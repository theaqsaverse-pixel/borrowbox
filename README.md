# BorrowBox - Community Tool & Equipment Lending Platform

> **Lend it. Borrow it. Track it.**
> A full-stack **PERN** (PostgreSQL · Express.js · React · Node.js) app where members lend tools and gadgets to each other with clear dates, clear responsibility and a clear record.

Built for the **U Devs Internship - Batch 6 (Full Stack FYP)**.

![Home](docs/screenshots/01-home.png)

---

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [How the booking engine works](#how-the-booking-engine-works)
4. [Project structure](#project-structure)
5. [Setup (step by step)](#setup-step-by-step)
6. [Demo accounts](#demo-accounts)
7. [Environment variables](#environment-variables)
8. [Scripts](#scripts)
9. [Running the tests](#running-the-tests)
10. [Database design](#database-design)
11. [Business rules](#business-rules)
12. [API reference](#api-reference)
13. [Screenshots](#screenshots)
14. [Troubleshooting](#troubleshooting)

---

## Features

| # | Module | What it does |
|---|--------|--------------|
| 1 | **Authentication & profile** | Register / log in with bcrypt-hashed passwords and JWT; protected routes; edit profile (name, phone, area); delete own account (soft delete, blocked while bookings are open); public profile page with **trust score** and reviews. |
| 2 | **Items** | Create, edit, activate / deactivate and delete items (title, description, category, condition, max lending days, pickup area, image by **URL or file upload**). "My Items" list for the owner. |
| 3 | **Browse & search** | Keyword search, category filter, condition filter, **"available between dates"** filter, sorting, pagination. All filters live in the URL so a search can be shared. |
| 4 | **Booking engine** | Borrow request with date range and message; **overlap check**; owner approves / rejects; borrower cancels; clashing pending requests are **auto-rejected on approval** (one DB transaction with a row lock). |
| 5 | **Handover & return** | Owner marks an item picked up and later returned; a **condition note is saved at each stage** (audit log); **overdue** bookings are flagged. |
| 6 | **Reviews & trust score** | After RETURNED both sides give a 1-5 rating and comment. The average rating (trust score) appears on profiles and item pages. |
| 7 | **Dashboard** | Three tabs - **My Items · My Borrowings · Incoming Requests** - with status badges and action buttons. |
| 8 | **Admin panel** | Platform statistics (users, items, bookings by status), user list with activate / deactivate, item removal, category add / rename / delete. |

**Full CRUD on every entity**, through both the API and the React UI, with a confirmation dialog before every delete:

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Users | Register | Own profile, public profile, admin list | Edit profile; admin activate / deactivate | Own account (soft delete, blocked while bookings are open) |
| Categories | Admin adds | Filters and item form | Admin renames | Blocked (409) if any item uses it |
| Items | Add item | Browse, search, detail, My Items | Edit; activate / deactivate | Only if it never had a booking, otherwise deactivated |
| Bookings | Send request | My Borrowings, Incoming, detail | Dates / message while REQUESTED; status actions | Only REJECTED or CANCELLED |
| Reviews | After RETURNED | Profile and item page | Own rating / comment | Own review (admin can too) |
| Condition logs | Auto-created at pickup / return | Inside booking detail | Read-only | Never deleted (audit record) |

**Bonus features included:** image upload with Multer · calendar-style date picker that greys out booked dates · API tests with Jest + Supertest (52 tests) · Docker Compose for PostgreSQL · rate limiting and security headers (Helmet).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL 14+ (tested on 16) |
| Backend | Node.js 20.19+, Express 4, `pg` (parameterised SQL only), bcryptjs, jsonwebtoken, Multer, Helmet, express-rate-limit |
| Frontend | React 19 (Vite), React Router, Axios, react-hot-toast, plain CSS (responsive) |
| Tests | Jest + Supertest |

## How the booking engine works

```
                 owner approves        owner marks          owner marks
   REQUESTED ───────────────► APPROVED ───────────► PICKED_UP ───────────► RETURNED
       │                         │                                              │
       │ owner rejects           │ borrower cancels                  both sides can review
       ▼                         ▼
   REJECTED                  CANCELLED        (REQUESTED can also be cancelled by the borrower)
```

* Only the transitions above are allowed - anything else returns **409 Conflict**.
* **The date-overlap query** (the heart of the project) is used when requesting, when editing, when approving and in the search filter:

```sql
SELECT 1 FROM bookings
 WHERE item_id = $1
   AND status IN ('APPROVED', 'PICKED_UP')
   AND start_date <= $3      -- existing booking starts before the new one ends
   AND end_date   >= $2;     -- and ends after the new one starts
-- a row returned = dates overlap = reject with 409 Conflict
```

* **Approval is one transaction:** lock the item row (`SELECT ... FOR UPDATE`) → lock the booking → re-check the overlap → set `APPROVED` → auto-reject every clashing `REQUESTED` booking → commit. Two owners' clicks can never double-book an item (there is an automated race test for this).
* **OVERDUE** is computed, never stored: `status = 'PICKED_UP' AND end_date < CURRENT_DATE`.
* **Trust score** is computed, never stored: `AVG(rating)` over reviews where `reviewee_id = user`.

## Project structure

```
borrowbox/
├── client/                    React app (Vite)
│   └── src/
│       ├── api/               axios instance (JWT interceptor) + API helper functions
│       ├── components/        Navbar, ItemCard, StatusBadge, BookingForm, AvailabilityCalendar, modals ...
│       ├── context/           AuthContext
│       ├── pages/             Home, ItemDetail, ItemForm, Dashboard, BookingDetail, Profile, Admin, Login, Register
│       ├── routes/            ProtectedRoute, AdminRoute
│       └── App.jsx
├── server/
│   ├── src/
│   │   ├── config/            db.js (pg Pool + transactions), env.js
│   │   ├── controllers/       auth, users, items, categories, bookings, reviews, admin
│   │   ├── middleware/        auth.js, role.js, validate.js, upload.js, errorHandler.js
│   │   ├── routes/            one file per module
│   │   ├── services/          bookingService.js  (business rules + status state machine)
│   │   ├── db/                schema.sql, seed.sql, setup.js
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/                 workflow.test.js (Jest + Supertest)
│   ├── uploads/               uploaded item images (git-ignored)
│   └── .env.example
├── docs/screenshots/
├── docker-compose.yml         optional PostgreSQL in Docker
├── package.json               root scripts (npm run dev starts API + React together)
├── README.md
└── .gitignore
```

## Setup (step by step)

### Prerequisites

* **Node.js 20.19 or newer** (22 LTS recommended) - check with `node -v`. Older versions cannot run the current Vite build tool.
* **PostgreSQL 14 or newer**, running locally - *or* Docker (see option B below)

### 1. Install dependencies

From the project root:

```bash
npm run install:all
```

(This runs `npm install` in the root, `server/` and `client/`.)

### 2. Create the environment file

```bash
# macOS / Linux
cp server/.env.example server/.env
# Windows (PowerShell)
Copy-Item server/.env.example server/.env
```

Open `server/.env` and set at least:

* `DATABASE_URL` - with **your** PostgreSQL password, e.g. `postgresql://postgres:mypassword@localhost:5432/borrowbox`
* `JWT_SECRET` - any long random string

### 3. Create the database

**Option A - PostgreSQL installed on your computer.** One command creates the `borrowbox` database if needed, then runs `schema.sql` and `seed.sql`:

```bash
npm run db:setup
```

> ⚠️ `schema.sql` starts with `DROP TABLE IF EXISTS ...` so it can be re-run safely during development. **Running it deletes existing data** - never run it against a live database.

You can also run the SQL files by hand with `psql`:

```bash
psql -U postgres -c "CREATE DATABASE borrowbox;"
psql -U postgres -d borrowbox -f server/src/db/schema.sql
psql -U postgres -d borrowbox -f server/src/db/seed.sql
```

**Option B - PostgreSQL in Docker:**

```bash
docker compose up -d
```

and use `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/borrowbox` in `server/.env`, then run `npm run db:setup`.

### 4. Start the app

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| React app | http://localhost:5173 |
| API | http://localhost:5000/api (health check: `/api/health`) |

In development Vite proxies `/api` and `/uploads` to the API, so no extra CORS setup is needed.
To run the two halves separately: `npm run dev:server` and `npm run dev:client`.

## Demo accounts

Created by `seed.sql`:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@borrowbox.com` | `Admin@123` |
| Member | `ali@example.com` | `Password@123` |
| Member | `sara@example.com` | `Password@123` |
| Member | `bilal@example.com` | `Password@123` |

The seed also contains 5 categories, 8 items, bookings in every stage (including one **overdue** booking), condition logs and reviews, so every screen has something to show.

Admins can only be created in the database - registering through the app always creates a `member`.

## Environment variables

`server/.env` (names only here - see `server/.env.example`):

| Variable | Purpose |
|----------|---------|
| `PORT` | API port (default 5000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `DB_SSL` | `true` for hosted databases that need SSL |
| `JWT_SECRET` | secret used to sign tokens (**required in production**) |
| `JWT_EXPIRES_IN` | token lifetime (default `7d`) |
| `CLIENT_URL` | allowed browser origin(s) for CORS |
| `TEST_DATABASE_URL` | optional separate database for tests |

`client/.env` (optional): `VITE_API_URL` - only needed when the API is on a different origin than the React app.

## Scripts

| Command (from the project root) | What it does |
|---------------------------------|--------------|
| `npm run install:all` | install root, server and client dependencies |
| `npm run db:setup` | create the database (if missing), run `schema.sql` + `seed.sql` |
| `npm run dev` | start API (nodemon) and React (Vite) together |
| `npm run build` | production build of the React app (`client/dist`) |
| `npm test` | run the API test suite |

## Running the tests

```bash
npm test
```

The suite creates and wipes a **separate** database named `<your database>_test`, so your development data is never touched. It walks through the **11-step end-to-end workflow** from the brief and checks every business rule: own-item, past dates, max days, overlap, inactive items, max 3 open bookings, role checks, invalid status moves (409), auto-reject on approval, a **concurrent-approval race test**, reviews (one per person per booking), the delete rules, soft-deleted accounts and the admin endpoints - 52 tests in total.

## Database design

Six tables (full script in [`server/src/db/schema.sql`](server/src/db/schema.sql)):

```
users 1──N items N──1 categories
users 1──N bookings (as borrower)      items 1──N bookings
bookings 1──N condition_logs (max 2)   bookings 1──N reviews (max 2, one per side)
```

| Table | Key constraints |
|-------|-----------------|
| `users` | `email UNIQUE`; `role IN ('member','admin')`; `is_active` default true; `deleted_at` for soft delete |
| `categories` | `name UNIQUE` |
| `items` | FKs to owner and category; `condition IN ('new','good','fair')`; `max_days > 0` |
| `bookings` | FKs to item and borrower; `status IN (6 values)`; `CHECK (end_date >= start_date)`; **index on `(item_id, status)`** |
| `condition_logs` | `stage IN ('handover','return')`; `UNIQUE (booking_id, stage)` |
| `reviews` | `rating CHECK 1-5`; `UNIQUE (booking_id, reviewer_id)`; reviewer ≠ reviewee |

## Business rules

| # | Rule | Enforced in |
|---|------|-------------|
| 1 | A member cannot borrow their own item | API |
| 2 | `start_date` not in the past; `end_date` on or after `start_date` | API + DB `CHECK` |
| 3 | Duration must not exceed the item's `max_days` | API |
| 4 | Dates must not overlap an APPROVED or PICKED_UP booking | API (SQL query) |
| 5 | Only active items owned by active users can be requested | API |
| 6 | At most 3 open bookings (REQUESTED, APPROVED, PICKED_UP) per borrower | API |
| 7 | Only the owner can approve / reject / pick up / return; only the borrower can cancel | Service layer |
| 8 | Status moves only in the allowed order - otherwise **409** | Service layer |
| 9 | Approving auto-rejects overlapping pending requests, inside one transaction | DB transaction |
| 10 | Reviews only after RETURNED, one per person per booking, rating 1-5 | DB `UNIQUE` + API |
| 11 | Item with open bookings cannot be deleted; with history it is only deactivated; never booked → deleted | API |
| 12 | Booking editable only while REQUESTED, deletable only when REJECTED / CANCELLED; category in use cannot be deleted | API (409) |
| 13 | Only the author (or an admin) can edit / delete a review; only the owner can edit / delete their profile | Service layer |

## API reference

All responses use the envelope `{ success, data, message }` (list endpoints add `meta` for pagination; errors add `errors` with field messages).
Status codes: **400** validation · **401** not logged in · **403** not allowed · **404** not found · **409** date overlap / invalid status change / conflict.
Protected endpoints need the header `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/auth/register` | Public | Create account; hash password; return user and token |
| POST | `/api/auth/login` | Public | Verify credentials; return JWT |
| GET | `/api/auth/me` | Member | Logged-in user's profile |
| PUT | `/api/users/me` | Member | Update name, phone, area |
| DELETE | `/api/users/me` | Member | Delete own account (soft delete; blocked while bookings are open) |
| GET | `/api/users/:id` | Public | Public profile with trust score and reviews |
| GET | `/api/categories` | Public | List categories |
| POST | `/api/categories` | Admin | Add a category |
| PUT | `/api/categories/:id` | Admin | Rename a category |
| DELETE | `/api/categories/:id` | Admin | Delete a category (409 if items use it) |
| GET | `/api/items` | Public | Search and filter: `?search=&category=&condition=&from=&to=&sort=&page=&limit=` |
| GET | `/api/items/mine` | Member | Items listed by me |
| GET | `/api/items/:id` | Public | Item details with owner info, rating and reviews |
| GET | `/api/items/:id/availability` | Public | Booked date ranges of the item |
| POST | `/api/items` | Member | Create item (JSON, or `multipart/form-data` with an `image` file) |
| PUT | `/api/items/:id` | Owner | Edit or deactivate item |
| DELETE | `/api/items/:id` | Owner / Admin | Delete if it never had a booking; otherwise deactivate |
| POST | `/api/bookings` | Member | Create request (runs all business rules) |
| GET | `/api/bookings/mine` | Borrower | My borrowings |
| GET | `/api/bookings/incoming` | Owner | Requests received on my items |
| GET | `/api/bookings/:id` | Borrower / Owner | Booking details with condition logs and reviews |
| PUT | `/api/bookings/:id` | Borrower | Edit dates or message while REQUESTED |
| DELETE | `/api/bookings/:id` | Borrower / Admin | Remove a REJECTED or CANCELLED booking |
| PATCH | `/api/bookings/:id/status` | Owner / Borrower | Body: `action` = `approve` \| `reject` \| `cancel` \| `pickup` \| `return`, plus optional `note`, `reason`, `condition` |
| POST | `/api/bookings/:id/reviews` | Member | Rating and comment after RETURNED |
| PUT | `/api/reviews/:id` | Reviewer | Edit own rating or comment |
| DELETE | `/api/reviews/:id` | Reviewer / Admin | Delete a review |
| GET | `/api/admin/stats` | Admin | Totals of users, items and bookings by status |
| GET | `/api/admin/users` | Admin | List all users (`?search=`) |
| PATCH | `/api/admin/users/:id/status` | Admin | Activate or deactivate a user (`{ "is_active": true }`) |
| GET | `/api/admin/items` | Admin | List every item (used by the admin panel's item removal) |

**Security notes:** passwords are hashed with bcrypt · every SQL query is parameterised (`$1, $2 …`) · JWT checked on every protected request and the user is re-loaded, so deactivated users are locked out immediately · role middleware for admin routes · input validation on every write · Helmet headers · login / register rate limiting · uploads limited to 2 MB images.

## Screenshots

| | |
|---|---|
| **Search with free-dates filter** ![](docs/screenshots/02-search.png) | **Item detail & booking calendar** ![](docs/screenshots/03-item-detail.png) |
| **Dashboard - My Borrowings** ![](docs/screenshots/04-dashboard-borrowings.png) | **Dashboard - Incoming Requests** ![](docs/screenshots/05-dashboard-incoming.png) |
| **Booking detail with condition log** ![](docs/screenshots/06-booking-detail.png) | **Public profile & trust score** ![](docs/screenshots/07-profile.png) |
| **Dashboard - My Items** ![](docs/screenshots/08-dashboard-items.png) | **Admin - statistics** ![](docs/screenshots/09-admin-stats.png) |
| **Admin - users** ![](docs/screenshots/10-admin-users.png) | **Admin - categories** ![](docs/screenshots/11-admin-categories.png) |

Mobile layout:

<img src="docs/screenshots/12-mobile-home.png" alt="Mobile home" width="280" />

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ECONNREFUSED` / "Could not connect to PostgreSQL" | PostgreSQL is not running, or the host / port in `DATABASE_URL` is wrong. |
| `password authentication failed` (error 28P01) | The password in `DATABASE_URL` is not your PostgreSQL password. |
| `npm run db:setup` cannot create the database | Create it yourself (`CREATE DATABASE borrowbox;`) and run `db:setup` again. |
| Login page says "Cannot reach the server" | The API is not running - use `npm run dev` from the project root. |
| Port 5000 already in use | Change `PORT` in `server/.env` **and** the proxy target in `client/vite.config.js`. |
| Hosted database (Neon / Render) | Set `DB_SSL=true` and paste the provided connection string into `DATABASE_URL`. |

---

Made for **U Devs Internship - Batch 6**. Questions: hr@udevs.company
