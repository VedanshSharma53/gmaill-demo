/** Strip dangerous content from email HTML before rendering in the browser. */

const BLOCKED_TAGS =
  /<\/?(?:script|iframe|object|embed|form|input|button|textarea|select|link|meta|base)[^>]*>/gi;

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(BLOCKED_TAGS, "")
    .replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]*)/gi, "")
    .replace(/javascript:/gi, "");
}

/** Wrap email HTML in a document shell with readable defaults for newsletters / rich mail. */
export function wrapEmailHtmlDocument(bodyHtml: string): string {
  const safe = sanitizeEmailHtml(bodyHtml);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #14171A;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }
    body { padding: 4px 2px; }
    img { max-width: 100% !important; height: auto !important; }
    table { max-width: 100% !important; }
    td, th { word-break: break-word; }
    a { color: #0E7C66; }
    blockquote {
      margin: 0.75em 0;
      padding-left: 12px;
      border-left: 3px solid #E7E4DD;
      color: #6B7280;
    }
    pre, code {
      font-family: "IBM Plex Mono", ui-monospace, monospace;
      font-size: 13px;
      background: #FAFAF8;
      border-radius: 4px;
    }
    pre { padding: 12px; overflow-x: auto; white-space: pre-wrap; }
  </style>
</head>
<body>${safe}</body>
</html>`;
}

/** Turn plain-text emails into simple HTML with links and paragraphs. */
export function plainTextToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  const paragraphs = withLinks
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 1em 0">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");

  return wrapEmailHtmlDocument(paragraphs);
}

export function hasMeaningfulHtml(html: string | null | undefined): boolean {
  if (!html?.trim()) return false;
  const stripped = html.replace(/<[^>]+>/g, "").trim();
  return stripped.length > 0;
}
