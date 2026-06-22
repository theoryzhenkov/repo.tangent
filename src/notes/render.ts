const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Collect unique, lowercased `#hashtags` from note text. */
export function extractHashtags(text: string): string[] {
  const matches = text.matchAll(/(?:^|\s)#([\p{L}0-9_]+)/gu);
  return [...new Set([...matches].map((match) => (match[1] ?? "").toLowerCase()))];
}

/** Render plain note text into safe HTML and extract its hashtags. */
export function renderNote(text: string): { html: string; tags: string[] } {
  const html = escapeHtml(text.trim())
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return { html, tags: extractHashtags(text) };
}
