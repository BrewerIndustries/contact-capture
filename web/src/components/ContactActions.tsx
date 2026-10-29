import { useState } from 'react';
import { api, type Contact, type Field } from '../lib/api';
import { useAuth } from '../lib/auth';
import ContactForm from './ContactForm';
import { Modal } from './ui';

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
          <ContactForm fields={fields} initial={contact.data} editingId={contact.id} submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={async (data) => {
              await api.updateContact(contact.id, data);
              setEditing(false);
              onChanged();
            }} />
        </Modal>
      )}
    </>
  );
}
