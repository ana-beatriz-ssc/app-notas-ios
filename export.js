'use strict';
/* =========================================================
   Exportar uma nota: PDF, imagens PNG, texto (.txt) e Markdown (.md).
   PDF e PNG são desenhados em folhas A4 aqui mesmo, sem bibliotecas,
   para funcionar sem internet.
   ========================================================= */
(function () {
  // A4 a 144 dpi
  const PW = 1190, PH = 1684, M = 96;
  const CW = PW - M * 2;
  const FS = 24, LH = 36;
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

  function slug(s) {
    const base = (s || 'nota').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40);
    return base || 'nota';
  }

  // ---------- texto ----------
  function toText(note, md) {
    const parts = [];
    let first = true;
    for (const b of note.blocks) {
      if (b.type === 'text') {
        if (!b.text.trim()) continue;
        let t = b.text;
        if (md && first) {
          const lines = t.split('\n');
          const i = lines.findIndex((l) => l.trim());
          lines[i] = '# ' + lines[i].trim();
          t = lines.join('\n');
        }
        first = false;
        parts.push(t);
      } else if (b.type === 'ink') {
        parts.push(md ? '*[Desenho]*' : '[Desenho]');
      } else if (b.type === 'file') {
        parts.push(md ? `📎 *${b.name}*` : `[Anexo: ${b.name}]`);
      }
    }
    return parts.join('\n\n') + '\n';
  }

  // ---------- folhas A4 desenhadas em canvas ----------
  function wrapLines(ctx, text, width) {
    const out = [];
    for (const para of text.split('\n')) {
      if (!para) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(/(\s+)/)) {
        const test = line + word;
        if (ctx.measureText(test).width <= width || !line) {
          // palavra maior que a linha: quebra por letras
          if (!line && ctx.measureText(word).width > width) {
            let chunk = '';
            for (const ch of word) {
              if (ctx.measureText(chunk + ch).width > width && chunk) { out.push(chunk); chunk = ''; }
              chunk += ch;
            }
            line = chunk;
          } else {
            line = test;
          }
        } else {
          out.push(line.trimEnd());
          line = word.trimStart();
        }
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  async function renderPages(note, opts) {
    const colors = opts.colors; // cores claras do tema
    const pages = [];
    let ctx = null, y = 0;
    const newPage = () => {
      const c = document.createElement('canvas');
      c.width = PW; c.height = PH;
      ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, PW, PH);
      pages.push(c);
      y = M;
    };
    newPage();
    const room = () => PH - M - y;
    let titleDone = false;

    for (const b of note.blocks) {
      if (b.type === 'text') {
        if (!b.text.trim()) continue;
        let lines;
        for (const [i, raw] of b.text.split('\n').entries()) {
          const isTitle = !titleDone && raw.trim();
          const size = isTitle ? 40 : FS;
          const lh = isTitle ? 56 : LH;
          ctx.font = `${isTitle ? 700 : 400} ${size}px ${FONT}`;
          lines = wrapLines(ctx, raw, CW);
          for (const line of lines) {
            if (room() < lh) { newPage(); ctx.font = `${isTitle ? 700 : 400} ${size}px ${FONT}`; }
            ctx.fillStyle = '#1c1c1e';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(line, M, y + lh * 0.75);
            y += lh;
          }
          if (isTitle) { titleDone = true; y += 8; }
          void i;
        }
        y += LH * 0.4;
      } else if (b.type === 'ink') {
        const s = CW / Ink.PAGE_W;
        const H = Ink.blockH(b);
        const total = H * s;
        if (total <= PH - 2 * M && room() < total) newPage();
        // desenhos maiores que uma folha continuam na folha seguinte
        let drawn = 0;
        while (drawn < total - 0.5) {
          if (room() < 80) newPage();
          const slice = Math.min(room(), total - drawn);
          ctx.save();
          ctx.beginPath();
          ctx.rect(M, y, CW, slice);
          ctx.clip();
          ctx.setTransform(s, 0, 0, s, M, y - drawn);
          Ink.drawBlock(ctx, b, colors, s);
          ctx.restore();
          ctx.strokeStyle = '#d8d8dc';
          ctx.lineWidth = 1;
          ctx.strokeRect(M + 0.5, y + 0.5, CW - 1, slice - 1);
          drawn += slice;
          y += slice;
        }
        y += LH * 0.6;
      } else if (b.type === 'file') {
        let drewImage = false;
        if (Doc.isImage(b) && opts.getBlob) {
          const blob = await opts.getBlob(b.fileId);
          if (blob) {
            try {
              const bmp = await createImageBitmap(blob);
              const k = Math.min(CW / bmp.width, (PH - 2 * M) / bmp.height, 1.5);
              const w = bmp.width * k, h = bmp.height * k;
              if (room() < h) newPage();
              ctx.drawImage(bmp, M, y, w, h);
              y += h + LH * 0.6;
              drewImage = true;
            } catch (_) { /* formato que o navegador não abre: vira cartão */ }
          }
        }
        if (!drewImage) {
          const h = 84;
          if (room() < h) newPage();
          ctx.fillStyle = '#f2f2f5';
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(M, y, CW, h, 14) : ctx.rect(M, y, CW, h);
          ctx.fill();
          ctx.fillStyle = colors.accent;
          ctx.font = `700 20px ${FONT}`;
          ctx.fillText(Doc.fileExt(b.name), M + 24, y + 50);
          ctx.fillStyle = '#1c1c1e';
          ctx.font = `600 24px ${FONT}`;
          const name = wrapLines(ctx, b.name, CW - 150)[0] || '';
          ctx.fillText(name, M + 110, y + 40);
          ctx.fillStyle = '#86868b';
          ctx.font = `400 19px ${FONT}`;
          ctx.fillText('Anexo · ' + Doc.formatSize(b.size), M + 110, y + 68);
          y += h + LH * 0.6;
        }
      }
    }

    // número da folha
    if (pages.length > 1) {
      pages.forEach((c, i) => {
        const x = c.getContext('2d');
        x.fillStyle = '#86868b';
        x.font = `400 18px ${FONT}`;
        x.textAlign = 'center';
        x.fillText(`${i + 1} / ${pages.length}`, PW / 2, PH - M / 2);
      });
    }
    return pages;
  }

  // ---------- PDF (cada folha vira uma imagem JPEG) ----------
  const toBlob = (canvas, type, q) => new Promise((r) => canvas.toBlob(r, type, q));

  async function buildPdf(pages) {
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let length = 0;
    const push = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); length += b.length; };
    const obj = (num, body) => { offsets[num] = length; push(`${num} 0 obj\n`); body(); push('\nendobj\n'); };

    const W = 595.28, H = 841.89;
    const n = pages.length;
    // objetos: 1 catálogo, 2 páginas, depois 3 por folha (página, conteúdo, imagem)
    const pageNum = (i) => 3 + i * 3;
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(' ')}] >>`));
    for (let i = 0; i < n; i++) {
      const jpg = new Uint8Array(await (await toBlob(pages[i], 'image/jpeg', 0.9)).arrayBuffer());
      const p = pageNum(i);
      obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${p + 2} 0 R >> >> /Contents ${p + 1} 0 R >>`));
      const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
      obj(p + 1, () => { push(`<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream'); });
      obj(p + 2, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${pages[i].width} /Height ${pages[i].height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
        push(jpg);
        push('\nendstream');
      });
    }
    const total = 3 + n * 3;
    const xref = length;
    let table = `xref\n0 ${total}\n0000000000 65535 f \n`;
    for (let i = 1; i < total; i++) table += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    push(table);
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }

  // ---------- ponto de entrada ----------
  async function exportNote(note, format, opts) {
    const name = slug(opts.title);
    if (format === 'txt' || format === 'md') {
      const blob = new Blob([toText(note, format === 'md')], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
      return [new File([blob], `${name}.${format}`, { type: blob.type })];
    }
    const pages = await renderPages(note, opts);
    if (format === 'pdf') {
      const blob = await buildPdf(pages);
      return [new File([blob], `${name}.pdf`, { type: 'application/pdf' })];
    }
    const files = [];
    for (let i = 0; i < pages.length; i++) {
      const blob = await toBlob(pages[i], 'image/png');
      files.push(new File([blob], pages.length > 1 ? `${name}-${i + 1}.png` : `${name}.png`, { type: 'image/png' }));
    }
    return files;
  }

  window.Exporter = { exportNote, toText, renderPages, buildPdf };
})();
