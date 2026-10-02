import "server-only";
import { orderEmailContent } from "./orders/email-content.js";

export async function sendOrderEmail({ recipient, order }) {
  const key = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const from = process.env.MAILGUN_FROM_EMAIL;
  if (!key || !domain || !from || !/^[a-z0-9.-]+$/i.test(domain)) throw new Error("Mailgun configuration unavailable");
  if (!recipient || /[\r\n,;]/.test(recipient)) throw new Error("Verified recipient unavailable");
  const content = orderEmailContent(order);
  const body = new FormData();
  for (const [name, value] of Object.entries({ from, to: recipient, ...content })) body.set(name, value);
  const response = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`api:${key}`).toString("base64")}` },
    body,
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Mailgun rejected confirmation (${response.status})`);
  const result = await response.json();
  if (!result.id) throw new Error("Mailgun acceptance could not be confirmed");
}
