import { useEffect, useState } from 'react';
import { api, type Contact, type Event, type Field } from '../lib/api';
import { useAuth } from '../lib/auth';
import ContactForm from './ContactForm';
import { inputCls, Modal } from './ui';

export const canEdit = (c: Contact, user: { id: string; role: string } | null) =>
  !!user && (user.role === 'admin' || c.created_by.id === user.id);

// Edit / delete buttons for one contact, plus the edit dialog.
export default function ContactActions({ contact, fields, onChanged }: {
  contact: Contact;
  fields: Field[];
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventId, setEventId] = useState(contact.event?.id || '');
  useEffect(() => {
    if (editing) { setEventId(contact.event?.id || ''); api.events().then((r) => setEvents(r.events)).catch(() => {}); }
  }, [editing, contact.event?.id]);
  if (!canEdit(contact, user)) return null;

  async function remove() {
    if (!confirm('Delete this contact? It disappears from the report.')) return;
    try {
      await api.deleteContact(contact.id);
      onChanged();
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <>
      <div className="flex justify-end gap-1 whitespace-nowrap">
        <button onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-xs text-accent hover:bg-accent/10">Edit</button>
        <button onClick={remove} className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-500/10">Delete</button>
      </div>
      {editing && (
        <Modal title="Edit contact" onClose={() => setEditing(false)}>
          {(events.length > 0 || contact.event) && (
            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-medium text-ink/60">Event</span>
              <select className={inputCls} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                <option value="">No event</option>
                {events.filter((e) => e.active || e.id === contact.event?.id).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </label>
          )}
          <ContactForm fields={fields} initial={contact.data} editingId={contact.id} submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              await api.updateContact(contact.id, data, eventId || null);
              setEditing(false);
              onChanged();
            }} />
        </Modal>
      )}
    </>
  );
}
