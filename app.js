/* =====================================================================
   THIRD SPACES — A FIELD GUIDE   ·   app.js
   Reads the Google Sheet (or bundled data.js), builds the grid, filters,
   popup gallery, and applies the halftone treatment to every image.
   Settings live in config.js.
   ===================================================================== */
(() => {
  'use strict';

  /* ------------------------------------------------------------ settings */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const CSV_URL    = (window.THIRD_SPACES_CSV_URL || '').trim();
  const REFRESH_MS = Number(window.THIRD_SPACES_REFRESH_MS) || 0;
  const IMG_DIR    = (window.THIRD_SPACES_IMAGE_DIR || 'images').replace(/\/+$/, '');
  // where photos are served from: the local /images folder by default, or any absolute URL (GitHub/jsDelivr, CDN, bucket…)
  const IMG_BASE   = (window.THIRD_SPACES_IMAGE_BASE || IMG_DIR).trim().replace(/\/+$/, '');
  const TRAIT_MODE = window.THIRD_SPACES_TRAIT_MATCH === 'all' ? 'all' : 'any';
  const HT = Object.assign({ enabled: true, mode: 'overlay', dotsAcross: 120, angle: 45, contrast: 1.25,
                             brightness: 0.03, gamma: 0.8, overlayOpacity: 0.8, ink: '#141414', paper: '#f4f2ee' }, window.THIRD_SPACES_HALFTONE || {});
  const FILTERS = Object.assign({ traits: [], categories: [], boroughs: [] }, window.THIRD_SPACES_FILTERS || {});

  // output sizes (px) for processed images — match the aspect ratios in styles.css
  const CARD_SIZE  = { w: 440, h: 490 };    // 349 : 389
  const MODAL_SIZE = { w: 700, h: 960 };    // 525 : 720

  /* ------------------------------------------------------------ text helpers */
  const norm = (s = '') => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const traitKey = s => norm(s).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  // category key ignores word ORDER around slashes: "bar / restaurant" == "restaurant / bar"
  const catKey = s => traitKey(s).split('/').map(x => x.trim()).filter(Boolean).sort().join('/');
  const splitList = (s = '') => String(s).split(/[,;|]/).map(x => x.trim()).filter(Boolean);
  const titleCase = s => String(s).replace(/(^|[\s/(-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());
  const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ------------------------------------------------------------ borough */
  function guessBorough(address = '') {
    const zip = (address.match(/\b(1\d{4})\b/) || [])[1];
    if (zip) {
      const z = +zip.slice(0, 3);
      if (z >= 100 && z <= 102) return 'Manhattan';
      if (z === 103) return 'Staten Island';
      if (z === 104) return 'Bronx';
      if (z === 112) return 'Brooklyn';
      if (z === 110 || z === 111 || z === 113 || z === 114 || z === 116) return 'Queens';
    }
    const a = norm(address);
    if (/staten island/.test(a)) return 'Staten Island';
    if (/bronx/.test(a)) return 'Bronx';
    if (/brooklyn/.test(a)) return 'Brooklyn';
    if (/queens|astoria|long island city|flushing|jamaica|ridgewood|sunnyside|woodside|jackson heights/.test(a)) return 'Queens';
    if (/new york|manhattan|harlem/.test(a)) return 'Manhattan';
    return '';
  }

  /* ------------------------------------------------------------ images: sheet column → URLs */
  const IMG_EXT = /\.(jpe?g|png|webp|gif|avif|svg)(\?.*)?$/i;
  let MANIFEST = Array.isArray(window.THIRD_SPACES_IMAGES) ? window.THIRD_SPACES_IMAGES : [];
  const stem = f => f.replace(/\.[^./]+$/, '');
  let manByName, manByStem;
  function indexManifest() {
    manByName = new Map(MANIFEST.map(f => [f.toLowerCase(), f]));
    manByStem = new Map(MANIFEST.map(f => [stem(f).toLowerCase(), f]));
  }
  indexManifest();
  // The live site re-reads <images>/manifest.json each refresh, so photos you upload later are picked up
  // without touching any code. (If it can't be fetched, the bundled images/manifest.js is used.)
  async function loadManifest() {
    try {
      const res = await fetch(IMG_BASE + '/manifest.json', { cache: 'no-store' });
      if (!res.ok) return;
      const list = await res.json();
      if (Array.isArray(list)) { MANIFEST = list; indexManifest(); }
    } catch (e) { /* offline / file:// / not uploaded yet — fine */ }
  }
  const enc = path => path.split('/').map(encodeURIComponent).join('/');

  // "a.jpg | b.jpg"  /  one per line  /  "a.jpg, b.jpg"
  function splitImages(s) {
    return String(s || '')
      .split(/[|;\n\r]+|,(?=\s*(?:https?:|[^,|;]+\.(?:jpe?g|png|webp|gif|avif)\b))/i)
      .map(x => x.trim()).filter(Boolean);
  }

  // → array of candidate URLs for one image token (tried in order)
  function candidatesFor(token) {
    if (/^data:/i.test(token)) return [token];
    if (/^(https?:)?\/\//i.test(token)) {
      const drive = token.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
      return [drive ? `https://drive.google.com/thumbnail?id=${drive[1]}&sz=w1400` : token];
    }
    let t = token.replace(/\\/g, '/').replace(/^\.?\/+/, '');
    if (t.toLowerCase().startsWith(IMG_DIR.toLowerCase() + '/')) t = t.slice(IMG_DIR.length + 1);
    const hit = manByName.get(t.toLowerCase()) || manByStem.get(stem(t).toLowerCase());
    const names = [];
    if (hit) names.push(hit);
    else {
      names.push(t);
      if (!IMG_EXT.test(t)) ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'PNG'].forEach(e => names.push(`${t}.${e}`));
    }
    return names.map(n => `${IMG_BASE}/${enc(n)}`);
  }

  // No image in the sheet?  Pair photos whose file name starts with the entry number (01_usagi.jpg → #1)
  function autoImages(num) {
    if (!MANIFEST.length || !num) return [];
    const re = new RegExp('^0*' + num + '(?![0-9])');
    return MANIFEST.filter(f => re.test(f)).map(f => [`${IMG_BASE}/${encodeURIComponent(f)}`]);
  }

  /* ------------------------------------------------------------ CSV */
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    text = text.replace(/^\uFEFF/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (c === '"' && q && n === '"') { cell += '"'; i++; }
      else if (c === '"') q = !q;
      else if (c === ',' && !q) { row.push(cell); cell = ''; }
      else if ((c === '\n' || c === '\r') && !q) {
        if (c === '\r' && n === '\n') i++;
        row.push(cell); if (row.some(v => v.trim() !== '')) rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell.length || row.length) { row.push(cell); if (row.some(v => v.trim() !== '')) rows.push(row); }
    if (!rows.length) return [];
    const headers = rows.shift().map(h => h.trim());
    return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
  }

  function cleanPlace(row, i) {
    const get = (...keys) => {
      for (const k of keys) for (const h of Object.keys(row))
        if (norm(h) === norm(k) && String(row[h]).trim() !== '') return String(row[h]).trim();
      return '';
    };
    const address = get('address');
    const id = get('#', 'id', 'number') || String(i + 1);
    const p = {
      uid: 'p' + i,
      id,
      num: parseInt(id, 10) || 0,
      name: get('place / name', 'name', 'place', 'place name'),
      address,
      tags: get('oldenburg tag', 'oldenburg tags', 'oldenburg traits', 'tags', 'traits'),
      category: get('category', 'categories'),
      description: get('description', 'decription', 'about the space', 'about'),
      image: get('[image]', 'image', 'images', 'image url', 'photo'),
      borough: get('borough') || guessBorough(address)
    };
    let imgs = splitImages(p.image).map(candidatesFor);
    if (!imgs.length) imgs = autoImages(p.num);
    p.images = imgs;
    p.traitKeys = new Set(splitList(p.tags).map(traitKey));
    p.catKeys   = new Set(splitList(p.category).map(catKey));
    return p;
  }

  /* ------------------------------------------------------------ filters */
  const mkOpt = (o, keyFn) => {
    const opt = typeof o === 'string' ? { value: o, label: o } : o;
    return { value: opt.value, label: opt.label || opt.value,
             keys: new Set([opt.value, opt.label, ...(opt.aliases || [])].filter(Boolean).map(keyFn)) };
  };
  let traitOpts = [], catOpts = [], boroughOpts = [];
  const active = { trait: new Set(), category: new Set(), borough: new Set() };
  let places = [];

  function buildOptions() {
    traitOpts = FILTERS.traits.map(o => mkOpt(o, traitKey));
    catOpts   = FILTERS.categories.map(o => mkOpt(o, catKey));
    boroughOpts = FILTERS.boroughs.map(b => ({ value: b, label: b }));
    // anything in the sheet that isn't in config still gets a button, so new categories "just appear"
    places.forEach(p => {
      splitList(p.tags).forEach(t => { if (!traitOpts.some(o => o.keys.has(traitKey(t)))) traitOpts.push(mkOpt(t.toLowerCase(), traitKey)); });
      splitList(p.category).forEach(c => { if (!catOpts.some(o => o.keys.has(catKey(c)))) catOpts.push(mkOpt(c.toLowerCase(), catKey)); });
      if (p.borough && !boroughOpts.some(o => o.value === p.borough)) boroughOpts.push({ value: p.borough, label: p.borough });
    });
  }

  function renderFilterButtons() {
    const fill = (sel, opts, group) => {
      const el = $(sel);
      el.innerHTML = opts.map(o =>
        `<button type="button" data-group="${group}" data-value="${esc(o.value)}" aria-pressed="${active[group].has(o.value)}">${esc(o.label)}</button>`).join('');
    };
    fill('#traitFilters', traitOpts, 'trait');
    fill('#categoryFilters', catOpts, 'category');
    fill('#locationFilters', boroughOpts, 'borough');
    $('#clearFilters').hidden = !(active.trait.size + active.category.size + active.borough.size);
  }

  function renderSubmitOptions() {
    $('#submitCategory').innerHTML = '<option value="">Select…</option>' +
      catOpts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');   // value = the word the sheet uses
    $('#submitTraits').innerHTML = traitOpts.map(o =>
      `<label><input type="checkbox" name="traits" value="${esc(o.value)}"> ${esc(o.label)}</label>`).join('');
  }

  const optHit = (opt, keys) => [...opt.keys].some(k => keys.has(k));
  function getFiltered() {
    const tSel = [...active.trait].map(v => traitOpts.find(o => o.value === v)).filter(Boolean);
    const cSel = [...active.category].map(v => catOpts.find(o => o.value === v)).filter(Boolean);
    return places.filter(p => {
      if (tSel.length && !(TRAIT_MODE === 'all' ? tSel.every(o => optHit(o, p.traitKeys)) : tSel.some(o => optHit(o, p.traitKeys)))) return false;
      if (cSel.length && !cSel.some(o => optHit(o, p.catKeys))) return false;
      if (active.borough.size && !active.borough.has(p.borough)) return false;
      return true;
    });
  }

  /* ------------------------------------------------------------ HALFTONE */
  function halftone(img, w, h) {
    // 1. cover-crop the picture into a w×h canvas
    const src = document.createElement('canvas'); src.width = w; src.height = h;
    const sx = src.getContext('2d', { willReadFrequently: true });
    sx.fillStyle = '#fff'; sx.fillRect(0, 0, w, h);
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    sx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const px = sx.getImageData(0, 0, w, h).data;      // throws if the image is cross-origin without CORS

    // 2. base: "overlay" keeps the photo in full colour and lays the dot screen on top;
    //    "mono" / "cmyk" replace the photo with dots printed on paper
    const overlay = HT.mode === 'overlay';
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const outCtx = out.getContext('2d');
    let ctx = outCtx, dots = null;
    if (overlay) {
      outCtx.drawImage(src, 0, 0);
      dots = document.createElement('canvas'); dots.width = w; dots.height = h;
      ctx = dots.getContext('2d');                 // dots drawn opaque here, then composited once (no double-darkening)
    } else { ctx.fillStyle = HT.paper; ctx.fillRect(0, 0, w, h); }

    const cell = w / HT.dotsAcross;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const tone = v => clamp((Math.pow(v, HT.gamma) - 0.5) * HT.contrast + 0.5 + HT.brightness, 0, 1);

    // average colour around (x,y), 0-1, contrast-adjusted
    const sample = (x, y) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = clamp(Math.round(x + dx * cell * 0.33), 0, w - 1), Y = clamp(Math.round(y + dy * cell * 0.33), 0, h - 1);
        const i = (Y * w + X) * 4; r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      return [tone(r / n / 255), tone(g / n / 255), tone(b / n / 255)];
    };

    // one screen of dots: valueFn(rgb) → 0..1 ink coverage
    const layer = (angleDeg, color, valueFn, blend) => {
      const a = angleDeg * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), half = Math.hypot(w, h) / 2;
      ctx.globalCompositeOperation = blend; ctx.fillStyle = color;
      for (let v = -half; v < half; v += cell) for (let u = -half; u < half; u += cell) {
        const x = w / 2 + u * cos - v * sin, y = h / 2 + u * sin + v * cos;
        if (x < -cell || y < -cell || x > w + cell || y > h + cell) continue;
        const cov = valueFn(sample(x, y));
        if (cov < 0.025) continue;
        ctx.beginPath(); ctx.arc(x, y, cell * 0.76 * Math.sqrt(cov), 0, Math.PI * 2); ctx.fill();
      }
    };

    if (HT.mode === 'cmyk') {
      const cmyk = ([r, g, b]) => { const k = Math.min(1 - r, 1 - g, 1 - b); return [1 - r - k * .85, 1 - g - k * .85, 1 - b - k * .85, k]; };
      layer(15, '#00b4e6', rgb => cmyk(rgb)[0], 'multiply');
      layer(75, '#ee2a8e', rgb => cmyk(rgb)[1], 'multiply');
      layer(0,  '#ffe81a', rgb => cmyk(rgb)[2], 'multiply');
      layer(45, '#141414', rgb => cmyk(rgb)[3] * 1.1, 'multiply');
    } else {
      layer(HT.angle, HT.ink, ([r, g, b]) => 1 - (0.299 * r + 0.587 * g + 0.114 * b), 'source-over');
    }
    ctx.globalCompositeOperation = 'source-over';
    if (overlay) { outCtx.globalAlpha = HT.overlayOpacity; outCtx.drawImage(dots, 0, 0); outCtx.globalAlpha = 1; }
    return out;
  }

  const toBlobURL = cv => new Promise((res, rej) => cv.toBlob(b => b ? res(URL.createObjectURL(b)) : rej(new Error('blob failed')), 'image/png'));

  /* ------------------------------------------------------------ image pipeline (load → halftone → cache) */
  let running = 0; const waiting = [];
  const queue = fn => new Promise((resolve, reject) => {
    const run = () => { running++; fn().then(resolve, reject).finally(() => { running--; const n = waiting.shift(); if (n) n(); }); };
    running < 3 ? run() : waiting.push(run);
  });

  function loadImage(cands) {
    return new Promise(resolve => {
      let i = 0;
      const next = () => {
        if (i >= cands.length) return resolve(null);
        const url = cands[i++];
        let remote = false;
        try { remote = new URL(url, location.href).origin !== location.origin && !/^data:/i.test(url); } catch (e) {}
        const im = new Image(); im.decoding = 'async';
        if (remote) im.crossOrigin = 'anonymous';
        im.onload = () => resolve({ img: im, url, cors: true });
        im.onerror = () => {
          if (!remote) return next();
          const im2 = new Image();                       // server may not send CORS headers → show original, no halftone
          im2.onload = () => resolve({ img: im2, url, cors: false });
          im2.onerror = next; im2.src = url;
        };
        im.src = url;
      };
      next();
    });
  }

  const imgCache = new Map();
  function renderImage(cands, size) {
    const key = cands.join('|') + '@' + size.w + 'x' + size.h + (HT.enabled ? JSON.stringify(HT) : '');
    if (!imgCache.has(key)) {
      imgCache.set(key, queue(async () => {
        const r = await loadImage(cands);
        if (!r) return null;
        if (!HT.enabled || !r.cors) return r.url;
        try { return await toBlobURL(halftone(r.img, size.w, size.h)); }
        catch (e) { console.warn('Halftone skipped for', r.url, e); return r.url; }
      }).then(u => { if (!u) imgCache.delete(key); return u; }));
    }
    return imgCache.get(key);
  }

  /* ------------------------------------------------------------ grid */
  const grid = $('#placesGrid');
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { io.unobserve(en.target); hydrateCard(en.target); }
      }), { rootMargin: '400px 0px' })
    : null;

  function hydrateCard(card) {
    const p = places.find(x => x.uid === card.dataset.id);
    if (!p || !p.images.length) return;
    renderImage(p.images[0], CARD_SIZE).then(url => {
      if (!url) return;
      const img = new Image(); img.alt = p.name; img.decoding = 'async';
      img.onload = () => { $('.card-image', card).appendChild(img); requestAnimationFrame(() => img.classList.add('is-ready')); };
      img.src = url;
    });
  }

  function render() {
    const list = getFiltered();
    grid.innerHTML = list.map(p =>
      `<article class="place-card" tabindex="0" role="button" data-id="${esc(p.uid)}" aria-label="View details for ${esc(p.name)}">
         <div class="card-image"><div class="image-placeholder"></div></div>
         <h2 class="card-name">${esc(p.name)}</h2>
       </article>`).join('');
    $$('.place-card', grid).forEach(c => io ? io.observe(c) : hydrateCard(c));
    $('#emptyState').hidden = list.length !== 0;
  }

  function onFiltersChanged() {
    $$('#filters [data-group]').forEach(b => b.setAttribute('aria-pressed', active[b.dataset.group].has(b.dataset.value)));
    $('#clearFilters').hidden = !(active.trait.size + active.category.size + active.borough.size);
    render();
  }

  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('[data-group]'); if (!b) return;
    const set = active[b.dataset.group], v = b.dataset.value;
    set.has(v) ? set.delete(v) : set.add(v);
    onFiltersChanged();
  });
  $('#clearFilters').addEventListener('click', () => { Object.values(active).forEach(s => s.clear()); onFiltersChanged(); });
  $('#mobileFilterToggle').addEventListener('click', e => {
    const open = $('#filters').classList.toggle('open');
    e.currentTarget.textContent = open ? 'Filters −' : 'Filters +';
    e.currentTarget.setAttribute('aria-expanded', open);
  });

  /* ------------------------------------------------------------ popup + gallery */
  const modal = $('#placeModal'), gallery = $('#modalGallery'), mImg = $('#modalImage'), mPh = $('#modalPlaceholder');
  let current = null, slide = 0, slideToken = 0, lastFocus = null, closeTimer = null;
  const FADE_MS = 320;

  function showSlide(i) {
    const imgs = current.images;
    gallery.dataset.count = imgs.length;
    if (!imgs.length) { mImg.hidden = true; mPh.hidden = false; return; }
    slide = (i + imgs.length) % imgs.length;
    $$('#galleryDots button').forEach((d, k) => d.classList.toggle('active', k === slide));
    const token = ++slideToken;
    renderImage(imgs[slide], MODAL_SIZE).then(url => {
      if (token !== slideToken) return;
      if (!url) { mImg.hidden = true; mPh.hidden = false; return; }
      mImg.src = url; mImg.alt = current.name; mImg.hidden = false; mPh.hidden = true;
    });
    if (imgs.length > 1) renderImage(imgs[(slide + 1) % imgs.length], MODAL_SIZE);   // warm the next one
  }

  function openPlace(uid, trigger) {
    const p = places.find(x => x.uid === uid); if (!p) return;
    current = p; lastFocus = trigger || null;
    $('#modalTitle').textContent = p.name;
    $('#modalCategory').textContent = titleCase(splitList(p.category).join(', ')) || '—';
    $('#modalTags').textContent = titleCase(splitList(p.tags).join(', ')) || '—';
    $('#modalDescription').textContent = p.description || 'Description coming soon.';
    const a = $('#mapLink');
    a.textContent = p.address || 'Address not listed';
    a.href = p.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([p.name, p.address].join(', ')) : '#';
    $('#galleryDots').innerHTML = p.images.map((_, k) => `<button type="button" aria-label="Image ${k + 1}"></button>`).join('');
    mImg.hidden = true; mImg.removeAttribute('src'); mPh.hidden = false;
    clearTimeout(closeTimer); modal.classList.remove('is-closing');
    modal.hidden = false; document.body.style.overflow = 'hidden';
    showSlide(0);
    $('#modalClose').focus({ preventScroll: true });
  }
  function closeModal() {
    if (modal.hidden || modal.classList.contains('is-closing')) return;
    document.body.style.overflow = ''; slideToken++;
    modal.classList.add('is-closing');                       // fade / dissolve out, then hide
    closeTimer = setTimeout(() => { modal.hidden = true; modal.classList.remove('is-closing'); }, FADE_MS);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  grid.addEventListener('click', e => { const c = e.target.closest('.place-card'); if (c) openPlace(c.dataset.id, c); });
  grid.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.place-card')) { e.preventDefault(); openPlace(e.target.dataset.id, e.target); }
  });
  $('#modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  $('#galleryPrev').addEventListener('click', () => showSlide(slide - 1));
  $('#galleryNext').addEventListener('click', () => showSlide(slide + 1));
  $('#galleryDots').addEventListener('click', e => { const i = $$('#galleryDots button').indexOf(e.target.closest('button')); if (i > -1) showSlide(i); });
  document.addEventListener('keydown', e => {
    if (modal.hidden || modal.classList.contains('is-closing')) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') showSlide(slide - 1);
    if (e.key === 'ArrowRight') showSlide(slide + 1);
  });
  let touchX = null;
  gallery.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  gallery.addEventListener('touchend', e => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX; touchX = null;
    if (Math.abs(dx) > 40) showSlide(slide + (dx < 0 ? 1 : -1));
  });

  /* ------------------------------------------------------------ collapsible sidebar */
  const SB_KEY = 'thirdSpacesSidebarCollapsed';
  const desktop = window.matchMedia('(min-width: 821px)');
  let collapsed = false;
  try { collapsed = localStorage.getItem(SB_KEY) === '1'; } catch (e) {}
  function applySidebar() {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    $('#sidebar').inert = collapsed && desktop.matches;      // keep hidden controls out of the tab order
    $('#sidebarExpand').setAttribute('aria-expanded', String(!collapsed));
  }
  function setSidebar(c, persist = true) {
    collapsed = c; applySidebar();
    if (persist) try { localStorage.setItem(SB_KEY, c ? '1' : '0'); } catch (e) {}
  }
  $('#sidebarCollapse').addEventListener('click', () => { setSidebar(true);  $('#sidebarExpand').focus({ preventScroll: true }); });
  $('#sidebarExpand').addEventListener('click',   () => { setSidebar(false); $('#sidebarCollapse').focus({ preventScroll: true }); });
  (desktop.addEventListener ? desktop.addEventListener('change', applySidebar) : desktop.addListener(applySidebar));

  /* ------------------------------------------------------------ fit titles: every .fit-line stays on one line */
  function fitTitles() {
    $$('.fit-title').forEach(h => {
      const lines = $$('.fit-line', h);
      h.style.fontSize = '';                                   // back to the CSS size
      const avail = h.clientWidth; if (!avail) return;         // panel hidden → nothing to measure
      let size = parseFloat(getComputedStyle(h).fontSize);
      const widest = () => Math.max(...lines.map(l => l.getBoundingClientRect().width));
      const w = widest();
      if (w > avail) {
        size = Math.max(18, Math.floor(size * (avail / w) * 0.98));
        h.style.fontSize = size + 'px';
        while (widest() > avail && size > 18) h.style.fontSize = (--size) + 'px';
      }
    });
  }
  window.addEventListener('resize', fitTitles);
  if (document.fonts) { document.fonts.ready.then(fitTitles); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', fitTitles); }

  /* ------------------------------------------------------------ views: index / submit / about */
  const VIEWS = ['index', 'submit', 'about'];
  function setView(v) {
    if (!VIEWS.includes(v)) v = 'index';
    document.body.dataset.view = v;
    $$('[data-panel]').forEach(p => p.hidden = p.dataset.panel !== v);
    $$('[data-view-link]').forEach(a => a.dataset.viewLink === v ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
    if (v !== 'index' && collapsed) setSidebar(false, false);   // About / Submit live in the sidebar
    closeModal(); $('#sidebar').scrollTop = 0; window.scrollTo(0, 0);
    requestAnimationFrame(fitTitles);
  }
  const route = () => setView(location.hash.replace(/^#\/?/, ''));
  window.addEventListener('hashchange', route);

  /* ------------------------------------------------------------ submit form */
  // THIRD_SPACES_GOOGLE_FORM = a Google Form "pre-filled link" whose answers are the words
  // name / address / category / traits / description / images / email  → maps each form question to a site field
  function parseGoogleForm() {
    const raw = (window.THIRD_SPACES_GOOGLE_FORM || '').trim();
    if (!raw) return null;
    try {
      const u = new URL(raw), fields = {};
      u.searchParams.forEach((v, k) => { if (/^entry\.\d+$/.test(k) && v.trim()) fields[v.trim().toLowerCase()] = k; });
      const action = u.origin + u.pathname.replace(/\/(viewform|prefill|formResponse)\/?$/, '') + '/formResponse';
      return Object.keys(fields).length ? { action, fields } : null;
    } catch (e) { return null; }
  }

  $('#submitForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target, st = $('#formStatus'), d = new FormData(f);
    if (!f.reportValidity()) return;
    const body = {
      name: d.get('name'), address: d.get('address'), category: d.get('category'),
      traits: d.getAll('traits').join(', '), description: d.get('description'),
      images: d.get('images'), email: d.get('email'), website: d.get('website')   // 'website' = hidden spam trap
    };
    const gf = parseGoogleForm();
    const endpoint = (window.THIRD_SPACES_SUBMIT_ENDPOINT || '').trim();
    if (gf) {                                   // Google Form route: no script deployment needed
      try {
        const params = new URLSearchParams();
        Object.entries(gf.fields).forEach(([key, entry]) => { if (body[key] != null) params.append(entry, body[key]); });
        await fetch(gf.action, { method: 'POST', mode: 'no-cors', body: params });
        st.textContent = 'Thank you — your submission was sent for review.'; f.reset();
      } catch (err) { st.textContent = 'Something went wrong. Please try again.'; }
    } else if (endpoint) {
      try {
        await fetch(endpoint, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(body) });
        st.textContent = 'Thank you — your submission was sent for review.'; f.reset();
      } catch (err) { st.textContent = 'Something went wrong. Please try again.'; }
    } else {
      const text = Object.entries(body).map(([k, v]) => `${k}: ${v || ''}`).join('\n');
      location.href = `mailto:${window.THIRD_SPACES_SUBMIT_EMAIL || ''}?subject=${encodeURIComponent('Third Spaces submission: ' + body.name)}&body=${encodeURIComponent(text)}`;
      st.textContent = 'Opening your mail app…';
    }
  });

  /* ------------------------------------------------------------ data loading */
  let lastSig = '';
  async function loadData() {
    await loadManifest();
    let rows = null, msg = '';
    if (CSV_URL) {
      try {
        const res = await fetch(CSV_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text.trim() || !text.includes(',') || /^\s*<(!doctype|html)/i.test(text)) throw new Error('Not CSV');
        rows = parseCSV(text).map(cleanPlace).filter(p => p.name);
        if (!rows.length) throw new Error('No place rows found');
      } catch (err) {
        console.warn('Live sheet unavailable:', err);
        msg = 'Could not reach the live sheet — showing the bundled data. Check the published CSV link in config.js.';
      }
    }
    if (!rows) rows = (window.THIRD_SPACES_FALLBACK || []).map(cleanPlace).filter(p => p.name);
    $('#statusMessage').textContent = msg;

    const sig = JSON.stringify(rows.map(p => [p.id, p.name, p.address, p.tags, p.category, p.description, p.image, p.borough, p.images]));
    if (sig === lastSig) return;               // nothing changed → don't redraw / re-process images
    lastSig = sig; places = rows;
    buildOptions(); renderFilterButtons(); renderSubmitOptions(); render();
  }

  /* ------------------------------------------------------------ go */
  applySidebar();
  route();
  loadData();
  if (REFRESH_MS > 0) setInterval(loadData, REFRESH_MS);
})();
