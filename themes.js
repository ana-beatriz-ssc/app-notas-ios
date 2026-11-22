'use strict';
/* Temas e preferências. Carregado no <head> para aplicar as cores antes de desenhar a tela. */
(function () {
  // accent = cor principal no modo claro; accentDark = no modo escuro
  const THEMES = [
    { id: 'rosa', name: 'Rosa', accent: '#d94f86', accentDark: '#ff7fb1' },
    { id: 'rosa-cha', name: 'Rosa chá', accent: '#b96f80', accentDark: '#e7a6b4' },
    { id: 'framboesa', name: 'Framboesa', accent: '#c2185b', accentDark: '#ff5c95' },
    { id: 'lavanda', name: 'Lavanda', accent: '#8a63d2', accentDark: '#b89cff' },
    { id: 'pessego', name: 'Pêssego', accent: '#e2724a', accentDark: '#ffa07a' },
    { id: 'menta', name: 'Menta', accent: '#23977b', accentDark: '#5fd6b4' },
    { id: 'ceu', name: 'Céu', accent: '#2f74d0', accentDark: '#6aa9ff' },
    { id: 'classico', name: 'Clássico', accent: '#d39e00', accentDark: '#ffc60a' },
    { id: 'grafite', name: 'Grafite', accent: '#4b4b52', accentDark: '#d1d1d6' },
  ];

  const DEFAULTS = {
    theme: 'rosa',
    appearance: 'auto', // auto | light | dark
    fingerMode: 'auto', // auto | draw | pan
    penSeen: false,
    onboarded: false,
    paper: 'auto', // cor da folha dos desenhos
    lines: 'tema', // cor das linhas (desenhos e texto)
    tips: {},
  };

  const KEY = 'notas-settings';
  let settings = { ...DEFAULTS };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    settings = { ...DEFAULTS, ...saved, tips: { ...(saved.tips || {}) } };
  } catch (e) { /* armazenamento indisponível: usa o padrão */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignora */ }
  }

  // ---------- cores ----------
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  }
  // mistura: t = 0 → a, t = 1 → b
  function mix(a, b, t) {
    const A = hexToRgb(a), B = hexToRgb(b);
    return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

  function resolvedMode() {
    if (settings.appearance === 'light' || settings.appearance === 'dark') return settings.appearance;
    return darkQuery.matches ? 'dark' : 'light';
  }

  // Folha dos desenhos: 'auto' segue o modo claro/escuro; as outras são cores fixas
  const PAPERS = [
    { id: 'auto', name: 'Automático' },
    { id: 'branco', name: 'Branco', color: '#ffffff' },
    { id: 'creme', name: 'Creme', color: '#faf4e4' },
    { id: 'tom', name: 'Tom do tema' },
    { id: 'cinza', name: 'Cinza', color: '#e8e8ed' },
    { id: 'grafite', name: 'Grafite', color: '#2c2c2e' },
    { id: 'preto', name: 'Preto', color: '#0b0b0c' },
    { id: 'noite', name: 'Azul-noite', color: '#16213a' },
    { id: 'lousa', name: 'Verde-lousa', color: '#1e3a2c' },
  ];
  const LINES = [
    { id: 'tema', name: 'Cor do tema' },
    { id: 'cinza', name: 'Cinza', color: '#8e8e93' },
    { id: 'azul', name: 'Azul caderno', color: '#4f8fd6' },
    { id: 'contraste', name: 'Contraste' },
  ];
  const isDarkColor = (hex) => luminance(hex) < 0.2;

  function paperColor(t, mode, paperId) {
    const p = PAPERS.find((x) => x.id === paperId) || PAPERS[0];
    if (p.color) return p.color;
    if (p.id === 'tom') return mix(t.accent, '#ffffff', 0.86);
    return mode === 'dark' ? mix(t.accent, '#1c1c1e', 0.9) : mix(t.accent, '#ffffff', 0.97);
  }

  function lineBase(t, linesId, paper) {
    const dark = isDarkColor(paper);
    const l = LINES.find((x) => x.id === linesId) || LINES[0];
    if (l.color) return l.color;
    if (l.id === 'contraste') return dark ? '#ffffff' : '#000000';
    return dark ? t.accentDark : t.accent;
  }

  // cores da folha e das linhas (usadas pelos desenhos e pelas prévias)
  function inkColors(themeId, mode, paperId = settings.paper, linesId = settings.lines) {
    const t = THEMES.find((x) => x.id === themeId) || THEMES[0];
    const paper = paperColor(t, mode, paperId);
    const base = lineBase(t, linesId, paper);
    const dark = isDarkColor(paper);
    return {
      paper,
      paperDark: dark,
      line: mix(base, paper, dark ? 0.72 : 0.68),
      margin: mix(base, paper, dark ? 0.4 : 0.3),
      lineBase: base,
    };
  }

  function palette(themeId, mode) {
    const t = THEMES.find((x) => x.id === themeId) || THEMES[0];
    const a = t.accent;
    const ink = inkColors(themeId, mode);
    // linhas atrás do texto: mesma escolha, calculada para o fundo do texto (claro ou escuro)
    const textBase = (accent) => (settings.lines === 'tema' ? accent
      : settings.lines === 'contraste' ? (mode === 'dark' ? '#ffffff' : '#000000')
        : ink.lineBase);
    if (mode === 'dark') {
      const accent = t.accentDark;
      const card = mix(a, '#1c1c1e', 0.9);
      return {
        mode,
        accent,
        onAccent: luminance(accent) > 0.45 ? '#000000' : '#ffffff',
        bg: mix(a, '#000000', 0.94),
        card,
        selected: mix(accent, card, 0.68),
        text: '#ffffff',
        muted: '#9a9aa0',
        sep: 'rgba(84, 84, 88, 0.6)',
        fill: 'rgba(118, 118, 128, 0.24)',
        bar: rgba(mix(a, '#000000', 0.94), 0.86),
        textLine: mix(textBase(accent), card, 0.78),
        textMargin: mix(textBase(accent), card, 0.45),
        canvas: mix(a, '#000000', 0.9),
        sheet: rgba(mix(a, '#2c2c2e', 0.92), 0.97),
        ...ink,
      };
    }
    return {
      mode,
      accent: a,
      onAccent: luminance(a) > 0.45 ? '#000000' : '#ffffff',
      bg: mix(a, '#ffffff', 0.93),
      card: '#ffffff',
      selected: mix(a, '#ffffff', 0.76),
      text: '#1c1c1e',
      muted: '#86868b',
      sep: 'rgba(60, 60, 67, 0.18)',
      fill: rgba(mix(a, '#767680', 0.75), 0.13),
      bar: rgba(mix(a, '#ffffff', 0.93), 0.86),
      textLine: mix(textBase(a), '#ffffff', 0.78),
      textMargin: mix(textBase(a), '#ffffff', 0.4),
      canvas: mix(a, '#e9e9ee', 0.86),
      sheet: rgba(mix(a, '#ffffff', 0.96), 0.97),
      ...ink,
    };
  }

  let current = null;

  function apply() {
    const mode = resolvedMode();
    const p = palette(settings.theme, mode);
    current = p;
    const root = document.documentElement;
    const vars = {
      '--accent': p.accent, '--on-accent': p.onAccent, '--bg': p.bg, '--card': p.card,
      '--selected': p.selected, '--text': p.text, '--muted': p.muted, '--sep': p.sep,
      '--fill': p.fill, '--bar': p.bar, '--text-line': p.textLine, '--text-margin': p.textMargin,
      '--canvas': p.canvas, '--sheet': p.sheet, '--paper': p.paper,
    };
    for (const k in vars) root.style.setProperty(k, vars[k]);
    root.dataset.mode = mode;
    root.dataset.paper = p.paperDark ? 'dark' : 'light';
    root.style.colorScheme = mode;

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = p.bg;
    window.dispatchEvent(new CustomEvent('themechange', { detail: p }));
  }

  darkQuery.addEventListener('change', () => { if (settings.appearance === 'auto') apply(); });

  window.Theme = {
    THEMES,
    PAPERS,
    LINES,
    inkColors,
    resolvedMode,
    get settings() { return settings; },
    get colors() { return current; },
    palette,
    set(patch) {
      Object.assign(settings, patch);
      save();
      if ('theme' in patch || 'appearance' in patch || 'paper' in patch || 'lines' in patch) apply();
    },
    save,
    apply,
  };

  apply();
})();
