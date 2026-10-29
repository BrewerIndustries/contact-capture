export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export type User = { id: string; email: string; role: 'user' | 'admin'; display_name: string | null };

export type FieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'date' | 'number';

export type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  position: number;
  active: boolean;
};

export type Values = Record<string, string | boolean>;

export type Person = { id: string; email: string; name: string | null };

export type Event = { id: string; name: string; active: boolean; created_at: number };

export type EventsState = {
  events: Event[];
  default_event_id: string | null;
  my_choice: string | null;      // null = following the default
  my_event_id: string | null;    // what new captures get stamped with
};

export type Contact = {
  id: string;
  data: Values;
  event: { id: string; name: string } | null;
  created_by: Person;
  created_at: number;
  updated_by: Person | null;
  updated_at: number | null;
};

export type AdminUser = User & {
  active: boolean;
  joined: boolean;
  created_at: number;
  last_login_at: number | null;
  invite_expires_at: number | null;
  contacts: number;
  event_id: string | null;
};

export type InviteResult = { link: string; email_sent: boolean; email_error: string | null };

export type ContactFilters = { q?: string; by?: string; event?: string; from?: number; to?: number; mine?: boolean };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'include',
    ...opts,
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(opts.headers || {}) },
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) msg = j.error;
    } catch { /* ignore */ }
    throw new ApiError(msg, res.status);
  }
  return (await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function qs(f: ContactFilters): string {
  const p = new URLSearchParams();
  if (f.q) p.set('q', f.q);
  if (f.by) p.set('by', f.by);
  if (f.event) p.set('event', f.event);
  if (f.from) p.set('from', String(f.from));
  if (f.to) p.set('to', String(f.to));
  if (f.mine) p.set('mine', '1');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  me: () => req<{ user: User }>('/auth/me').then((r) => r.user),
  login: (email: string, password: string) => req<{ user: User }>('/auth/login', json('POST', { email, password })).then((r) => r.user),
  logout: () => req<{ ok: true }>('/auth/logout', { method: 'POST' }),
  forgot: (email: string) => req<{ ok: true }>('/auth/forgot', json('POST', { email })),
  changePassword: (current: string, next: string) => req<{ ok: true }>('/auth/password', json('POST', { current, next })),
  saveProfile: (display_name: string) => req<{ user: User }>('/auth/profile', json('PUT', { display_name })).then((r) => r.user),
  checkLink: (kind: 'invite' | 'reset', token: string) =>
    req<{ email: string; display_name: string | null }>(`/auth/${kind === 'invite' ? 'accept' : 'reset'}?token=${encodeURIComponent(token)}`),
  useLink: (kind: 'invite' | 'reset', d: { token: string; password: string; display_name?: string }) =>
    req<{ user: User }>(`/auth/${kind === 'invite' ? 'accept' : 'reset'}`, json('POST', d)).then((r) => r.user),

  fields: () => req<{ fields: Field[]; types: FieldType[] }>('/fields'),
  addField: (f: Partial<Field>) => req<{ fields: Field[] }>('/fields', json('POST', f)).then((r) => r.fields),
  updateField: (id: string, f: Partial<Field>) => req<{ fields: Field[] }>(`/fields/${id}`, json('PATCH', f)).then((r) => r.fields),
  reorderFields: (ids: string[]) => req<{ fields: Field[] }>('/fields/order', json('PUT', { ids })).then((r) => r.fields),
  deleteField: (id: string) => req<{ fields: Field[] }>(`/fields/${id}`, { method: 'DELETE' }).then((r) => r.fields),

  contacts: (f: ContactFilters = {}) => req<{ contacts: Contact[] }>(`/contacts${qs(f)}`).then((r) => r.contacts),
  capture: (data: Values, event_id: string | null) => req<{ contact: Contact; duplicates: Contact[] }>('/contacts', json('POST', { data, event_id })),
  updateContact: (id: string, data: Values, event_id?: string | null) =>
    req<{ contact: Contact }>(`/contacts/${id}`, json('PATCH', { data, event_id })).then((r) => r.contact),

  events: () => req<EventsState>('/events'),
  addEvent: (name: string, make_default = false) => req<EventsState>('/events', json('POST', { name, make_default })),
  updateEvent: (id: string, d: { name?: string; active?: boolean }) => req<EventsState>(`/events/${id}`, json('PATCH', d)),
  deleteEvent: (id: string) => req<EventsState>(`/events/${id}`, { method: 'DELETE' }),
  setDefaultEvent: (event_id: string | null) => req<EventsState>('/events/default', json('PUT', { event_id })),
  setMyEvent: (event_id: string | null) => req<EventsState>('/me/event', json('PUT', { event_id })),
  deleteContact: (id: string) => req<{ ok: true }>(`/contacts/${id}`, { method: 'DELETE' }),
  checkDuplicate: (email: string, exclude = '') =>
    req<{ duplicates: Contact[] }>(`/contacts/check?email=${encodeURIComponent(email)}&exclude=${encodeURIComponent(exclude)}`).then((r) => r.duplicates),
  capturers: () => req<{ users: { id: string; email: string; display_name: string | null }[] }>('/capturers').then((r) => r.users),

  users: () => req<{ users: AdminUser[]; email_enabled: boolean }>('/admin/users'),
  inviteUser: (d: { email: string; role: string; display_name?: string }) =>
    req<InviteResult & { user: User }>('/admin/users', json('POST', d)),
  resendInvite: (id: string) => req<InviteResult>(`/admin/users/${id}/invite`, { method: 'POST' }),
  updateUser: (id: string, d: { role?: string; active?: boolean; display_name?: string; event_id?: string | null }) =>
    req<{ ok: true }>(`/admin/users/${id}`, json('PATCH', d)),
  deleteUser: (id: string) => req<{ ok: true }>(`/admin/users/${id}`, { method: 'DELETE' }),
};

export const personName = (p: Person | null) => (p ? p.name || p.email : '');
