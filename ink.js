'use strict';
/* =========================================================
   Motor de escrita à mão.
   Um "quadro de desenho" tem largura fixa de 820 unidades e altura variável (h).
   - Funções de desenho (folhas, traços, borracha) usadas pelos quadros dentro da nota
   - InkEditor: o quadro ampliado em tela cheia, com zoom, pinça e rolagem
   ========================================================= */
(function () {
  const PAGE_W = 820;
  const PAGE_H = 1160; // altura de uma folha antiga (≈ A4)
  const MIN_H = 120;
  const MAX_H = 6000;
  const ADD_H = 120; // espaço do botão "+ Mais espaço" abaixo do quadro ampliado

  const LAYOUTS = [
    { id: 'lisa', name: 'Lisa' },
    { id: 'pautada', name: 'Pautada' },
    { id: 'caderno', name: 'Caderno' },
    { id: 'quadriculada', name: 'Quadriculada' },
    { id: 'pontilhada', name: 'Pontilhada' },
    { id: 'cornell', name: 'Cornell' },
  ];

  const SIZES = {
    pen: [1.6, 2.8, 5],
    hl: [12, 20, 30],
    eraser: [8, 18, 34],
  };

  // ---------- Desenho dos layouts ----------
  function drawLayout(ctx, layout, colors, scale, H = PAGE_H) {
    const lw = Math.max(1, 0.9 / scale);
    const hLines = (from, to, gap, x0 = 0, x1 = PAGE_W) => {
      ctx.beginPath();
      for (let y = from; y <= to; y += gap) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    };
    ctx.lineWidth = lw;
    ctx.strokeStyle = colors.line;
    switch (layout) {
      case 'pautada':
        hLines(36, H - 20, 36);
        break;
      case 'caderno':
        hLines(36, H - 20, 36);
        ctx.strokeStyle = colors.margin;
        ctx.lineWidth = lw * 1.4;
        ctx.beginPath();
        ctx.moveTo(96, 0); ctx.lineTo(96, H);
        ctx.stroke();
        break;
      case 'quadriculada': {
        const g = 28;
        ctx.globalAlpha = 0.75;
        ctx.beginPath();
        for (let x = g; x < PAGE_W; x += g) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let y = g; y < H; y += g) { ctx.moveTo(0, y); ctx.lineTo(PAGE_W, y); }
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'pontilhada': {
        const g = 28;
        const r = Math.max(1.6, 1.2 / scale);
        ctx.fillStyle = colors.margin;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        for (let y = g; y < H; y += g) {
          for (let x = g; x < PAGE_W; x += g) {
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, Math.PI * 2);
          }
        }
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'cornell': {
        const top = Math.min(118, H * 0.2), bottom = Math.max(top + 72, H - 250), col = 240;
        hLines(top + 36, bottom - 10, 36, col, PAGE_W);
        ctx.strokeStyle = colors.margin;
        ctx.lineWidth = lw * 1.6;
        ctx.beginPath();
        ctx.moveTo(0, top); ctx.lineTo(PAGE_W, top);
        if (bottom < H) { ctx.moveTo(0, bottom); ctx.lineTo(PAGE_W, bottom); }
        ctx.moveTo(col, top); ctx.lineTo(col, Math.min(bottom, H));
        ctx.stroke();
        break;
      }
      default:
        break;
    }
  }

  // ---------- Geometria dos traços ----------
  const geomCache = new WeakMap();

  function strokeWidth(s, pressure) {
    return s.w * (0.35 + 1.3 * pressure);
  }

  function buildGeom(s) {
    const p = s.p;
    const n = p.length / 3;
    const path = new Path2D();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    if (s.t === 'hl') {
      const r = s.w / 2;
      path.moveTo(p[0], p[1]);
      if (n === 1) path.lineTo(p[0] + 0.01, p[1]);
      for (let i = 1; i < n - 1; i++) {
        const x = p[i * 3], y = p[i * 3 + 1];
        const nx = p[(i + 1) * 3], ny = p[(i + 1) * 3 + 1];
        path.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
      }
      if (n > 1) path.lineTo(p[(n - 1) * 3], p[(n - 1) * 3 + 1]);
      for (let i = 0; i < n; i++) {
        const x = p[i * 3], y = p[i * 3 + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      return { path, bbox: [minX - r, minY - r, maxX + r, maxY + r] };
    }

    const xs = new Float32Array(n), ys = new Float32Array(n), raw = new Float32Array(n), rs = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      xs[i] = p[i * 3];
      ys[i] = p[i * 3 + 1];
      raw[i] = strokeWidth(s, p[i * 3 + 2]) / 2;
    }
    // suaviza a espessura para não "tremer"
    for (let i = 0; i < n; i++) {
      const a = raw[Math.max(0, i - 1)], b = raw[i], c = raw[Math.min(n - 1, i + 1)];
      rs[i] = (a + 2 * b + c) / 4;
    }
    let maxR = 0;
    for (let i = 0; i < n; i++) {
      if (xs[i] < minX) minX = xs[i]; if (xs[i] > maxX) maxX = xs[i];
      if (ys[i] < minY) minY = ys[i]; if (ys[i] > maxY) maxY = ys[i];
      if (rs[i] > maxR) maxR = rs[i];
    }
    const bbox = [minX - maxR, minY - maxR, maxX + maxR, maxY + maxR];

    if (n === 1 || (maxX - minX < 0.5 && maxY - minY < 0.5)) {
      path.arc(xs[0], ys[0], Math.max(rs[0], 0.8), 0, Math.PI * 2);
      return { path, bbox };
    }

    const nxs = new Float32Array(n), nys = new Float32Array(n);
    let lnx = 0, lny = -1;
    for (let i = 0; i < n; i++) {
      const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
      const dx = xs[j1] - xs[j0], dy = ys[j1] - ys[j0];
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) { lnx = -dy / len; lny = dx / len; }
      nxs[i] = lnx; nys[i] = lny;
    }
    const lx = (i) => xs[i] + nxs[i] * rs[i];
    const ly = (i) => ys[i] + nys[i] * rs[i];
    const rx = (i) => xs[i] - nxs[i] * rs[i];
    const ry = (i) => ys[i] - nys[i] * rs[i];

    path.moveTo(lx(0), ly(0));
    for (let i = 1; i < n - 1; i++) {
      path.quadraticCurveTo(lx(i), ly(i), (lx(i) + lx(i + 1)) / 2, (ly(i) + ly(i + 1)) / 2);
    }
    path.lineTo(lx(n - 1), ly(n - 1));
    const a1 = Math.atan2(nys[n - 1], nxs[n - 1]);
    path.arc(xs[n - 1], ys[n - 1], rs[n - 1], a1, a1 + Math.PI, true);
    for (let i = n - 2; i >= 1; i--) {
      path.quadraticCurveTo(rx(i), ry(i), (rx(i) + rx(i - 1)) / 2, (ry(i) + ry(i - 1)) / 2);
    }
    path.lineTo(rx(0), ry(0));
    const a0 = Math.atan2(nys[0], nxs[0]);
    path.arc(xs[0], ys[0], rs[0], a0 + Math.PI, a0, true);
    path.closePath();
    return { path, bbox };
  }

  function geomOf(s) {
    let g = geomCache.get(s);
    if (!g) { g = buildGeom(s); geomCache.set(s, g); }
    return g;
  }

  function drawStroke(ctx, s, live) {
    const g = live ? buildGeom(s) : geomOf(s);
    if (s.t === 'hl') {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.globalCompositeOperation = 'multiply';
      ctx.strokeStyle = s.c;
      ctx.lineWidth = s.w;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(g.path);
      ctx.restore();
    } else {
      ctx.fillStyle = s.c;
      ctx.fill(g.path);
    }
  }

  function distToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  function hitStroke(s, x, y, r) {
    const b = geomOf(s).bbox;
    if (x < b[0] - r || x > b[2] + r || y < b[1] - r || y > b[3] + r) return false;
    const p = s.p, n = p.length / 3;
    const tol = r + (s.t === 'hl' ? s.w / 2 : s.w * 0.6);
    if (n === 1) return Math.hypot(x - p[0], y - p[1]) <= tol;
    for (let i = 0; i < n - 1; i++) {
      if (distToSegment(x, y, p[i * 3], p[i * 3 + 1], p[i * 3 + 3], p[i * 3 + 4]) <= tol) return true;
    }
    return false;
  }

  // ponto mais baixo desenhado (para não encolher o quadro por cima do desenho)
  function contentBottom(block) {
    let max = 0;
    for (const s of block.strokes) max = Math.max(max, geomOf(s).bbox[3]);
    return max;
  }

  // apaga, no ponto (x, y), os traços tocados; devolve os itens removidos
  function eraseAt(block, x, y, r) {
    const removed = [];
    const strokes = block.strokes;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (hitStroke(strokes[i], x, y, r)) {
        const [s] = strokes.splice(i, 1);
        removed.push({ index: i, stroke: s });
      }
    }
    return removed;
  }

  function blockH(block) { return block.h || PAGE_H; }

  // desenha o quadro inteiro (fundo, folha e traços), em coordenadas de quadro
  function drawBlock(ctx, block, colors, scale) {
    const H = blockH(block);
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, PAGE_W, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, PAGE_W, H);
    ctx.clip();
    drawLayout(ctx, block.layout, colors, scale, H);
    for (const s of block.strokes) drawStroke(ctx, s, false);
    ctx.restore();
  }

  // Miniatura (para a lista): o topo do quadro, no formato de uma folha
  function renderThumb(block, colors, width = 120) {
    const c = document.createElement('canvas');
    const k = 2;
    c.width = width * k;
    c.height = Math.round(width * (PAGE_H / PAGE_W)) * k;
    const ctx = c.getContext('2d');
    ctx.fillStyle = colors.paper;
    ctx.fillRect(0, 0, c.width, c.height);
    const s = (width * k) / PAGE_W;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawBlock(ctx, { ...block, h: Math.min(blockH(block), PAGE_H) }, colors, s / k);
    return c.toDataURL('image/jpeg', 0.8);
  }

  // Pré-visualização de um layout (para o painel "Folha")
  function renderLayoutPreview(canvas, layout, colors) {
    const w = canvas.width, h = canvas.height;
    const ctx = canvas.getContext('2d');
    // grade e pontos ficam ilegíveis em miniatura: mostra um pedaço ampliado
    const zoom = layout === 'quadriculada' || layout === 'pontilhada' ? 2.2 : 1;
    const s = (w / PAGE_W) * zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(s, 0, 0, s, 0, 0);
    drawBlock(ctx, { layout, strokes: [], h: PAGE_H }, colors, s);
  }

  // =========================================================
  // Quadro ampliado: zoom, pinça, rolagem e borracha
  class InkEditor {
    constructor(host, opts) {
      this.host = host;
      this.opts = opts;
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'ink-canvas';
      this.canvas.setAttribute('aria-label', 'Quadro de desenho ampliado');
      host.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.block = null;
      this.scale = 1; this.fit = 1; this.tx = 0; this.ty = 0;
      this.vw = 0; this.vh = 0; this.dpr = 1;
      this.tool = 'pen';
      this.color = { pen: '#1c1c1e', hl: '#ff7eb3' };
      this.sizeIndex = { pen: 1, hl: 1, eraser: 1 };
      this.undoStack = [];
      this.redoStack = [];
      this.pointers = new Map();
      this.drawing = null;
      this.gesture = null;
      this.penActive = false;
      this.penTimer = null;
      this.tap = null;
      this.addBtn = null;
      this.frame = 0;
      this.inertia = 0;
      this.bottomPad = 110;

      const c = this.canvas;
      c.addEventListener('pointerdown', (e) => this.onDown(e));
      c.addEventListener('pointermove', (e) => this.onMove(e));
      c.addEventListener('pointerup', (e) => this.onUp(e));
      c.addEventListener('pointercancel', (e) => this.onUp(e, true));
      c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      // Evita lupa/seleção do iOS durante a escrita
      c.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(host);
      window.addEventListener('themechange', () => this.requestRender());
    }

    // ---------- abrir / fechar ----------
    open(block) {
      cancelAnimationFrame(this.inertia);
      this.block = block;
      this.undoStack = [];
      this.redoStack = [];
      this.drawing = null;
      this.gesture = null;
      this.pointers.clear();
      this.resize(true);
      this.history();
    }

    close() {
      cancelAnimationFrame(this.inertia);
      this.block = null;
      this.drawing = null;
      this.pointers.clear();
    }

    // ---------- viewport ----------
    resize(reset) {
      const w = this.host.clientWidth, h = this.host.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const oldFit = this.fit, oldScale = this.scale;
      const docTop = (0 - this.ty) / (oldScale || 1);
      this.vw = w; this.vh = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      const pad = w < 600 ? 10 : 32;
      this.fit = Math.min((w - pad * 2) / PAGE_W, 1.35);
      if (reset || !this.block) {
        this.scale = this.fit;
        this.ty = 14;
      } else {
        this.scale = (oldScale / oldFit) * this.fit;
        this.ty = -docTop * this.scale;
      }
      this.clamp();
      this.render();
      this.viewChanged();
    }

    docHeight() { return (this.block ? blockH(this.block) : PAGE_H) + ADD_H; }

    clamp() {
      const cw = PAGE_W * this.scale;
      const ch = this.docHeight() * this.scale;
      const padX = 10, padTop = 14;
      if (cw + padX * 2 <= this.vw) this.tx = (this.vw - cw) / 2;
      else this.tx = Math.min(padX, Math.max(this.vw - cw - padX, this.tx));
      // deixa rolar até o botão "+ Mais espaço" ficar acima da barra de ferramentas
      const extra = Math.max(20, this.bottomPad - 0.58 * ADD_H * this.scale);
      const minTy = Math.min(padTop, this.vh - ch - extra);
      this.ty = Math.min(padTop, Math.max(minTy, this.ty));
    }

    zoomPercent() { return Math.round((this.scale / this.fit) * 100); }

    setScale(next, cx = this.vw / 2, cy = this.vh / 2) {
      const min = this.fit * 0.5, max = Math.max(this.fit * 6, 3);
      next = Math.min(max, Math.max(min, next));
      const dx = (cx - this.tx) / this.scale, dy = (cy - this.ty) / this.scale;
      this.scale = next;
      this.tx = cx - dx * next;
      this.ty = cy - dy * next;
      this.clamp();
      this.requestRender();
      this.viewChanged();
    }
    zoomBy(f) { this.setScale(this.scale * f); }
    zoomFit() { this.setScale(this.fit, this.vw / 2, 0); this.clamp(); this.requestRender(); this.viewChanged(); }

    viewChanged() {
      if (this.opts.onView && this.block) this.opts.onView({ zoom: this.zoomPercent() });
    }

    toDoc(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      const sx = clientX - r.left, sy = clientY - r.top;
      const x = (sx - this.tx) / this.scale;
      const y = (sy - this.ty) / this.scale;
      return { sx, sy, x, y, inPage: x >= 0 && x <= PAGE_W && y >= 0 && y <= blockH(this.block) };
    }

    // ---------- desenho na tela ----------
    requestRender() {
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => { this.frame = 0; this.render(); });
    }

    render() {
      const ctx = this.ctx, dpr = this.dpr;
      const colors = this.opts.colors();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colors.canvas;
      ctx.fillRect(0, 0, this.vw, this.vh);
      if (!this.block) return;
      const s = this.scale;
      const H = blockH(this.block);
      // sombra da folha
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(this.tx - 0.5, this.ty + 1.5, PAGE_W * s + 1, H * s + 1);
      ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * this.tx, dpr * this.ty);
      drawBlock(ctx, this.block, colors, s);
      if (this.drawing && this.drawing.stroke) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, PAGE_W, H);
        ctx.clip();
        drawStroke(ctx, this.drawing.stroke, true);
        ctx.restore();
      }

      // botão "+ Mais espaço"
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = this.tx + (PAGE_W * s) / 2;
      const cy = this.ty + (H + ADD_H * 0.42) * s;
      const bw = 168, bh = 40;
      this.addBtn = { x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh };
      if (H < MAX_H && cy > -bh && cy < this.vh + bh) {
        ctx.fillStyle = colors.paper;
        ctx.strokeStyle = colors.margin;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(this.addBtn.x, this.addBtn.y, bw, bh, 20) : ctx.rect(this.addBtn.x, this.addBtn.y, bw, bh);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = colors.accent;
        ctx.font = '600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+  Mais espaço', cx, cy + 1);
      }

      // círculo da borracha
      if (this.drawing && this.drawing.type === 'erase' && this.drawing.cursor) {
        const c = this.drawing.cursor;
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(c.sx, c.sy, SIZES.eraser[this.sizeIndex.eraser] * s, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // ---------- ferramentas ----------
    setTool(t) { this.tool = t; }
    setColor(c) { if (this.tool === 'hl') this.color.hl = c; else this.color.pen = c; }
    currentColor() { return this.tool === 'hl' ? this.color.hl : this.color.pen; }
    setSize(i) { this.sizeIndex[this.tool] = i; }
    currentSize() { return this.sizeIndex[this.tool]; }

    // ---------- ponteiros ----------
    onDown(e) {
      if (!this.block) return;
      e.preventDefault();
      cancelAnimationFrame(this.inertia);
      const type = e.pointerType;

      if (type === 'pen') {
        this.penActive = true;
        clearTimeout(this.penTimer);
        if (this.opts.onPen) this.opts.onPen();
        // a caneta tem prioridade: cancela gesto ou traço feito com a palma
        if (this.gesture) this.gesture = null;
        this.pointers.clear();
        if (this.drawing && this.drawing.pointerType !== 'pen') this.cancelDrawing();
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        this.startDraw(e);
        return;
      }

      if (type === 'touch') {
        if (this.penActive) return; // rejeição da palma
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.pointers.size === 1) {
          this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
          const pos = this.toDoc(e.clientX, e.clientY);
          if (this.opts.fingerDraws() && pos.inPage) this.startDraw(e);
          else this.startPan(e);
        } else if (this.pointers.size === 2) {
          this.tap = null;
          if (this.drawing) this.cancelDrawing();
          this.startPinch();
        }
        return;
      }

      // mouse / trackpad
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      const pos = this.toDoc(e.clientX, e.clientY);
      if (e.button === 0 && pos.inPage) this.startDraw(e);
      else {
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.startPan(e);
      }
    }

    startDraw(e) {
      const pos = this.toDoc(e.clientX, e.clientY);
      if (e.pointerType === 'pen') this.tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
      if (!pos.inPage) return;
      if (this.tool === 'eraser') {
        this.drawing = { type: 'erase', pointerId: e.pointerId, pointerType: e.pointerType, removed: [], cursor: pos, last: { x: pos.x, y: pos.y } };
        this.eraseAt(pos.x, pos.y);
      } else {
        const pressure = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
        const stroke = { t: this.tool === 'hl' ? 'hl' : 'pen', c: this.currentColor(), w: SIZES[this.tool][this.sizeIndex[this.tool]], p: [] };
        this.drawing = { type: 'stroke', pointerId: e.pointerId, pointerType: e.pointerType, stroke };
        this.addPoint(pos.x, pos.y, pressure);
      }
      this.requestRender();
    }

    addPoint(x, y, pressure) {
      const p = this.drawing.stroke.p;
      const n = p.length;
      if (n >= 3 && Math.hypot(x - p[n - 3], y - p[n - 2]) < 0.7 / Math.max(this.scale, 0.5)) return;
      const H = blockH(this.block);
      p.push(Math.round(Math.max(0, Math.min(PAGE_W, x)) * 10) / 10, Math.round(Math.max(0, Math.min(H, y)) * 10) / 10,
        Math.round(Math.max(0.05, Math.min(1, pressure)) * 100) / 100);
    }

    eraseAt(x, y) {
      const removed = eraseAt(this.block, x, y, SIZES.eraser[this.sizeIndex.eraser]);
      this.drawing.removed.push(...removed);
    }

    cancelDrawing() {
      if (this.drawing && this.drawing.type === 'erase') {
        const items = this.drawing.removed;
        for (let i = items.length - 1; i >= 0; i--) this.block.strokes.splice(items[i].index, 0, items[i].stroke);
      }
      this.drawing = null;
      this.requestRender();
    }

    startPan(e) {
      this.gesture = { type: 'pan', id: e.pointerId, x: e.clientX, y: e.clientY, vx: 0, vy: 0, t: performance.now() };
    }

    startPinch() {
      const [a, b] = [...this.pointers.values()];
      const r = this.canvas.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      this.gesture = {
        type: 'pinch',
        dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)),
        scale: this.scale,
        docX: (mx - this.tx) / this.scale,
        docY: (my - this.ty) / this.scale,
      };
    }

    onMove(e) {
      if (!this.block) return;
      const d = this.drawing;
      const prev = this.pointers.get(e.pointerId);
      if (prev) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (d && e.pointerId === d.pointerId) {
        const list = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
        for (const ev of list) {
          const pos = this.toDoc(ev.clientX, ev.clientY);
          if (d.type === 'erase') {
            d.cursor = pos;
            // apaga ao longo do caminho todo, mesmo com movimento rápido
            const last = d.last;
            const r = SIZES.eraser[this.sizeIndex.eraser];
            const steps = Math.max(1, Math.ceil(Math.hypot(pos.x - last.x, pos.y - last.y) / (r / 2)));
            for (let k = 1; k <= steps; k++) {
              this.eraseAt(last.x + ((pos.x - last.x) * k) / steps, last.y + ((pos.y - last.y) * k) / steps);
            }
            d.last = { x: pos.x, y: pos.y };
          } else {
            const pressure = ev.pointerType === 'pen' ? (ev.pressure || 0.5) : 0.5;
            this.addPoint(pos.x, pos.y, pressure);
          }
        }
        this.requestRender();
        return;
      }

      if (!prev) return;
      const g = this.gesture;
      if (!g) return;
      if (this.tap && Math.hypot(e.clientX - this.tap.x, e.clientY - this.tap.y) > 8) this.tap = null;

      if (g.type === 'pan' && e.pointerId === g.id) {
        const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
        this.tx += dx; this.ty += dy;
        const now = performance.now();
        const dt = Math.max(1, now - g.t);
        g.vx = 0.8 * (dx / dt) + 0.2 * g.vx;
        g.vy = 0.8 * (dy / dt) + 0.2 * g.vy;
        g.t = now;
        this.clamp();
        this.requestRender();
        this.viewChanged();
      } else if (g.type === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const r = this.canvas.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
        const dist = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
        const min = this.fit * 0.5, max = Math.max(this.fit * 6, 3);
        this.scale = Math.min(max, Math.max(min, g.scale * (dist / g.dist)));
        this.tx = mx - g.docX * this.scale;
        this.ty = my - g.docY * this.scale;
        this.clamp();
        this.requestRender();
        this.viewChanged();
      }
    }

    onUp(e, cancelled) {
      if (!this.block) return;
      const d = this.drawing;
      if (d && e.pointerId === d.pointerId) {
        if (cancelled) {
          this.cancelDrawing();
        } else if (d.type === 'stroke' && d.stroke.p.length) {
          this.block.strokes.push(d.stroke);
          this.pushHistory({ type: 'add', stroke: d.stroke });
          this.drawing = null;
          this.changed();
        } else if (d.type === 'erase') {
          this.drawing = null;
          if (d.removed.length) {
            this.pushHistory({ type: 'remove', items: d.removed });
            this.changed();
          }
        }
        this.drawing = null;
        this.requestRender();
      }
      if (e.pointerType === 'pen') {
        clearTimeout(this.penTimer);
        this.penTimer = setTimeout(() => { this.penActive = false; }, 300);
      }

      // toque rápido no botão "+ Mais espaço"
      if (this.tap && this.tap.id === e.pointerId && !cancelled) {
        const r = this.canvas.getBoundingClientRect();
        const sx = e.clientX - r.left, sy = e.clientY - r.top, b = this.addBtn;
        if (performance.now() - this.tap.t < 600 && b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) {
          this.grow(600);
        }
        this.tap = null;
      }

      if (this.pointers.has(e.pointerId)) {
        const g = this.gesture;
        this.pointers.delete(e.pointerId);
        if (g && g.type === 'pinch') {
          if (this.pointers.size === 1) {
            const [id, p] = [...this.pointers.entries()][0];
            this.gesture = { type: 'pan', id, x: p.x, y: p.y, vx: 0, vy: 0, t: performance.now() };
          } else if (this.pointers.size === 0) this.gesture = null;
        } else if (g && g.type === 'pan' && g.id === e.pointerId) {
          this.gesture = null;
          if (!cancelled && performance.now() - g.t < 80) this.glide(g.vx, g.vy);
        }
      }
    }

    // rolagem com inércia depois de arrastar
    glide(vx, vy) {
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(32, now - last);
        last = now;
        vx *= Math.pow(0.995, dt);
        vy *= Math.pow(0.995, dt);
        if (Math.abs(vx) < 0.02 && Math.abs(vy) < 0.02) { this.viewChanged(); return; }
        const ox = this.tx, oy = this.ty;
        this.tx += vx * dt; this.ty += vy * dt;
        this.clamp();
        if (ox === this.tx && oy === this.ty) { this.viewChanged(); return; }
        this.render();
        this.viewChanged();
        this.inertia = requestAnimationFrame(step);
      };
      this.inertia = requestAnimationFrame(step);
    }

    onWheel(e) {
      if (!this.block) return;
      e.preventDefault();
      cancelAnimationFrame(this.inertia);
      const r = this.canvas.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        this.setScale(this.scale * Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top);
      } else {
        this.tx -= e.deltaX;
        this.ty -= e.deltaY;
        this.clamp();
        this.requestRender();
        this.viewChanged();
      }
    }

    // ---------- tamanho e folha ----------
    grow(by) {
      const before = blockH(this.block);
      const after = Math.min(MAX_H, before + by);
      if (after === before) return;
      this.block.h = after;
      this.pushHistory({ type: 'height', before, after });
      this.changed();
    }

    setLayout(layout) {
      const before = this.block.layout;
      if (before === layout) return;
      this.block.layout = layout;
      this.pushHistory({ type: 'layout', before, after: layout });
      this.changed();
    }

    // ---------- desfazer / refazer ----------
    pushHistory(op) {
      this.undoStack.push(op);
      if (this.undoStack.length > 300) this.undoStack.shift();
      this.redoStack = [];
      this.history();
    }

    history() {
      if (this.opts.onHistory) this.opts.onHistory(this.undoStack.length > 0, this.redoStack.length > 0);
    }

    undo() {
      const op = this.undoStack.pop();
      if (!op) return;
      applyOp(this.block, op, true);
      this.redoStack.push(op);
      this.history();
      this.clamp();
      this.changed();
    }

    redo() {
      const op = this.redoStack.pop();
      if (!op) return;
      applyOp(this.block, op, false);
      this.undoStack.push(op);
      this.history();
      this.clamp();
      this.changed();
    }

    changed() {
      this.clamp();
      this.requestRender();
      this.viewChanged();
      if (this.opts.onChange) this.opts.onChange();
    }
  }

  // desfaz/refaz uma operação num quadro
  function applyOp(block, op, undo) {
    const arr = block.strokes;
    switch (op.type) {
      case 'add':
        if (undo) { const i = arr.lastIndexOf(op.stroke); if (i >= 0) arr.splice(i, 1); }
        else arr.push(op.stroke);
        break;
      case 'remove':
        if (undo) {
          for (let i = op.items.length - 1; i >= 0; i--) arr.splice(op.items[i].index, 0, op.items[i].stroke);
        } else {
          for (const it of op.items) { const i = arr.indexOf(it.stroke); if (i >= 0) arr.splice(i, 1); }
        }
        break;
      case 'height':
        block.h = undo ? op.before : op.after;
        break;
      case 'layout':
        block.layout = undo ? op.before : op.after;
        break;
      default:
        break;
    }
  }

  window.Ink = {
    InkEditor, LAYOUTS, SIZES, PAGE_W, PAGE_H, MIN_H, MAX_H,
    drawBlock, drawStroke, drawLayout, eraseAt, contentBottom, applyOp, blockH,
    renderThumb, renderLayoutPreview,
  };
})();
