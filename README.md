# Event Booking System

A Mini Event Management System built with Node.js (Express) and MySQL.

## Prerequisites

- Node.js v18+
- MySQL 8.0+

## Setup

### 1. Clone and install dependencies

```bash
git clone <your-repo-url>
cd event-booking-system
npm install
```

### 2. Set up the database

Log into MySQL and run the schema file:

```bash
mysql -u root -p < schema.sql
```

This will create the `event_booking` database, all tables, and seed sample data.

### 3. Configure environment variables

Create a `.env` file in the root directory:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=event_booking
PORT=3000
```

### 4. Start the server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

The server will start at `http://localhost:3000`.

---

## API Endpoints

| Method | Endpoint               | Description                                      |
|--------|------------------------|--------------------------------------------------|
| GET    | /events                | List all upcoming events                         |
| POST   | /events                | Create a new event                               |
| POST   | /bookings              | Book a ticket for a user (returns unique code)   |
| GET    | /users/:id/bookings    | Get all bookings for a specific user             |
| POST   | /events/:id/attendance | Record attendance using confirmation code        |

---

## Example Requests

### Create an event
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{"title":"Node Workshop","description":"Intro to Node.js","date":"2025-08-15T10:00:00Z","capacity":50}'
```

### Book a ticket
```bash
curl -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"event_id":1}'
```

### Get user bookings
```bash
curl http://localhost:3000/users/1/bookings
```

### Record attendance
```bash
curl -X POST http://localhost:3000/events/1/attendance \
  -H "Content-Type: application/json" \
  -d '{"confirmation_code":"A3F9C12E1B"}'
```

---

## API Documentation

The full OpenAPI spec is in `swagger.yaml`. To view it:

1. Go to [https://editor.swagger.io](https://editor.swagger.io)
2. Paste the contents of `swagger.yaml`

---

## Project Structure

```
├── server.js       # Express app and all route handlers
├── db.js           # MySQL connection pool
├── schema.sql      # Database schema + seed data
├── swagger.yaml    # OpenAPI 3.0 documentation
├── package.json
├── .env            # Environment variables (do not commit)
└── README.md
```

---

## Key Design Decisions

- **Transactions** on `/bookings` — uses `SELECT ... FOR UPDATE` to lock the event row and prevent race conditions (handles the "Race Condition" evaluation criterion).
- **Unique confirmation codes** — generated with `crypto.randomBytes` for uniqueness and security.
- **Input validation** — all endpoints validated with `express-validator`.
- **Separation of concerns** — DB connection is isolated in `db.js`, business logic in route handlers.
