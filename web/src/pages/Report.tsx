import { useEffect, useMemo, useState } from 'react';
import { api, personName, type Contact, type Event, type Field } from '../lib/api';
import ContactActions from '../components/ContactActions';
import { Button, Card, ErrorNote, inputCls, fmtDate } from '../components/ui';

const dayStart = (s: string) => (s ? new Date(`${s}T00:00:00`).getTime() : undefined);
const dayEnd = (s: string) => (s ? new Date(`${s}T00:00:00`).getTime() + 86_400_000 : undefined);

function cell(v: unknown): string {
  if (v === true) return 'Yes';
  if (v === false || v === undefined || v === null) return '';
  return String(v);
}

function csvEscape(s: string) {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Report() {
  const [fields, setFields] = useState<Field[]>([]);
  const [rows, setRows] = useState<Contact[] | null>(null);
  const [people, setPeople] = useState<{ id: string; email: string; display_name: string | null }[]>([]);
  const [q, setQ] = useState('');
  const [by, setBy] = useState('');
  const [event, setEvent] = useState('');
  const [events, setEvents] = useState<Event[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api.contacts({ q: q.trim(), by, event, from: dayStart(from), to: dayEnd(to) })
      .then((r) => { setRows(r); setError(''); })
      .catch((e) => setError(e.message));

  useEffect(() => {
    api.fields().then((r) => setFields(r.fields)).catch((e) => setError(e.message));
    api.capturers().then(setPeople).catch(() => {});
    api.events().then((r) => setEvents(r.events)).catch(() => {});
  }, []);

  // Re-query as filters change; the search box waits for a pause in typing.
  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q, by, event, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  // Active fields first, then retired ones that still hold data in these rows.
  const columns = useMemo(() => {
    const has = (f: Field) => rows?.some((r) => r.data[f.id] !== undefined);
    return [...fields.filter((f) => f.active), ...fields.filter((f) => !f.active && has(f))];
  }, [fields, rows]);

  function exportCsv() {
    if (!rows) return;
    const head = [...columns.map((f) => f.label + (f.active ? '' : ' (retired)')), 'Event', 'Captured by', 'Captured by email', 'Captured at', 'Last edited by', 'Last edited at'];
    const lines = rows.map((r) => [
      ...columns.map((f) => cell(r.data[f.id])),
      r.event?.name || '',
      r.created_by.name || '', r.created_by.email || '',
      new Date(r.created_at).toISOString(),
      personName(r.updated_by), r.updated_at ? new Date(r.updated_at).toISOString() : '',
    ]);
    // BOM so Excel reads UTF-8 names correctly.
    const csv = '﻿' + [head, ...lines].map((l) => l.map(csvEscape).join(',')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `contacts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const filtered = q || by || event || from || to;

  return (
    <div className="space-y-4">
      <Card title="Report" right={
        <Button onClick={exportCsv} disabled={!rows?.length}>Export CSV{rows ? ` (${rows.length})` : ''}</Button>
      }>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input className={inputCls} placeholder="Search any field…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className={inputCls} value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">Event: all</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.name}{e.active ? '' : ' (archived)'}</option>)}
            <option value="none">No event</option>
          </select>
          <select className={inputCls} value={by} onChange={(e) => setBy(e.target.value)}>
            <option value="">Captured by: anyone</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.email}</option>)}
          </select>
          <div className="flex min-w-0 items-center gap-2">
            <input type="date" aria-label="From date" className={`${inputCls} min-w-0`} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-ink/40">–</span>
            <input type="date" aria-label="To date" className={`${inputCls} min-w-0`} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        {filtered && (
          <button className="mt-2 text-xs text-ink/50 hover:text-ink" onClick={() => { setQ(''); setBy(''); setEvent(''); setFrom(''); setTo(''); }}>
            Clear filters
          </button>
        )}
      </Card>

      <ErrorNote>{error}</ErrorNote>

      {!rows ? (
        <p className="text-ink/40">Loading…</p>
      ) : !rows.length ? (
        <Card><p className="text-sm text-ink/50">{filtered ? 'Nothing matches those filters.' : 'No contacts captured yet.'}</p></Card>
      ) : (
        <>
        <ul className="space-y-3 sm:hidden">
          {rows.map((r) => {
            const [head, ...rest] = columns;
            return (
              <li key={r.id} className="rounded-2xl bg-panel p-4 shadow-sm ring-1 ring-ink/10">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{head ? cell(r.data[head.id]) || '(blank)' : ''}</div>
                    {r.event && <div className="mt-0.5 text-xs font-medium text-accent">{r.event.name}</div>}
                  </div>
                  <ContactActions contact={r} fields={fields} onChanged={load} />
                </div>
                <dl className="mt-2 space-y-1 text-sm">
                  {rest.filter((f) => cell(r.data[f.id])).map((f) => (
                    <div key={f.id} className="flex gap-2">
                      <dt className="w-28 shrink-0 text-ink/50">{f.label}</dt>
                      <dd className="min-w-0 whitespace-pre-line break-words">{cell(r.data[f.id])}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-2 text-xs text-ink/50">
                  {personName(r.created_by)} · {fmtDate(r.created_at)}{r.updated_at && ' · edited'}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hidden overflow-x-auto rounded-2xl bg-panel shadow-sm ring-1 ring-ink/10 sm:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-ink/10 text-xs uppercase tracking-wider text-ink/50">
              <tr>
                {columns.map((f) => (
                  <th key={f.id} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                    {f.label}{!f.active && <span className="ml-1 normal-case tracking-normal text-ink/40">(retired)</span>}
                  </th>
                ))}
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Event</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Captured by</th>
                <th className="whitespace-nowrap px-3 py-2.5 font-semibold">Captured</th>
                <th className="sticky right-0 bg-panel px-3 py-2.5 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-ink/[0.03]">
                  {columns.map((f) => (
                    <td key={f.id} className="max-w-64 whitespace-pre-line px-3 py-2 break-words">{cell(r.data[f.id])}</td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2">{r.event?.name || ''}</td>
                  <td className="whitespace-nowrap px-3 py-2">{personName(r.created_by)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink/60" title={r.updated_at ? `Edited ${fmtDate(r.updated_at)} by ${personName(r.updated_by)}` : undefined}>
                    {fmtDate(r.created_at)}{r.updated_at && <span className="ml-1 text-xs text-ink/40">(edited)</span>}
                  </td>
                  <td className="sticky right-0 bg-panel px-2 py-1.5 shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.15)]"><ContactActions contact={r} fields={fields} onChanged={load} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
