-- Event Booking System - Database Schema
-- Run this file to set up the database: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS event_booking;
USE event_booking;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  date DATETIME NOT NULL,
  total_capacity INT NOT NULL CHECK (total_capacity > 0),
  remaining_tickets INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_remaining CHECK (remaining_tickets >= 0),
  CONSTRAINT chk_remaining_lte_total CHECK (remaining_tickets <= total_capacity)
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmation_code VARCHAR(20) NOT NULL UNIQUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Event Attendance table
CREATE TABLE IF NOT EXISTS event_attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  event_id INT NOT NULL,
  entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  confirmation_code VARCHAR(20) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (confirmation_code) REFERENCES bookings(confirmation_code)
);

-- Seed some sample data
INSERT INTO users (name, email) VALUES
  ('Alice Johnson', 'alice@example.com'),
  ('Bob Smith', 'bob@example.com');

INSERT INTO events (title, description, date, total_capacity, remaining_tickets) VALUES
  ('Node.js Workshop', 'An intro to Node.js and Express', '2025-08-15 10:00:00', 50, 50),
  ('MySQL Deep Dive', 'Advanced MySQL techniques', '2025-09-01 14:00:00', 30, 30);
