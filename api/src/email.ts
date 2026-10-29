// Invite + password-reset email bodies (HTML and plain text both, for deliverability).

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

function layout(heading: string, body: string, link: string, button: string, footer: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f6f9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0f1a24">
<div style="max-width:480px;margin:32px auto;background:#fff;border-radius:14px;padding:28px;border:1px solid #e3e8ee">
  <div style="font-weight:700;font-size:15px;color:#0d9488;margin-bottom:18px">Contact Capture</div>
  <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 22px">${body}</p>
  <a href="${esc(link)}" style="display:inline-block;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:9px">${button}</a>
  <p style="font-size:12px;color:#66727f;line-height:1.5;margin:22px 0 0">${footer}<br>If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all">${esc(link)}</span></p>
</div></body></html>`;
}

export function inviteEmail({ link, inviter, name }: { link: string; inviter: string; name: string | null }) {
  const hi = name ? `Hi ${name},` : 'Hi,';
  return {
    subject: `${inviter} invited you to Contact Capture`,
    html: layout(
      'You\'re invited',
      `${esc(hi)} ${esc(inviter)} added you to Contact Capture. Set a password to finish creating your account.`,
      link, 'Create my account', 'This link works once and expires in 72 hours.',
    ),
    text: `${hi}\n\n${inviter} added you to Contact Capture. Set a password to finish creating your account:\n\n${link}\n\nThis link works once and expires in 72 hours.`,
  };
}

export function resetEmail(link: string) {
  return {
    subject: 'Reset your Contact Capture password',
    html: layout(
      'Reset your password',
      'Someone (hopefully you) asked to reset the password for this account.',
      link, 'Choose a new password', 'This link works once and expires in 1 hour. If you didn\'t ask for this, ignore this email.',
    ),
    text: `Someone (hopefully you) asked to reset your Contact Capture password. Choose a new one here:\n\n${link}\n\nThis link works once and expires in 1 hour. If you didn't ask for this, ignore this email.`,
  };
}
