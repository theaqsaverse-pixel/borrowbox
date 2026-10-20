-- =====================================================================
-- BorrowBox - PostgreSQL schema (6 tables)
-- Run with:  npm run db:setup   (from the server folder)
-- NOTE: the DROP statements below make this script safe to re-run in
-- development. They DELETE existing data - do not run on a live database.
-- =====================================================================

DROP TABLE IF EXISTS reviews         CASCADE;
DROP TABLE IF EXISTS condition_logs  CASCADE;
DROP TABLE IF EXISTS bookings        CASCADE;
DROP TABLE IF EXISTS items           CASCADE;
DROP TABLE IF EXISTS categories      CASCADE;
DROP TABLE IF EXISTS users           CASCADE;

-- ---------------------------------------------------------------------
-- 1. users
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  phone         VARCHAR(30),
  area          VARCHAR(120),
  role          VARCHAR(10)  NOT NULL DEFAULT 'member'
                CHECK (role IN ('member', 'admin')),
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  deleted_at    TIMESTAMP,                       -- set when a user deletes their own account (soft delete)
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------
-- 2. categories
-- ---------------------------------------------------------------------
CREATE TABLE categories (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL UNIQUE
);

-- ---------------------------------------------------------------------
-- 3. items
-- ---------------------------------------------------------------------
CREATE TABLE items (
  id          SERIAL PRIMARY KEY,
  owner_id    INT          NOT NULL REFERENCES users(id),
  category_id INT          NOT NULL REFERENCES categories(id),
  title       VARCHAR(120) NOT NULL,
  description TEXT,
  condition   VARCHAR(10)  NOT NULL DEFAULT 'good'
              CHECK (condition IN ('new', 'good', 'fair')),
  max_days    INT          NOT NULL CHECK (max_days > 0),
  pickup_area VARCHAR(120),
  image_url   VARCHAR(500),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_items_owner    ON items (owner_id);
CREATE INDEX idx_items_category ON items (category_id);
CREATE INDEX idx_items_created  ON items (created_at DESC);

-- ---------------------------------------------------------------------
-- 4. bookings
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
  id            SERIAL PRIMARY KEY,
  item_id       INT         NOT NULL REFERENCES items(id),
  borrower_id   INT         NOT NULL REFERENCES users(id),
  start_date    DATE        NOT NULL,
  end_date      DATE        NOT NULL,
  status        VARCHAR(12) NOT NULL DEFAULT 'REQUESTED'
                CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED',
                                  'CANCELLED', 'PICKED_UP', 'RETURNED')),
  message       TEXT,
  reject_reason TEXT,
  created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

-- speeds up the date-overlap query and status filters
CREATE INDEX idx_bookings_item_status ON bookings (item_id, status);
CREATE INDEX idx_bookings_borrower    ON bookings (borrower_id, status);

-- ---------------------------------------------------------------------
-- 5. condition_logs  (audit record: created automatically, never edited/deleted)
-- ---------------------------------------------------------------------
CREATE TABLE condition_logs (
  id         SERIAL PRIMARY KEY,
  booking_id INT         NOT NULL REFERENCES bookings(id),
  stage      VARCHAR(10) NOT NULL CHECK (stage IN ('handover', 'return')),
  condition  VARCHAR(10) NOT NULL CHECK (condition IN ('new', 'good', 'fair')),
  note       TEXT,
  logged_by  INT         NOT NULL REFERENCES users(id),
  logged_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, stage)
);

-- ---------------------------------------------------------------------
-- 6. reviews  (trust score = AVG(rating) per reviewee, calculated - not stored)
-- ---------------------------------------------------------------------
CREATE TABLE reviews (
  id          SERIAL PRIMARY KEY,
  booking_id  INT       NOT NULL REFERENCES bookings(id),
  reviewer_id INT       NOT NULL REFERENCES users(id),
  reviewee_id INT       NOT NULL REFERENCES users(id),
  rating      INT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, reviewer_id),
  CHECK (reviewer_id <> reviewee_id)
);

CREATE INDEX idx_reviews_reviewee ON reviews (reviewee_id);
