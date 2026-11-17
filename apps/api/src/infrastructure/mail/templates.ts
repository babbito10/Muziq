/** Minimal, accessible transactional email templates (plain text + simple HTML). */

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }) {
  const html = `<!doctype html><html lang="en"><body style="margin:0;background:#0a0f1e;font-family:Arial,sans-serif;color:#eef1f8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#151b2e;border-radius:16px;padding:32px">
<tr><td><p style="margin:0 0 24px;font-size:20px;font-weight:bold;color:#2dd4bf">MusicVerse</p>
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(title)}</h1>
${paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5;color:#c9cfe0">${escapeHtml(p)}</p>`).join('')}
${action ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#2dd4bf;color:#042f2e;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#a3acc4;word-break:break-all">${escapeHtml(action.url)}</p>` : ''}
</td></tr></table></td></tr></table></body></html>`;
  const text = [
    title,
    '',
    ...paragraphs,
    ...(action ? ['', `${action.label}: ${action.url}`] : []),
  ].join('\n');
  return { html, text };
}

export function verificationEmail(name: string, url: string) {
  return {
    template: 'email_verification',
    subject: 'Verify your MusicVerse email',
    ...layout(
      `Welcome, ${name}`,
      [
        'Confirm your email address to secure your account and unlock creator features.',
        'This link expires in 24 hours.',
      ],
      { label: 'Verify email', url },
    ),
  };
}

export function passwordResetEmail(name: string, url: string) {
  return {
    template: 'password_reset',
    subject: 'Reset your MusicVerse password',
    ...layout(
      `Hi ${name}`,
      [
        'We received a request to reset your password. This link expires in 30 minutes.',
        'If you did not request this, you can ignore this email — your password will not change.',
      ],
      { label: 'Reset password', url },
    ),
  };
}

export function passwordChangedEmail(name: string) {
  return {
    template: 'password_changed',
    subject: 'Your MusicVerse password was changed',
    ...layout(`Hi ${name}`, [
      'Your password was just changed and other sessions were signed out.',
      'If this was not you, reset your password immediately and contact support.',
    ]),
  };
}

export function accountDeletionEmail(name: string) {
  return {
    template: 'account_deletion_scheduled',
    subject: 'Your MusicVerse account is scheduled for deletion',
    ...layout(`Goodbye for now, ${name}`, [
      'Your account has been deactivated and will be permanently anonymised after 30 days.',
      'If you did not request this, contact support immediately.',
    ]),
  };
}
