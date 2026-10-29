-- Notes: a base long-text field at the end of the capture form. Skipped if an admin
-- already made a field with this id.
INSERT OR IGNORE INTO fields (id, label, type, required, options, position, active, created_at)
SELECT 'notes', 'Notes', 'textarea', 0, NULL, COALESCE(MAX(position), 0) + 1, 1, 0 FROM fields;
