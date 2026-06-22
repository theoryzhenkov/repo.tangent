import type { NoteRow } from "../store/notes.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return char;
    }
  });
}

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).href;
}

export function publicNotePage(
  note: NoteRow,
  permalinkBase: string,
  mediaOrigin: string,
): string {
  const title = note.text.split(/\s+/).filter(Boolean).slice(0, 8).join(" ") || "note";
  const canonical = absoluteUrl(permalinkBase, `/notes/${note.id}`);
  const actorUrl = absoluteUrl(permalinkBase, "/");
  const published = note.publishedAt.toISOString();
  const updated = note.updatedAt?.toISOString();
  const attachments = note.attachments
    .map((attachment) => {
      if (!attachment.contentType.startsWith("image/")) return "";
      const src = absoluteUrl(mediaOrigin, `/media/${attachment.mediaId}`);
      const alt = escapeHtml(attachment.alt ?? "");
      return `<figure><img src="${src}" alt="${alt}" loading="lazy"></figure>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · theor</title>
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary">
<style>
  :root { color-scheme: dark; }
  body { margin: 0; font: 17px/1.6 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f1115; color: #e6e6e6; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 16px; }
  a { color: #7aa2f7; }
  article { border: 1px solid #2a2f3a; border-radius: 14px; padding: 18px; background: #131620; }
  header, footer { color: #8b93a7; font-size: 14px; }
  .body { margin: 14px 0; }
  .body p { margin: 0 0 0.8em; }
  figure { margin: 12px 0 0; }
  img { max-width: 100%; border-radius: 10px; border: 1px solid #2a2f3a; }
</style>
</head>
<body>
<main>
  <article>
    <header><a href="${actorUrl}">@theor@theor.net</a> · <time datetime="${published}">${published}</time>${updated ? ` · edited <time datetime="${updated}">${updated}</time>` : ""}</header>
    <div class="body">${note.html}</div>
    ${attachments}
    <footer><a href="${note.uri}">ActivityPub object</a></footer>
  </article>
</main>
</body>
</html>`;
}
