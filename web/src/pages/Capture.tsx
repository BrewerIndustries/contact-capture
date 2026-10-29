import { useEffect, useState } from 'react';
import { api, type Contact, type EventsState, type Field } from '../lib/api';
import ContactForm from '../components/ContactForm';
import ContactActions from '../components/ContactActions';
import { Card, ErrorNote, Note, inputCls, fmtDate } from '../components/ui';

export default function Capture() {
  const [fields, setFields] = useState<Field[] | null>(null);
  const [mine, setMine] = useState<Contact[]>([]);
  const [ev, setEv] = useState<EventsState | null>(null);
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');

  const loadMine = () => api.contacts({ mine: true }).then(setMine).catch(() => {});

  useEffect(() => {
    api.fields().then((r) => setFields(r.fields)).catch((e) => setError(e.message));
    api.events().then(setEv).catch(() => {});
    loadMine();
  }, []);

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!fields) return <p className="text-ink/40">Loading…</p>;

  const active = fields.filter((f) => f.active);
  // The first two active fields make a readable one-line summary of each recent capture.
  const summary = (c: Contact) =>
    active.slice(0, 2).map((f) => c.data[f.id]).filter((v) => v !== undefined && v !== '').join(' · ') || '(blank)';

  const activeEvents = ev?.events.filter((e) => e.active) || [];
  const defaultName = ev?.events.find((e) => e.id === ev.default_event_id)?.name;
  const pickEvent = (id: string) => api.setMyEvent(id || null).then(setEv).catch((e) => setError(e.message));

  return (
    <div className="space-y-6">
      <Card title="New contact" right={ev && (activeEvents.length > 0 || ev.my_event_id) ? (
        <label className="flex w-full items-center gap-2 sm:w-auto">
          <span className="text-xs font-medium text-ink/60">Event</span>
          <select className={`${inputCls} sm:w-64`} value={ev.my_choice || ''} onChange={(e) => pickEvent(e.target.value)}>
            <option value="">{defaultName ? `${defaultName} (default)` : 'No event'}</option>
            {activeEvents.filter((e) => e.id !== ev.default_event_id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
      ) : undefined}>
        {!active.length ? (
          <p className="text-sm text-ink/50">No fields are switched on. An admin can add some under Settings.</p>
        ) : (
          <div className="space-y-4">
            {saved && <Note>Saved {saved}. Ready for the next one.</Note>}
            <ContactForm fields={fields} submitLabel="Save contact"
              onSubmit={async (data) => {
                const r = await api.capture(data, ev?.my_event_id ?? null);
                setSaved(summary(r.contact));
                loadMine();
                return 'reset';
              }} />
          </div>
        )}
      </Card>

      <Card title={`My captures${mine.length ? ` (${mine.length})` : ''}`}>
        {!mine.length ? (
          <p className="text-sm text-ink/50">Contacts you save show up here.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {mine.slice(0, 25).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{summary(c)}</div>
                  <div className="text-xs text-ink/50">{fmtDate(c.created_at)}{c.event && ` · ${c.event.name}`}</div>
                </div>
                <ContactActions contact={c} fields={fields} onChanged={loadMine} />
              </li>
            ))}
          </ul>
        )}
        {mine.length > 25 && <p className="mt-2 text-xs text-ink/50">Showing your latest 25 — the Report tab has everything.</p>}
      </Card>
    </div>
  );
}
