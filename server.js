require('dotenv').config();
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const crypto = require('crypto');
const pool = require('./db');

const app = express();
app.use(express.json());

// ─── Helper: generate unique confirmation code ───────────────────────────────
function generateCode() {
  return crypto.randomBytes(5).toString('hex').toUpperCase(); // e.g. "A3F9C12E1B"
}

// ─── Helper: send validation errors ─────────────────────────────────────────
function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// GET /events — List all upcoming events
// ────────────────────────────────────────────────────────────────────────────
app.get('/events', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM events WHERE date > NOW() ORDER BY date ASC'
    );
    res.json({ events: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /events — Create a new event
// ────────────────────────────────────────────────────────────────────────────
app.post(
  '/events',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('date').isISO8601().withMessage('Date must be a valid ISO 8601 datetime'),
    body('capacity').isInt({ min: 1 }).withMessage('Capacity must be a positive integer'),
    body('description').optional().trim(),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { title, description = '', date, capacity } = req.body;

    try {
      const [result] = await pool.query(
        'INSERT INTO events (title, description, date, total_capacity, remaining_tickets) VALUES (?, ?, ?, ?, ?)',
        [title, description, date, capacity, capacity]
      );
      res.status(201).json({
        message: 'Event created successfully',
        eventId: result.insertId,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// POST /bookings — Book a ticket for a user
// ────────────────────────────────────────────────────────────────────────────
app.post(
  '/bookings',
  [
    body('user_id').isInt({ min: 1 }).withMessage('user_id must be a positive integer'),
    body('event_id').isInt({ min: 1 }).withMessage('event_id must be a positive integer'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { user_id, event_id } = req.body;
    const conn = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // Lock the event row to prevent race conditions
      const [events] = await conn.query(
        'SELECT * FROM events WHERE id = ? FOR UPDATE',
        [event_id]
      );

      if (events.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Event not found' });
      }

      const event = events[0];

      if (event.remaining_tickets <= 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'No tickets remaining for this event' });
      }

      // Check user exists
      const [users] = await conn.query('SELECT id FROM users WHERE id = ?', [user_id]);
      if (users.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'User not found' });
      }

      // Prevent duplicate booking
      const [existing] = await conn.query(
        'SELECT id FROM bookings WHERE user_id = ? AND event_id = ?',
        [user_id, event_id]
      );
      if (existing.length > 0) {
        await conn.rollback();
        return res.status(409).json({ error: 'User has already booked this event' });
      }

      const confirmationCode = generateCode();

      // Deduct ticket
      await conn.query(
        'UPDATE events SET remaining_tickets = remaining_tickets - 1 WHERE id = ?',
        [event_id]
      );

      // Insert booking
      await conn.query(
        'INSERT INTO bookings (user_id, event_id, confirmation_code) VALUES (?, ?, ?)',
        [user_id, event_id, confirmationCode]
      );

      await conn.commit();

      res.status(201).json({
        message: 'Booking confirmed',
        confirmation_code: confirmationCode,
      });
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      conn.release();
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// GET /users/:id/bookings — Get all bookings for a user
// ────────────────────────────────────────────────────────────────────────────
app.get(
  '/users/:id/bookings',
  [param('id').isInt({ min: 1 }).withMessage('User ID must be a positive integer')],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const { id } = req.params;

    try {
      // Check user exists
      const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const [bookings] = await pool.query(
        `SELECT b.id, b.confirmation_code, b.booking_date,
                e.title, e.date, e.description
         FROM bookings b
         JOIN events e ON b.event_id = e.id
         WHERE b.user_id = ?
         ORDER BY b.booking_date DESC`,
        [id]
      );

      res.json({ user_id: parseInt(id), bookings });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// POST /events/:id/attendance — Record attendance using confirmation code
// ────────────────────────────────────────────────────────────────────────────
app.post(
  '/events/:id/attendance',
  [
    param('id').isInt({ min: 1 }).withMessage('Event ID must be a positive integer'),
    body('confirmation_code').trim().notEmpty().withMessage('confirmation_code is required'),
  ],
  async (req, res) => {
    if (handleValidation(req, res)) return;

    const event_id = parseInt(req.params.id);
    const { confirmation_code } = req.body;

    try {
      // Find the booking by code
      const [bookings] = await pool.query(
        'SELECT * FROM bookings WHERE confirmation_code = ? AND event_id = ?',
        [confirmation_code, event_id]
      );

      if (bookings.length === 0) {
        return res.status(404).json({ error: 'Invalid confirmation code for this event' });
      }

      const booking = bookings[0];

      // Record attendance
      await pool.query(
        'INSERT INTO event_attendance (user_id, event_id, confirmation_code) VALUES (?, ?, ?)',
        [booking.user_id, event_id, confirmation_code]
      );

      // Return how many tickets are booked for this event
      const [[{ total_booked }]] = await pool.query(
        'SELECT COUNT(*) AS total_booked FROM bookings WHERE event_id = ?',
        [event_id]
      );

      res.status(201).json({
        message: 'Attendance recorded',
        event_id,
        total_tickets_booked: total_booked,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// ─── Start server ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
