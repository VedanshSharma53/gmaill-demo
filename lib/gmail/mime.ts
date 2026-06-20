export interface ComposeOptions {
  from: string;
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string;
  references?: string;
}

function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return `=?UTF-8?B?${encoded}?=`;
}

function foldHeader(name: string, value: string): string {
  return `${name}: ${encodeHeaderValue(value)}`;
}

/** Build a minimal RFC 2822 MIME message (text/plain only). No SMTP library needed. */
export function buildRawMimeMessage(options: ComposeOptions): string {
  const lines: string[] = [
    foldHeader("From", options.from),
    foldHeader("To", options.to),
    foldHeader("Subject", options.subject),
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
  ];

  if (options.inReplyTo) {
    lines.push(foldHeader("In-Reply-To", options.inReplyTo));
  }
  if (options.references) {
    lines.push(foldHeader("References", options.references));
  }

  const message = `${lines.join("\r\n")}\r\n\r\n${options.text}`;

  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function extractHeader(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string | undefined {
  const found = headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return found?.value ?? undefined;
}

export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseEmailAddress(raw: string): { name: string | null; email: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (!match) return { name: null, email: raw.trim() };
  return { name: match[1]?.trim() || null, email: match[2].trim() };
}
