function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root {
    color-scheme: dark;
    --bg: #0e1014; --bg2: #14171f; --bg3: #181c26;
    --fg: #e6e8ee; --muted: #8b93a7; --faint: #5b6478;
    --border: #262b37; --border2: #2f3645;
    --accent: #7aa2f7; --accent2: #9d7cf5; --good: #9ece6a; --warn: #e0af68;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--bg); color: var(--fg);
    background-image: radial-gradient(1100px 460px at 50% -8%, #171b27 0%, transparent 72%); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 20px 16px 64px; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; letter-spacing: .2px; }
  header h1 .at { color: var(--accent); }
  header .hint { color: var(--faint); font-size: 12px; }
  header .hint kbd { color: var(--muted); background: var(--bg3); border: 1px solid var(--border);
    border-radius: 5px; padding: 0 5px; font: inherit; font-size: 11px; }
  header .hint button { padding: 1px 8px; font-size: 12px; margin-left: 2px; }
  textarea, input[type=password] { width: 100%; background: var(--bg2); color: var(--fg);
    border: 1px solid var(--border); border-radius: 10px; padding: 11px 12px; font: inherit; resize: vertical;
    transition: border-color .15s, box-shadow .15s; }
  textarea:focus, input:focus { outline: none; border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(122,162,247,.12); }
  .composer { position: sticky; top: 0; z-index: 5; margin: 14px 0 22px; padding: 14px;
    background: rgba(20,23,31,.82); backdrop-filter: blur(8px);
    border: 1px solid var(--border); border-radius: 14px; }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  button { background: var(--bg3); color: var(--fg); border: 1px solid var(--border); border-radius: 8px;
    padding: 6px 12px; font: inherit; cursor: pointer; transition: border-color .15s, background .15s, transform .05s, color .15s; }
  button:hover { border-color: var(--accent); }
  button:active { transform: translateY(1px); }
  button.primary { background: linear-gradient(180deg, #34508c, #2b3f73); border-color: #3f5da6; color: #eaf0ff; }
  .meter { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .meter-track { width: 84px; height: 6px; border-radius: 999px; background: var(--bg3);
    overflow: hidden; border: 1px solid var(--border); }
  .meter-fill { height: 100%; width: 0; background: var(--accent); transition: width .15s, background .15s; }
  .meter.warn .meter-fill { background: var(--warn); }
  .meter.thread .meter-fill { width: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); }
  .meter-label { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .meter.thread .meter-label { color: var(--accent2); }
  .thread-preview { margin-top: 10px; display: grid; gap: 8px; }
  .thread-preview .ph { color: var(--faint); font-size: 12px; }
  .seg { border: 1px solid var(--border); border-left: 2px solid var(--accent2); border-radius: 8px;
    background: var(--bg2); padding: 8px 10px; }
  .seg .seg-head { color: var(--accent2); font-size: 11px; margin-bottom: 4px;
    display: flex; justify-content: space-between; }
  .seg .seg-body { white-space: pre-wrap; word-break: break-word; font-size: 13px; color: #cfd3de; }
  .thumbs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .thumb { width: 120px; }
  .thumb img { width: 120px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); }
  .thumb input { width: 120px; margin-top: 4px; font-size: 11px; padding: 3px 5px; }
  .thumb button { width: 120px; margin-top: 4px; padding: 2px; font-size: 11px; }
  .note { border: 1px solid var(--border); border-radius: 12px; padding: 13px 14px; margin-bottom: 11px;
    background: var(--bg2); transition: border-color .15s, box-shadow .15s; }
  .note:hover { border-color: var(--border2); }
  .note.sel { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(122,162,247,.10); }
  .note .meta { color: var(--muted); font-size: 12px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .note .meta .dot { color: var(--faint); }
  .note .body { margin: 7px 0; }
  .note .body p { margin: 0 0 6px; }
  .note .body a { color: var(--accent); }
  .note .atts { display: flex; gap: 6px; flex-wrap: wrap; }
  .note .atts img { max-height: 120px; border-radius: 6px; border: 1px solid var(--border); }
  .note .ops { margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; }
  .note .ops button { padding: 4px 9px; font-size: 12px; }
  .chip { color: var(--accent); background: rgba(122,162,247,.10); border: 1px solid var(--border2);
    border-radius: 999px; padding: 0 8px; font-size: 11px; }
  .badge { color: var(--good); }
  .empty { color: var(--muted); padding: 28px 0; text-align: center; }
  .notice { color: var(--good); border: 1px solid #2c4326; background: #111a10; border-radius: 8px;
    padding: 8px 11px; margin-top: 10px; animation: fade .25s ease; }
  .notice a { margin-right: 10px; }
  @keyframes fade { from { opacity: 0; transform: translateY(-3px); } to { opacity: 1; transform: none; } }
  .help { border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin: 12px 0; background: var(--bg3); }
  .help h2 { margin: 0 0 10px; font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: .08em; }
  .help dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 0; }
  .help dt { color: var(--good); }
  .help dd { margin: 0; color: #c7cad4; }
  .copied { color: var(--good) !important; border-color: #2c4326 !important; }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

export function loginPage(error?: string): string {
  return layout(
    "tangent · sign in",
    `<header><h1>tangent</h1></header>
    <form method="post" action="/admin/login" class="composer">
      ${error ? `<p style="color:#f7768e">${error}</p>` : ""}
      <label>Password<input type="password" name="password" autofocus></label>
      <div class="row"><button class="primary" type="submit">Sign in</button></div>
    </form>`,
  );
}

export function adminPage(
  handle: string,
  host: string,
  notePermalinkBase: string | null,
): string {
  const publicNoteBase = notePermalinkBase ?? `https://${host}/notes`;
  const body = `<header>
    <h1>tangent · <span class="at">@${handle}@${host}</span></h1>
    <span class="hint"><kbd>n</kbd> new · <kbd>⌘↵</kbd> post · <kbd>j/k</kbd> move · <kbd>g</kbd> refresh · <button id="help-toggle" type="button">?</button></span>
  </header>
  <section id="help" class="help" hidden>
    <h2>Shortcuts</h2>
    <dl>
      <dt>n</dt><dd>new note / focus composer</dd>
      <dt>⌘↵ / Ctrl↵</dt><dd>post or save</dd>
      <dt>j / k</dt><dd>select next / previous note</dd>
      <dt>e</dt><dd>edit selected note</dd>
      <dt>d</dt><dd>delete selected note</dd>
      <dt>g</dt><dd>refresh notes</dd>
      <dt>Esc</dt><dd>blur composer or close this help</dd>
      <dt>paste/drop</dt><dd>attach images</dd>
      <dt>long notes</dt><dd>auto-split into a Bluesky thread — preview appears as you type</dd>
    </dl>
  </section>
  <div class="composer" data-public-note-base="${publicNoteBase.replace(/"/g, "&quot;")}">
    <textarea id="text" rows="4" placeholder="Write a note… #hashtags become tags"></textarea>
    <div class="thumbs" id="thumbs"></div>
    <div id="notice" class="notice" hidden></div>
    <div class="row">
      <button id="attach" type="button">Attach image</button>
      <button id="post" class="primary" type="button">Post</button>
      <button id="cancel" type="button" hidden>Cancel edit</button>
      <input id="file" type="file" accept="image/*" multiple hidden>
      <span class="meter" id="meter">
        <span class="meter-track"><span class="meter-fill" id="meter-fill"></span></span>
        <span class="meter-label" id="count">0 / 300</span>
      </span>
    </div>
    <div class="thread-preview" id="preview" hidden></div>
  </div>
  <div id="list"><div class="empty">Loading…</div></div>
  <form method="post" action="/admin/logout" style="margin-top:24px"><button type="submit">Sign out</button></form>
  ${ADMIN_SCRIPT}`;
  return layout(`tangent · @${handle}`, body);
}

const ADMIN_SCRIPT = `<script type="module">
const $ = (s) => document.querySelector(s);
const textEl = $("#text"), thumbsEl = $("#thumbs"), listEl = $("#list"), countEl = $("#count"), noticeEl = $("#notice");
const postBtn = $("#post"), cancelBtn = $("#cancel"), fileEl = $("#file"), helpEl = $("#help"), helpToggle = $("#help-toggle");
const meterEl = $("#meter"), meterFill = $("#meter-fill"), previewEl = $("#preview");
const LIMIT = 300;
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
function glen(s) { let n = 0; for (const _ of segmenter.segment(s)) n++; return n; }
let previewTimer = null;
const publicNoteBase = document.querySelector(".composer").dataset.publicNoteBase.replace(/\\/$/, "");
const DRAFT_KEY = "tangent:admin:draft:v1";
let pending = [];      // { mediaId, url, alt }
let editing = null;    // note id being edited
let notes = [];
let sel = -1;

const esc = (s) => s.replace(/[&<>\"]/g, (c) => {
  if (c === "&") return "&amp;";
  if (c === "<") return "&lt;";
  if (c === ">") return "&gt;";
  return "&quot;";
});
function updateCount() {
  const n = glen(textEl.value);
  meterEl.classList.remove("warn", "thread");
  if (editing) {
    // Edits don't sync to Bluesky, so just show length — no thread preview.
    meterFill.style.width = Math.min(100, (n / LIMIT) * 100) + "%";
    countEl.textContent = n + (n === 1 ? " char" : " chars");
    hidePreview();
    return;
  }
  if (n > LIMIT) {
    meterEl.classList.add("thread");
    countEl.textContent = n + " · thread";
    schedulePreview();
  } else {
    if (n > LIMIT * 0.9) meterEl.classList.add("warn");
    meterFill.style.width = Math.min(100, (n / LIMIT) * 100) + "%";
    countEl.textContent = n + " / " + LIMIT;
    hidePreview();
  }
}
function hidePreview() { previewEl.hidden = true; previewEl.innerHTML = ""; clearTimeout(previewTimer); }
function schedulePreview() {
  previewEl.hidden = false;
  if (!previewEl.innerHTML) previewEl.innerHTML = '<div class="ph">building thread preview…</div>';
  clearTimeout(previewTimer);
  previewTimer = setTimeout(renderPreview, 300);
}
async function renderPreview() {
  const text = textEl.value.trim();
  if (!text || editing) { hidePreview(); return; }
  let data;
  try {
    data = await api("/api/thread-preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
  } catch { return; }
  const segs = data.segments || [];
  if (segs.length <= 1) { hidePreview(); return; }
  countEl.textContent = glen(textEl.value) + " · " + segs.length + " posts";
  previewEl.innerHTML = segs.map(function (s, i) {
    return '<div class="seg"><div class="seg-head"><span>' + (i + 1) + "/" + segs.length + '</span><span>' + glen(s) + ' graphemes</span></div><div class="seg-body">' + esc(s) + "</div></div>";
  }).join("");
}
function permalink(id) { return publicNoteBase + "/" + encodeURIComponent(id); }
function relTime(iso) {
  const d = new Date(iso), s = (Date.now() - d.getTime()) / 1000;
  if (s < 45) return "just now";
  if (s < 3600) return Math.round(s / 60) + "m ago";
  if (s < 86400) return Math.round(s / 3600) + "h ago";
  if (s < 604800) return Math.round(s / 86400) + "d ago";
  return d.toLocaleDateString();
}
function blueskyWebUrl(uri) {
  try {
    const url = new URL(uri);
    const parts = url.pathname.split("/").filter(Boolean);
    if (url.protocol === "at:" && parts[0] === "app.bsky.feed.post" && parts[1]) {
      return "https://bsky.app/profile/" + encodeURIComponent(url.hostname) + "/post/" + encodeURIComponent(parts[1]);
    }
  } catch {}
  return uri;
}
function showNotice(html) { noticeEl.innerHTML = html; noticeEl.hidden = false; }
function hideNotice() { noticeEl.innerHTML = ""; noticeEl.hidden = true; }
function saveDraft() {
  const draft = { text: textEl.value, pending, editing, savedAt: new Date().toISOString() };
  if (!draft.text.trim() && draft.pending.length === 0 && !draft.editing) localStorage.removeItem(DRAFT_KEY);
  else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}
function clearDraft() { localStorage.removeItem(DRAFT_KEY); }
function restoreDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    if (typeof draft.text === "string") textEl.value = draft.text;
    if (Array.isArray(draft.pending)) pending = draft.pending.filter((p) => p && typeof p.mediaId === "string" && typeof p.url === "string");
    editing = typeof draft.editing === "string" ? draft.editing : null;
    postBtn.textContent = editing ? "Save" : "Post";
    cancelBtn.hidden = !editing;
    renderThumbs(); updateCount();
    if (textEl.value.trim() || pending.length > 0) showNotice('Draft restored from this browser. <button id="discard-draft" type="button">discard</button>');
    document.querySelector("#discard-draft")?.addEventListener("click", resetComposer);
  } catch { localStorage.removeItem(DRAFT_KEY); }
}
textEl.addEventListener("input", () => { updateCount(); saveDraft(); });
helpToggle.addEventListener("click", () => { helpEl.hidden = !helpEl.hidden; });

async function api(path, opts) {
  const res = await fetch(path, opts);
  if (!res.ok) { alert("Error " + res.status + ": " + await res.text()); throw new Error(res.status); }
  return res.status === 204 ? null : res.json();
}

async function upload(file) {
  const fd = new FormData();
  fd.append("file", file);
  const data = await api("/api/media", { method: "POST", body: fd });
  pending.push({ mediaId: data.id, url: data.url, alt: "" });
  renderThumbs(); saveDraft();
}

function renderThumbs() {
  thumbsEl.innerHTML = "";
  pending.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "thumb";
    d.innerHTML = '<img src="' + p.url + '">' +
      '<input placeholder="alt text" value="' + esc(p.alt || "") + '">' +
      "<button>remove</button>";
    d.querySelector("input").addEventListener("input", (e) => { p.alt = e.target.value; saveDraft(); });
    d.querySelector("button").addEventListener("click", () => { pending.splice(i, 1); renderThumbs(); saveDraft(); });
    thumbsEl.appendChild(d);
  });
}

fileEl.addEventListener("change", async () => { for (const f of fileEl.files) await upload(f); fileEl.value = ""; });
$("#attach").addEventListener("click", () => fileEl.click());
document.addEventListener("paste", (e) => { for (const it of e.clipboardData.files) if (it.type.startsWith("image/")) upload(it); });
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) if (f.type.startsWith("image/")) upload(f); });

function startEdit(note) {
  editing = note.id;
  textEl.value = note.text;
  pending = note.attachments.map((a) => ({ mediaId: a.mediaId, url: a.url, alt: a.alt || "" }));
  postBtn.textContent = "Save";
  cancelBtn.hidden = false;
  hideNotice();
  renderThumbs(); updateCount(); saveDraft(); textEl.focus();
}
function resetComposer() {
  editing = null; pending = []; textEl.value = "";
  postBtn.textContent = "Post"; cancelBtn.hidden = true;
  renderThumbs(); updateCount(); clearDraft(); hideNotice();
}
cancelBtn.addEventListener("click", resetComposer);

async function submit() {
  const text = textEl.value.trim();
  const attachments = pending.map((p) => ({ mediaId: p.mediaId, alt: p.alt }));
  if (!text && attachments.length === 0) return;
  const wasEditing = Boolean(editing);
  let result;
  if (editing) {
    result = await api("/api/notes/" + editing, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, attachments }) });
  } else {
    result = await api("/api/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, attachments }) });
  }
  const note = result?.note;
  resetComposer();
  if (note?.id) {
    const links = ['<a href="' + permalink(note.id) + '" target="_blank" rel="noopener noreferrer">open permalink</a>'];
    if (result?.syndicated?.bluesky) {
      links.push('<a href="' + blueskyWebUrl(result.syndicated.bluesky) + '" target="_blank" rel="noopener noreferrer">open Bluesky</a>');
    }
    showNotice((wasEditing ? "Saved." : "Posted.") + " " + links.join(" "));
  }
  await refresh();
}
postBtn.addEventListener("click", submit);

async function del(id) {
  if (!confirm("Delete this note?")) return;
  await api("/api/notes/" + id, { method: "DELETE" });
  await refresh();
}

function copyLink(btn, id) {
  const done = () => {
    const original = btn.textContent;
    btn.textContent = "copied ✓"; btn.classList.add("copied");
    setTimeout(() => { btn.textContent = original; btn.classList.remove("copied"); }, 1200);
  };
  const link = permalink(id);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => prompt("Copy link:", link));
  else prompt("Copy link:", link);
}

async function repost(id) {
  if (!confirm("Publish a new Bluesky post for this note and delete the old one? The new post gets a new URL and does not keep the old post's likes, reposts, or replies.")) return;
  const result = await api("/api/notes/" + id + "/resyndicate", { method: "POST" });
  if (result?.syndicated?.bluesky) {
    showNotice('Reposted to Bluesky. <a href="' + blueskyWebUrl(result.syndicated.bluesky) + '" target="_blank" rel="noopener noreferrer">open Bluesky</a>');
  }
  await refresh();
}

function render() {
  if (notes.length === 0) { listEl.innerHTML = '<div class="empty">No notes yet.</div>'; return; }
  listEl.innerHTML = "";
  notes.forEach((n, i) => {
    const el = document.createElement("div");
    el.className = "note" + (i === sel ? " sel" : "");
    el.dataset.id = n.id;
    const atts = n.attachments.map((a) => '<img src="' + a.url + '" alt="' + esc(a.alt || "") + '">').join("");
    el.innerHTML =
      '<div class="meta"><span title="' + esc(new Date(n.published).toLocaleString()) + '">' + esc(relTime(n.published)) + "</span>" +
      (n.updated ? '<span class="dot">·</span><span>edited</span>' : "") +
      (n.tags.length ? '<span class="dot">·</span>' + n.tags.map((t) => '<span class="chip">#' + esc(t) + "</span>").join(" ") : "") + "</div>" +
      '<div class="body">' + n.html + "</div>" +
      (atts ? '<div class="atts">' + atts + "</div>" : "") +
      '<div class="ops"><button data-op="edit">edit</button>' +
      '<button data-op="copy">copy link</button>' +
      (n.inReplyTo ? "" : '<button data-op="repost">repost to Bluesky</button>') +
      '<button data-op="del">delete</button></div>';
    el.querySelector('[data-op="edit"]').addEventListener("click", () => startEdit(n));
    el.querySelector('[data-op="copy"]').addEventListener("click", (e) => copyLink(e.target, n.id));
    el.querySelector('[data-op="repost"]')?.addEventListener("click", () => repost(n.id));
    el.querySelector('[data-op="del"]').addEventListener("click", () => del(n.id));
    el.addEventListener("click", () => { sel = i; render(); });
    listEl.appendChild(el);
  });
}

async function refresh() {
  const data = await api("/api/notes?limit=100");
  notes = data.notes;
  if (sel >= notes.length) sel = notes.length - 1;
  render();
}

document.addEventListener("keydown", (e) => {
  const typing = ["TEXTAREA", "INPUT"].includes(document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); return; }
  if (e.key === "Escape" && !helpEl.hidden) { e.preventDefault(); helpEl.hidden = true; return; }
  if (typing) { if (e.key === "Escape") document.activeElement.blur(); return; }
  if (e.key === "?" || (e.key === "/" && e.shiftKey)) { e.preventDefault(); helpEl.hidden = !helpEl.hidden; }
  else if (e.key === "n") { e.preventDefault(); resetComposer(); textEl.focus(); }
  else if (e.key === "g") { refresh(); }
  else if (e.key === "j") { sel = Math.min(sel + 1, notes.length - 1); render(); }
  else if (e.key === "k") { sel = Math.max(sel - 1, 0); render(); }
  else if (e.key === "e" && notes[sel]) { startEdit(notes[sel]); }
  else if (e.key === "d" && notes[sel]) { del(notes[sel].id); }
});

restoreDraft();
refresh();
</script>`;
