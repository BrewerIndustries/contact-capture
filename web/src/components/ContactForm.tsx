import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, personName, type Contact, type Field, type Values } from '../lib/api';
import { Button, ErrorNote, inputCls, Note, fmtDate } from './ui';

// The capture form, built from the active fields. Used on the Capture tab and in
// the edit dialog. `onSubmit` throws to show an error; resolve to reset/close.
export default function ContactForm({ fields, initial, editingId = '', submitLabel, onSubmit, onCancel }: {
  fields: Field[];
  initial?: Values;
  editingId?: string;
  submitLabel: string;
  onSubmit: (data: Values) => Promise<void | 'reset'>;
  onCancel?: () => void;
}) {
  const active = fields.filter((f) => f.active);
  const [values, setValues] = useState<Values>(initial || {});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dupes, setDupes] = useState<Contact[]>([]);
  const firstRef = useRef<HTMLInputElement | null>(null);

  const set = (id: string, v: string | boolean) => setValues((s) => ({ ...s, [id]: v }));

  async function checkDupes(email: string) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setDupes([]);
    setDupes(await api.checkDuplicate(email.trim(), editingId).catch(() => []));
  }

  // A fresh form after each capture puts the cursor back in the first box.
  useEffect(() => { if (!initial) firstRef.current?.focus(); }, [initial]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await onSubmit(values);
      if (r === 'reset') {
        setValues({});
        setDupes([]);
        firstRef.current?.focus();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {active.map((f, i) => {
          const id = `f-${f.id}`;
          const v = values[f.id];
          const common = {
            id, required: f.required,
            ref: i === 0 ? (el: any) => { firstRef.current = el; } : undefined,
          };
          const wide = f.type === 'textarea';
          const label = (
            <label htmlFor={id} className="mb-1 block text-xs font-medium text-ink/60">
              {f.label}{f.required && <span className="text-accent"> *</span>}
            </label>
          );
          if (f.type === 'checkbox') {
            return (
              <label key={f.id} className="flex min-h-11 items-center gap-3 rounded-lg px-1 text-sm sm:col-span-2">
                <input {...common} type="checkbox" className="h-5 w-5" checked={v === true}
                  onChange={(e) => set(f.id, e.target.checked)} />
                {f.label}{f.required && <span className="text-accent">*</span>}
              </label>
            );
          }
          return (
            <div key={f.id} className={wide ? 'sm:col-span-2' : ''}>
              {label}
              {f.type === 'textarea' ? (
                <textarea {...common} rows={3} className={inputCls} value={String(v ?? '')}
                  onChange={(e) => set(f.id, e.target.value)} />
              ) : f.type === 'select' ? (
                <select {...common} className={inputCls} value={String(v ?? '')} onChange={(e) => set(f.id, e.target.value)}>
                  <option value="">—</option>
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input {...common} className={inputCls} value={String(v ?? '')}
                  type={{ email: 'email', phone: 'tel', date: 'date', number: 'number' }[f.type as string] || 'text'}
                  inputMode={f.type === 'number' ? 'decimal' : undefined}
                  autoCapitalize={f.type === 'email' ? 'none' : f.type === 'text' ? 'words' : undefined}
                  autoComplete="off" spellCheck={f.type !== 'email'}
                  onChange={(e) => set(f.id, e.target.value)}
                  onBlur={f.type === 'email' ? (e) => checkDupes(e.target.value) : undefined} />
              )}
            </div>
          );
        })}
      </div>
      {dupes.length > 0 && (
        <Note tone="warn">
          Heads up: this email was already captured{' '}
          {dupes.slice(0, 2).map((d, i) => (
            <span key={d.id}>{i > 0 && '; '}by {personName(d.created_by)} on {fmtDate(d.created_at)}</span>
          ))}
          {dupes.length > 2 && ` (+${dupes.length - 2} more)`}. You can still save it.
        </Note>
      )}
      <ErrorNote>{error}</ErrorNote>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !active.length} className="flex-1 py-3 text-base sm:flex-none sm:px-6">
          {busy ? 'Saving…' : submitLabel}
        </Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
      </div>
    </form>
  );
}
