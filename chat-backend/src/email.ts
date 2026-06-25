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
  const text = `Bonjour ${args.firstname},\n\nUn compte a été créé pour vous dans l'organisation "${args.organisationName}".\nDéfinissez votre mot de passe pour l'activer : ${link}\n\nÀ bientôt sur Lime.`;
  const html = `<p>Bonjour ${args.firstname},</p>
<p>Un compte a été créé pour vous dans l'organisation <strong>${args.organisationName}</strong>.</p>
<p><a href="${link}">Définissez votre mot de passe</a> pour activer votre compte.</p>
<p>À bientôt sur Lime.</p>`;
  await send({ to: args.to, subject, html, text });
}
