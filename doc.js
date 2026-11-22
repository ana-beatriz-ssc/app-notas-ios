'use strict';
/* =========================================================
   Editor da nota em blocos: texto, quadros de desenho e anexos.
   A nota é uma lista de blocos:
     { type: 'text', text }
     { type: 'ink', h, layout, strokes }          (quadro de desenho, 820 de largura)
     { type: 'file', fileId, name, mime, size }   (anexo; o arquivo fica no banco "files")
   ========================================================= */
(function () {
  const { PAGE_W, MIN_H, MAX_H, SIZES } = Ink;

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  const textBlock = (text = '') => ({ id: newId(), type: 'text', text });
  const inkBlock = (layout = 'lisa', h = 520) => ({ id: newId(), type: 'ink', h, layout, strokes: [] });
  const fileBlock = (f) => ({ id: newId(), type: 'file', fileId: f.id, name: f.name, mime: f.type || '', size: f.size || 0 });

  // Regras: começa e termina com texto, nunca dois textos seguidos (junta) e
  // sempre um texto entre dois blocos que não são texto (para poder digitar ali).
  function normalizeBlocks(blocks) {
    const out = [];
    for (const b of blocks) {
      const prev = out[out.length - 1];
      if (b.type === 'text' && prev && prev.type === 'text') {
        prev.text = prev.text + (prev.text && b.text ? '\n' : '') + b.text;
      } else {
        if (b.type !== 'text' && prev && prev.type !== 'text') out.push(textBlock(''));
        out.push(b);
      }
    }
    if (!out.length || out[0].type !== 'text') out.unshift(textBlock(''));
    if (out[out.length - 1].type !== 'text') out.push(textBlock(''));
    blocks.splice(0, blocks.length, ...out);
    return blocks;
  }

  function formatSize(n) {
    if (!n) return '';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB';
  }
  function fileExt(name) {
    const m = /\.([a-z0-9]{1,5})$/i.exec(name || '');
    return m ? m[1].toUpperCase() : 'ARQ';
  }
  const isImage = (b) => /^image\/(png|jpe?g|gif|webp|heic|heif|bmp|svg\+xml)$/i.test(b.mime || '');

  const ICON = {
    expand: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    more: '<svg viewBox="0 0 24 24"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>',
  };

  // =========================================================
  // Quadro de desenho dentro da nota
  class InlineInk {
    constructor(doc, block) {
      this.doc = doc;
      this.block = block;
      this.el = document.createElement('div');
      this.el.className = 'blk blk-ink';
      this.el.dataset.id = block.id;
      this.canvas = document.createElement('canvas');
      this.canvas.setAttribute('aria-label', 'Quadro de desenho');
      this.ctx = this.canvas.getContext('2d');

      const actions = document.createElement('div');
      actions.className = 'ink-actions';
      const expand = document.createElement('button');
      expand.className = 'ink-act';
      expand.setAttribute('aria-label', 'Ampliar o desenho');
      expand.innerHTML = ICON.expand;
      expand.addEventListener('click', () => doc.opts.onExpand(block));
      const more = document.createElement('button');
      more.className = 'ink-act';
      more.setAttribute('aria-label', 'Opções do desenho');
      more.innerHTML = ICON.more;
      more.addEventListener('click', () => doc.opts.onBlockMenu(block));
      actions.append(expand, more);

      this.handle = document.createElement('div');
      this.handle.className = 'ink-resize';
      this.handle.setAttribute('role', 'separator');
      this.handle.setAttribute('aria-label', 'Arraste para mudar a altura do desenho');
      this.handle.innerHTML = '<span></span>';

      this.el.append(this.canvas, actions, this.handle);

      this.scale = 1; this.dpr = 1; this.w = 0;
      this.drawing = null;
      this.pointers = new Map();
      this.frame = 0;

      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', (e) => this.onUp(e, true));
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      // O Apple Pencil nunca rola a nota; o dedo só desenha se estiver configurado assim
      c.addEventListener('touchstart', (e) => {
        const stylus = [...e.touches].some((t) => t.touchType === 'stylus');
        if (stylus || (this.doc.opts.fingerDraws() && e.touches.length === 1)) e.preventDefault();
      }, { passive: false });

      this.handle.addEventListener('pointerdown', (e) => this.onResizeDown(e));
      this.handle.addEventListener('pointermove', (e) => this.onResizeMove(e));
      this.handle.addEventListener('pointerup', (e) => this.onResizeUp(e));
      this.handle.addEventListener('pointercancel', (e) => this.onResizeUp(e));
    }

    layout() {
      const w = this.el.clientWidth;
      if (!w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = w;
      this.dpr = dpr;
      this.scale = w / PAGE_W;
      const hCss = Math.round(Ink.blockH(this.block) * this.scale);
      this.canvas.style.height = hCss + 'px';
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(hCss * dpr);
      this.render();
    }

    requestRender() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
    }

    render() {
      const ctx = this.ctx, s = this.scale * this.dpr;
      const colors = this.doc.opts.colors();
      ctx.setTransform(s, 0, 0, s, 0, 0);
      Ink.drawBlock(ctx, this.block, colors, this.scale);
      if (this.drawing && this.drawing.stroke) Ink.drawStroke(ctx, this.drawing.stroke, true);
      if (this.drawing && this.drawing.type === 'erase' && this.drawing.cursor) {
        const c = this.drawing.cursor;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.5 / this.scale;
        ctx.beginPath();
        ctx.arc(c.x, c.y, SIZES.eraser[this.doc.tools().sizeIndex.eraser], 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    toBlock(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: (e.clientX - r.left) / this.scale, y: (e.clientY - r.top) / this.scale };
    }

    // ---------- ponteiros ----------
    onDown(e) {
      const type = e.pointerType;
      const doc = this.doc;
      if (type === 'pen') {
        doc.penActive = true;
        clearTimeout(doc.penTimer);
        doc.opts.onPen();
        if (this.drawing && this.drawing.pointerType !== 'pen') this.cancelDrawing();
        this.pointers.clear();
      } else if (type === 'touch') {
        if (doc.penActive) return; // rejeição da palma
        if (!doc.opts.fingerDraws()) return; // o dedo rola a nota normalmente
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size >= 2) { // dois dedos: rola a nota
          if (this.drawing) this.cancelDrawing();
          return;
        }
      } else if (e.button !== 0) {
        return;
      }
      e.preventDefault();
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      doc.blurText();
      this.startDraw(e);
    }

    startDraw(e) {
      const t = this.doc.tools();
      const pos = this.toBlock(e);
      if (t.tool === 'eraser') {
        this.drawing = { type: 'erase', pointerId: e.pointerId, pointerType: e.pointerType, removed: [], cursor: pos, last: pos };
        this.erase(pos.x, pos.y);
      } else {
        const stroke = { t: t.tool === 'hl' ? 'hl' : 'pen', c: t.currentColor(), w: SIZES[t.tool][t.sizeIndex[t.tool]], p: [] };
        this.drawing = { type: 'stroke', pointerId: e.pointerId, pointerType: e.pointerType, stroke, hBefore: Ink.blockH(this.block) };
        this.addPoint(pos.x, pos.y, e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5);
      }
      this.requestRender();
    }

    addPoint(x, y, pressure) {
      const p = this.drawing.stroke.p;
      const n = p.length;
      if (n >= 3 && Math.hypot(x - p[n - 3], y - p[n - 2]) < 0.7 / Math.max(this.scale, 0.3)) return;
      // escrevendo perto do fim: o quadro cresce sozinho
      if (y > Ink.blockH(this.block) - 40 && Ink.blockH(this.block) < MAX_H) {
        this.block.h = Math.min(MAX_H, Ink.blockH(this.block) + 260);
        this.layout();
      }
      const H = Ink.blockH(this.block);
      p.push(Math.round(Math.max(0, Math.min(PAGE_W, x)) * 10) / 10, Math.round(Math.max(0, Math.min(H, y)) * 10) / 10,
        Math.round(Math.max(0.05, Math.min(1, pressure)) * 100) / 100);
    }

    erase(x, y) {
      const r = SIZES.eraser[this.doc.tools().sizeIndex.eraser];
      this.drawing.removed.push(...Ink.eraseAt(this.block, x, y, r));
    }

    cancelDrawing() {
      const d = this.drawing;
      if (d && d.type === 'erase') {
        for (let i = d.removed.length - 1; i >= 0; i--) this.block.strokes.splice(d.removed[i].index, 0, d.removed[i].stroke);
      }
      if (d && d.type === 'stroke' && d.hBefore !== Ink.blockH(this.block)) { this.block.h = d.hBefore; this.layout(); }
      this.drawing = null;
      this.requestRender();
    }

    onMove(e) {
      const prev = this.pointers.get(e.pointerId);
      if (prev) {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size >= 2) { // rolagem com dois dedos
          this.doc.scrollEl.scrollTop -= (e.clientY - prev.y) / this.pointers.size;
          return;
        }
      }
      const d = this.drawing;
      if (!d || e.pointerId !== d.pointerId) return;
      const list = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
      for (const ev of list) {
        const pos = this.toBlock(ev);
        if (d.type === 'erase') {
          d.cursor = pos;
          const r = SIZES.eraser[this.doc.tools().sizeIndex.eraser];
          const steps = Math.max(1, Math.ceil(Math.hypot(pos.x - d.last.x, pos.y - d.last.y) / (r / 2)));
          for (let k = 1; k <= steps; k++) {
            this.erase(d.last.x + ((pos.x - d.last.x) * k) / steps, d.last.y + ((pos.y - d.last.y) * k) / steps);
          }
          d.last = pos;
        } else {
          this.addPoint(pos.x, pos.y, ev.pointerType === 'pen' ? (ev.pressure || 0.5) : 0.5);
        }
      }
      this.requestRender();
    }

    onUp(e, cancelled) {
      this.pointers.delete(e.pointerId);
      if (e.pointerType === 'pen') {
        clearTimeout(this.doc.penTimer);
        this.doc.penTimer = setTimeout(() => { this.doc.penActive = false; }, 300);
      }
      const d = this.drawing;
      if (!d || e.pointerId !== d.pointerId) return;
      if (cancelled) { this.cancelDrawing(); return; }
      this.drawing = null;
      if (d.type === 'stroke' && d.stroke.p.length) {
        this.block.strokes.push(d.stroke);
        const ops = [];
        if (d.hBefore !== Ink.blockH(this.block)) ops.push({ type: 'height', before: d.hBefore, after: Ink.blockH(this.block) });
        ops.push({ type: 'add', stroke: d.stroke });
        this.doc.pushHistory(this.block, ops);
      } else if (d.type === 'erase' && d.removed.length) {
        this.doc.pushHistory(this.block, [{ type: 'remove', items: d.removed }]);
      }
      this.requestRender();
    }

    // ---------- mudar a altura arrastando a alça ----------
    onResizeDown(e) {
      e.preventDefault();
      try { this.handle.setPointerCapture(e.pointerId); } catch (_) {}
      this.resizing = { id: e.pointerId, y: e.clientY, h: Ink.blockH(this.block), min: Math.max(MIN_H, Math.ceil(Ink.contentBottom(this.block) + 12)) };
    }
    onResizeMove(e) {
      const r = this.resizing;
      if (!r || e.pointerId !== r.id) return;
      const h = Math.round(Math.max(r.min, Math.min(MAX_H, r.h + (e.clientY - r.y) / this.scale)));
      if (h !== Ink.blockH(this.block)) { this.block.h = h; this.layout(); }
    }
    onResizeUp(e) {
      const r = this.resizing;
      if (!r || e.pointerId !== r.id) return;
      this.resizing = null;
      const after = Ink.blockH(this.block);
      if (after !== r.h) this.doc.pushHistory(this.block, [{ type: 'height', before: r.h, after }]);
    }
  }

  // =========================================================
  class DocEditor {
    constructor(container, scrollEl, opts) {
      this.el = container;
      this.scrollEl = scrollEl;
      this.opts = opts;
      this.note = null;
      this.inks = new Map(); // id do bloco -> InlineInk
      this.urls = new Map(); // fileId -> URL de miniatura
      this.caret = null;     // onde inserir: { id do bloco de texto, posição }
      this.undoStack = [];
      this.redoStack = [];
      this.penActive = false;
      this.penTimer = null;

      this.ro = new ResizeObserver(() => this.layoutAll());
      this.ro.observe(container);
      window.addEventListener('themechange', () => this.inks.forEach((v) => v.requestRender()));

      // arrastar arquivos para dentro da nota (notebook / iPad com Split View)
      container.addEventListener('dragover', (e) => { if (this.note && e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
      container.addEventListener('drop', (e) => {
        if (!this.note || !e.dataTransfer || !e.dataTransfer.files.length) return;
        e.preventDefault();
        this.opts.onFiles([...e.dataTransfer.files]);
      });
    }

    tools() { return this.opts.tools(); }

    open(note) {
      this.note = note;
      this.undoStack = [];
      this.redoStack = [];
      this.caret = null;
      this.history();
      this.render();
      this.scrollEl.scrollTop = 0;
    }

    close() {
      this.note = null;
      this.el.replaceChildren();
      this.inks.clear();
      this.urls.forEach((u) => URL.revokeObjectURL(u));
      this.urls.clear();
      this.caret = null;
    }

    render() {
      const n = this.note;
      this.inks.clear();
      if (!n) { this.el.replaceChildren(); return; }
      const only = n.blocks.length === 1;
      this.el.replaceChildren(...n.blocks.map((b, i) => this.createEl(b, i === 0 && only)));
      this.layoutAll();
      this.updateTouchMode();
    }

    createEl(b, placeholder) {
      if (b.type === 'text') {
        const ta = document.createElement('textarea');
        ta.className = 'blk tb';
        ta.dataset.id = b.id;
        ta.rows = 1;
        ta.value = b.text;
        ta.spellcheck = true;
        ta.setAttribute('autocapitalize', 'sentences');
        ta.setAttribute('aria-label', 'Texto da nota');
        if (placeholder) ta.placeholder = 'Comece a escrever…';
        const remember = () => { this.caret = { id: b.id, pos: ta.selectionStart }; };
        ta.addEventListener('input', () => {
          b.text = ta.value;
          this.autosize(ta);
          remember();
          this.opts.onChange('text');
        });
        ['focus', 'keyup', 'pointerup', 'select', 'blur'].forEach((ev) => ta.addEventListener(ev, remember));
        ta.addEventListener('focus', () => this.opts.onTextFocus(true));
        ta.addEventListener('blur', () => this.opts.onTextFocus(false));
        ta.addEventListener('paste', (e) => {
          const files = e.clipboardData && [...e.clipboardData.files];
          if (files && files.length) { e.preventDefault(); remember(); this.opts.onFiles(files); }
        });
        return ta;
      }
      if (b.type === 'ink') {
        const v = new InlineInk(this, b);
        this.inks.set(b.id, v);
        return v.el;
      }
      // anexo
      const wrap = document.createElement('div');
      wrap.className = 'blk blk-file' + (isImage(b) ? ' is-image' : '');
      wrap.dataset.id = b.id;
      const card = document.createElement('button');
      card.className = 'file-card';
      card.setAttribute('aria-label', `Anexo ${b.name}`);
      const thumb = document.createElement('span');
      thumb.className = 'file-thumb';
      thumb.textContent = fileExt(b.name);
      const meta = document.createElement('span');
      meta.className = 'file-meta';
      const name = document.createElement('span');
      name.className = 'file-name';
      name.textContent = b.name;
      const sub = document.createElement('span');
      sub.className = 'file-sub';
      sub.textContent = [fileExt(b.name), formatSize(b.size)].filter(Boolean).join(' · ');
      meta.append(name, sub);
      card.append(thumb, meta);
      card.addEventListener('click', () => this.opts.onFileOpen(b));
      wrap.append(card);
      if (isImage(b)) this.loadThumb(b, thumb);
      return wrap;
    }

    async loadThumb(b, thumb) {
      let url = this.urls.get(b.fileId);
      if (!url) {
        url = await this.opts.fileUrl(b.fileId);
        if (!url) return;
        this.urls.set(b.fileId, url);
      }
      const img = document.createElement('img');
      img.alt = '';
      img.onload = () => thumb.replaceChildren(img);
      img.src = url;
    }

    autosize(ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }

    layoutAll() {
      if (!this.note) return;
      this.el.querySelectorAll('textarea.tb').forEach((ta) => this.autosize(ta));
      this.inks.forEach((v) => v.layout());
    }

    refreshBlock(block) {
      const v = this.inks.get(block.id);
      if (v) v.layout();
    }

    updateTouchMode() {
      this.el.classList.toggle('finger-draws', !!this.opts.fingerDraws());
    }

    blurText() {
      const a = document.activeElement;
      if (a && a.classList && a.classList.contains('tb')) a.blur();
    }

    // ---------- inserir e remover blocos ----------
    insert(newBlocks) {
      const blocks = this.note.blocks;
      const idx = this.caret ? blocks.findIndex((b) => b.id === this.caret.id && b.type === 'text') : -1;
      if (idx >= 0) {
        const b = blocks[idx];
        const pos = Math.max(0, Math.min(b.text.length, this.caret.pos || 0));
        let before = b.text.slice(0, pos), after = b.text.slice(pos);
        if (before.endsWith('\n')) before = before.slice(0, -1);
        if (after.startsWith('\n')) after = after.slice(1);
        b.text = before;
        blocks.splice(idx + 1, 0, ...newBlocks, textBlock(after));
      } else {
        const last = blocks[blocks.length - 1];
        if (blocks.length > 1 && last.type === 'text' && !last.text.trim()) blocks.splice(blocks.length - 1, 0, ...newBlocks);
        else blocks.push(...newBlocks, textBlock(''));
      }
      normalizeBlocks(blocks);
      this.render();
      // depois do que foi inserido, o cursor vai para o texto seguinte
      const lastNew = newBlocks[newBlocks.length - 1];
      const after = blocks[blocks.indexOf(lastNew) + 1];
      if (after) this.caret = { id: after.id, pos: 0 };
      const node = this.el.querySelector(`[data-id="${CSS.escape(newBlocks[0].id)}"]`);
      if (node) requestAnimationFrame(() => node.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
      this.opts.onChange('structure');
    }

    removeBlock(id) {
      const blocks = this.note.blocks;
      const i = blocks.findIndex((b) => b.id === id);
      if (i < 0) return;
      blocks.splice(i, 1);
      normalizeBlocks(blocks);
      // o histórico de desenho daquele quadro deixa de valer
      this.undoStack = this.undoStack.filter((op) => blocks.includes(op.block));
      this.redoStack = this.redoStack.filter((op) => blocks.includes(op.block));
      this.history();
      this.caret = null;
      this.render();
      this.opts.onChange('structure');
    }

    // ---------- desfazer / refazer (desenhos) ----------
    pushHistory(block, ops) {
      this.undoStack.push({ block, ops });
      if (this.undoStack.length > 300) this.undoStack.shift();
      this.redoStack = [];
      this.history();
      this.opts.onChange('ink');
    }
    history() { this.opts.onHistory(this.undoStack.length > 0, this.redoStack.length > 0); }
    applyEntry(entry, undo) {
      const ops = undo ? [...entry.ops].reverse() : entry.ops;
      for (const op of ops) Ink.applyOp(entry.block, op, undo);
      this.refreshBlock(entry.block);
    }
    undo() {
      const e = this.undoStack.pop();
      if (!e) return;
      this.applyEntry(e, true);
      this.redoStack.push(e);
      this.history();
      this.opts.onChange('ink');
    }
    redo() {
      const e = this.redoStack.pop();
      if (!e) return;
      this.applyEntry(e, false);
      this.undoStack.push(e);
      this.history();
      this.opts.onChange('ink');
    }
  }

  window.Doc = { DocEditor, normalizeBlocks, textBlock, inkBlock, fileBlock, formatSize, fileExt, isImage, newId };
})();
