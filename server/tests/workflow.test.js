/**
 * End-to-end API test: the 11-step workflow from Section 07 of the brief,
 * plus the business rules from Section 05 and the CRUD delete rules.
 *
 * Runs against a SEPARATE database ("<your db>_test"), which is created and
 * wiped automatically - your development data is never touched.
 *
 *   npm test
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.NODE_ENV = 'test';
if (!process.env.TEST_DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/borrowbox');
  url.pathname = `${url.pathname}_test`;
  process.env.TEST_DATABASE_URL = url.toString();
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { setup } = require('../src/db/setup');
const app = require('../src/app');
const { pool } = require('../src/config/db');

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

// local calendar date `n` days from today, as YYYY-MM-DD
const day = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ctx = {}; // shared state between the ordered tests below

async function register(name, email) {
  const res = await api().post('/api/auth/register').send({ name, email, password: 'secret123', area: 'Block B' });
  expect(res.status).toBe(201);
  return { id: res.body.data.user.id, token: res.body.data.token };
}

beforeAll(async () => {
  await setup({ withSeed: false, databaseUrl: process.env.TEST_DATABASE_URL });

  // admins can only be created in the database
  const hash = await bcrypt.hash('Admin@123', 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', 'admin@test.com', $1, 'admin') RETURNING id`,
    [hash]
  );
  ctx.adminId = rows[0].id;
});

afterAll(async () => {
  await pool.end();
});

describe('Step 1 - Register & login', () => {
  test('register hashes the password, returns user + token, never the hash', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ali', email: 'Ali@Test.com', password: 'secret123', phone: '0300', area: 'Block B' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe('ali@test.com');
    expect(res.body.data.user.role).toBe('member');
    expect(res.body.data.user.password_hash).toBeUndefined();
    ctx.ali = { id: res.body.data.user.id, token: res.body.data.token };

    const { rows } = await pool.query('SELECT password_hash FROM users WHERE id = $1', [ctx.ali.id]);
    expect(rows[0].password_hash).not.toBe('secret123');
    expect(rows[0].password_hash.startsWith('$2')).toBe(true); // bcrypt
  });

  test('registering cannot create an admin', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: 'sneaky@test.com', password: 'secret123', role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('member');
  });

  test('validation (400) and duplicate email (409)', async () => {
    expect((await api().post('/api/auth/register').send({ name: 'X', email: 'bad', password: '1' })).status).toBe(400);
    const dup = await api().post('/api/auth/register').send({ name: 'Ali 2', email: 'ali@test.com', password: 'secret123' });
    expect(dup.status).toBe(409);
  });

  test('login success, wrong password 401, /auth/me needs a token', async () => {
    const ok = await api().post('/api/auth/login').send({ email: 'ali@test.com', password: 'secret123' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.token).toBeTruthy();

    expect((await api().post('/api/auth/login').send({ email: 'ali@test.com', password: 'wrong-pass' })).status).toBe(401);
    expect((await api().get('/api/auth/me')).status).toBe(401);

    const me = await api().get('/api/auth/me').set(auth(ctx.ali.token));
    expect(me.status).toBe(200);
    expect(me.body.data.user.name).toBe('Ali');
  });

  test('other members for later steps', async () => {
    ctx.sara = await register('Sara', 'sara@test.com');
    ctx.bilal = await register('Bilal', 'bilal@test.com');
    const adminLogin = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@123' });
    expect(adminLogin.status).toBe(200);
    ctx.admin = { id: ctx.adminId, token: adminLogin.body.data.token };
  });
});

describe('Categories (admin CRUD)', () => {
  test('only an admin can add; duplicates are rejected', async () => {
    expect((await api().post('/api/categories').set(auth(ctx.ali.token)).send({ name: 'Power Tools' })).status).toBe(403);
    expect((await api().post('/api/categories').send({ name: 'Power Tools' })).status).toBe(401);

    const res = await api().post('/api/categories').set(auth(ctx.admin.token)).send({ name: 'Power Tools' });
    expect(res.status).toBe(201);
    ctx.catTools = res.body.data.id;

    expect((await api().post('/api/categories').set(auth(ctx.admin.token)).send({ name: 'power tools' })).status).toBe(409);

    ctx.catTemp = (await api().post('/api/categories').set(auth(ctx.admin.token)).send({ name: 'Temp' })).body.data.id;
  });

  test('rename + list + delete unused', async () => {
    const ren = await api().put(`/api/categories/${ctx.catTemp}`).set(auth(ctx.admin.token)).send({ name: 'Temporary' });
    expect(ren.status).toBe(200);
    expect(ren.body.data.name).toBe('Temporary');

    const list = await api().get('/api/categories');
    expect(list.body.data.map((c) => c.name)).toEqual(expect.arrayContaining(['Power Tools', 'Temporary']));

    expect((await api().delete(`/api/categories/${ctx.catTemp}`).set(auth(ctx.admin.token))).status).toBe(200);
    expect((await api().delete(`/api/categories/${ctx.catTemp}`).set(auth(ctx.admin.token))).status).toBe(404);
  });
});

describe('Step 2 - List an item', () => {
  test('Ali lists a Cordless Drill', async () => {
    const res = await api()
      .post('/api/items')
      .set(auth(ctx.ali.token))
      .send({
        title: 'Cordless Drill',
        description: '18V drill with two batteries',
        category_id: ctx.catTools,
        condition: 'good',
        max_days: 5,
        pickup_area: 'Block B',
      });
    expect(res.status).toBe(201);
    expect(res.body.data.owner_id).toBe(ctx.ali.id);
    ctx.drill = res.body.data.id;
  });

  test('validation, auth and category checks', async () => {
    const base = { title: 'Ladder', category_id: ctx.catTools, max_days: 3 };
    expect((await api().post('/api/items').send(base)).status).toBe(401);
    expect((await api().post('/api/items').set(auth(ctx.ali.token)).send({ ...base, max_days: 0 })).status).toBe(400);
    expect((await api().post('/api/items').set(auth(ctx.ali.token)).send({ ...base, condition: 'broken' })).status).toBe(400);
    expect((await api().post('/api/items').set(auth(ctx.ali.token)).send({ ...base, category_id: 9999 })).status).toBe(400);
    expect((await api().post('/api/items').set(auth(ctx.ali.token)).send({ ...base, image_url: 'javascript:alert(1)' })).status).toBe(400);
  });

  test('My Items lists only my items (route defined before /:id)', async () => {
    const mine = await api().get('/api/items/mine').set(auth(ctx.ali.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].booking_count).toBe(0);
    expect((await api().get('/api/items/mine').set(auth(ctx.sara.token))).body.data).toHaveLength(0);
  });
});

describe('Step 3 - Search with the "available between dates" filter', () => {
  test('keyword, category and pagination', async () => {
    const byKeyword = await api().get('/api/items?search=drill');
    expect(byKeyword.body.data).toHaveLength(1);
    expect(byKeyword.body.meta).toMatchObject({ page: 1, total: 1, totalPages: 1 });

    expect((await api().get('/api/items?search=nothingmatches')).body.data).toHaveLength(0);
    expect((await api().get(`/api/items?category=${ctx.catTools}`)).body.data).toHaveLength(1);
    expect((await api().get('/api/items?search=100%25')).body.data).toHaveLength(0); // % is escaped, not a wildcard
    expect((await api().get('/api/items?from=2026-13-40&to=2026-13-41')).status).toBe(400);
    expect((await api().get('/api/items?from=2026-10-10&to=2026-10-01')).status).toBe(400);
  });
});

describe('Step 4/5 - Availability and booking requests (business rules)', () => {
  test('availability is empty at first', async () => {
    const res = await api().get(`/api/items/${ctx.drill}/availability`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('Sara requests the drill -> REQUESTED', async () => {
    const res = await api()
      .post('/api/bookings')
      .set(auth(ctx.sara.token))
      .send({ item_id: ctx.drill, start_date: day(3), end_date: day(5), message: 'Need it for a repair' });
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('REQUESTED');
    expect(res.body.data.days).toBe(3);
    ctx.bookingSara = res.body.data.id;
  });

  test('rule 1: cannot borrow own item (403)', async () => {
    const res = await api()
      .post('/api/bookings')
      .set(auth(ctx.ali.token))
      .send({ item_id: ctx.drill, start_date: day(3), end_date: day(4) });
    expect(res.status).toBe(403);
  });

  test('rule 2: start in the past / end before start (400)', async () => {
    const past = await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: ctx.drill, start_date: day(-2), end_date: day(1) });
    expect(past.status).toBe(400);
    const reversed = await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: ctx.drill, start_date: day(8), end_date: day(6) });
    expect(reversed.status).toBe(400);
  });

  test('rule 3: duration over max_days (400)', async () => {
    const res = await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: ctx.drill, start_date: day(10), end_date: day(16) });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at most 5/);
  });

  test('unknown item (404), unauthenticated (401), bad body (400)', async () => {
    expect((await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: 99999, start_date: day(3), end_date: day(4) })).status).toBe(404);
    expect((await api().post('/api/bookings').send({ item_id: ctx.drill, start_date: day(3), end_date: day(4) })).status).toBe(401);
    expect((await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: ctx.drill })).status).toBe(400);
  });

  test('a clashing REQUESTED booking is still allowed (only APPROVED / PICKED_UP block dates)', async () => {
    const res = await api()
      .post('/api/bookings')
      .set(auth(ctx.bilal.token))
      .send({ item_id: ctx.drill, start_date: day(4), end_date: day(6), message: 'Me too' });
    expect(res.status).toBe(201);
    ctx.bookingBilal = res.body.data.id;
  });
});

describe('Step 6 - Owner sees incoming requests', () => {
  test('Incoming Requests for Ali (and My Borrowings for Sara)', async () => {
    const incoming = await api().get('/api/bookings/incoming').set(auth(ctx.ali.token));
    expect(incoming.status).toBe(200);
    expect(incoming.body.data.map((b) => b.id).sort()).toEqual([ctx.bookingSara, ctx.bookingBilal].sort());

    const mine = await api().get('/api/bookings/mine').set(auth(ctx.sara.token));
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].item_title).toBe('Cordless Drill');

    expect((await api().get('/api/bookings/incoming?status=BOGUS').set(auth(ctx.ali.token))).status).toBe(400);
  });

  test('booking detail is only for the two parties', async () => {
    expect((await api().get(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.sara.token))).status).toBe(200);
    expect((await api().get(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.ali.token))).status).toBe(200);
    expect((await api().get(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.bilal.token))).status).toBe(403);
    expect((await api().get('/api/bookings/99999').set(auth(ctx.ali.token))).status).toBe(404);
  });
});

describe('Step 7 - Approve (transaction, row lock, auto-reject)', () => {
  test('rule 7: only the owner can approve (403); borrower cannot', async () => {
    expect((await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.sara.token)).send({ action: 'approve' })).status).toBe(403);
    expect((await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.bilal.token)).send({ action: 'approve' })).status).toBe(403);
  });

  test('rule 8: invalid transitions give 409 (cannot pick up a REQUESTED booking)', async () => {
    const res = await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.ali.token)).send({ action: 'pickup' });
    expect(res.status).toBe(409);
  });

  test('bad action value -> 400', async () => {
    expect((await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.ali.token)).send({ action: 'explode' })).status).toBe(400);
  });

  test('rule 9: approving Sara auto-rejects Bilal\'s overlapping request', async () => {
    const res = await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.ali.token)).send({ action: 'approve' });
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('APPROVED');
    expect(res.body.data.auto_rejected).toEqual([ctx.bookingBilal]);

    const bilal = await api().get(`/api/bookings/${ctx.bookingBilal}`).set(auth(ctx.bilal.token));
    expect(bilal.body.data.status).toBe('REJECTED');
    expect(bilal.body.data.reject_reason).toMatch(/automatically rejected/i);
  });

  test('approving twice -> 409', async () => {
    expect((await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.ali.token)).send({ action: 'approve' })).status).toBe(409);
  });

  test('rule 4: new requests overlapping an APPROVED booking -> 409; adjacent dates are fine', async () => {
    const clash = await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: ctx.drill, start_date: day(5), end_date: day(7) });
    expect(clash.status).toBe(409);

    const ok = await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: ctx.drill, start_date: day(6), end_date: day(8) });
    expect(ok.status).toBe(201);
    ctx.bookingBilal2 = ok.body.data.id;
  });

  test('search no longer returns the drill for overlapping dates; availability shows the range', async () => {
    const busy = await api().get(`/api/items?search=drill&from=${day(4)}&to=${day(5)}`);
    expect(busy.body.data).toHaveLength(0);
    expect(busy.body.meta.total).toBe(0);

    const free = await api().get(`/api/items?search=drill&from=${day(20)}&to=${day(22)}`);
    expect(free.body.data).toHaveLength(1);

    const av = await api().get(`/api/items/${ctx.drill}/availability`);
    expect(av.body.data).toEqual([{ start_date: day(3), end_date: day(5), status: 'APPROVED' }]);
  });

  test('concurrent approvals of clashing requests: exactly one wins (row lock + transaction)', async () => {
    const item = (await api().post('/api/items').set(auth(ctx.ali.token)).send({ title: 'Race Ladder', category_id: ctx.catTools, max_days: 5 })).body.data.id;
    const a = (await api().post('/api/bookings').set(auth(ctx.sara.token)).send({ item_id: item, start_date: day(12), end_date: day(14) })).body.data.id;
    const b = (await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: item, start_date: day(13), end_date: day(15) })).body.data.id;

    const [r1, r2] = await Promise.all([
      api().patch(`/api/bookings/${a}/status`).set(auth(ctx.ali.token)).send({ action: 'approve' }),
      api().patch(`/api/bookings/${b}/status`).set(auth(ctx.ali.token)).send({ action: 'approve' }),
    ]);
    expect([r1.status, r2.status].sort()).toEqual([200, 409]);

    const rows = await pool.query(`SELECT status FROM bookings WHERE item_id = $1 ORDER BY id`, [item]);
    expect(rows.rows.map((r) => r.status).sort()).toEqual(['APPROVED', 'REJECTED']);
    ctx.raceItem = item;
  });
});

describe('Step 8 - Handover (condition log)', () => {
  test('only the owner can mark picked up; log row is created', async () => {
    expect((await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.sara.token)).send({ action: 'pickup' })).status).toBe(403);

    const res = await api()
      .patch(`/api/bookings/${ctx.bookingSara}/status`)
      .set(auth(ctx.ali.token))
      .send({ action: 'pickup', note: 'Good, one scratch on the handle', condition: 'good' });
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('PICKED_UP');

    const detail = await api().get(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.sara.token));
    expect(detail.body.data.condition_logs).toHaveLength(1);
    expect(detail.body.data.condition_logs[0]).toMatchObject({ stage: 'handover', condition: 'good', note: 'Good, one scratch on the handle' });
    expect(detail.body.data.owner_phone === null || typeof detail.body.data.owner_phone === 'string').toBe(true);
  });

  test('cannot cancel once picked up (409)', async () => {
    expect((await api().patch(`/api/bookings/${ctx.bookingSara}/status`).set(auth(ctx.sara.token)).send({ action: 'cancel' })).status).toBe(409);
  });

  test('reviews are blocked before RETURNED (409)', async () => {
    expect((await api().post(`/api/bookings/${ctx.bookingSara}/reviews`).set(auth(ctx.sara.token)).send({ rating: 5 })).status).toBe(409);
  });
});

describe('Step 9 - Return (second condition log) and the OVERDUE flag', () => {
  test('a PICKED_UP booking past its end_date is flagged OVERDUE (computed)', async () => {
    const before = await api().get(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.ali.token));
    expect(before.body.data.is_overdue).toBe(false);

    await pool.query(`UPDATE bookings SET start_date = CURRENT_DATE - 5, end_date = CURRENT_DATE - 2 WHERE id = $1`, [ctx.bookingSara]);
    const after = await api().get('/api/bookings/mine').set(auth(ctx.sara.token));
    expect(after.body.data.find((b) => b.id === ctx.bookingSara).is_overdue).toBe(true);
  });

  test('Ali marks returned -> RETURNED + return log', async () => {
    const res = await api()
      .patch(`/api/bookings/${ctx.bookingSara}/status`)
      .set(auth(ctx.ali.token))
      .send({ action: 'return', note: 'Returned clean' });
    expect(res.status).toBe(200);
    expect(res.body.data.booking.status).toBe('RETURNED');
    expect(res.body.data.booking.is_overdue).toBe(false);

    const detail = await api().get(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.ali.token));
    expect(detail.body.data.condition_logs.map((l) => l.stage)).toEqual(['handover', 'return']);
    expect(detail.body.data.condition_logs[1].condition).toBe('good'); // defaults to the item's condition
  });

  test('condition logs are append-only: the booking cannot be deleted', async () => {
    expect((await api().delete(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.sara.token))).status).toBe(409);
  });
});

describe('Step 10 - Two-way reviews and the trust score', () => {
  test('both sides review; duplicates (409), strangers (403), bad rating (400)', async () => {
    const url = `/api/bookings/${ctx.bookingSara}/reviews`;
    const fromSara = await api().post(url).set(auth(ctx.sara.token)).send({ rating: 5, comment: 'Great lender' });
    expect(fromSara.status).toBe(201);
    expect(fromSara.body.data).toMatchObject({ reviewer_id: ctx.sara.id, reviewee_id: ctx.ali.id, rating: 5 });
    ctx.reviewSara = fromSara.body.data.id;

    const fromAli = await api().post(url).set(auth(ctx.ali.token)).send({ rating: 3, comment: 'Late return' });
    expect(fromAli.status).toBe(201);
    expect(fromAli.body.data).toMatchObject({ reviewer_id: ctx.ali.id, reviewee_id: ctx.sara.id });
    ctx.reviewAli = fromAli.body.data.id;

    expect((await api().post(url).set(auth(ctx.sara.token)).send({ rating: 4 })).status).toBe(409);
    expect((await api().post(url).set(auth(ctx.bilal.token)).send({ rating: 4 })).status).toBe(403);
    expect((await api().post(url).set(auth(ctx.sara.token)).send({ rating: 6 })).status).toBe(400);
    expect((await api().post(url).send({ rating: 4 })).status).toBe(401);
  });

  test('trust score = AVG(rating received) on profiles and item pages', async () => {
    const ali = await api().get(`/api/users/${ctx.ali.id}`);
    expect(ali.body.data.trust_score).toBe(5);
    expect(ali.body.data.review_count).toBe(1);
    expect(ali.body.data.reviews[0]).toMatchObject({ reviewer_name: 'Sara', rating: 5, item_title: 'Cordless Drill' });
    expect(ali.body.data.email).toBeUndefined(); // private data stays private
    expect(ali.body.data.password_hash).toBeUndefined();

    const sara = await api().get(`/api/users/${ctx.sara.id}`);
    expect(sara.body.data.trust_score).toBe(3);

    const item = await api().get(`/api/items/${ctx.drill}`);
    expect(item.body.data.item_rating).toBe(5);
    expect(item.body.data.owner.trust_score).toBe(5);
    expect(item.body.data.reviews).toHaveLength(1);
  });
});

describe('Step 11 - Edit & clean up (CRUD)', () => {
  test('items: owner edits; strangers cannot (403)', async () => {
    const upd = await api().put(`/api/items/${ctx.drill}`).set(auth(ctx.ali.token)).send({ description: 'Updated description', max_days: 6 });
    expect(upd.status).toBe(200);
    expect(upd.body.data.description).toBe('Updated description');
    expect(upd.body.data.max_days).toBe(6);
    expect(upd.body.data.title).toBe('Cordless Drill'); // untouched fields stay

    expect((await api().put(`/api/items/${ctx.drill}`).set(auth(ctx.sara.token)).send({ title: 'Hacked' })).status).toBe(403);
    expect((await api().put('/api/items/99999').set(auth(ctx.ali.token)).send({ title: 'Nope' })).status).toBe(404);
  });

  test('bookings: edit only while REQUESTED; delete only REJECTED / CANCELLED', async () => {
    // Bilal's second request (day 6-8) is still REQUESTED -> editable
    const edit = await api()
      .put(`/api/bookings/${ctx.bookingBilal2}`)
      .set(auth(ctx.bilal.token))
      .send({ start_date: day(20), end_date: day(21), message: 'Changed my mind on dates' });
    expect(edit.status).toBe(200);
    expect(edit.body.data.start_date).toBe(day(20));
    expect(edit.body.data.message).toBe('Changed my mind on dates');

    expect((await api().put(`/api/bookings/${ctx.bookingBilal2}`).set(auth(ctx.sara.token)).send({ message: 'x' })).status).toBe(403);
    expect((await api().put(`/api/bookings/${ctx.bookingBilal2}`).set(auth(ctx.bilal.token)).send({ start_date: day(20), end_date: day(30) })).status).toBe(400); // > max_days
    expect((await api().put(`/api/bookings/${ctx.bookingSara}`).set(auth(ctx.sara.token)).send({ message: 'x' })).status).toBe(409); // RETURNED

    // not deletable while REQUESTED, cancel first, then delete
    expect((await api().delete(`/api/bookings/${ctx.bookingBilal2}`).set(auth(ctx.bilal.token))).status).toBe(409);
    expect((await api().patch(`/api/bookings/${ctx.bookingBilal2}/status`).set(auth(ctx.ali.token)).send({ action: 'cancel' })).status).toBe(403); // only the borrower cancels
    expect((await api().patch(`/api/bookings/${ctx.bookingBilal2}/status`).set(auth(ctx.bilal.token)).send({ action: 'cancel' })).status).toBe(200);
    expect((await api().delete(`/api/bookings/${ctx.bookingBilal2}`).set(auth(ctx.sara.token))).status).toBe(403);
    expect((await api().delete(`/api/bookings/${ctx.bookingBilal2}`).set(auth(ctx.bilal.token))).status).toBe(200);

    // the auto-rejected one can be removed too
    expect((await api().delete(`/api/bookings/${ctx.bookingBilal}`).set(auth(ctx.bilal.token))).status).toBe(200);
    expect((await api().get(`/api/bookings/${ctx.bookingBilal}`).set(auth(ctx.bilal.token))).status).toBe(404);
  });

  test('owner can reject with a reason; cancelled APPROVED dates become free again', async () => {
    const item = (await api().post('/api/items').set(auth(ctx.ali.token)).send({ title: 'Spare Saw', category_id: ctx.catTools, max_days: 4 })).body.data.id;

    const r1 = (await api().post('/api/bookings').set(auth(ctx.sara.token)).send({ item_id: item, start_date: day(30), end_date: day(31) })).body.data.id;
    const rej = await api().patch(`/api/bookings/${r1}/status`).set(auth(ctx.ali.token)).send({ action: 'reject', reason: 'Not available' });
    expect(rej.body.data.booking).toMatchObject({ status: 'REJECTED', reject_reason: 'Not available' });

    const r2 = (await api().post('/api/bookings').set(auth(ctx.sara.token)).send({ item_id: item, start_date: day(30), end_date: day(31) })).body.data.id;
    await api().patch(`/api/bookings/${r2}/status`).set(auth(ctx.ali.token)).send({ action: 'approve' });
    expect((await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: item, start_date: day(30), end_date: day(30) })).status).toBe(409);

    await api().patch(`/api/bookings/${r2}/status`).set(auth(ctx.sara.token)).send({ action: 'cancel' });
    expect((await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: item, start_date: day(30), end_date: day(30) })).status).toBe(201);
    ctx.sawItem = item;
  });

  test('rule 6: max 3 open bookings per borrower', async () => {
    const mk = async (title) => (await api().post('/api/items').set(auth(ctx.ali.token)).send({ title, category_id: ctx.catTools, max_days: 2 })).body.data.id;
    const [i1, i2, i3, i4] = [await mk('Cap 1'), await mk('Cap 2'), await mk('Cap 3'), await mk('Cap 4')];

    // Sara has: Saw booking by Bilal? no - use a fresh member
    const dave = await register('Dave', 'dave@test.com');
    for (const id of [i1, i2, i3]) {
      expect((await api().post('/api/bookings').set(auth(dave.token)).send({ item_id: id, start_date: day(40), end_date: day(41) })).status).toBe(201);
    }
    const fourth = await api().post('/api/bookings').set(auth(dave.token)).send({ item_id: i4, start_date: day(40), end_date: day(41) });
    expect(fourth.status).toBe(409);
    expect(fourth.body.message).toMatch(/3 open bookings/);
    ctx.dave = dave;
  });

  test('rule 5: inactive items cannot be requested and are hidden from the public', async () => {
    const item = (await api().post('/api/items').set(auth(ctx.ali.token)).send({ title: 'Hidden Gadget', category_id: ctx.catTools, max_days: 2 })).body.data.id;
    expect((await api().put(`/api/items/${item}`).set(auth(ctx.ali.token)).send({ is_active: false })).body.data.is_active).toBe(false);

    expect((await api().post('/api/bookings').set(auth(ctx.bilal.token)).send({ item_id: item, start_date: day(50), end_date: day(51) })).status).toBe(409);
    expect((await api().get('/api/items?search=Hidden')).body.data).toHaveLength(0);
    expect((await api().get(`/api/items/${item}`)).status).toBe(404); // public
    expect((await api().get(`/api/items/${item}`).set(auth(ctx.ali.token))).status).toBe(200); // owner still sees it
    expect((await api().get(`/api/items/${item}`).set(auth(ctx.admin.token))).status).toBe(200);
  });

  test('reviews: author edits, others cannot; author / admin delete', async () => {
    const edit = await api().put(`/api/reviews/${ctx.reviewSara}`).set(auth(ctx.sara.token)).send({ rating: 4, comment: 'Edited comment' });
    expect(edit.status).toBe(200);
    expect(edit.body.data).toMatchObject({ rating: 4, comment: 'Edited comment' });
    expect((await api().get(`/api/users/${ctx.ali.id}`)).body.data.trust_score).toBe(4); // recalculated

    expect((await api().put(`/api/reviews/${ctx.reviewSara}`).set(auth(ctx.ali.token)).send({ rating: 1 })).status).toBe(403);
    expect((await api().put(`/api/reviews/${ctx.reviewSara}`).set(auth(ctx.admin.token)).send({ rating: 1 })).status).toBe(403);
    expect((await api().put(`/api/reviews/${ctx.reviewSara}`).set(auth(ctx.sara.token)).send({ rating: 9 })).status).toBe(400);

    expect((await api().delete(`/api/reviews/${ctx.reviewAli}`).set(auth(ctx.bilal.token))).status).toBe(403);
    expect((await api().delete(`/api/reviews/${ctx.reviewAli}`).set(auth(ctx.ali.token))).status).toBe(200); // author

    expect((await api().delete(`/api/reviews/${ctx.reviewSara}`).set(auth(ctx.admin.token))).status).toBe(200); // admin
    expect((await api().delete(`/api/reviews/${ctx.reviewSara}`).set(auth(ctx.admin.token))).status).toBe(404);
    expect((await api().get(`/api/users/${ctx.ali.id}`)).body.data.trust_score).toBeNull();
  });
});

describe('Delete rules (rules 11, 12, 13)', () => {
  test('item with open bookings -> 409; with only history -> deactivated; never booked -> deleted', async () => {
    // Dave holds REQUESTED bookings on the Cap items -> open
    const capItem = (await api().get('/api/items?search=Cap 1')).body.data[0].id;
    expect((await api().delete(`/api/items/${capItem}`).set(auth(ctx.ali.token))).status).toBe(409);
    expect((await api().delete(`/api/items/${capItem}`).set(auth(ctx.sara.token))).status).toBe(403);

    // Drill has only RETURNED history -> deactivate instead of delete
    const drill = await api().delete(`/api/items/${ctx.drill}`).set(auth(ctx.ali.token));
    expect(drill.status).toBe(200);
    expect(drill.body.data.action).toBe('deactivated');
    const row = await pool.query('SELECT is_active FROM items WHERE id = $1', [ctx.drill]);
    expect(row.rows[0].is_active).toBe(false);

    // never had a booking -> real delete (admin may do it too)
    const fresh = (await api().post('/api/items').set(auth(ctx.ali.token)).send({ title: 'Brand New', category_id: ctx.catTools, max_days: 2 })).body.data.id;
    const del = await api().delete(`/api/items/${fresh}`).set(auth(ctx.admin.token));
    expect(del.status).toBe(200);
    expect(del.body.data.action).toBe('deleted');
    expect((await pool.query('SELECT 1 FROM items WHERE id = $1', [fresh])).rowCount).toBe(0);
  });

  test('category in use cannot be deleted (409)', async () => {
    expect((await api().delete(`/api/categories/${ctx.catTools}`).set(auth(ctx.admin.token))).status).toBe(409);
  });

  test('profile: edit own; delete blocked while bookings are open, then soft-deletes', async () => {
    const upd = await api().put('/api/users/me').set(auth(ctx.sara.token)).send({ name: 'Sara K', phone: '0311', area: 'Library Block' });
    expect(upd.status).toBe(200);
    expect(upd.body.data.user).toMatchObject({ name: 'Sara K', phone: '0311', area: 'Library Block' });
    expect((await api().put('/api/users/me').send({ name: 'x' })).status).toBe(401);

    // Dave has open REQUESTED bookings -> blocked
    expect((await api().delete('/api/users/me').set(auth(ctx.dave.token))).status).toBe(409);
    // Ali owns items that Dave requested -> blocked as well
    expect((await api().delete('/api/users/me').set(auth(ctx.ali.token))).status).toBe(409);

    // Sara gets an open request of her own -> she is blocked too
    const capItem = (await api().get('/api/items?search=Cap 2')).body.data[0].id;
    const open = await api().post('/api/bookings').set(auth(ctx.sara.token)).send({ item_id: capItem, start_date: day(70), end_date: day(71) });
    expect(open.status).toBe(201);
    expect((await api().delete('/api/users/me').set(auth(ctx.sara.token))).status).toBe(409);

    // cancel everything that is still open for Sara (the race test may have left an APPROVED one)
    const mine = (await api().get('/api/bookings/mine').set(auth(ctx.sara.token))).body.data;
    for (const b of mine.filter((x) => ['REQUESTED', 'APPROVED'].includes(x.status))) {
      expect((await api().patch(`/api/bookings/${b.id}/status`).set(auth(ctx.sara.token)).send({ action: 'cancel' })).status).toBe(200);
    }

    // now only finished / cancelled history is left -> she can leave
    const gone = await api().delete('/api/users/me').set(auth(ctx.sara.token));
    expect(gone.status).toBe(200);
    const row = await pool.query('SELECT is_active, deleted_at FROM users WHERE id = $1', [ctx.sara.id]);
    expect(row.rows[0].is_active).toBe(false);
    expect(row.rows[0].deleted_at).not.toBeNull();

    // soft-deleted user: token no longer works, cannot log in, profile is gone
    expect((await api().get('/api/auth/me').set(auth(ctx.sara.token))).status).toBe(401);
    expect((await api().post('/api/auth/login').send({ email: 'sara@test.com', password: 'secret123' })).status).toBe(401);
    expect((await api().get(`/api/users/${ctx.sara.id}`)).status).toBe(404);
  });
});

describe('Admin panel', () => {
  test('stats, user list and activate / deactivate', async () => {
    expect((await api().get('/api/admin/stats').set(auth(ctx.ali.token))).status).toBe(403);
    expect((await api().get('/api/admin/stats')).status).toBe(401);

    const stats = await api().get('/api/admin/stats').set(auth(ctx.admin.token));
    expect(stats.status).toBe(200);
    expect(stats.body.data.users.total).toBeGreaterThanOrEqual(5);
    expect(Object.keys(stats.body.data.bookings.by_status).sort()).toEqual(
      ['APPROVED', 'CANCELLED', 'PICKED_UP', 'REJECTED', 'REQUESTED', 'RETURNED']
    );
    expect(stats.body.data.bookings.by_status.RETURNED).toBe(1);

    const users = await api().get('/api/admin/users').set(auth(ctx.admin.token));
    expect(users.body.data.length).toBeGreaterThanOrEqual(5);
    expect(users.body.data[0].password_hash).toBeUndefined();
    expect((await api().get('/api/admin/users?search=bilal').set(auth(ctx.admin.token))).body.data).toHaveLength(1);

    expect((await api().get('/api/admin/items').set(auth(ctx.admin.token))).body.data.length).toBeGreaterThan(0);
  });

  test('deactivated users are locked out immediately; reactivation restores access', async () => {
    const off = await api().patch(`/api/admin/users/${ctx.bilal.id}/status`).set(auth(ctx.admin.token)).send({ is_active: false });
    expect(off.status).toBe(200);
    expect(off.body.data.is_active).toBe(false);

    expect((await api().get('/api/auth/me').set(auth(ctx.bilal.token))).status).toBe(403);
    expect((await api().post('/api/auth/login').send({ email: 'bilal@test.com', password: 'secret123' })).status).toBe(403);

    // rule 5: items of deactivated owners cannot be requested (and are hidden from browse)
    const cap = (await api().get('/api/items?search=Cap 1')).body.data;
    expect(cap).toHaveLength(1); // Ali is still active
    const bilalItem = (await api().post('/api/items').set(auth(ctx.dave.token)).send({ title: 'Dave Gadget', category_id: ctx.catTools, max_days: 2 })).body.data.id;
    await api().patch(`/api/admin/users/${ctx.dave.id}/status`).set(auth(ctx.admin.token)).send({ is_active: false });
    expect((await api().get('/api/items?search=Dave Gadget')).body.data).toHaveLength(0);
    expect((await api().post('/api/bookings').set(auth(ctx.ali.token)).send({ item_id: bilalItem, start_date: day(60), end_date: day(61) })).status).toBe(409);

    const on = await api().patch(`/api/admin/users/${ctx.bilal.id}/status`).set(auth(ctx.admin.token)).send({ is_active: true });
    expect(on.body.data.is_active).toBe(true);
    expect((await api().post('/api/auth/login').send({ email: 'bilal@test.com', password: 'secret123' })).status).toBe(200);
  });

  test('admin cannot change own status; deleted accounts cannot be reactivated; bad body 400', async () => {
    expect((await api().patch(`/api/admin/users/${ctx.admin.id}/status`).set(auth(ctx.admin.token)).send({ is_active: false })).status).toBe(400);
    expect((await api().patch(`/api/admin/users/${ctx.sara.id}/status`).set(auth(ctx.admin.token)).send({ is_active: true })).status).toBe(409);
    expect((await api().patch(`/api/admin/users/${ctx.bilal.id}/status`).set(auth(ctx.admin.token)).send({})).status).toBe(400);
    expect((await api().patch('/api/admin/users/99999/status').set(auth(ctx.admin.token)).send({ is_active: true })).status).toBe(404);
  });

  test('admin can remove an inappropriate item (delete or deactivate)', async () => {
    const res = await api().delete(`/api/items/${ctx.sawItem}`).set(auth(ctx.admin.token));
    // Bilal's REQUESTED booking on the saw is open -> 409 protects live loans
    expect(res.status).toBe(409);
  });
});

describe('Misc API behaviour', () => {
  test('unknown routes give a JSON 404; bad JSON gives 400; health endpoint', async () => {
    const nf = await api().get('/api/nope');
    expect(nf.status).toBe(404);
    expect(nf.body.success).toBe(false);

    const bad = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{ not json');
    expect(bad.status).toBe(400);

    expect((await api().get('/api/health')).body.data.status).toBe('ok');
  });

  test('SQL injection attempts are treated as plain text (parameterised queries)', async () => {
    const res = await api().get("/api/items?search=' OR 1=1; DROP TABLE users; --");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect((await pool.query('SELECT COUNT(*) AS n FROM users')).rows[0].n).toBeGreaterThan(0);

    const login = await api().post('/api/auth/login').send({ email: "admin@test.com' OR '1'='1", password: 'x' });
    expect(login.status).toBe(400); // not even a valid email
  });

  test('pagination returns the requested page', async () => {
    const page1 = await api().get('/api/items?limit=2&page=1');
    const page2 = await api().get('/api/items?limit=2&page=2');
    expect(page1.body.data).toHaveLength(2);
    expect(page2.body.data.length).toBeGreaterThan(0);
    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
    expect(page1.body.meta.totalPages).toBeGreaterThan(1);
  });
});
