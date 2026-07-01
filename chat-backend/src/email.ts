import { MailtrapClient } from "mailtrap";

// Intégration email via le SDK officiel Mailtrap.
//  - MAILTRAP_INBOX_ID défini  -> Email Testing (sandbox) : mails capturés dans
//    l'inbox virtuelle, aucune vérification d'expéditeur.
//  - sinon                     -> Email Sending (envoi réel). L'expéditeur de
//    démo `hello@demomailtrap.co` fonctionne sans vérifier de domaine.
const TOKEN = process.env.MAILTRAP_API_TOKEN;
const INBOX_ID = process.env.MAILTRAP_INBOX_ID;
const MAIL_FROM = process.env.MAIL_FROM || "hello@demomailtrap.co";
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "Lime";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const isConfigured = Boolean(TOKEN);

const client = isConfigured
  ? new MailtrapClient(
      INBOX_ID
        ? {
            token: TOKEN as string,
            sandbox: true,
            testInboxId: Number(INBOX_ID),
          }
        : { token: TOKEN as string },
    )
  : null;

/** True si un token Mailtrap est présent (sinon les mails sont seulement loggés). */
export function isEmailConfigured(): boolean {
  return isConfigured;
}

/** Échappe les caractères HTML dangereux dans les valeurs interpolées. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Gabarit d'email responsive : tables + styles inline pour une compatibilité
 * maximale avec les clients mail (Gmail, Outlook, Apple Mail…).
 */
function renderEmail(opts: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background-color:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:32px 40px 8px;">
              <span style="display:inline-block;font-size:20px;font-weight:700;color:#65a30d;">Lime</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 0;">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#18181b;">${escapeHtml(opts.heading)}</h1>
              <div style="font-size:15px;line-height:1.6;color:#3f3f46;">${opts.body}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 40px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:#65a30d;">
                    <a href="${escapeHtml(opts.ctaHref)}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(opts.ctaLabel)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;word-break:break-all;">Ou copiez ce lien : ${escapeHtml(opts.ctaHref)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">${escapeHtml(opts.footer)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function send({ to, subject, html, text }: SendArgs): Promise<void> {
  if (!client) {
    console.warn(
      `[email] MAILTRAP_API_TOKEN absent — mail non envoyé à ${to} (sujet: "${subject}")`,
    );
    return;
  }

  await client.send({
    from: { email: MAIL_FROM, name: MAIL_FROM_NAME },
    to: [{ email: to }],
    subject,
    html,
    text,
  });
}

/**
 * Envoie l'invitation à un nouveau membre : lien d'activation pour qu'il
 * définisse son mot de passe et active son compte dans l'organisation.
 */
export async function sendInvitationEmail(args: {
  to: string;
  firstname: string;
  organisationName: string;
  token: string;
}): Promise<void> {
  const link = `${CLIENT_ORIGIN}/activate?token=${encodeURIComponent(args.token)}`;
  const subject = `Vous avez été invité·e à rejoindre ${args.organisationName} sur Lime`;
  const text = `Bonjour ${args.firstname},\n\nUn compte a été créé pour vous dans l'organisation "${args.organisationName}".\nDéfinissez votre mot de passe pour l'activer : ${link}\n\nCe lien est valable 7 jours.\n\nÀ bientôt sur Lime.`;
  const html = renderEmail({
    heading: "Bienvenue sur Lime",
    body: `
      <p style="margin:0 0 16px;">Bonjour ${escapeHtml(args.firstname)},</p>
      <p style="margin:0 0 16px;">Un compte a été créé pour vous dans l'organisation <strong>${escapeHtml(args.organisationName)}</strong>. Définissez votre mot de passe pour activer votre compte et commencer à discuter.</p>`,
    ctaLabel: "Activer mon compte",
    ctaHref: link,
    footer:
      "Ce lien est valable 7 jours. Si vous n'êtes pas à l'origine de cette invitation, ignorez cet email.",
  });
  await send({ to: args.to, subject, html, text });
}
