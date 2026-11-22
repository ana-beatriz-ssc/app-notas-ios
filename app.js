'use strict';

/* =========================================================
   Notas: PWA para iPhone e iPad
   Cada nota mistura texto, desenhos e anexos (veja doc.js).
   Os dados ficam no próprio aparelho (IndexedDB).
   ========================================================= */

const T = window.Theme;
const Help = window.HelpContent;

// ---------- Banco de dados (IndexedDB) ----------
// versão 3: notas em blocos + arquivos anexados. Subir a versão também impede que
// uma cópia antiga do app (ainda em cache) abra e entenda errado as notas novas.
const DB_NAME = 'notas-db';
const STORE = 'notes';
const FOLDERS = 'folders';
const FILES = 'files';

const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 3);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(FOLDERS)) db.createObjectStore(FOLDERS, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'id' });
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbRun(store, mode, action) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const dbAll = () => dbRun(STORE, 'readonly', (s) => s.getAll());
const dbPut = (note) => dbRun(STORE, 'readwrite', (s) => s.put(note));
const dbDelete = (id) => dbRun(STORE, 'readwrite', (s) => s.delete(id));
const dbFolders = () => dbRun(FOLDERS, 'readonly', (s) => s.getAll());
const dbPutFolder = (f) => dbRun(FOLDERS, 'readwrite', (s) => s.put(f));
const dbDeleteFolder = (id) => dbRun(FOLDERS, 'readwrite', (s) => s.delete(id));
const dbGetFile = (id) => dbRun(FILES, 'readonly', (s) => s.get(id));
const dbPutFile = (f) => dbRun(FILES, 'readwrite', (s) => s.put(f));
const dbDeleteFile = (id) => dbRun(FILES, 'readwrite', (s) => s.delete(id));
const dbFileKeys = () => dbRun(FILES, 'readonly', (s) => s.getAllKeys());

// ---------- Estado ----------
let notes = [];
let folders = [];
let folderId = null; // pasta aberta na lista (null = todas as notas)
let currentId = null;
let query = '';
let saveTimer = null;
let fullBlock = null; // quadro aberto em tela cheia
const thumbTimers = new Map();

const $ = (sel) => document.querySelector(sel);
const el = {
  list: $('#list'), listEmpty: $('#list-empty'), count: $('#count'), search: $('#search'),
  listTitle: $('#list-title'), folders: $('#folders'),
  docScroll: $('#doc-scroll'), doc: $('#doc'), editorDate: $('#editor-date'),
  inkFull: $('#ink-full'), inkHost: $('#ink-host'), btnFullDone: $('#btn-full-done'),
  toolbar: $('#ink-toolbar'), popover: $('#ink-popover'),
  tbColor: $('#tb-color'), tbSize: $('#tb-size'), tbFinger: $('#tb-finger'), tbZoom: $('#tb-zoom'),
  btnNew: $('#btn-new'), btnBack: $('#btn-back'), btnPin: $('#btn-pin'), btnDelete: $('#btn-delete'),
  btnDone: $('#btn-done'), btnMenu: $('#btn-menu'), btnHelp: $('#btn-help'), btnPaper: $('#btn-paper'),
  btnUndo: $('#btn-undo'), btnRedo: $('#btn-redo'), btnSidebar: $('#btn-sidebar'), btnFolder: $('#btn-folder'),
  btnInsert: $('#btn-insert'), btnExport: $('#btn-export'), btnNoteMenu: $('#btn-note-menu'),
  sheetBackdrop: $('#sheet-backdrop'), sheetGroup: $('#sheet-group'), sheetCancel: $('#sheet-cancel'),
  panelBackdrop: $('#panel-backdrop'), panelTitle: $('#panel-title'), panelBody: $('#panel-body'), panelClose: $('#panel-close'),
  onboarding: $('#onboarding'), obSlides: $('#ob-slides'), obDots: $('#ob-dots'), obNext: $('#ob-next'), obSkip: $('#ob-skip'),
  importFile: $('#import-file'), attachFile: $('#attach-file'), attachPhoto: $('#attach-photo'),
  viewer: $('#viewer'), viewerImg: $('#viewer-img'), viewerClose: $('#viewer-close'),
  toast: $('#toast'),
};

const wide = window.matchMedia('(min-width: 768px)');

const PEN_COLORS = ['#1c1c1e', '#6e6e73', '#d94f86', '#c2185b', '#e5383b', '#f28c28', '#e0b000', '#2fa565', '#1f9fb4', '#2f6fde', '#8a4fd8', '#8b5e3c'];
const HL_COLORS = ['#ff7eb3', '#ffd60a', '#7ee081', '#6cc8ff', '#c59bff', '#ffab6e'];
const TEXT_LAYOUTS = Ink.LAYOUTS.filter((l) => l.id !== 'cornell');
const MAX_FILE = 200 * 1024 * 1024;

const ICONS = {
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  clip: '<svg viewBox="0 0 24 24"><path d="m20 11.5-7.8 7.8a5 5 0 0 1-7-7L13 4.5a3.3 3.3 0 0 1 4.7 4.7l-7.8 7.8a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  photo: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 2.5-2.5L20 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
};

// ---------- Utilidades ----------
const newId = Doc.newId;
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function highlight(text, q) {
  if (!q) return escapeHtml(text);
  const i = fold(text).indexOf(fold(q));
  if (i < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, i)) + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>' + escapeHtml(text.slice(i + q.length));
}

const fmtTime = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const fmtShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const fmtLong = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function shortDate(ts) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  if (diff === 0) return fmtTime.format(ts);
  if (diff === 1) return 'Ontem';
  if (diff < 7) return fmtWeekday.format(ts);
  return fmtShort.format(ts);
}

let toastTimer;
function toast(msg) {
  el.toast.textContent = msg;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2600);
}

// ---------- Notas ----------
// Converte notas antigas (digitada ou manuscrita) para o formato em blocos.
function migrate(n) {
  if (Array.isArray(n.blocks)) return false;
  const blocks = [];
  if (n.kind === 'ink') {
    if (typeof n.title === 'string' && n.title.trim()) blocks.push(Doc.textBlock(n.title.trim()));
    const pages = Array.isArray(n.pages) ? n.pages : [];
    for (const p of pages) {
      if (!p || !Array.isArray(p.strokes) || !p.strokes.length) continue; // folhas em branco não viram quadros
      blocks.push({ id: newId(), type: 'ink', h: Ink.PAGE_H, layout: p.layout || 'pautada', strokes: p.strokes });
    }
    n.layout = 'lisa';
    n.zoom = 1;
  } else {
    blocks.push(Doc.textBlock(typeof n.text === 'string' ? n.text : ''));
  }
  delete n.kind; delete n.pages; delete n.title; delete n.text; delete n.thumb;
  n.blocks = blocks;
  return true;
}

function normalize(n) {
  migrate(n);
  n.blocks = n.blocks.filter((b) => b && (b.type === 'text' || b.type === 'ink' || b.type === 'file'));
  for (const b of n.blocks) {
    if (!b.id) b.id = newId();
    if (b.type === 'text' && typeof b.text !== 'string') b.text = '';
    if (b.type === 'ink' && !Array.isArray(b.strokes)) b.strokes = [];
  }
  Doc.normalizeBlocks(n.blocks);
  n.layout = TEXT_LAYOUTS.some((l) => l.id === n.layout) ? n.layout : 'lisa';
  n.zoom = n.zoom || 1;
  n.pinned = !!n.pinned;
  n.folder = typeof n.folder === 'string' && n.folder ? n.folder : null;
  return n;
}

const inkBlocks = (n) => n.blocks.filter((b) => b.type === 'ink');
const fileBlocks = (n) => n.blocks.filter((b) => b.type === 'file');
const noteText = (n) => n.blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');

function isEmpty(n) {
  return n.blocks.every((b) => (b.type === 'text' ? !b.text.trim() : b.type === 'ink' ? b.strokes.length === 0 : false));
}

function noteTitle(n) {
  const line = noteText(n).split('\n').map((l) => l.trim()).find(Boolean);
  if (line) return line;
  if (inkBlocks(n).some((b) => b.strokes.length)) return 'Desenho';
  const f = fileBlocks(n)[0];
  return f ? f.name : 'Nova nota';
}

function notePreview(n) {
  const lines = noteText(n).split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.slice(1).join(' ');
}

const currentNote = () => notes.find((n) => n.id === currentId) || null;
const persist = (n) => (isEmpty(n) ? dbDelete(n.id) : dbPut(n));
// grava sem mudar a data (folha, zoom, miniatura)
const persistQuiet = (n) => (isEmpty(n) ? Promise.resolve() : dbPut(n));

function scheduleSave() {
  clearTimeout(saveTimer);
  const n = currentNote();
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (n) await persist(n);
    renderList();
  }, 400);
}

async function flushSave() {
  if (!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  const n = currentNote();
  if (n) await persist(n);
}

function makeThumb(n) {
  const b = inkBlocks(n).find((x) => x.strokes.length);
  return b ? Ink.renderThumb(b, T.colors) : null;
}

function scheduleThumb(n) {
  clearTimeout(thumbTimers.get(n.id));
  thumbTimers.set(n.id, setTimeout(() => {
    thumbTimers.delete(n.id);
    n.thumb = makeThumb(n);
    persistQuiet(n);
    renderList();
  }, 900));
}

// apaga do banco os arquivos que nenhuma nota usa mais
async function removeUnusedFiles(ids) {
  const used = new Set(notes.flatMap((n) => fileBlocks(n).map((b) => b.fileId)));
  for (const id of ids) if (!used.has(id)) await dbDeleteFile(id).catch(() => {});
}

async function discardIfEmpty(n = currentNote()) {
  if (n && isEmpty(n)) {
    notes = notes.filter((x) => x.id !== n.id);
    await dbDelete(n.id);
  }
}

// ---------- Escrita à mão ----------
function fingerDraws() {
  const m = T.settings.fingerMode;
  return m === 'draw' || (m === 'auto' && !T.settings.penSeen);
}

function onPen() {
  if (!T.settings.penSeen) {
    T.set({ penSeen: true });
    updateToolbar();
    doc.updateTouchMode();
    if (T.settings.fingerMode === 'auto') toast('Apple Pencil detectado: agora o dedo rola a nota e só a caneta desenha');
  }
}

function setHistoryButtons(canUndo, canRedo) {
  el.btnUndo.disabled = !canUndo;
  el.btnRedo.disabled = !canRedo;
}

// quadro ampliado (tela cheia). Também guarda a ferramenta, a cor e a espessura escolhidas.
const ink = new Ink.InkEditor(el.inkHost, {
  colors: () => T.colors,
  fingerDraws,
  onPen,
  onChange() { onDocChange('ink'); },
  onHistory(u, r) { if (fullBlock) setHistoryButtons(u, r); },
  onView(v) {
    el.tbZoom.textContent = v.zoom + '%';
    const out = el.popover.querySelector('output[data-zoom]');
    if (out) out.textContent = v.zoom + '%';
  },
});

// editor da nota em blocos
const doc = new Doc.DocEditor(el.doc, el.docScroll, {
  colors: () => T.colors,
  fingerDraws,
  tools: () => ink,
  onPen,
  onChange: onDocChange,
  onHistory(u, r) { if (!fullBlock) setHistoryButtons(u, r); },
  onExpand: openFull,
  onBlockMenu: inkBlockMenu,
  onFileOpen: fileBlockMenu,
  onFiles: addFiles,
  onTextFocus(on) {
    document.body.classList.toggle('typing', on);
    el.btnDone.hidden = !on;
    if (!on) flushSave().then(renderList);
  },
  async fileUrl(id) {
    const rec = await dbGetFile(id).catch(() => null);
    return rec && rec.blob ? URL.createObjectURL(rec.blob) : null;
  },
});

function onDocChange(kind) {
  const n = currentNote();
  if (!n) return;
  n.updated = Date.now();
  el.editorDate.textContent = fmtLong.format(n.updated);
  scheduleSave();
  if (kind !== 'text') {
    scheduleThumb(n);
    updateNoteChrome();
    closePopover();
  }
}

// restaura ferramentas usadas por último
(function restoreInk() {
  const s = T.settings.ink || {};
  if (s.pen) ink.color.pen = s.pen;
  if (s.hl) ink.color.hl = s.hl;
  if (s.sizes) Object.assign(ink.sizeIndex, s.sizes);
  if (s.tool) ink.tool = s.tool;
})();
function saveInkPrefs() {
  T.set({ ink: { pen: ink.color.pen, hl: ink.color.hl, sizes: { ...ink.sizeIndex }, tool: ink.tool } });
}

// ---------- Lista ----------
const folderById = (id) => folders.find((f) => f.id === id) || null;
// nota aparece na pasta aberta? (pasta apagada = a nota fica só em "Todas")
const inOpenFolder = (n) => !folderId || n.folder === folderId;

function sortedNotes() {
  return [...notes].sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
}

function renderFolders() {
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const chip = (id, label) => h('button', {
    class: 'folder-chip', role: 'tab', 'aria-selected': String(folderId === id), 'data-folder': id || '',
  }, label);
  el.folders.replaceChildren(
    chip(null, 'Todas'),
    ...sorted.map((f) => {
      const count = notes.filter((n) => n.folder === f.id && !isEmpty(n)).length;
      return chip(f.id, h('span', {}, f.name, h('span', { class: 'folder-count' }, String(count))));
    }),
    h('button', { class: 'folder-chip add', 'aria-label': 'Nova pasta', html: ICONS.plus + '<span>Pasta</span>', onclick: () => newFolder() }),
  );
  const f = folderById(folderId);
  el.listTitle.textContent = f ? f.name : 'Notas';
}

function renderList() {
  renderFolders();
  const q = query.trim();
  const fq = fold(q);
  const searchable = (n) => noteText(n) + '\n' + fileBlocks(n).map((b) => b.name).join('\n');
  const matches = (n) => !fq || fold(searchable(n)).includes(fq);
  const visible = sortedNotes().filter((n) => !isEmpty(n) || n.id === currentId).filter(inOpenFolder).filter(matches);
  const pinned = visible.filter((n) => n.pinned);
  const others = visible.filter((n) => !n.pinned);

  const item = (n) => {
    const active = n.id === currentId ? ' active' : '';
    if (n.thumb === undefined) n.thumb = makeThumb(n);
    const files = fileBlocks(n).length;
    const icons = (inkBlocks(n).some((b) => b.strokes.length) ? `<span class="kind-icon">${ICONS.pen}</span>` : '')
      + (files ? `<span class="kind-icon">${ICONS.clip}</span>` : '');
    let preview = notePreview(n);
    if (!preview && files) preview = files === 1 ? '1 anexo' : `${files} anexos`;
    if (!preview) preview = 'Sem texto adicional';
    return `<button class="note-item${active}" data-id="${escapeHtml(n.id)}">
      <div class="note-text">
        <div class="note-title">${highlight(noteTitle(n), q)}</div>
        <div class="note-sub"><time>${escapeHtml(shortDate(n.updated))}</time>${icons}${highlight(preview, q)}</div>
      </div>
      ${n.thumb ? `<img class="note-thumb" src="${n.thumb}" alt="">` : ''}
    </button>`;
  };
  const section = (title, arr) =>
    arr.length ? `${title ? `<h2 class="section-title">${title}</h2>` : ''}<div class="group">${arr.map(item).join('')}</div>` : '';

  el.list.innerHTML = pinned.length ? section('Fixadas', pinned) + section('Notas', others) : section('', others);

  const total = notes.filter((n) => !isEmpty(n) && inOpenFolder(n)).length;
  el.count.textContent = total === 0 ? '' : total === 1 ? '1 nota' : `${total} notas`;

  if (visible.length === 0) {
    el.listEmpty.hidden = false;
    el.listEmpty.textContent = q
      ? `Nenhum resultado para “${q}”`
      : folderId
        ? 'Esta pasta está vazia. Toque no lápis para criar uma nota aqui.'
        : 'Nenhuma nota ainda. Toque no lápis para criar uma.';
  } else {
    el.listEmpty.hidden = true;
  }
}

// ---------- Editor ----------
function applyTextZoom(n) {
  const fs = 17 * (n.zoom || 1);
  el.doc.style.setProperty('--fs', fs.toFixed(1) + 'px');
  el.doc.style.setProperty('--lh', Math.round(fs * 1.55) + 'px');
  doc.layoutAll();
}

function renderEditor(force) {
  const n = currentNote();
  document.body.classList.toggle('no-note', !n);
  closePopover();
  if (!n) {
    closeFull();
    doc.close();
    el.editorDate.textContent = '';
    updateNoteChrome();
    return;
  }
  if (force || doc.note !== n) {
    closeFull();
    el.doc.dataset.layout = n.layout;
    applyTextZoom(n);
    doc.open(n);
  }
  el.doc.dataset.layout = n.layout;
  el.editorDate.textContent = fmtLong.format(n.updated);
  updateNoteChrome();
}

function updateNoteChrome() {
  const n = currentNote();
  document.body.classList.toggle('has-ink', !!n && inkBlocks(n).length > 0);
  if (n) {
    const nf = folderById(n.folder);
    el.btnFolder.setAttribute('aria-label', nf ? `Pasta: ${nf.name} (mover)` : 'Mover para uma pasta');
    el.btnFolder.classList.toggle('in-folder', !!nf);
    el.btnPin.setAttribute('aria-pressed', String(!!n.pinned));
    el.btnPin.setAttribute('aria-label', n.pinned ? 'Desafixar nota' : 'Fixar nota');
  }
  updateToolbar();
}

function focusFirstText() {
  const ta = el.doc.querySelector('textarea.tb');
  if (ta) ta.focus();
}

async function openNote(id) {
  if (id !== currentId) {
    await flushSave();
    await discardIfEmpty();
  }
  currentId = id;
  document.body.classList.add('editing');
  renderEditor();
  renderList();
}

async function closeEditor() {
  doc.blurText();
  closeFull();
  closePopover();
  await flushSave();
  await discardIfEmpty();
  document.body.classList.remove('editing');
  if (!wide.matches) currentId = null;
  if (wide.matches && !currentNote()) selectFirst();
  renderEditor();
  renderList();
}

function selectFirst() {
  const first = sortedNotes().find((n) => !isEmpty(n) && inOpenFolder(n));
  currentId = first ? first.id : null;
}

function createNote(withDrawing) {
  const now = Date.now();
  const blocks = [Doc.textBlock('')];
  if (withDrawing) blocks.push(Doc.inkBlock(T.settings.lastLayout || 'lisa'));
  const n = { id: newId(), blocks, layout: T.settings.lastTextLayout || 'lisa', zoom: 1, pinned: false, folder: folderId, created: now, updated: now };
  return normalize(n);
}

function newNote(withDrawing = false) {
  const prev = currentNote();
  const hadPending = !!saveTimer;
  clearTimeout(saveTimer);
  saveTimer = null;

  const note = createNote(withDrawing);
  notes.push(note);
  currentId = note.id;
  document.body.classList.add('editing');
  renderEditor();
  // foco síncrono, dentro do toque, para o teclado abrir no iOS
  if (!withDrawing) focusFirstText();
  renderList();
  if (withDrawing) maybeShowInkTip();

  if (prev) {
    (async () => {
      if (isEmpty(prev)) {
        notes = notes.filter((x) => x.id !== prev.id);
        await dbDelete(prev.id);
      } else if (hadPending) {
        await dbPut(prev);
      }
      renderList();
    })();
  }
}

async function togglePin() {
  const n = currentNote();
  if (!n) return;
  if (isEmpty(n)) { toast('Escreva algo antes de fixar'); return; }
  n.pinned = !n.pinned;
  await persistQuiet(n);
  renderEditor();
  renderList();
  toast(n.pinned ? 'Nota fixada' : 'Nota desafixada');
}

function askDelete() {
  const n = currentNote();
  if (!n) return;
  if (isEmpty(n)) { closeEditor(); return; }
  const files = fileBlocks(n).length;
  openSheet({
    message: `Esta nota${files ? ` e ${files === 1 ? 'o anexo dela' : `os ${files} anexos dela`}` : ''} será apagada deste aparelho. Não é possível desfazer.`,
    actions: [{ label: 'Apagar Nota', danger: true, run: deleteCurrent }],
  });
}

async function deleteCurrent() {
  const n = currentNote();
  if (!n) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  closeFull();
  doc.blurText();
  notes = notes.filter((x) => x.id !== n.id);
  await dbDelete(n.id);
  await removeUnusedFiles(fileBlocks(n).map((b) => b.fileId));
  if (wide.matches) selectFirst();
  else { currentId = null; document.body.classList.remove('editing'); }
  renderEditor();
  renderList();
  toast('Nota apagada');
}

// ---------- Desenho ampliado (tela cheia) ----------
function openFull(block) {
  doc.blurText();
  closePopover();
  fullBlock = block;
  document.body.classList.add('full-ink');
  el.inkFull.hidden = false;
  ink.open(block);
  updateToolbar();
}

function closeFull() {
  if (!fullBlock) return;
  const b = fullBlock;
  fullBlock = null;
  ink.close();
  el.inkFull.hidden = true;
  document.body.classList.remove('full-ink');
  closePopover();
  doc.refreshBlock(b);
  doc.history();
  updateToolbar();
}

// ---------- Inserir desenho e anexos ----------
function insertDrawing() {
  closeFull();
  doc.insert([Doc.inkBlock(T.settings.lastLayout || 'lisa')]);
  maybeShowInkTip();
}

function chooseInsert() {
  if (!currentNote()) return;
  openSheet({
    actions: [
      { label: 'Desenho', icon: ICONS.pen, run: insertDrawing },
      { label: 'Foto ou vídeo', icon: ICONS.photo, run: () => el.attachPhoto.click() },
      { label: 'Arquivo', icon: ICONS.clip, run: () => el.attachFile.click() },
    ],
  });
}

async function addFiles(list) {
  const n = currentNote();
  if (!n || !list.length) return;
  closeFull();
  const blocks = [];
  for (const f of list) {
    if (f.size > MAX_FILE) { toast(`“${f.name}” é grande demais (máximo de 200 MB)`); continue; }
    try {
      // copia os bytes: o arquivo escolhido pode ser só uma referência temporária
      const blob = new Blob([await f.arrayBuffer()], { type: f.type || 'application/octet-stream' });
      const rec = { id: newId(), name: f.name || 'arquivo', type: blob.type, size: blob.size, created: Date.now(), blob };
      await dbPutFile(rec);
      blocks.push(Doc.fileBlock(rec));
    } catch (e) {
      toast(`Não foi possível guardar “${f.name}”. O aparelho pode estar sem espaço.`);
    }
  }
  if (!blocks.length) return;
  doc.insert(blocks);
  await flushSave();
  toast(blocks.length === 1 ? 'Arquivo anexado' : `${blocks.length} arquivos anexados`);
}

// compartilhar (iPhone/iPad) ou baixar (computador)
function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function shareFiles(files, title) {
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      if (e && e.name === 'NotAllowedError') {
        // demorou para preparar: o iOS pede um novo toque para abrir a tela de compartilhar
        openSheet({
          message: files.length === 1 ? `“${files[0].name}” está pronto.` : `${files.length} arquivos prontos.`,
          actions: [{ label: 'Compartilhar ou Salvar', run: () => navigator.share({ files, title }).catch(() => {}) }],
        });
        return false;
      }
    }
  }
  files.forEach(download);
  return true;
}

async function fileOf(b) {
  const rec = await dbGetFile(b.fileId).catch(() => null);
  if (!rec || !rec.blob) { toast('Este arquivo não está neste aparelho. Importe o backup que o contém.'); return null; }
  return new File([rec.blob], b.name, { type: rec.type || b.mime || 'application/octet-stream' });
}

function fileBlockMenu(b) {
  const canShare = !!(navigator.canShare && navigator.share);
  const actions = [];
  if (Doc.isImage(b)) actions.push({ label: 'Ver imagem', icon: ICONS.photo, run: () => viewImage(b) });
  actions.push({
    label: canShare ? 'Abrir ou Compartilhar' : 'Baixar',
    run: async () => { const f = await fileOf(b); if (f) shareFiles([f], b.name); },
  });
  actions.push({ label: 'Renomear', run: () => askName('Nome do anexo', b.name, 'Nome do arquivo', null, (name) => {
    b.name = name.slice(0, 200);
    doc.render();
    onDocChange('structure');
  }) });
  actions.push({ label: 'Remover da Nota', danger: true, run: () => openSheet({
    message: `O anexo “${b.name}” será apagado deste aparelho.`,
    actions: [{ label: 'Remover Anexo', danger: true, run: async () => {
      doc.removeBlock(b.id);
      await flushSave();
      await removeUnusedFiles([b.fileId]);
    } }],
  }) });
  openSheet({ message: `${b.name} · ${Doc.formatSize(b.size)}`, actions });
}

let viewerUrl = null;
async function viewImage(b) {
  const rec = await dbGetFile(b.fileId).catch(() => null);
  if (!rec || !rec.blob) { toast('Este arquivo não está neste aparelho.'); return; }
  viewerUrl = URL.createObjectURL(rec.blob);
  el.viewerImg.src = viewerUrl;
  el.viewerImg.alt = b.name;
  el.viewer.hidden = false;
}
function closeViewer() {
  if (el.viewer.hidden) return;
  el.viewer.hidden = true;
  el.viewerImg.removeAttribute('src');
  if (viewerUrl) URL.revokeObjectURL(viewerUrl);
  viewerUrl = null;
}

function inkBlockMenu(b) {
  openSheet({
    actions: [
      { label: 'Ampliar', run: () => openFull(b) },
      { label: 'Fundo do Desenho', run: () => openBlockLayout(b) },
      { label: 'Apagar Desenho', danger: true, run: () => openSheet({
        message: 'O desenho será apagado. Não é possível desfazer.',
        actions: [{ label: 'Apagar Desenho', danger: true, run: () => doc.removeBlock(b.id) }],
      }) },
    ],
  });
}

function layoutGrid(layouts, current, onPick) {
  const grid = h('div', { class: 'layout-grid' });
  const refresh = (id) => grid.querySelectorAll('.layout-opt').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.id === id)));
  for (const l of layouts) {
    const cv = h('canvas', { width: 128, height: 180 });
    Ink.renderLayoutPreview(cv, l.id, T.colors);
    const b = h('button', { class: 'layout-opt', 'data-id': l.id, 'aria-pressed': 'false' }, cv, h('span', {}, l.name));
    b.addEventListener('click', () => { onPick(l.id); refresh(l.id); });
    grid.append(b);
  }
  refresh(current);
  return grid;
}

function setBlockLayout(b, layout) {
  if (b.layout === layout) return;
  doc.pushHistory(b, [{ type: 'layout', before: b.layout, after: layout }]);
  b.layout = layout;
  doc.refreshBlock(b);
  T.set({ lastLayout: layout });
}

function openBlockLayout(b) {
  openPanel('Fundo do desenho', h('div', {}, section(null, layoutGrid(Ink.LAYOUTS, b.layout, (id) => setBlockLayout(b, id)))));
}

// ---------- Zoom do texto ----------
function setTextZoom(z, save = true) {
  const n = currentNote();
  if (!n) return;
  n.zoom = Math.round(clamp(z, 0.7, 2.6) * 100) / 100;
  applyTextZoom(n);
  const out = el.panelBody.querySelector('output[data-textzoom]');
  if (out) out.textContent = Math.round(n.zoom * 100) + '%';
  if (save) persistQuiet(n);
}

let textPinch = null;
el.docScroll.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2 && currentNote() && !e.target.closest('.blk-ink')) {
    const [a, b] = e.touches;
    textPinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: currentNote().zoom || 1 };
  }
}, { passive: true });
el.docScroll.addEventListener('touchmove', (e) => {
  if (textPinch && e.touches.length === 2) {
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    setTextZoom(textPinch.z * (d / Math.max(10, textPinch.d)), false);
  }
}, { passive: false });
el.docScroll.addEventListener('touchend', (e) => {
  if (textPinch && e.touches.length < 2) {
    textPinch = null;
    const n = currentNote();
    if (n) persistQuiet(n);
  }
});
el.docScroll.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  const n = currentNote();
  if (!n) return;
  e.preventDefault();
  setTextZoom((n.zoom || 1) * Math.exp(-e.deltaY * 0.01));
}, { passive: false });

// ---------- Folha de ações ----------
function openSheet({ message, actions }) {
  el.toast.classList.remove('show');
  el.sheetGroup.innerHTML = '';
  if (message) {
    const p = document.createElement('p');
    p.className = 'sheet-msg';
    p.textContent = message;
    el.sheetGroup.appendChild(p);
  }
  actions.forEach((a) => {
    const b = document.createElement('button');
    b.className = 'sheet-btn' + (a.danger ? ' danger' : '');
    b.innerHTML = (a.icon || '') + `<span>${escapeHtml(a.label)}</span>`;
    b.addEventListener('click', () => { closeSheet(); a.run(); });
    el.sheetGroup.appendChild(b);
  });
  el.sheetBackdrop.hidden = false;
}
function closeSheet() { el.sheetBackdrop.hidden = true; }

// ---------- Painéis ----------
let panelOnClose = null;
function openPanel(title, content, onClose) {
  closePopover();
  el.panelTitle.textContent = title;
  el.panelBody.replaceChildren(content);
  el.panelBody.scrollTop = 0;
  el.panelBackdrop.hidden = false;
  panelOnClose = onClose || null;
}
function closePanel() {
  if (el.panelBackdrop.hidden) return;
  el.panelBackdrop.hidden = true;
  const fn = panelOnClose;
  panelOnClose = null;
  if (fn) fn();
}

function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function section(title, ...children) {
  return h('div', { class: 'panel-section' }, title ? h('h3', {}, title) : null, ...children);
}

function segmented(options, value, onPick) {
  const wrap = h('div', { class: 'segmented', role: 'group' });
  for (const [val, label] of options) {
    const b = h('button', { 'aria-pressed': String(val === value) }, label);
    b.addEventListener('click', () => {
      wrap.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      onPick(val);
    });
    wrap.append(b);
  }
  return wrap;
}

function themeGrid() {
  const grid = h('div', { class: 'theme-grid' });
  for (const t of T.THEMES) {
    const dark = T.colors.mode === 'dark';
    const b = h('button', { class: 'theme-opt', 'aria-pressed': String(T.settings.theme === t.id), 'aria-label': `Tema ${t.name}` },
      h('span', { class: 'theme-dot', style: `background:${dark ? t.accentDark : t.accent}`, html: ICONS.check }),
      h('span', {}, t.name));
    b.addEventListener('click', () => {
      T.set({ theme: t.id });
      grid.querySelectorAll('.theme-opt').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    });
    grid.append(b);
  }
  return grid;
}

function setFingerMode(v) {
  T.set({ fingerMode: v });
  updateToolbar();
  doc.updateTouchMode();
}

function openSettings() {
  const fingerHint = h('p', { class: 'hint' });
  const updateHint = () => {
    const m = T.settings.fingerMode;
    fingerHint.textContent = m === 'auto'
      ? (T.settings.penSeen ? 'Agora: o dedo rola a nota (o Apple Pencil já foi usado neste aparelho).' : 'Agora: o dedo desenha. Ao usar o Apple Pencil, o dedo passa a rolar a nota.')
      : m === 'draw' ? 'O dedo sempre desenha. Use dois dedos para rolar.' : 'Só a caneta desenha. O dedo rola a nota.';
  };
  updateHint();
  const content = h('div', {},
    section('Tema', h('div', { class: 'panel-card' }, themeGrid())),
    section('Aparência', segmented([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']], T.settings.appearance, (v) => {
      T.set({ appearance: v });
      openSettings(); // redesenha as bolinhas com as cores do modo
    })),
    section('Desenho: o que o dedo faz',
      segmented([['auto', 'Automático'], ['draw', 'Desenha'], ['pan', 'Rola a nota']], T.settings.fingerMode, (v) => {
        setFingerMode(v);
        updateHint();
      }),
      fingerHint),
    section('Tutorial', h('button', { class: 'secondary-btn', onclick: () => { closePanel(); showOnboarding(); } }, 'Ver o tutorial de novo')),
  );
  openPanel('Temas e aparência', content);
}

function openPaperPanel() {
  const n = currentNote();
  if (!n) return;
  if (fullBlock) { // no desenho ampliado, muda só o fundo dele
    const b = fullBlock;
    openPanel('Fundo do desenho', h('div', {}, section(null, layoutGrid(Ink.LAYOUTS, b.layout, (id) => { ink.setLayout(id); T.set({ lastLayout: id }); }))));
    return;
  }
  const parts = [section('Linhas do texto', layoutGrid(TEXT_LAYOUTS, n.layout, (id) => {
    n.layout = id;
    el.doc.dataset.layout = id;
    T.set({ lastTextLayout: id });
    persistQuiet(n);
  }))];
  const inks = inkBlocks(n);
  if (inks.length) {
    const cur = inks[0].layout;
    parts.push(section(inks.length === 1 ? 'Fundo do desenho' : `Fundo dos ${inks.length} desenhos`,
      layoutGrid(Ink.LAYOUTS, inks.every((b) => b.layout === cur) ? cur : null, (id) => inks.forEach((b) => setBlockLayout(b, id))),
      h('p', { class: 'hint' }, 'Para mudar só um desenho, toque em ••• no canto dele.')));
  }
  const out = h('output', { 'data-textzoom': '' }, Math.round((n.zoom || 1) * 100) + '%');
  parts.push(section('Tamanho do texto',
    h('div', { class: 'stepper' },
      h('button', { 'aria-label': 'Diminuir texto', onclick: () => setTextZoom((n.zoom || 1) - 0.1) }, 'A−'),
      out,
      h('button', { 'aria-label': 'Aumentar texto', onclick: () => setTextZoom((n.zoom || 1) + 0.1) }, 'A+')),
    h('p', { class: 'hint' }, 'Dica: você também pode pinçar com dois dedos sobre o texto.')));
  openPanel('Folha', h('div', {}, ...parts));
}

// ---------- Pastas ----------
function askName(title, value, placeholder, hint, onDone) {
  const input = h('input', { class: 'rename-input', type: 'text', value, placeholder, maxlength: '60', enterkeyhint: 'done' });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePanel(); } });
  openPanel(title, h('div', {}, input, hint ? h('p', { class: 'hint' }, hint) : null), () => {
    const v = input.value.trim();
    if (v) onDone(v);
  });
  input.focus();
  input.select();
}

async function openFolder(id) {
  folderId = id;
  T.set({ folder: id });
  const n = currentNote();
  if (wide.matches && (!n || !inOpenFolder(n))) {
    await flushSave();
    await discardIfEmpty();
    selectFirst();
    renderEditor();
  }
  renderList();
  el.list.parentElement.scrollTop = 0;
}

function newFolder(noteToMove) {
  askName('Nova pasta', '', 'Nome da pasta', 'Deixe em branco para cancelar.', async (name) => {
    const now = Date.now();
    const f = { id: newId(), name, created: now, updated: now };
    folders.push(f);
    await dbPutFolder(f);
    if (noteToMove) await moveToFolder(noteToMove, f.id);
    else await openFolder(f.id);
    toast(`Pasta “${name}” criada`);
  });
}

function folderOptions(f) {
  const count = notes.filter((n) => n.folder === f.id && !isEmpty(n)).length;
  openSheet({
    message: `Pasta “${f.name}”`,
    actions: [
      { label: 'Renomear Pasta', run: () => askName('Renomear pasta', f.name, 'Nome da pasta', null, async (name) => {
        f.name = name;
        f.updated = Date.now();
        await dbPutFolder(f);
        renderList();
        renderEditor();
      }) },
      { label: 'Apagar Pasta', danger: true, run: () => openSheet({
        message: count
          ? `A pasta será apagada, mas ${count === 1 ? 'a nota dela não será apagada: ela continua' : `as ${count} notas dela não serão apagadas: elas continuam`} em “Todas”.`
          : 'A pasta está vazia e será apagada.',
        actions: [{ label: 'Apagar Pasta', danger: true, run: () => deleteFolder(f) }],
      }) },
    ],
  });
}

async function deleteFolder(f) {
  folders = folders.filter((x) => x.id !== f.id);
  await dbDeleteFolder(f.id);
  for (const n of notes) {
    if (n.folder !== f.id) continue;
    n.folder = null;
    n.updated = Date.now(); // para a mudança valer também ao importar o backup em outro aparelho
    await persistQuiet(n);
  }
  if (folderId === f.id) await openFolder(null);
  else renderList();
  renderEditor();
  toast('Pasta apagada');
}

async function moveToFolder(n, id) {
  n.folder = id;
  n.updated = Date.now();
  await persistQuiet(n);
  renderList();
  renderEditor();
  const f = folderById(id);
  toast(f ? `Nota movida para “${f.name}”` : 'Nota tirada da pasta');
}

function chooseFolder() {
  const n = currentNote();
  if (!n) return;
  const sorted = [...folders].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  const actions = sorted.filter((f) => f.id !== n.folder)
    .map((f) => ({ label: f.name, icon: ICONS.folder, run: () => moveToFolder(n, f.id) }));
  if (n.folder) actions.push({ label: 'Tirar da pasta', run: () => moveToFolder(n, null) });
  actions.push({ label: 'Nova Pasta…', icon: ICONS.plus, run: () => newFolder(n) });
  const cur = folderById(n.folder);
  openSheet({ message: cur ? `Esta nota está na pasta “${cur.name}”. Mover para:` : 'Mover esta nota para a pasta:', actions });
}

// ---------- Exportar a nota ----------
async function exportCurrent(format) {
  const n = currentNote();
  if (!n) return;
  await flushSave();
  toast('Preparando o arquivo…');
  try {
    const files = await Exporter.exportNote(n, format, {
      title: noteTitle(n),
      colors: T.palette(T.settings.theme, 'light'),
      getBlob: async (id) => { const r = await dbGetFile(id).catch(() => null); return r && r.blob; },
    });
    el.toast.classList.remove('show');
    await shareFiles(files, noteTitle(n));
  } catch (e) {
    toast('Não foi possível exportar a nota');
  }
}

function chooseExport() {
  if (!currentNote()) return;
  openSheet({
    message: 'Exportar esta nota como',
    actions: [
      { label: 'PDF', run: () => exportCurrent('pdf') },
      { label: 'Imagem (PNG)', run: () => exportCurrent('png') },
      { label: 'Texto (.txt)', run: () => exportCurrent('txt') },
      { label: 'Markdown (.md)', run: () => exportCurrent('md') },
    ],
  });
}

function openNoteMenu() {
  const n = currentNote();
  if (!n) return;
  const nf = folderById(n.folder);
  openSheet({
    actions: [
      { label: 'Folha e tamanho do texto', run: openPaperPanel },
      { label: nf ? `Pasta: ${nf.name}` : 'Mover para pasta', icon: ICONS.folder, run: chooseFolder },
      { label: n.pinned ? 'Desafixar' : 'Fixar no topo', run: togglePin },
      { label: 'Apagar Nota', danger: true, run: askDelete },
    ],
  });
}

function openHelp(topicId) {
  const wrap = h('div', { class: 'help' });
  for (const t of Help.HELP) {
    const d = h('details', { class: t.id === 'sync' ? 'featured' : '' }, h('summary', {}, t.title), h('div', { class: 'help-body', html: t.html }));
    if (topicId ? t.id === topicId : t.open) d.open = true;
    wrap.append(d);
  }
  wrap.append(h('div', { class: 'help-actions' },
    h('button', { class: 'secondary-btn', onclick: () => { closePanel(); showOnboarding(); } }, 'Ver o tutorial'),
    h('button', { class: 'secondary-btn', onclick: () => { closePanel(); exportNotes(); } }, 'Exportar backup agora')));
  openPanel('Ajuda', wrap);
}

function openMenu() {
  const total = notes.filter((n) => !isEmpty(n)).length;
  openSheet({
    message: total ? `${total} ${total === 1 ? 'nota salva' : 'notas salvas'} neste aparelho` : 'Nenhuma nota salva ainda',
    actions: [
      { label: 'Temas e aparência', run: openSettings },
      { label: 'Exportar backup', run: exportNotes },
      { label: 'Importar backup', run: () => el.importFile.click() },
      { label: 'Como sincronizar aparelhos', run: () => openHelp('sync') },
    ],
  });
}

// ---------- Barra de ferramentas do desenho ----------
function updateToolbar() {
  el.toolbar.querySelectorAll('.tool').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === ink.tool)));
  const eraser = ink.tool === 'eraser';
  el.tbColor.disabled = eraser;
  el.tbColor.querySelector('.swatch').style.background = eraser ? 'transparent' : ink.currentColor();
  const dot = el.tbSize.querySelector('.size-dot');
  const px = [7, 11, 16][ink.currentSize()];
  dot.style.width = dot.style.height = px + 'px';
  dot.style.background = eraser ? 'transparent' : ink.currentColor();
  dot.style.boxShadow = eraser ? 'inset 0 0 0 1.5px var(--text)' : '0 0 0 1px var(--muted)';
  const fd = fingerDraws();
  el.tbFinger.setAttribute('aria-pressed', String(fd));
  el.tbFinger.setAttribute('aria-label', fd ? 'O dedo desenha (toque para o dedo rolar)' : 'O dedo rola (toque para o dedo desenhar)');
}

let popoverKind = null;
function closePopover() {
  el.popover.hidden = true;
  popoverKind = null;
}
function showPopover(kind, content) {
  if (popoverKind === kind) { closePopover(); return; }
  popoverKind = kind;
  el.toast.classList.remove('show');
  el.popover.replaceChildren(content);
  el.popover.hidden = false;
}

el.toolbar.addEventListener('click', (e) => {
  const tool = e.target.closest('.tool');
  if (tool) {
    ink.setTool(tool.dataset.tool);
    saveInkPrefs();
    closePopover();
    updateToolbar();
  }
});

el.tbColor.addEventListener('click', () => {
  const colors = ink.tool === 'hl' ? HL_COLORS : PEN_COLORS;
  const grid = h('div', { class: 'color-grid' });
  for (const c of colors) {
    grid.append(h('button', {
      class: 'color-opt', style: `background:${c}`, 'aria-label': `Cor ${c}`,
      'aria-pressed': String(c === ink.currentColor()),
      onclick: () => { ink.setColor(c); saveInkPrefs(); updateToolbar(); closePopover(); },
    }));
  }
  showPopover('color', h('div', {}, h('p', { class: 'popover-label' }, ink.tool === 'hl' ? 'Cor do marca-texto' : 'Cor da caneta'), grid));
});

el.tbSize.addEventListener('click', () => {
  const row = h('div', { class: 'size-row' });
  const eraser = ink.tool === 'eraser';
  [7, 11, 16].forEach((px, i) => {
    const dot = h('span', { style: `width:${px}px;height:${px}px;${eraser ? 'background:transparent;box-shadow:inset 0 0 0 1.5px var(--text)' : `background:${ink.currentColor()}`}` });
    row.append(h('button', {
      class: 'size-opt', 'aria-label': ['Fina', 'Média', 'Grossa'][i], 'aria-pressed': String(i === ink.currentSize()),
      onclick: () => { ink.setSize(i); saveInkPrefs(); updateToolbar(); closePopover(); },
    }, dot));
  });
  const label = eraser ? 'Tamanho da borracha' : ink.tool === 'hl' ? 'Largura do marca-texto' : 'Espessura da caneta';
  showPopover('size', h('div', {}, h('p', { class: 'popover-label' }, label), row));
});

el.tbFinger.addEventListener('click', () => {
  const next = fingerDraws() ? 'pan' : 'draw';
  setFingerMode(next);
  toast(next === 'draw' ? 'O dedo agora desenha' : 'O dedo agora rola a nota (só a caneta desenha)');
});

el.tbZoom.addEventListener('click', () => {
  const row = h('div', { class: 'zoom-row' },
    h('button', { 'aria-label': 'Diminuir zoom', onclick: () => ink.zoomBy(1 / 1.25) }, '−'),
    h('output', { 'data-zoom': '' }, ink.zoomPercent() + '%'),
    h('button', { 'aria-label': 'Aumentar zoom', onclick: () => ink.zoomBy(1.25) }, '+'),
    h('button', { class: 'zoom-fit', onclick: () => { ink.zoomFit(); closePopover(); } }, 'Ajustar à tela'));
  showPopover('zoom', h('div', {}, h('p', { class: 'popover-label' }, 'Zoom (ou pince com dois dedos)'), row));
});

// fecha o popover ao tocar fora
document.addEventListener('pointerdown', (e) => {
  if (popoverKind && !el.popover.contains(e.target) && !el.toolbar.contains(e.target)) closePopover();
}, true);

// ---------- Dicas de primeiro uso ----------
function maybeShowInkTip() {
  if (T.settings.tips.blocks || !el.onboarding.hidden || document.querySelector('.tip')) return;
  const tip = h('div', { class: 'tip', role: 'note' },
    h('div', { html: '<b>Dica:</b> desenhe no quadro com o Apple Pencil ou com o dedo. Arraste a <b>alça de baixo</b> para aumentar o quadro e toque em <b>⤢</b> para desenhar em tela cheia, com zoom.' }),
    h('div', { class: 'tip-actions' }, h('button', {
      class: 'text-btn accent strong',
      onclick: () => { T.set({ tips: { ...T.settings.tips, blocks: true } }); tip.remove(); },
    }, 'Entendi')));
  $('.editor-wrap').append(tip);
}

// ---------- Tutorial ----------
let obIndex = 0;
function showOnboarding() {
  const slides = Help.ONBOARDING;
  el.obSlides.innerHTML = '';
  el.obDots.innerHTML = '';
  slides.forEach((s, i) => {
    const slide = h('div', { class: 'ob-slide', 'aria-hidden': 'true' },
      h('div', { html: s.art }), h('h2', {}, s.title), h('p', { html: s.text }));
    if (s.slot === 'themes') slide.append(themeGrid());
    el.obSlides.append(slide);
    el.obDots.append(h('span', { onclick: () => goSlide(i) }));
  });
  obIndex = 0;
  el.onboarding.hidden = false;
  goSlide(0);
  // conta como visto já ao aparecer: fechar o app no meio não faz o tutorial voltar
  if (!T.settings.onboarded) T.set({ onboarded: true });
}
function goSlide(i) {
  const slides = el.obSlides.children;
  obIndex = clamp(i, 0, slides.length - 1);
  [...slides].forEach((s, k) => {
    s.style.transform = `translateX(${(k - obIndex) * 100}%)`;
    s.style.opacity = k === obIndex ? '1' : '0';
    s.setAttribute('aria-hidden', String(k !== obIndex));
  });
  [...el.obDots.children].forEach((d, k) => d.classList.toggle('on', k === obIndex));
  const last = obIndex === slides.length - 1;
  el.obNext.textContent = last ? 'Começar' : 'Próximo';
  el.obSkip.style.visibility = last ? 'hidden' : 'visible';
}
function finishOnboarding() {
  el.onboarding.hidden = true;
  T.set({ onboarded: true });
}
el.obNext.addEventListener('click', () => {
  if (obIndex >= el.obSlides.children.length - 1) finishOnboarding();
  else goSlide(obIndex + 1);
});
el.obSkip.addEventListener('click', finishOnboarding);
let obSwipe = null;
el.obSlides.addEventListener('pointerdown', (e) => { obSwipe = { x: e.clientX, y: e.clientY }; });
el.obSlides.addEventListener('pointerup', (e) => {
  if (!obSwipe) return;
  const dx = e.clientX - obSwipe.x, dy = e.clientY - obSwipe.y;
  obSwipe = null;
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) goSlide(obIndex + (dx < 0 ? 1 : -1));
});

// ---------- Backup: exportar / importar ----------
function exportable(n) {
  const { thumb, ...rest } = n;
  return rest;
}

const blobToBase64 = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

async function exportNotes() {
  await flushSave();
  const list = notes.filter((n) => !isEmpty(n));
  toast('Preparando o backup…');
  const files = [];
  for (const id of new Set(list.flatMap((n) => fileBlocks(n).map((b) => b.fileId)))) {
    const rec = await dbGetFile(id).catch(() => null);
    if (rec && rec.blob) files.push({ id: rec.id, name: rec.name, type: rec.type, size: rec.size, data: await blobToBase64(rec.blob) });
  }
  const data = { app: 'notas-pwa', version: 4, exported: new Date().toISOString(), folders, notes: list.map(exportable), files };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const name = `notas-backup-${stamp}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  el.toast.classList.remove('show');
  if (await shareFiles([file], 'Backup das notas') && !(navigator.canShare && navigator.canShare({ files: [file] }))) toast('Backup exportado');
}

const LAYOUT_IDS = new Set(Ink.LAYOUTS.map((l) => l.id));
const HEX = /^#[0-9a-f]{6}$/i;
const MIME = /^[\w.+-]+\/[\w.+-]+$/;
const idOf = (v) => (typeof v === 'string' && v ? v.slice(0, 64) : newId());

function sanitizeStrokes(list) {
  return (Array.isArray(list) ? list : [])
    .filter((s) => s && Array.isArray(s.p) && s.p.length >= 3 && s.p.length % 3 === 0 && s.p.every(Number.isFinite))
    .map((s) => ({ t: s.t === 'hl' ? 'hl' : 'pen', c: HEX.test(s.c) ? s.c : '#1c1c1e', w: clamp(Number(s.w) || 2.8, 0.5, 60), p: s.p }));
}

function sanitizeBlock(b) {
  if (!b || typeof b !== 'object') return null;
  if (b.type === 'text') return { id: idOf(b.id), type: 'text', text: typeof b.text === 'string' ? b.text : '' };
  if (b.type === 'ink') {
    return { id: idOf(b.id), type: 'ink', h: clamp(Number(b.h) || Ink.PAGE_H, Ink.MIN_H, Ink.MAX_H), layout: LAYOUT_IDS.has(b.layout) ? b.layout : 'lisa', strokes: sanitizeStrokes(b.strokes) };
  }
  if (b.type === 'file' && typeof b.fileId === 'string' && b.fileId) {
    return { id: idOf(b.id), type: 'file', fileId: b.fileId.slice(0, 64), name: typeof b.name === 'string' && b.name ? b.name.slice(0, 200) : 'arquivo',
      mime: typeof b.mime === 'string' && MIME.test(b.mime) ? b.mime : '', size: Number(b.size) || 0 };
  }
  return null;
}

function sanitizeImported(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = {
    id: idOf(raw.id),
    pinned: !!raw.pinned,
    folder: typeof raw.folder === 'string' && raw.folder ? raw.folder.slice(0, 64) : null,
    created: Number(raw.created) || Date.now(),
    updated: Number(raw.updated) || Date.now(),
    zoom: clamp(Number(raw.zoom) || 1, 0.7, 2.6),
    layout: LAYOUT_IDS.has(raw.layout) && raw.layout !== 'cornell' ? raw.layout : 'lisa',
  };
  let n;
  if (Array.isArray(raw.blocks)) {
    n = { ...base, blocks: raw.blocks.map(sanitizeBlock).filter(Boolean) };
  } else if (raw.kind === 'ink') { // backup antigo: nota manuscrita
    if (!Array.isArray(raw.pages)) return null;
    n = { ...base, kind: 'ink', title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : '',
      pages: raw.pages.map((p) => ({ layout: LAYOUT_IDS.has(p && p.layout) ? p.layout : 'pautada', strokes: sanitizeStrokes(p && p.strokes) })) };
  } else { // backup antigo: nota digitada
    if (typeof raw.text !== 'string') return null;
    n = { ...base, kind: 'text', text: raw.text };
  }
  normalize(n);
  return isEmpty(n) ? null : n;
}

async function importNotes(file) {
  try {
    await flushSave();
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data && data.notes;
    if (!Array.isArray(incoming)) throw new Error('formato');
    // arquivos anexados
    for (const f of (data && Array.isArray(data.files) ? data.files : [])) {
      if (!f || typeof f.id !== 'string' || !f.id || typeof f.data !== 'string') continue;
      if (await dbGetFile(f.id.slice(0, 64)).catch(() => null)) continue;
      const type = typeof f.type === 'string' && MIME.test(f.type) ? f.type : 'application/octet-stream';
      const blob = await (await fetch(`data:${type};base64,${f.data}`)).blob();
      await dbPutFile({ id: f.id.slice(0, 64), name: typeof f.name === 'string' ? f.name.slice(0, 200) : 'arquivo', type, size: blob.size, created: Date.now(), blob });
    }
    // pastas (backups antigos não têm pastas)
    for (const raw of (data && Array.isArray(data.folders) ? data.folders : [])) {
      if (!raw || typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string' || !raw.name.trim()) continue;
      const f = { id: raw.id.slice(0, 64), name: raw.name.trim().slice(0, 60), created: Number(raw.created) || Date.now(), updated: Number(raw.updated) || Date.now() };
      const existing = folderById(f.id);
      if (!existing) { folders.push(f); await dbPutFolder(f); }
      else if (f.updated > existing.updated) { Object.assign(existing, f); await dbPutFolder(existing); }
    }
    let added = 0, updated = 0, reopen = false;
    for (const raw of incoming) {
      const note = sanitizeImported(raw);
      if (!note) continue;
      const existing = notes.find((n) => n.id === note.id);
      if (!existing) {
        note.thumb = makeThumb(note);
        notes.push(note);
        added++;
        await dbPut(note);
      } else if (note.updated > existing.updated) {
        for (const k of Object.keys(existing)) delete existing[k];
        Object.assign(existing, note);
        existing.thumb = makeThumb(existing);
        if (existing.id === currentId) reopen = true;
        updated++;
        await dbPut(existing);
      }
    }
    if (wide.matches && !currentNote()) selectFirst();
    renderList();
    renderEditor(reopen);
    toast(added || updated ? `Importado: ${added} ${added === 1 ? 'nova' : 'novas'}, ${updated} ${updated === 1 ? 'atualizada' : 'atualizadas'}` : 'Nada novo para importar: tudo já estava aqui');
  } catch {
    toast('Arquivo de backup inválido');
  }
}

// ---------- Tela cheia no iPad (esconde a lista) ----------
function setFocusMode(on, save = true) {
  document.body.classList.toggle('focus', on);
  el.btnSidebar.setAttribute('aria-pressed', String(on));
  el.btnSidebar.setAttribute('aria-label', on ? 'Mostrar a lista' : 'Esconder a lista (tela cheia)');
  if (save) T.set({ focus: on });
}

// ---------- Eventos ----------
el.list.addEventListener('click', (e) => {
  const item = e.target.closest('.note-item');
  if (item) openNote(item.dataset.id);
});
el.search.addEventListener('input', () => { query = el.search.value; renderList(); });
el.btnDone.addEventListener('mousedown', (e) => e.preventDefault());
el.btnDone.addEventListener('click', () => doc.blurText());
el.btnNew.addEventListener('click', () => newNote());
el.btnBack.addEventListener('click', () => (fullBlock ? closeFull() : closeEditor()));
el.btnFullDone.addEventListener('click', closeFull);
el.btnPin.addEventListener('click', togglePin);
el.btnDelete.addEventListener('click', askDelete);
el.btnMenu.addEventListener('click', openMenu);
el.btnHelp.addEventListener('click', () => openHelp());
el.btnPaper.addEventListener('click', openPaperPanel);
el.btnInsert.addEventListener('click', chooseInsert);
el.btnExport.addEventListener('click', chooseExport);
el.btnNoteMenu.addEventListener('click', openNoteMenu);
el.btnUndo.addEventListener('click', () => (fullBlock ? ink.undo() : doc.undo()));
el.btnRedo.addEventListener('click', () => (fullBlock ? ink.redo() : doc.redo()));
el.btnFolder.addEventListener('click', chooseFolder);
el.folders.addEventListener('click', (e) => {
  const chip = e.target.closest('.folder-chip');
  if (!chip || chip.classList.contains('add')) return;
  const id = chip.dataset.folder || null;
  if (id && id === folderId) folderOptions(folderById(id));
  else openFolder(id);
});
el.btnSidebar.addEventListener('click', () => setFocusMode(!document.body.classList.contains('focus')));
el.sheetCancel.addEventListener('click', closeSheet);
el.sheetBackdrop.addEventListener('click', (e) => { if (e.target === el.sheetBackdrop) closeSheet(); });
el.panelClose.addEventListener('click', closePanel);
el.panelBackdrop.addEventListener('click', (e) => { if (e.target === el.panelBackdrop) closePanel(); });
el.viewerClose.addEventListener('click', closeViewer);
el.viewer.addEventListener('click', (e) => { if (e.target === el.viewer) closeViewer(); });
el.importFile.addEventListener('change', () => {
  const f = el.importFile.files[0];
  if (f) importNotes(f);
  el.importFile.value = '';
});
for (const input of [el.attachFile, el.attachPhoto]) {
  input.addEventListener('change', () => {
    const files = [...input.files];
    input.value = '';
    addFiles(files);
  });
}

// impede o zoom da página inteira no iOS (o zoom acontece dentro da nota)
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Atalhos de teclado (iPad com teclado e notebook)
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  const n = currentNote();
  const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (!el.viewer.hidden) closeViewer();
    else if (!el.sheetBackdrop.hidden) closeSheet();
    else if (!el.panelBackdrop.hidden) closePanel();
    else if (popoverKind) closePopover();
    else if (fullBlock) closeFull();
    return;
  }
  if (!mod) return;
  if (k === 'n') { e.preventDefault(); newNote(e.shiftKey); }
  else if (k === 'f') { e.preventDefault(); setFocusMode(false); el.search.focus(); }
  else if (k === '\\' && wide.matches) { e.preventDefault(); setFocusMode(!document.body.classList.contains('focus')); }
  else if (n && k === 'z' && !typing) {
    e.preventDefault();
    if (fullBlock) { if (e.shiftKey) ink.redo(); else ink.undo(); }
    else if (e.shiftKey) doc.redo(); else doc.undo();
  } else if (n && (k === '=' || k === '+' || k === '-' || k === '0')) {
    e.preventDefault();
    if (fullBlock) {
      if (k === '0') ink.zoomFit(); else ink.zoomBy(k === '-' ? 1 / 1.25 : 1.25);
    } else {
      setTextZoom(k === '0' ? 1 : (n.zoom || 1) + (k === '-' ? -0.1 : 0.1));
    }
  }
});

// Ao girar o iPad ou mudar o tamanho da janela (Split View)
wide.addEventListener('change', () => {
  if (wide.matches) { if (!currentNote()) selectFirst(); }
  else if (!document.body.classList.contains('editing')) currentId = null;
  renderEditor();
  renderList();
});

// Tema trocado: refaz miniaturas (a cor do papel muda)
let themeTimer;
window.addEventListener('themechange', () => {
  clearTimeout(themeTimer);
  themeTimer = setTimeout(() => {
    for (const n of notes) if (!isEmpty(n)) { n.thumb = makeThumb(n); persistQuiet(n); }
    renderList();
    updateToolbar();
  }, 250);
});

// Salva antes de o app ir para segundo plano
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
window.addEventListener('pagehide', () => { flushSave(); });

// ---------- Início ----------
async function init() {
  setFocusMode(!!T.settings.focus, false); // antes de abrir o banco, para a lista não piscar
  try {
    const all = await dbAll();
    const kept = [];
    for (const n of all) {
      const migrated = !Array.isArray(n.blocks);
      normalize(n);
      if (isEmpty(n)) { await dbDelete(n.id); continue; }
      if (migrated) { n.thumb = makeThumb(n); await dbPut(n); } // grava já no formato novo
      kept.push(n);
    }
    notes = kept;
    folders = (await dbFolders()).filter((f) => f && typeof f.id === 'string' && typeof f.name === 'string');
    folderId = folderById(T.settings.folder) ? T.settings.folder : null;
    // arquivos que nenhuma nota usa (por exemplo, anexados numa nota que não chegou a ser salva)
    removeUnusedFiles(await dbFileKeys()).catch(() => {});
  } catch (e) {
    notes = [];
    folders = [];
    toast('Não foi possível abrir o armazenamento');
  }
  if (wide.matches) selectFirst();
  renderList();
  renderEditor();
  updateToolbar();
  if (!T.settings.onboarded) showOnboarding();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}

init();
