import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { hashPassword, verifyPassword, newToken, sessionId } from './auth';
import { inviteEmail, resetEmail } from './email';

type Bindings = {
  DB: D1Database;
  EMAIL?: SendEmail;
  ALLOWED_ORIGIN: string;
  APP_URL: string;              // where invite / reset links point, with trailing slash
  MAIL_FROM: string;
  SESSION_SECRET: string;
};

type SessionUser = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  display_name: string | null;
};

type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number';
const FIELD_TYPES: FieldType[] = ['text', 'email', 'phone', 'textarea', 'select', 'checkbox', 'date', 'number'];

type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  position: number;
  active: boolean;
};

const app = new Hono<{ Bindings: Bindings; Variables: { user: SessionUser } }>();

const COOKIE = 'cc_session';
const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const INVITE_MS = 72 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;

// Login / reset lockout: this many failures per key inside the window → 429.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_VALUE_LEN = 2000;

// ---------------- CORS ----------------
app.use('*', cors({
  origin: (origin, c) => {
    if (origin === c.env.ALLOWED_ORIGIN) return origin;
    // any localhost port during local dev
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '')) return origin;
    return c.env.ALLOWED_ORIGIN;
  },
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// ---------------- helpers ----------------
function publicUser(row: any): SessionUser {
  return { id: row.id, email: row.email, role: row.role, display_name: row.display_name ?? null };
}

async function currentUser(c: any): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const id = await sessionId(token, c.env.SESSION_SECRET);
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.display_name, u.active, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
  ).bind(id).first();
  if (!row || !row.active) return null;
  if (Number(row.expires_at) < Date.now()) return null;
  return publicUser(row);
}

const auth = async (c: any, next: any) => {
  const user = await currentUser(c);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
};

const requireAdmin = async (c: any, next: any) => {
  if (c.get('user').role !== 'admin') return c.json({ error: 'forbidden' }, 403);
  await next();
};

async function startSession(c: any, userId: string) {
  const token = newToken();
  const id = await sessionId(token, c.env.SESSION_SECRET);
  const now = Date.now();
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?,?,?,?)')
      .bind(id, userId, now, now + SESSION_MS),
    c.env.DB.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').bind(now, userId),
  ]);
  const host = new URL(c.req.url).hostname;
  const secure = host !== 'localhost' && host !== '127.0.0.1';
  setCookie(c, COOKIE, token, {
    httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

async function tooManyFailures(c: any, keys: string[]): Promise<boolean> {
  const since = Date.now() - LOGIN_WINDOW_MS;
  await c.env.DB.prepare('DELETE FROM login_failures WHERE at < ?').bind(since).run();
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM login_failures WHERE key IN (${keys.map(() => '?').join(',')}) AND at >= ?
     GROUP BY key ORDER BY n DESC LIMIT 1`,
  ).bind(...keys, since).first();
  return Number(row?.n ?? 0) >= LOGIN_MAX_FAILURES;
}

async function recordFailure(c: any, keys: string[]) {
  const at = Date.now();
  await c.env.DB.batch(keys.map((k) =>
    c.env.DB.prepare('INSERT INTO login_failures (key, at) VALUES (?, ?)').bind(k, at)));
}

// Create a one-time link token; returns the raw token for the URL.
async function issueToken(c: any, kind: 'invite' | 'reset', userId: string, createdBy: string | null) {
  const raw = newToken();
  const now = Date.now();
  await c.env.DB.batch([
    // Only the newest link of a kind works.
    c.env.DB.prepare('UPDATE tokens SET used_at = ? WHERE user_id = ? AND kind = ? AND used_at IS NULL')
      .bind(now, userId, kind),
    c.env.DB.prepare('INSERT INTO tokens (id, kind, user_id, created_by, created_at, expires_at) VALUES (?,?,?,?,?,?)')
      .bind(await sessionId(raw, c.env.SESSION_SECRET), kind, userId, createdBy, now,
        now + (kind === 'invite' ? INVITE_MS : RESET_MS)),
  ]);
  return raw;
}

async function lookupToken(c: any, raw: string, kind: 'invite' | 'reset') {
  if (!raw) return null;
  const row = await c.env.DB.prepare(
    `SELECT t.id AS token_id, t.expires_at, t.used_at, u.* FROM tokens t JOIN users u ON u.id = t.user_id
     WHERE t.id = ? AND t.kind = ?`,
  ).bind(await sessionId(raw, c.env.SESSION_SECRET), kind).first();
  if (!row || row.used_at || Number(row.expires_at) < Date.now() || !row.active) return null;
  return row;
}

const linkFor = (c: any, kind: 'invite' | 'reset', raw: string) =>
  `${c.env.APP_URL}${kind === 'invite' ? 'accept' : 'reset'}?token=${encodeURIComponent(raw)}`;

// Sends through the Cloudflare Email binding. Returns an error string instead of
// throwing so callers can still hand the admin the link to share by hand.
async function sendMail(c: any, msg: { to: string; subject: string; html: string; text: string }): Promise<string | null> {
  if (!c.env.EMAIL) return 'email sending is not configured';
  try {
    await c.env.EMAIL.send({ from: { email: c.env.MAIL_FROM, name: 'Contact Capture' }, ...msg });
    return null;
  } catch (e: any) {
    console.error('email send failed', e?.code, e?.message);
    return e?.message || 'email send failed';
  }
}

function rowToField(r: any): Field {
  return {
    id: r.id,
    label: r.label,
    type: r.type,
    required: Boolean(r.required),
    options: r.options ? JSON.parse(r.options) : [],
    position: r.position,
    active: Boolean(r.active),
  };
}

async function allFields(c: any): Promise<Field[]> {
  const { results } = await c.env.DB.prepare('SELECT * FROM fields ORDER BY position, created_at').all();
  return results.map(rowToField);
}

// Validate submitted values against the active fields. Unknown keys are dropped;
// values for retired fields are carried over from `prev` so an edit never loses them.
function cleanValues(fields: Field[], input: any, prev: Record<string, unknown> = {}):
  { data: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};
  for (const f of fields) {
    if (!f.active) {
      if (prev[f.id] !== undefined) data[f.id] = prev[f.id];
      continue;
    }
    let v: unknown = input?.[f.id];
    if (f.type === 'checkbox') {
      v = v === true || v === 'true' || v === 1;
      if (f.required && !v) return { data, error: `${f.label} must be checked` };
      data[f.id] = v;
      continue;
    }
    const s = v === undefined || v === null ? '' : String(v).trim().slice(0, MAX_VALUE_LEN);
    if (!s) {
      if (f.required) return { data, error: `${f.label} is required` };
      continue;
    }
    if (f.type === 'email' && !EMAIL_RE.test(s)) return { data, error: `${f.label} isn't a valid email` };
    if (f.type === 'number' && !isFinite(Number(s))) return { data, error: `${f.label} must be a number` };
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) return { data, error: `${f.label} must be a date` };
    if (f.type === 'select' && !f.options.includes(s)) return { data, error: `pick a ${f.label} from the list` };
    data[f.id] = f.type === 'email' ? s.toLowerCase() : s;
  }
  return { data };
}

function primaryEmail(fields: Field[], data: Record<string, unknown>): string | null {
  const f = fields.find((x) => x.type === 'email' && typeof data[x.id] === 'string');
  return f ? String(data[f.id]).toLowerCase() : null;
}

const CONTACT_SELECT = `
  SELECT ct.*, cu.email AS created_by_email, cu.display_name AS created_by_name,
         uu.email AS updated_by_email, uu.display_name AS updated_by_name
  FROM contacts ct
  LEFT JOIN users cu ON cu.id = ct.created_by
  LEFT JOIN users uu ON uu.id = ct.updated_by`;

function publicContact(r: any) {
  return {
    id: r.id,
    data: JSON.parse(r.data),
    created_by: { id: r.created_by, email: r.created_by_email, name: r.created_by_name },
    created_at: r.created_at,
    updated_by: r.updated_by ? { id: r.updated_by, email: r.updated_by_email, name: r.updated_by_name } : null,
    updated_at: r.updated_at,
  };
}

async function duplicates(c: any, email: string | null, excludeId = '') {
  if (!email) return [];
  const { results } = await c.env.DB.prepare(
    `${CONTACT_SELECT} WHERE ct.email = ? AND ct.deleted_at IS NULL AND ct.id != ? ORDER BY ct.created_at DESC LIMIT 5`,
  ).bind(email, excludeId).all();
  return results.map(publicContact);
}

// ---------------- health ----------------
app.get('/', (c) => c.json({ ok: true, service: 'contact-capture-api' }));

// ---------------- auth ----------------
app.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => ({} as any));
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!email || !password) return c.json({ error: 'email and password required' }, 400);

  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const keys = [`ip:${ip}`, `email:${email}`];
  if (await tooManyFailures(c, keys)) return c.json({ error: 'too many attempts — try again in 15 minutes' }, 429);

  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  if (!user || !user.active || !user.password_hash || !(await verifyPassword(password, user.password_hash as string))) {
    await recordFailure(c, keys);
    return c.json({ error: 'invalid email or password' }, 401);
  }
  await startSession(c, user.id as string);
  return c.json({ user: publicUser(user) });
});

app.post('/auth/logout', auth, async (c) => {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(await sessionId(token, c.env.SESSION_SECRET)).run();
  }
  deleteCookie(c, COOKIE, { path: '/' });
  return c.json({ ok: true });
});

app.get('/auth/me', auth, (c) => c.json({ user: c.get('user') }));

app.post('/auth/password', auth, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const current = String(b.current ?? '');
  const next = String(b.next ?? '');
  if (next.length < 10) return c.json({ error: 'new password must be at least 10 characters' }, 400);
  const me = c.get('user');
  const row = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(me.id).first();
  if (!row || !(await verifyPassword(current, row.password_hash as string))) {
    return c.json({ error: 'current password is wrong' }, 401);
  }
  // Sign out every other session on a password change.
  const keep = await sessionId(getCookie(c, COOKIE)!, c.env.SESSION_SECRET);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(next), me.id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').bind(me.id, keep),
  ]);
  return c.json({ ok: true });
});

app.put('/auth/profile', auth, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const name = String(b.display_name ?? '').trim().slice(0, 80) || null;
  await c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(name, c.get('user').id).run();
  return c.json({ user: { ...c.get('user'), display_name: name } });
});

// Invite / reset links: GET shows who the link is for, POST sets the password and signs in.
for (const kind of ['invite', 'reset'] as const) {
  const path = kind === 'invite' ? '/auth/accept' : '/auth/reset';

  app.get(path, async (c) => {
    const row = await lookupToken(c, c.req.query('token') || '', kind);
    if (!row) return c.json({ error: 'this link is invalid or has expired — ask for a new one' }, 410);
    return c.json({ email: row.email, display_name: row.display_name ?? null });
  });

  app.post(path, async (c) => {
    const b = await c.req.json().catch(() => ({} as any));
    const row = await lookupToken(c, String(b.token ?? ''), kind);
    if (!row) return c.json({ error: 'this link is invalid or has expired — ask for a new one' }, 410);
    const password = String(b.password ?? '');
    if (password.length < 10) return c.json({ error: 'password must be at least 10 characters' }, 400);
    const name = kind === 'invite' && b.display_name !== undefined
      ? String(b.display_name).trim().slice(0, 80) || null
      : row.display_name ?? null;
    const now = Date.now();
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE users SET password_hash = ?, display_name = ? WHERE id = ?')
        .bind(await hashPassword(password), name, row.id),
      c.env.DB.prepare('UPDATE tokens SET used_at = ? WHERE id = ?').bind(now, row.token_id),
      c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.id),
    ]);
    await startSession(c, row.id as string);
    return c.json({ user: publicUser({ ...row, display_name: name }) });
  });
}

// Always answers ok so the endpoint can't be used to discover who has an account.
app.post('/auth/forgot', async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const email = String(b.email ?? '').trim().toLowerCase();
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const keys = [`ip:${ip}`, `email:${email}`];
  if (await tooManyFailures(c, keys)) return c.json({ error: 'too many attempts — try again in 15 minutes' }, 429);
  await recordFailure(c, keys);   // counts toward the same lockout so it can't be used to spam a mailbox
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ? AND active = 1 AND password_hash IS NOT NULL')
    .bind(email).first();
  if (user) {
    const raw = await issueToken(c, 'reset', user.id as string, null);
    await sendMail(c, { to: email, ...resetEmail(linkFor(c, 'reset', raw)) });
  }
  return c.json({ ok: true });
});

// ---------------- fields ----------------
app.get('/fields', auth, async (c) => c.json({ fields: await allFields(c), types: FIELD_TYPES }));

function cleanField(b: any, base?: Field): { field?: Omit<Field, 'id' | 'position'>; error?: string } {
  const label = String(b.label ?? base?.label ?? '').trim().slice(0, 60);
  if (!label) return { error: 'label is required' };
  const type = (b.type ?? base?.type) as FieldType;
  if (!FIELD_TYPES.includes(type)) return { error: 'unknown field type' };
  let options: string[] = [];
  if (type === 'select') {
    const raw = Array.isArray(b.options) ? b.options : base?.options ?? [];
    options = [...new Set(raw.map((o: unknown) => String(o).trim().slice(0, 80)).filter(Boolean))] as string[];
    if (!options.length) return { error: 'a dropdown needs at least one option' };
  }
  return {
    field: {
      label, type, options,
      required: Boolean(b.required ?? base?.required ?? false),
      active: Boolean(b.active ?? base?.active ?? true),
    },
  };
}

app.post('/fields', auth, requireAdmin, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const { field, error } = cleanField(b);
  if (!field) return c.json({ error }, 400);
  const pos = await c.env.DB.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM fields').first();
  const id = crypto.randomUUID().slice(0, 8);
  await c.env.DB.prepare(
    'INSERT INTO fields (id, label, type, required, options, position, active, created_at) VALUES (?,?,?,?,?,?,?,?)',
  ).bind(id, field.label, field.type, field.required ? 1 : 0, field.options.length ? JSON.stringify(field.options) : null,
    Number(pos?.p ?? 1), field.active ? 1 : 0, Date.now()).run();
  return c.json({ fields: await allFields(c) });
});

app.patch('/fields/:id', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT * FROM fields WHERE id = ?').bind(id).first();
  if (!row) return c.json({ error: 'not found' }, 404);
  const b = await c.req.json().catch(() => ({} as any));
  const { field, error } = cleanField(b, rowToField(row));
  if (!field) return c.json({ error }, 400);
  await c.env.DB.prepare('UPDATE fields SET label = ?, type = ?, required = ?, options = ?, active = ? WHERE id = ?')
    .bind(field.label, field.type, field.required ? 1 : 0,
      field.options.length ? JSON.stringify(field.options) : null, field.active ? 1 : 0, id).run();
  return c.json({ fields: await allFields(c) });
});

app.put('/fields/order', auth, requireAdmin, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const ids: string[] = Array.isArray(b.ids) ? b.ids.map(String) : [];
  if (ids.length) {
    await c.env.DB.batch(ids.map((id, i) =>
      c.env.DB.prepare('UPDATE fields SET position = ? WHERE id = ?').bind(i + 1, id)));
  }
  return c.json({ fields: await allFields(c) });
});

// Hard delete only for fields that hold no data; otherwise retire it instead.
app.delete('/fields/:id', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const used = await c.env.DB.prepare(
    `SELECT 1 FROM contacts WHERE json_extract(data, '$."' || ? || '"') IS NOT NULL LIMIT 1`,
  ).bind(id).first();
  if (used) return c.json({ error: 'this field has captured data — hide it instead so reports keep it' }, 409);
  await c.env.DB.prepare('DELETE FROM fields WHERE id = ?').bind(id).run();
  return c.json({ fields: await allFields(c) });
});

// ---------------- contacts ----------------
app.get('/contacts/check', auth, async (c) => {
  const email = String(c.req.query('email') ?? '').trim().toLowerCase();
  return c.json({ duplicates: EMAIL_RE.test(email) ? await duplicates(c, email, c.req.query('exclude') || '') : [] });
});

app.post('/contacts', auth, async (c) => {
  const me = c.get('user');
  const fields = await allFields(c);
  const { data, error } = cleanValues(fields, (await c.req.json().catch(() => ({} as any))).data);
  if (error) return c.json({ error }, 400);
  if (!Object.keys(data).some((k) => data[k] !== false)) return c.json({ error: 'fill in at least one field' }, 400);
  const email = primaryEmail(fields, data);
  const dupes = await duplicates(c, email);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO contacts (id, data, email, created_by, created_at) VALUES (?,?,?,?,?)')
    .bind(id, JSON.stringify(data), email, me.id, Date.now()).run();
  const row = await c.env.DB.prepare(`${CONTACT_SELECT} WHERE ct.id = ?`).bind(id).first();
  return c.json({ contact: publicContact(row), duplicates: dupes });
});

// Report: everyone signed in sees every contact. Filters are optional.
app.get('/contacts', auth, async (c) => {
  const q = c.req.query();
  const where = ['ct.deleted_at IS NULL'];
  const args: unknown[] = [];
  if (q.mine === '1') { where.push('ct.created_by = ?'); args.push(c.get('user').id); }
  if (q.by) { where.push('ct.created_by = ?'); args.push(q.by); }
  if (q.from) { where.push('ct.created_at >= ?'); args.push(Number(q.from)); }
  if (q.to) { where.push('ct.created_at < ?'); args.push(Number(q.to)); }
  if (q.q) { where.push('LOWER(ct.data) LIKE ?'); args.push(`%${q.q.toLowerCase()}%`); }
  const { results } = await c.env.DB.prepare(
    `${CONTACT_SELECT} WHERE ${where.join(' AND ')} ORDER BY ct.created_at DESC LIMIT 5000`,
  ).bind(...args).all();
  return c.json({ contacts: results.map(publicContact) });
});

async function editable(c: any, id: string) {
  const row = await c.env.DB.prepare('SELECT * FROM contacts WHERE id = ? AND deleted_at IS NULL').bind(id).first();
  if (!row) return { status: 404 as const };
  const me = c.get('user');
  if (me.role !== 'admin' && row.created_by !== me.id) return { status: 403 as const };
  return { row };
}

app.patch('/contacts/:id', auth, async (c) => {
  const id = c.req.param('id');
  const { row, status } = await editable(c, id);
  if (!row) return c.json({ error: status === 403 ? 'you can only edit contacts you captured' : 'not found' }, status);
  const fields = await allFields(c);
  const { data, error } = cleanValues(fields, (await c.req.json().catch(() => ({} as any))).data, JSON.parse(row.data));
  if (error) return c.json({ error }, 400);
  await c.env.DB.prepare('UPDATE contacts SET data = ?, email = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind(JSON.stringify(data), primaryEmail(fields, data), c.get('user').id, Date.now(), id).run();
  const updated = await c.env.DB.prepare(`${CONTACT_SELECT} WHERE ct.id = ?`).bind(id).first();
  return c.json({ contact: publicContact(updated) });
});

// Soft delete — the row stays in D1 with who removed it and when.
app.delete('/contacts/:id', auth, async (c) => {
  const id = c.req.param('id');
  const { row, status } = await editable(c, id);
  if (!row) return c.json({ error: status === 403 ? 'you can only delete contacts you captured' : 'not found' }, status);
  await c.env.DB.prepare('UPDATE contacts SET deleted_at = ?, deleted_by = ? WHERE id = ?')
    .bind(Date.now(), c.get('user').id, id).run();
  return c.json({ ok: true });
});

// People who have captured anything — feeds the Report's "captured by" filter.
app.get('/capturers', auth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.display_name FROM users u
     WHERE EXISTS (SELECT 1 FROM contacts WHERE created_by = u.id) ORDER BY COALESCE(u.display_name, u.email)`,
  ).all();
  return c.json({ users: results });
});

// ---------------- admin: users ----------------
app.get('/admin/users', auth, requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.email, u.role, u.display_name, u.active, u.created_at, u.last_login_at,
            (u.password_hash IS NOT NULL) AS joined,
            (SELECT MAX(expires_at) FROM tokens WHERE user_id = u.id AND kind = 'invite' AND used_at IS NULL) AS invite_expires_at,
            (SELECT COUNT(*) FROM contacts WHERE created_by = u.id AND deleted_at IS NULL) AS contacts
     FROM users u ORDER BY u.created_at`,
  ).all();
  return c.json({
    users: results.map((r: any) => ({ ...r, active: Boolean(r.active), joined: Boolean(r.joined) })),
    email_enabled: Boolean(c.env.EMAIL),
  });
});

async function sendInvite(c: any, user: { id: string; email: string; display_name: string | null }) {
  const me = c.get('user');
  const raw = await issueToken(c, 'invite', user.id, me.id);
  const link = linkFor(c, 'invite', raw);
  const email_error = await sendMail(c, {
    to: user.email,
    ...inviteEmail({ link, inviter: me.display_name || me.email, name: user.display_name }),
  });
  // The link goes back to the admin too, so an invite still works if the email doesn't land.
  return { link, email_sent: !email_error, email_error };
}

app.post('/admin/users', auth, requireAdmin, async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const email = String(b.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return c.json({ error: 'enter a valid email address' }, 400);
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) return c.json({ error: 'that email already has an account' }, 409);
  const user = {
    id: crypto.randomUUID(), email,
    role: b.role === 'admin' ? 'admin' : 'user',
    display_name: b.display_name ? String(b.display_name).trim().slice(0, 80) || null : null,
  };
  await c.env.DB.prepare('INSERT INTO users (id, email, role, display_name, created_at) VALUES (?,?,?,?,?)')
    .bind(user.id, email, user.role, user.display_name, Date.now()).run();
  return c.json({ user, ...(await sendInvite(c, user)) });
});

app.post('/admin/users/:id/invite', auth, requireAdmin, async (c) => {
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(c.req.param('id')).first();
  if (!user) return c.json({ error: 'not found' }, 404);
  if (user.password_hash) return c.json({ error: 'they have already set up their account' }, 400);
  return c.json(await sendInvite(c, user as any));
});

app.patch('/admin/users/:id', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  const self = id === c.get('user').id;
  const b = await c.req.json().catch(() => ({} as any));
  const stmts: D1PreparedStatement[] = [];
  if (b.role !== undefined) {
    if (self) return c.json({ error: "you can't change your own role" }, 400);
    stmts.push(c.env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(b.role === 'admin' ? 'admin' : 'user', id));
  }
  if (b.active !== undefined) {
    if (self) return c.json({ error: "you can't deactivate yourself" }, 400);
    stmts.push(c.env.DB.prepare('UPDATE users SET active = ? WHERE id = ?').bind(b.active ? 1 : 0, id));
    if (!b.active) stmts.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id));
  }
  if (b.display_name !== undefined) {
    stmts.push(c.env.DB.prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .bind(String(b.display_name).trim().slice(0, 80) || null, id));
  }
  if (stmts.length) await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// Only users who never captured anything can be removed outright; others get deactivated
// so the "captured by" trail stays intact.
app.delete('/admin/users/:id', auth, requireAdmin, async (c) => {
  const id = c.req.param('id');
  if (id === c.get('user').id) return c.json({ error: "you can't delete yourself" }, 400);
  const used = await c.env.DB.prepare('SELECT 1 FROM contacts WHERE created_by = ? LIMIT 1').bind(id).first();
  if (used) return c.json({ error: 'this user has captured contacts — deactivate them instead' }, 409);
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM tokens WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id),
  ]);
  return c.json({ ok: true });
});

export default app;
