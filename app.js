'use strict';

/* =========================================================
   Notas: PWA para iPhone e iPad
   Notas digitadas e manuscritas, temas, folhas, zoom, ajuda.
   Os dados ficam no próprio aparelho (IndexedDB).
   ========================================================= */

const T = window.Theme;
const Help = window.HelpContent;

// ---------- Banco de dados (IndexedDB) ----------
const DB_NAME = 'notas-db';
const STORE = 'notes';

const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbRun(mode, action) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = action(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req ? req.result : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
const dbAll = () => dbRun('readonly', (s) => s.getAll());
const dbPut = (note) => dbRun('readwrite', (s) => s.put(note));
const dbDelete = (id) => dbRun('readwrite', (s) => s.delete(id));

// ---------- Estado ----------
let notes = [];
let currentId = null;
let query = '';
let saveTimer = null;
const thumbTimers = new Map();

const $ = (sel) => document.querySelector(sel);
const el = {
  list: $('#list'), listEmpty: $('#list-empty'), count: $('#count'), search: $('#search'),
  textView: $('#text-view'), editor: $('#editor'), editorDate: $('#editor-date'),
  inkView: $('#ink-view'), inkHost: $('#ink-host'), inkTitle: $('#ink-title'), inkInfo: $('#ink-info'),
  toolbar: $('#ink-toolbar'), popover: $('#ink-popover'),
  tbColor: $('#tb-color'), tbSize: $('#tb-size'), tbFinger: $('#tb-finger'), tbZoom: $('#tb-zoom'),
  btnNew: $('#btn-new'), btnBack: $('#btn-back'), btnPin: $('#btn-pin'), btnDelete: $('#btn-delete'),
  btnDone: $('#btn-done'), btnMenu: $('#btn-menu'), btnHelp: $('#btn-help'), btnPaper: $('#btn-paper'),
  btnUndo: $('#btn-undo'), btnRedo: $('#btn-redo'),
  sheetBackdrop: $('#sheet-backdrop'), sheetGroup: $('#sheet-group'), sheetCancel: $('#sheet-cancel'),
  panelBackdrop: $('#panel-backdrop'), panelTitle: $('#panel-title'), panelBody: $('#panel-body'), panelClose: $('#panel-close'),
  onboarding: $('#onboarding'), obSlides: $('#ob-slides'), obDots: $('#ob-dots'), obNext: $('#ob-next'), obSkip: $('#ob-skip'),
  importFile: $('#import-file'), toast: $('#toast'),
};

const wide = window.matchMedia('(min-width: 768px)');

const PEN_COLORS = ['#1c1c1e', '#6e6e73', '#d94f86', '#c2185b', '#e5383b', '#f28c28', '#e0b000', '#2fa565', '#1f9fb4', '#2f6fde', '#8a4fd8', '#8b5e3c'];
const HL_COLORS = ['#ff7eb3', '#ffd60a', '#7ee081', '#6cc8ff', '#c59bff', '#ffab6e'];
const TEXT_LAYOUTS = Ink.LAYOUTS.filter((l) => l.id !== 'cornell');

const ICONS = {
  pen: '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.6L16.6 4a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6h14M12 6v13M9 19h6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---------- Utilidades ----------
function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fold(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

function splitNote(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return { title: lines[0] || 'Nova nota', preview: lines.slice(1).join(' ') || 'Sem texto adicional' };
}

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
const isInk = (n) => n.kind === 'ink';

function normalize(n) {
  if (n.kind === 'ink') {
    if (!Array.isArray(n.pages) || !n.pages.length) n.pages = [{ layout: 'pautada', strokes: [] }];
    n.title = typeof n.title === 'string' ? n.title : '';
  } else {
    n.kind = 'text';
    n.text = typeof n.text === 'string' ? n.text : '';
    n.layout = n.layout || 'lisa';
    n.zoom = n.zoom || 1;
  }
  n.pinned = !!n.pinned;
  return n;
}

function isEmpty(n) {
  if (isInk(n)) return !n.title.trim() && n.pages.every((p) => p.strokes.length === 0);
  return !n.text.trim();
}

function noteTitle(n) {
  if (isInk(n)) return n.title.trim() || 'Nota manuscrita';
  return splitNote(n.text).title;
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

function scheduleThumb(n) {
  clearTimeout(thumbTimers.get(n.id));
  thumbTimers.set(n.id, setTimeout(() => {
    thumbTimers.delete(n.id);
    n.thumb = Ink.renderThumb(n, T.colors);
    persistQuiet(n);
    renderList();
  }, 900));
}

async function discardIfEmpty(n = currentNote()) {
  if (n && isEmpty(n)) {
    notes = notes.filter((x) => x.id !== n.id);
    await dbDelete(n.id);
  }
}

// ---------- Editor de escrita à mão ----------
function fingerDraws() {
  const m = T.settings.fingerMode;
  return m === 'draw' || (m === 'auto' && !T.settings.penSeen);
}

const ink = new Ink.InkEditor(el.inkHost, {
  colors: () => T.colors,
  fingerDraws,
  onPen() {
    if (!T.settings.penSeen) {
      T.set({ penSeen: true });
      updateToolbar();
      if (T.settings.fingerMode === 'auto') toast('Apple Pencil detectado: agora o dedo move a folha e só a caneta escreve');
    }
  },
  onChange() {
    const n = currentNote();
    if (!n || !isInk(n)) return;
    n.updated = Date.now();
    scheduleSave();
    scheduleThumb(n);
    closePopover();
  },
  onHistory(canUndo, canRedo) {
    el.btnUndo.disabled = !canUndo;
    el.btnRedo.disabled = !canRedo;
  },
  onView(v) {
    el.tbZoom.textContent = v.zoom + '%';
    el.inkInfo.textContent = v.pages > 1 ? `página ${v.page} de ${v.pages}` : '';
    const out = el.popover.querySelector('output[data-zoom]');
    if (out) out.textContent = v.zoom + '%';
  },
});

// restaura ferramentas usadas por último
(function restoreInk() {
  const s = T.settings.ink || {};
  if (s.pen) ink.color.pen = s.pen;
  if (s.hl) ink.color.hl = s.hl;
  if (s.sizes) Object.assign(ink.sizeIndex, s.sizes);
})();
function saveInkPrefs() {
  T.set({ ink: { pen: ink.color.pen, hl: ink.color.hl, sizes: { ...ink.sizeIndex } } });
}

// ---------- Lista ----------
function sortedNotes() {
  return [...notes].sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
}

function renderList() {
  const q = query.trim();
  const fq = fold(q);
  const matches = (n) => !fq || fold(isInk(n) ? n.title : n.text).includes(fq);
  const visible = sortedNotes().filter((n) => !isEmpty(n) || n.id === currentId).filter(matches);
  const pinned = visible.filter((n) => n.pinned);
  const others = visible.filter((n) => !n.pinned);

  const item = (n) => {
    const active = n.id === currentId ? ' active' : '';
    if (isInk(n)) {
      if (!n.thumb) n.thumb = Ink.renderThumb(n, T.colors);
      const pages = n.pages.length;
      return `<button class="note-item${active}" data-id="${escapeHtml(n.id)}">
        <div class="note-text">
          <div class="note-title">${highlight(noteTitle(n), q)}</div>
          <div class="note-sub"><time>${escapeHtml(shortDate(n.updated))}</time><span class="kind-icon">${ICONS.pen}</span>${pages} ${pages === 1 ? 'página' : 'páginas'}</div>
        </div>
        <img class="note-thumb" src="${n.thumb}" alt="">
      </button>`;
    }
    const { title, preview } = splitNote(n.text);
    return `<button class="note-item${active}" data-id="${escapeHtml(n.id)}">
      <div class="note-text">
        <div class="note-title">${highlight(title, q)}</div>
        <div class="note-sub"><time>${escapeHtml(shortDate(n.updated))}</time>${highlight(preview, q)}</div>
      </div>
    </button>`;
  };
  const section = (title, arr) =>
    arr.length ? `${title ? `<h2 class="section-title">${title}</h2>` : ''}<div class="group">${arr.map(item).join('')}</div>` : '';

  el.list.innerHTML = pinned.length ? section('Fixadas', pinned) + section('Notas', others) : section('', others);

  const total = notes.filter((n) => !isEmpty(n)).length;
  el.count.textContent = total === 0 ? '' : total === 1 ? '1 nota' : `${total} notas`;

  if (visible.length === 0) {
    el.listEmpty.hidden = false;
    el.listEmpty.textContent = q
      ? `Nenhum resultado para “${q}”`
      : 'Nenhuma nota ainda. Toque no lápis para escrever à mão ou digitar.';
  } else {
    el.listEmpty.hidden = true;
  }
}

// ---------- Editor ----------
function applyTextZoom(n) {
  const fs = 17 * (n.zoom || 1);
  el.editor.style.setProperty('--fs', fs.toFixed(1) + 'px');
  el.editor.style.setProperty('--lh', Math.round(fs * 1.55) + 'px');
}

function renderEditor(force) {
  const n = currentNote();
  const body = document.body;
  body.classList.toggle('no-note', !n);
  body.classList.toggle('kind-ink', !!n && isInk(n));
  body.classList.toggle('kind-text', !!n && !isInk(n));
  closePopover();
  if (!n) {
    ink.close();
    el.editor.value = '';
    el.editorDate.textContent = '';
    return;
  }
  el.btnPin.setAttribute('aria-pressed', String(!!n.pinned));
  el.btnPin.setAttribute('aria-label', n.pinned ? 'Desafixar nota' : 'Fixar nota');

  if (isInk(n)) {
    el.btnDone.hidden = true;
    if (force || ink.note !== n) ink.open(n);
    updateInkHead();
    updateToolbar();
    maybeShowInkTip();
  } else {
    if (ink.note) ink.close();
    if (el.editor.value !== n.text) el.editor.value = n.text;
    el.editor.dataset.layout = n.layout;
    applyTextZoom(n);
    el.editorDate.textContent = fmtLong.format(n.updated);
  }
}

function updateInkHead() {
  const n = currentNote();
  if (!n || !isInk(n)) return;
  el.inkTitle.textContent = n.title.trim() || 'Sem título';
  el.inkTitle.classList.toggle('placeholder', !n.title.trim());
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
  el.editor.scrollTop = 0;
}

async function closeEditor() {
  el.editor.blur();
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
  const first = sortedNotes().find((n) => !isEmpty(n));
  currentId = first ? first.id : null;
}

function createNote(kind) {
  const now = Date.now();
  if (kind === 'ink') {
    return normalize({ id: newId(), kind: 'ink', title: '', pages: [{ layout: T.settings.lastLayout || 'pautada', strokes: [] }], pinned: false, created: now, updated: now });
  }
  return normalize({ id: newId(), kind: 'text', text: '', layout: T.settings.lastTextLayout || 'lisa', zoom: 1, pinned: false, created: now, updated: now });
}

function newNote(kind) {
  const prev = currentNote();
  const hadPending = !!saveTimer;
  clearTimeout(saveTimer);
  saveTimer = null;

  const note = createNote(kind);
  notes.push(note);
  currentId = note.id;
  document.body.classList.add('editing');
  renderEditor();
  // foco síncrono, dentro do toque, para o teclado abrir no iOS
  if (kind === 'text') el.editor.focus();
  renderList();

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

function chooseNewNote() {
  openSheet({
    actions: [
      { label: 'Nota manuscrita', icon: ICONS.pen, run: () => newNote('ink') },
      { label: 'Nota digitada', icon: ICONS.text, run: () => newNote('text') },
    ],
  });
}

function onTextInput() {
  const n = currentNote();
  if (!n || isInk(n)) return;
  n.text = el.editor.value;
  n.updated = Date.now();
  el.editorDate.textContent = fmtLong.format(n.updated);
  scheduleSave();
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
  openSheet({
    message: 'Esta nota será apagada deste aparelho. Não é possível desfazer.',
    actions: [{ label: 'Apagar Nota', danger: true, run: deleteCurrent }],
  });
}

async function deleteCurrent() {
  const n = currentNote();
  if (!n) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  notes = notes.filter((x) => x.id !== n.id);
  await dbDelete(n.id);
  el.editor.blur();
  if (wide.matches) selectFirst();
  else { currentId = null; document.body.classList.remove('editing'); }
  renderEditor();
  renderList();
  toast('Nota apagada');
}

// ---------- Zoom do texto ----------
function setTextZoom(z, save = true) {
  const n = currentNote();
  if (!n || isInk(n)) return;
  n.zoom = Math.round(clamp(z, 0.7, 2.6) * 100) / 100;
  applyTextZoom(n);
  const out = el.panelBody.querySelector('output[data-textzoom]');
  if (out) out.textContent = Math.round(n.zoom * 100) + '%';
  if (save) persistQuiet(n);
}

let textPinch = null;
el.textView.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2 && currentNote() && !isInk(currentNote())) {
    const [a, b] = e.touches;
    textPinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: currentNote().zoom || 1 };
  }
}, { passive: true });
el.textView.addEventListener('touchmove', (e) => {
  if (textPinch && e.touches.length === 2) {
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    setTextZoom(textPinch.z * (d / Math.max(10, textPinch.d)), false);
  }
}, { passive: false });
el.textView.addEventListener('touchend', (e) => {
  if (textPinch && e.touches.length < 2) {
    textPinch = null;
    const n = currentNote();
    if (n) persistQuiet(n);
  }
});
el.textView.addEventListener('wheel', (e) => {
  if (!e.ctrlKey && !e.metaKey) return;
  const n = currentNote();
  if (!n || isInk(n)) return;
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

function openSettings() {
  const fingerHint = h('p', { class: 'hint' });
  const updateHint = () => {
    const m = T.settings.fingerMode;
    fingerHint.textContent = m === 'auto'
      ? (T.settings.penSeen ? 'Agora: o dedo move a folha (Apple Pencil já foi usado neste aparelho).' : 'Agora: o dedo escreve. Ao usar o Apple Pencil, o dedo passa a mover a folha.')
      : m === 'draw' ? 'O dedo sempre escreve. Use dois dedos para mover e dar zoom.' : 'Só a caneta escreve. O dedo move a folha.';
  };
  updateHint();
  const content = h('div', {},
    section('Tema', h('div', { class: 'panel-card' }, themeGrid())),
    section('Aparência', segmented([['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Escuro']], T.settings.appearance, (v) => {
      T.set({ appearance: v });
      openSettings(); // redesenha as bolinhas com as cores do modo
    })),
    section('Escrita à mão: o que o dedo faz',
      segmented([['auto', 'Automático'], ['draw', 'Escreve'], ['pan', 'Move a folha']], T.settings.fingerMode, (v) => {
        T.set({ fingerMode: v });
        updateHint();
        updateToolbar();
      }),
      fingerHint),
    section('Tutorial', h('button', { class: 'secondary-btn', onclick: () => { closePanel(); showOnboarding(); } }, 'Ver o tutorial de novo')),
  );
  openPanel('Temas e aparência', content);
}

function openPaperPanel() {
  const n = currentNote();
  if (!n) return;
  const inkNote = isInk(n);
  const layouts = inkNote ? Ink.LAYOUTS : TEXT_LAYOUTS;
  const current = () => (inkNote ? n.pages[ink.currentPage()].layout : n.layout);
  let applyAll = false;

  const grid = h('div', { class: 'layout-grid' });
  const refresh = () => grid.querySelectorAll('.layout-opt').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === current())));
  for (const l of layouts) {
    const cv = h('canvas', { width: 128, height: 180 });
    Ink.renderLayoutPreview(cv, l.id, T.colors);
    const b = h('button', { class: 'layout-opt', 'data-id': l.id, 'aria-pressed': 'false' }, cv, h('span', {}, l.name));
    b.addEventListener('click', () => {
      if (inkNote) {
        ink.setLayout(l.id, applyAll);
        T.set({ lastLayout: l.id });
      } else {
        n.layout = l.id;
        el.editor.dataset.layout = l.id;
        T.set({ lastTextLayout: l.id });
        persistQuiet(n);
      }
      refresh();
    });
    grid.append(b);
  }
  refresh();

  const parts = [section('Tipo de folha', grid)];
  if (inkNote) {
    const sw = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'Aplicar a todas as páginas' });
    sw.addEventListener('change', () => { applyAll = sw.checked; if (applyAll) ink.setLayout(current(), true); });
    parts.push(section(null,
      h('div', { class: 'panel-card switch-row' }, h('span', {}, 'Aplicar a todas as páginas'), h('label', { class: 'switch' }, sw, h('span'))),
      h('p', { class: 'hint' }, `Sem isso, a folha muda só na página ${ink.currentPage() + 1}, a que está na tela.`)));
    parts.push(section('Páginas', h('button', { class: 'secondary-btn', onclick: () => { ink.addPage(); closePanel(); toast('Página adicionada'); } }, '+ Nova página')));
  } else {
    const out = h('output', { 'data-textzoom': '' }, Math.round((n.zoom || 1) * 100) + '%');
    parts.push(section('Tamanho do texto',
      h('div', { class: 'stepper' },
        h('button', { 'aria-label': 'Diminuir texto', onclick: () => setTextZoom((n.zoom || 1) - 0.1) }, 'A−'),
        out,
        h('button', { 'aria-label': 'Aumentar texto', onclick: () => setTextZoom((n.zoom || 1) + 0.1) }, 'A+')),
      h('p', { class: 'hint' }, 'Dica: você também pode pinçar com dois dedos sobre o texto.')));
  }
  openPanel('Folha', h('div', {}, ...parts));
}

function openRename() {
  const n = currentNote();
  if (!n || !isInk(n)) return;
  const input = h('input', { class: 'rename-input', type: 'text', value: n.title, placeholder: 'Título da nota', maxlength: '120', enterkeyhint: 'done' });
  const save = () => {
    n.title = input.value.trim();
    n.updated = Date.now();
    persist(n);
    updateInkHead();
    renderList();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); closePanel(); } });
  openPanel('Nome da nota', h('div', {}, input, h('p', { class: 'hint' }, 'O nome aparece na lista e é usado na busca.')), save);
  input.focus();
  input.select();
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

// ---------- Barra de ferramentas da escrita à mão ----------
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
  el.tbFinger.setAttribute('aria-label', fd ? 'O dedo escreve (toque para o dedo mover a folha)' : 'O dedo move a folha (toque para o dedo escrever)');
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
  T.set({ fingerMode: next });
  updateToolbar();
  toast(next === 'draw' ? 'O dedo agora escreve' : 'O dedo agora move a folha (só a caneta escreve)');
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
  if (T.settings.tips.ink || !el.onboarding.hidden || el.inkView.querySelector('.tip')) return;
  const tip = h('div', { class: 'tip', role: 'note' },
    h('div', { html: '<b>Dica:</b> escreva com o Apple Pencil ou com o dedo. Use <b>dois dedos</b> para mover a folha e dar zoom. No fim da última página tem o botão <b>+ Nova página</b>.' }),
    h('div', { class: 'tip-actions' }, h('button', {
      class: 'text-btn accent strong',
      onclick: () => { T.set({ tips: { ...T.settings.tips, ink: true } }); tip.remove(); },
    }, 'Entendi')));
  el.inkView.append(tip);
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
  if (currentNote() && isInk(currentNote())) maybeShowInkTip();
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

async function exportNotes() {
  await flushSave();
  const list = notes.filter((n) => !isEmpty(n)).map(exportable);
  const data = { app: 'notas-pwa', version: 2, exported: new Date().toISOString(), notes: list };
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const name = `notas-backup-${stamp}.json`;
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });

  // No iPhone/iPad abre a folha de compartilhar (AirDrop, Salvar em Arquivos...)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Backup das notas' });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup exportado');
}

const LAYOUT_IDS = new Set(Ink.LAYOUTS.map((l) => l.id));
const HEX = /^#[0-9a-f]{6}$/i;

function sanitizeImported(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const base = {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    pinned: !!raw.pinned,
    created: Number(raw.created) || Date.now(),
    updated: Number(raw.updated) || Date.now(),
  };
  if (raw.kind === 'ink') {
    if (!Array.isArray(raw.pages)) return null;
    const pages = raw.pages.map((p) => ({
      layout: LAYOUT_IDS.has(p && p.layout) ? p.layout : 'pautada',
      strokes: (p && Array.isArray(p.strokes) ? p.strokes : [])
        .filter((s) => s && Array.isArray(s.p) && s.p.length >= 3 && s.p.length % 3 === 0 && s.p.every(Number.isFinite))
        .map((s) => ({ t: s.t === 'hl' ? 'hl' : 'pen', c: HEX.test(s.c) ? s.c : '#1c1c1e', w: clamp(Number(s.w) || 2.8, 0.5, 60), p: s.p })),
    }));
    if (!pages.length) return null;
    const n = normalize({ ...base, kind: 'ink', title: typeof raw.title === 'string' ? raw.title.slice(0, 120) : '', pages });
    return isEmpty(n) ? null : n;
  }
  if (typeof raw.text !== 'string' || !raw.text.trim()) return null;
  return normalize({ ...base, kind: 'text', text: raw.text, layout: LAYOUT_IDS.has(raw.layout) && raw.layout !== 'cornell' ? raw.layout : 'lisa', zoom: clamp(Number(raw.zoom) || 1, 0.7, 2.6) });
}

async function importNotes(file) {
  try {
    await flushSave();
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data && data.notes;
    if (!Array.isArray(incoming)) throw new Error('formato');
    let added = 0, updated = 0, reopen = false;
    for (const raw of incoming) {
      const note = sanitizeImported(raw);
      if (!note) continue;
      const existing = notes.find((n) => n.id === note.id);
      if (!existing) {
        if (isInk(note)) note.thumb = Ink.renderThumb(note, T.colors);
        notes.push(note);
        added++;
        await dbPut(note);
      } else if (note.updated > existing.updated) {
        for (const k of Object.keys(existing)) delete existing[k];
        Object.assign(existing, note);
        if (isInk(existing)) existing.thumb = Ink.renderThumb(existing, T.colors);
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

// ---------- Eventos ----------
el.list.addEventListener('click', (e) => {
  const item = e.target.closest('.note-item');
  if (item) openNote(item.dataset.id);
});
el.search.addEventListener('input', () => { query = el.search.value; renderList(); });
el.editor.addEventListener('input', onTextInput);
el.editor.addEventListener('focus', () => { el.btnDone.hidden = false; });
el.editor.addEventListener('blur', () => { el.btnDone.hidden = true; flushSave().then(renderList); });
el.btnDone.addEventListener('mousedown', (e) => e.preventDefault());
el.btnDone.addEventListener('click', () => el.editor.blur());
el.btnNew.addEventListener('click', chooseNewNote);
el.btnBack.addEventListener('click', closeEditor);
el.btnPin.addEventListener('click', togglePin);
el.btnDelete.addEventListener('click', askDelete);
el.btnMenu.addEventListener('click', openMenu);
el.btnHelp.addEventListener('click', () => openHelp());
el.btnPaper.addEventListener('click', openPaperPanel);
el.btnUndo.addEventListener('click', () => ink.undo());
el.btnRedo.addEventListener('click', () => ink.redo());
el.inkTitle.addEventListener('click', openRename);
el.sheetCancel.addEventListener('click', closeSheet);
el.sheetBackdrop.addEventListener('click', (e) => { if (e.target === el.sheetBackdrop) closeSheet(); });
el.panelClose.addEventListener('click', closePanel);
el.panelBackdrop.addEventListener('click', (e) => { if (e.target === el.panelBackdrop) closePanel(); });
el.importFile.addEventListener('change', () => {
  const f = el.importFile.files[0];
  if (f) importNotes(f);
  el.importFile.value = '';
});

// impede o zoom da página inteira no iOS (o zoom acontece dentro da nota)
document.addEventListener('gesturestart', (e) => e.preventDefault());

// Atalhos de teclado (iPad com teclado e notebook)
document.addEventListener('keydown', (e) => {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  const n = currentNote();
  const typing = document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (!el.sheetBackdrop.hidden) closeSheet();
    else if (!el.panelBackdrop.hidden) closePanel();
    else closePopover();
    return;
  }
  if (!mod) return;
  if (k === 'n') { e.preventDefault(); newNote(e.shiftKey ? 'ink' : 'text'); }
  else if (k === 'f') { e.preventDefault(); el.search.focus(); }
  else if (n && isInk(n) && k === 'z' && !typing) { e.preventDefault(); e.shiftKey ? ink.redo() : ink.undo(); }
  else if (n && (k === '=' || k === '+' || k === '-' || k === '0')) {
    e.preventDefault();
    if (isInk(n)) {
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
    for (const n of notes) if (isInk(n) && !isEmpty(n)) { n.thumb = Ink.renderThumb(n, T.colors); persistQuiet(n); }
    renderList();
    updateToolbar();
  }, 250);
});

// Salva antes de o app ir para segundo plano
document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
window.addEventListener('pagehide', () => { flushSave(); });

// ---------- Início ----------
async function init() {
  try {
    const all = (await dbAll()).map(normalize);
    for (const n of all.filter(isEmpty)) await dbDelete(n.id);
    notes = all.filter((n) => !isEmpty(n));
  } catch (e) {
    notes = [];
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
