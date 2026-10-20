-- =====================================================================
-- BorrowBox - sample data  (run after schema.sql: npm run db:setup)
--
-- Demo logins
--   Admin  : admin@borrowbox.com  /  Admin@123
--   Members: ali@example.com, sara@example.com, bilal@example.com  /  Password@123
--
-- Dates are relative to today, so the data always looks current.
-- =====================================================================

-- ---------------- users (passwords are bcrypt hashes) ----------------
INSERT INTO users (id, name, email, password_hash, phone, area, role) VALUES
  (1, 'BorrowBox Admin', 'admin@borrowbox.com', '$2a$10$dLxdPzmfYWAnN/w21WKwRuKbyKenCwyvrvHcIrXYjqJocbq9wCsry', NULL,          'Head Office',  'admin'),
  (2, 'Ali Raza',        'ali@example.com',     '$2a$10$oSSI7.dA6iCauM6NnasH3eSUdV/PCpo8xG.EsqdckZVZdKYSrI2Ly', '0300-1111111', 'Block B',      'member'),
  (3, 'Sara Khan',       'sara@example.com',    '$2a$10$oSSI7.dA6iCauM6NnasH3eSUdV/PCpo8xG.EsqdckZVZdKYSrI2Ly', '0300-2222222', 'Library Block','member'),
  (4, 'Bilal Ahmed',     'bilal@example.com',   '$2a$10$oSSI7.dA6iCauM6NnasH3eSUdV/PCpo8xG.EsqdckZVZdKYSrI2Ly', '0300-3333333', 'Hostel Road',  'member');

-- ---------------- categories ----------------
INSERT INTO categories (id, name) VALUES
  (1, 'Power Tools'),
  (2, 'Home & Garden'),
  (3, 'Electronics'),
  (4, 'Kitchen'),
  (5, 'Sports & Outdoor');

-- ---------------- items ----------------
INSERT INTO items (id, owner_id, category_id, title, description, condition, max_days, pickup_area) VALUES
  (1, 2, 1, 'Cordless Drill 18V',
      '18V cordless drill with two batteries, charger and a set of bits. Please return it charged and clean. Pickup by prior arrangement.',
      'good', 5, 'Block B'),
  (2, 2, 2, 'Extension Ladder',
      '3-section aluminium extension ladder, reaches about 4 metres. Handle with care and return it dry.',
      'good', 3, 'Block B'),
  (3, 4, 3, 'HD Projector',
      '1080p projector with HDMI cable and a small tripod screen. Great for movie nights and presentations.',
      'new', 7, 'Hostel Road'),
  (4, 3, 3, 'DSLR Camera Kit',
      'Entry-level DSLR with 18-55mm lens, spare battery, 32GB card and a camera bag.',
      'good', 4, 'Library Block'),
  (5, 4, 5, 'Camping Tent (4P)',
      'Waterproof 4-person dome tent with pegs and carry bag. Easy 10-minute setup.',
      'fair', 6, 'Hostel Road'),
  (6, 3, 3, 'Bluetooth Speaker',
      'Portable waterproof Bluetooth speaker, around 12 hours of battery life.',
      'good', 3, 'Library Block'),
  (7, 3, 4, 'Pressure Cooker 6L',
      'Stainless steel 6-litre pressure cooker, ideal for big family meals.',
      'good', 3, 'Library Block'),
  (8, 2, 2, 'Hedge Trimmer',
      'Electric hedge trimmer with 50cm blade. Extension cord not included.',
      'fair', 2, 'Block B');

-- item photos
UPDATE items SET image_url = '/items/drill.jpg'     WHERE id = 1;
UPDATE items SET image_url = '/items/ladder.jpg'    WHERE id = 2;
UPDATE items SET image_url = '/items/projector.jpg' WHERE id = 3;
UPDATE items SET image_url = '/items/camera.jpg'    WHERE id = 4;
UPDATE items SET image_url = '/items/tent.jpg'      WHERE id = 5;
UPDATE items SET image_url = '/items/speaker.jpg'   WHERE id = 6;
UPDATE items SET image_url = '/items/cooker.jpg'    WHERE id = 7;
UPDATE items SET image_url = '/items/trimmer.jpg'   WHERE id = 8;
-- ---------------- bookings ----------------
INSERT INTO bookings (id, item_id, borrower_id, start_date, end_date, status, message, reject_reason, created_at, updated_at) VALUES
  -- finished loans (reviews + condition logs below)
  (1, 1, 3, CURRENT_DATE - 14, CURRENT_DATE - 12, 'RETURNED',  'Need the drill for a small repair this weekend.', NULL,
      NOW() - INTERVAL '16 days', NOW() - INTERVAL '12 days'),
  (2, 2, 4, CURRENT_DATE - 10, CURRENT_DATE - 9,  'RETURNED',  'Painting the hostel room, need the ladder for a day.', NULL,
      NOW() - INTERVAL '12 days', NOW() - INTERVAL '9 days'),
  -- open loans in different stages
  (3, 3, 3, CURRENT_DATE + 5,  CURRENT_DATE + 6,  'REQUESTED', 'Society movie night - will return it the next morning.', NULL,
      NOW() - INTERVAL '1 day',  NOW() - INTERVAL '1 day'),
  (4, 4, 2, CURRENT_DATE + 3,  CURRENT_DATE + 5,  'APPROVED',  'Photographing a family event.', NULL,
      NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
  (5, 6, 4, CURRENT_DATE + 2,  CURRENT_DATE + 3,  'REJECTED',  'Small get-together on the roof.', 'Already promised to a friend that weekend.',
      NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days'),
  -- picked up and past its end date -> shows the OVERDUE flag
  (6, 5, 2, CURRENT_DATE - 3,  CURRENT_DATE - 1,  'PICKED_UP', 'Weekend camping trip with friends.', NULL,
      NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days');

-- ---------------- condition_logs ----------------
INSERT INTO condition_logs (booking_id, stage, condition, note, logged_by, logged_at) VALUES
  (1, 'handover', 'good', 'Good, one scratch on the handle.',         2, NOW() - INTERVAL '14 days'),
  (1, 'return',   'good', 'Returned clean and fully charged.',        2, NOW() - INTERVAL '12 days'),
  (2, 'handover', 'good', 'Ladder in good shape, rubber feet intact.',2, NOW() - INTERVAL '10 days'),
  (2, 'return',   'good', 'Returned with a bit of paint on one rung.',2, NOW() - INTERVAL '9 days'),
  (6, 'handover', 'fair', 'Tent already has a small patch on the floor.', 4, NOW() - INTERVAL '3 days');

-- ---------------- reviews ----------------
INSERT INTO reviews (booking_id, reviewer_id, reviewee_id, rating, comment, created_at) VALUES
  (1, 3, 2, 5, 'Ali was very helpful and the drill worked perfectly.', NOW() - INTERVAL '12 days'),
  (1, 2, 3, 5, 'Sara returned everything on time and in great condition.', NOW() - INTERVAL '12 days'),
  (2, 4, 2, 4, 'Smooth handover. The ladder is a bit heavy but sturdy.', NOW() - INTERVAL '9 days'),
  (2, 2, 4, 5, 'Bilal was polite and punctual.', NOW() - INTERVAL '9 days');

-- keep the SERIAL sequences in sync with the explicit ids used above
SELECT setval(pg_get_serial_sequence('users',      'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories));
SELECT setval(pg_get_serial_sequence('items',      'id'), (SELECT MAX(id) FROM items));
SELECT setval(pg_get_serial_sequence('bookings',   'id'), (SELECT MAX(id) FROM bookings));
