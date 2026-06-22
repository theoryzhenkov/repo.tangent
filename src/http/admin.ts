function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 15px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #0f1115; color: #e6e6e6; }
  a { color: #7aa2f7; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 16px; }
  header { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  header .hint { color: #8b93a7; font-size: 12px; }
  textarea, input[type=password] { width: 100%; background: #161922; color: #e6e6e6;
    border: 1px solid #2a2f3a; border-radius: 8px; padding: 10px; font: inherit; resize: vertical; }
  textarea:focus, input:focus, .note.sel { outline: none; border-color: #7aa2f7; }
  .composer { margin: 12px 0 20px; }
  .row { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
  button { background: #232838; color: #e6e6e6; border: 1px solid #2a2f3a; border-radius: 8px;
    padding: 6px 12px; font: inherit; cursor: pointer; }
  button.primary { background: #2e4374; border-color: #3b5599; }
  button:hover { border-color: #7aa2f7; }
  .count { color: #8b93a7; font-size: 12px; margin-left: auto; }
  .thumbs { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
  .thumb { width: 120px; }
  .thumb img { width: 120px; height: 80px; object-fit: cover; border-radius: 6px; border: 1px solid #2a2f3a; }
  .thumb input { width: 120px; margin-top: 4px; font-size: 11px; padding: 3px 5px; }
  .thumb button { width: 120px; margin-top: 4px; padding: 2px; font-size: 11px; }
  .note { border: 1px solid #2a2f3a; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
  .note .meta { color: #8b93a7; font-size: 12px; display: flex; gap: 10px; flex-wrap: wrap; }
  .note .body { margin: 6px 0; }
  .note .body p { margin: 0 0 6px; }
  .note .atts { display: flex; gap: 6px; flex-wrap: wrap; }
  .note .atts img { max-height: 120px; border-radius: 6px; border: 1px solid #2a2f3a; }
  .note .ops { margin-top: 6px; display: flex; gap: 8px; }
  .badge { color: #9ece6a; }
  .empty { color: #8b93a7; padding: 20px 0; }
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

export function adminPage(handle: string, host: string): string {
  const body = `<header>
    <h1>tangent · @${handle}@${host}</h1>
    <span class="hint">n new · ⌘↵ post · e edit · d delete · j/k move · g refresh</span>
  </header>
  <div class="composer">
    <textarea id="text" rows="4" placeholder="Write a note… #hashtags become tags"></textarea>
    <div class="thumbs" id="thumbs"></div>
    <div class="row">
      <button id="attach" type="button">Attach image</button>
      <button id="post" class="primary" type="button">Post</button>
      <button id="cancel" type="button" hidden>Cancel edit</button>
      <input id="file" type="file" accept="image/*" multiple hidden>
      <span class="count" id="count">0</span>
    </div>
  </div>
  <div id="list"><div class="empty">Loading…</div></div>
  <form method="post" action="/admin/logout" style="margin-top:24px"><button type="submit">Sign out</button></form>
  ${ADMIN_SCRIPT}`;
  return layout(`tangent · @${handle}`, body);
}

const ADMIN_SCRIPT = `<script type="module">
const $ = (s) => document.querySelector(s);
const textEl = $("#text"), thumbsEl = $("#thumbs"), listEl = $("#list"), countEl = $("#count");
const postBtn = $("#post"), cancelBtn = $("#cancel"), fileEl = $("#file");
let pending = [];      // { mediaId, url, alt }
let editing = null;    // note id being edited
let notes = [];
let sel = -1;

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const updateCount = () => { countEl.textContent = [...textEl.value].length; };
textEl.addEventListener("input", updateCount);

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
  renderThumbs();
}

function renderThumbs() {
  thumbsEl.innerHTML = "";
  pending.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "thumb";
    d.innerHTML = '<img src="' + p.url + '">' +
      '<input placeholder="alt text" value="' + esc(p.alt || "") + '">' +
      "<button>remove</button>";
    d.querySelector("input").addEventListener("input", (e) => { p.alt = e.target.value; });
    d.querySelector("button").addEventListener("click", () => { pending.splice(i, 1); renderThumbs(); });
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
  renderThumbs(); updateCount(); textEl.focus();
}
function resetComposer() {
  editing = null; pending = []; textEl.value = "";
  postBtn.textContent = "Post"; cancelBtn.hidden = true;
  renderThumbs(); updateCount();
}
cancelBtn.addEventListener("click", resetComposer);

async function submit() {
  const text = textEl.value.trim();
  const attachments = pending.map((p) => ({ mediaId: p.mediaId, alt: p.alt }));
  if (!text && attachments.length === 0) return;
  if (editing) {
    await api("/api/notes/" + editing, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, attachments }) });
  } else {
    await api("/api/compose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, attachments }) });
  }
  resetComposer(); await refresh();
}
postBtn.addEventListener("click", submit);

async function del(id) {
  if (!confirm("Delete this note?")) return;
  await api("/api/notes/" + id, { method: "DELETE" });
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
      '<div class="meta"><span>' + new Date(n.published).toLocaleString() + "</span>" +
      (n.updated ? "<span>edited</span>" : "") +
      (n.tags.length ? "<span>" + n.tags.map((t) => "#" + esc(t)).join(" ") + "</span>" : "") + "</div>" +
      '<div class="body">' + n.html + "</div>" +
      (atts ? '<div class="atts">' + atts + "</div>" : "") +
      '<div class="ops"><button data-op="edit">edit</button><button data-op="del">delete</button></div>';
    el.querySelector('[data-op="edit"]').addEventListener("click", () => startEdit(n));
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
  if (typing) { if (e.key === "Escape") document.activeElement.blur(); return; }
  if (e.key === "n") { e.preventDefault(); resetComposer(); textEl.focus(); }
  else if (e.key === "g") { refresh(); }
  else if (e.key === "j") { sel = Math.min(sel + 1, notes.length - 1); render(); }
  else if (e.key === "k") { sel = Math.max(sel - 1, 0); render(); }
  else if (e.key === "e" && notes[sel]) { startEdit(notes[sel]); }
  else if (e.key === "d" && notes[sel]) { del(notes[sel].id); }
});

refresh();
</script>`;
