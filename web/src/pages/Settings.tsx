import { useEffect, useState, type FormEvent } from 'react';
import { api, type AdminUser, type EventsState, type Field, type FieldType, type InviteResult } from '../lib/api';
import { useAuth } from '../lib/auth';
import { getTheme, setTheme, type Theme } from '../lib/theme';
import { Button, Card, ErrorNote, Input, Modal, Note, PasswordInput, inputCls, fmtDate } from '../components/ui';

const TYPE_LABELS: Record<FieldType, string> = {
  text: 'Text', email: 'Email', phone: 'Phone', textarea: 'Long text', select: 'Dropdown',
  checkbox: 'Checkbox', date: 'Date', number: 'Number',
};

export default function Settings() {
  const { user } = useAuth();
  const admin = user?.role === 'admin';
  return (
    <div className="space-y-6">
      {admin && <EventsCard />}
      <FieldsCard admin={admin} />
      {admin && <UsersCard />}
      <AccountCard />
      <AppearanceCard />
    </div>
  );
}

// ---------------- events (admin) ----------------
function EventsCard() {
  const [st, setSt] = useState<EventsState | null>(null);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { api.events().then(setSt).catch((e) => setError(e.message)); }, []);
  const run = (p: Promise<EventsState>) => p.then((s) => { setSt(s); setError(''); }).catch((e) => setError(e.message));

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await run(api.addEvent(name.trim()));
    setName('');
  }

  if (!st) return <Card title="Events"><ErrorNote>{error}</ErrorNote></Card>;
  const active = st.events.filter((e) => e.active);

  return (
    <Card title="Events">
      <div className="space-y-4">
        <label className="block max-w-sm">
          <span className="mb-1 block text-xs font-medium text-ink/60">Default event</span>
          <select className={inputCls} value={st.default_event_id || ''} onChange={(e) => run(api.setDefaultEvent(e.target.value || null))}>
            <option value="">No event</option>
            {active.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <span className="mt-1 block text-xs text-ink/50">Everyone captures to this unless they pick another event on the Capture tab.</span>
        </label>
        <ErrorNote>{error}</ErrorNote>
        {st.events.length > 0 && (
          <ul className="divide-y divide-ink/10">
            {st.events.map((e) => (
              <li key={e.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${e.active ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                  {e.name}
                  {e.id === st.default_event_id && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Default</span>}
                  {!e.active && <span className="ml-2 text-xs font-normal text-ink/50">archived</span>}
                </div>
                <div className="flex gap-1">
                  {e.active && e.id !== st.default_event_id && (
                    <button onClick={() => run(api.setDefaultEvent(e.id))} className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-accent hover:bg-accent/10">Make default</button>
                  )}
                  <button onClick={() => setRenaming({ id: e.id, name: e.name })} className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-ink/60 hover:bg-ink/5">Rename</button>
                  <button onClick={() => run(api.updateEvent(e.id, { active: !e.active }))}
                    className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-ink/60 hover:bg-ink/5">{e.active ? 'Archive' : 'Restore'}</button>
                  <button onClick={() => confirm(`Delete "${e.name}"?`) && run(api.deleteEvent(e.id))}
                    className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-red-500 hover:bg-red-500/10">Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={add} className="flex max-w-md gap-2">
          <Input placeholder="New event name, e.g. Spring Expo 2027" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={!name.trim()} className="whitespace-nowrap">Add event</Button>
        </form>
        <p className="text-xs text-ink/50">Archived events drop out of the pickers but stay on contacts already captured. Only events with no contacts can be deleted.</p>
      </div>
      {renaming && (
        <Modal title="Rename event" onClose={() => setRenaming(null)}>
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            await run(api.updateEvent(renaming.id, { name: renaming.name }));
            setRenaming(null);
          }}>
            <Input autoFocus value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} required />
            <div className="flex gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setRenaming(null)}>Cancel</Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

// ---------------- fields ----------------
function FieldsCard({ admin }: { admin: boolean }) {
  const [fields, setFields] = useState<Field[]>([]);
  const [types, setTypes] = useState<FieldType[]>([]);
  const [editing, setEditing] = useState<Field | 'new' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.fields().then((r) => { setFields(r.fields); setTypes(r.types); }).catch((e) => setError(e.message));
  }, []);

  const run = (p: Promise<Field[]>) => p.then((f) => { setFields(f); setError(''); }).catch((e) => setError(e.message));

  function move(i: number, d: -1 | 1) {
    const next = [...fields];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setFields(next);
    run(api.reorderFields(next.map((f) => f.id)));
  }

  return (
    <Card title="Capture fields" right={admin && <Button onClick={() => setEditing('new')}>Add field</Button>}>
      {!admin && <p className="mb-3 text-sm text-ink/50">Only admins can change the form.</p>}
      <ErrorNote>{error}</ErrorNote>
      <ul className="divide-y divide-ink/10">
        {fields.map((f, i) => (
          <li key={f.id} className={`flex items-center gap-3 py-2.5 ${f.active ? '' : 'opacity-50'}`}>
            {admin && (
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${f.label} up`}
                  className="px-2 py-1 text-xs leading-none text-ink/50 hover:text-ink disabled:opacity-20">▲</button>
                <button disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${f.label} down`}
                  className="px-2 py-1 text-xs leading-none text-ink/50 hover:text-ink disabled:opacity-20">▼</button>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {f.label}{f.required && <span className="text-accent"> *</span>}
              </div>
              <div className="text-xs text-ink/50">
                {TYPE_LABELS[f.type]}
                {f.type === 'select' && ` · ${f.options.length} option${f.options.length === 1 ? '' : 's'}`}
                {!f.active && ' · hidden'}
              </div>
            </div>
            {admin && (
              <div className="flex gap-1">
                <button onClick={() => run(api.updateField(f.id, { active: !f.active }))}
                  className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-ink/60 hover:bg-ink/5">{f.active ? 'Hide' : 'Show'}</button>
                <button onClick={() => setEditing(f)} className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-accent hover:bg-accent/10">Edit</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {admin && <p className="mt-3 text-xs text-ink/50">Hidden fields drop off the form but keep their data in the report.</p>}
      {editing && (
        <FieldDialog field={editing === 'new' ? null : editing} types={types} onClose={() => setEditing(null)}
          onSaved={(f) => { setFields(f); setEditing(null); }} />
      )}
    </Card>
  );
}

function FieldDialog({ field, types, onClose, onSaved }: {
  field: Field | null;
  types: FieldType[];
  onClose: () => void;
  onSaved: (f: Field[]) => void;
}) {
  const [label, setLabel] = useState(field?.label || '');
  const [type, setType] = useState<FieldType>(field?.type || 'text');
  const [required, setRequired] = useState(field?.required || false);
  const [options, setOptions] = useState((field?.options || []).join('\n'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { label, type, required, options: options.split('\n').map((s) => s.trim()).filter(Boolean) };
    try {
      onSaved(field ? await api.updateField(field.id, body) : await api.addField(body));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!field || !confirm(`Delete the "${field.label}" field?`)) return;
    try {
      onSaved(await api.deleteField(field.id));
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Modal title={field ? 'Edit field' : 'Add field'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Label</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} required autoFocus />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Type</span>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            {types.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          {field && field.type !== type && (
            <span className="mt-1 block text-xs text-amber-600">Existing answers stay as they were typed.</span>
          )}
        </label>
        {type === 'select' && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">Options (one per line)</span>
            <textarea rows={5} className={inputCls} value={options} onChange={(e) => setOptions(e.target.value)} />
          </label>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Required
        </label>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : field ? 'Save' : 'Add field'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          {field && <Button type="button" variant="danger" className="ml-auto" onClick={remove}>Delete</Button>}
        </div>
      </form>
    </Modal>
  );
}

// ---------------- users (admin) ----------------
function UsersCard() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<EventsState | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<(InviteResult & { email: string }) | null>(null);
  const [error, setError] = useState('');

  const load = () => api.users().then((r) => { setUsers(r.users); setEmailEnabled(r.email_enabled); }).catch((e) => setError(e.message));
  useEffect(() => { load(); api.events().then(setEvents).catch(() => {}); }, []);

  const act = (p: Promise<unknown>) => p.then(() => { setError(''); load(); }).catch((e) => setError(e.message));

  async function resend(u: AdminUser) {
    try {
      setResult({ ...(await api.resendInvite(u.id)), email: u.email });
      load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  function status(u: AdminUser) {
    if (!u.active) return 'Deactivated';
    if (!u.joined) {
      return u.invite_expires_at && u.invite_expires_at > Date.now()
        ? `Invited · link expires ${fmtDate(u.invite_expires_at)}` : 'Invite expired';
    }
    return u.last_login_at ? `Last signed in ${fmtDate(u.last_login_at)}` : 'Joined';
  }

  return (
    <Card title="Users" right={<Button onClick={() => setInviting(true)}>Invite user</Button>}>
      <ErrorNote>{error}</ErrorNote>
      {!emailEnabled && <Note tone="warn">Email sending isn't set up on this server, so share invite links by hand.</Note>}
      <ul className="divide-y divide-ink/10">
        {users.map((u) => {
          const self = u.id === me?.id;
          return (
            <li key={u.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 ${u.active ? '' : 'opacity-60'}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">
                  {u.display_name || u.email}
                  {u.role === 'admin' && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">Admin</span>}
                  {self && <span className="ml-1 text-xs text-ink/40">(you)</span>}
                </div>
                <div className="truncate text-xs text-ink/50">
                  {u.display_name && `${u.email} · `}{status(u)} · {u.contacts} captured
                </div>
              </div>
              {events && u.active && (
                <select aria-label={`Event for ${u.display_name || u.email}`} value={u.event_id || ''}
                  onChange={(e) => act(api.updateUser(u.id, { event_id: e.target.value || null }))}
                  className="max-w-44 rounded-md bg-field px-2 py-1 text-xs ring-1 ring-ink/15">
                  <option value="">Event: default{defaultName(events) ? ` (${defaultName(events)})` : ''}</option>
                  {events.events.filter((e) => e.active || e.id === u.event_id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
              {!self && (
                <div className="flex flex-wrap gap-1">
                  {!u.joined && u.active && (
                    <button onClick={() => resend(u)} className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-accent hover:bg-accent/10">Resend invite</button>
                  )}
                  <button onClick={() => act(api.updateUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }))}
                    className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-ink/60 hover:bg-ink/5">{u.role === 'admin' ? 'Make user' : 'Make admin'}</button>
                  <button onClick={() => act(api.updateUser(u.id, { active: !u.active }))}
                    className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-ink/60 hover:bg-ink/5">{u.active ? 'Deactivate' : 'Reactivate'}</button>
                  {u.contacts === 0 && (
                    <button onClick={() => confirm(`Remove ${u.email} completely?`) && act(api.deleteUser(u.id))}
                      className="rounded-md px-3 py-2 text-sm sm:px-2 sm:py-1 sm:text-xs text-red-500 hover:bg-red-500/10">Remove</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {inviting && (
        <InviteDialog onClose={() => setInviting(false)}
          onSent={(r) => { setInviting(false); setResult(r); load(); }} />
      )}
      {result && <InviteResultDialog result={result} onClose={() => setResult(null)} />}
    </Card>
  );
}

const defaultName = (st: EventsState) => st.events.find((e) => e.id === st.default_event_id)?.name || '';

function InviteDialog({ onClose, onSent }: { onClose: () => void; onSent: (r: InviteResult & { email: string }) => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api.inviteUser({ email, role, display_name: name });
      onSent({ ...r, email: r.user.email });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Invite user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-ink/60">They get an email with a link to set their own password. The link works once and lasts 72 hours.</p>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Email</span>
          <Input type="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Name (optional, they can change it)</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Role</span>
          <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="user">User: capture + report</option>
            <option value="admin">Admin: also settings + users</option>
          </select>
        </label>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2 pt-1">
          <Button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send invite'}</Button>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}

function InviteResultDialog({ result, onClose }: { result: InviteResult & { email: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Modal title={result.email_sent ? 'Invite sent' : 'Invite created'} onClose={onClose}>
      <div className="space-y-3">
        {result.email_sent
          ? <Note>An invite email is on its way to {result.email}.</Note>
          : <Note tone="warn">The email didn't go out ({result.email_error}). Send them this link yourself.</Note>}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink/60">Invite link</span>
          <input readOnly className={`${inputCls} font-mono text-xs`} value={result.link} onFocus={(e) => e.target.select()} />
        </label>
        <div className="flex gap-2">
          <Button onClick={() => navigator.clipboard.writeText(result.link).then(() => setCopied(true))}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------- account (everyone) ----------------
function AccountCard() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.display_name || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function saveName(e: FormEvent) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      setUser(await api.saveProfile(name));
      setMsg('Name saved.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setError(''); setMsg('');
    try {
      await api.changePassword(current, next);
      setCurrent(''); setNext('');
      setMsg('Password changed. Other devices were signed out.');
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <Card title="My account">
      <div className="grid gap-6 sm:grid-cols-2">
        <form onSubmit={saveName} className="space-y-3">
          <div className="text-sm"><span className="text-ink/50">Signed in as </span>{user?.email}</div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">Display name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <Button type="submit" variant="ghost">Save name</Button>
        </form>
        <form onSubmit={savePassword} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">Current password</span>
            <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">New password (10+ characters)</span>
            <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </label>
          <Button type="submit" variant="ghost">Change password</Button>
        </form>
      </div>
      <div className="mt-4 space-y-2">
        <ErrorNote>{error}</ErrorNote>
        {msg && <Note>{msg}</Note>}
      </div>
    </Card>
  );
}

// ---------------- appearance (everyone; saved per device) ----------------
function AppearanceCard() {
  const [theme, pick] = useState<Theme>(getTheme);
  const opts: { v: Theme; label: string }[] = [
    { v: 'system', label: 'Match device' }, { v: 'light', label: 'Light' }, { v: 'dark', label: 'Dark' },
  ];
  return (
    <Card title="Appearance">
      <div role="radiogroup" aria-label="Theme" className="inline-flex w-full rounded-xl bg-ink/5 p-1 sm:w-auto">
        {opts.map((o) => (
          <button key={o.v} role="radio" aria-checked={theme === o.v}
            onClick={() => { setTheme(o.v); pick(o.v); }}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:flex-none sm:py-2 ${theme === o.v ? 'bg-panel text-ink shadow-sm ring-1 ring-ink/10' : 'text-ink/60 hover:text-ink'}`}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink/50">Saved on this device.</p>
    </Card>
  );
}
