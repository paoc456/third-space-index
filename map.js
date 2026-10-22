/* =====================================================================
   THIRD SPACES — MAP VIEW  ·  map.js
   Adds a Grid / Map switch to the Index. The map:
     • uses Leaflet (loaded from a CDN the first time someone opens the map)
     • recolours the street map into ivory + green (see COLOURS below)
     • shows one pin per place that matches the current filters
     • clicking a pin opens the same popup the grid cards open
   Where the pins come from (first match wins):
     1. "lat" and "lng" columns in the Google Sheet
     2. coords.js — written by `node geocode.js`
     3. looked up live (a few at a time) and remembered in the visitor's browser
   Optional overrides: set window.THIRD_SPACES_MAP = { … } in config.js
   (any of the keys in CFG below).
   ===================================================================== */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);

  /* ------------------------------------------------------------ settings */
  const CFG = Object.assign({
    /* COLOURS — the map is drawn in greyscale, then mapped onto these four colours
       (darkest → lightest). Roads/land sit near the light end, water and parks in the middle,
       labels at the dark end. */
    dark: '#08602ed2',     // labels, outlines
    mid: '#fffcf2',      // water
    light: '#fffcf2',    // parks, land
    paper: '#0b9547',    // roads + background (the site's ivory)
    contrast: 7,         // higher = more of the map goes ivory, only water/labels stay green (try 3–8)

    /* BASE MAP — Esri's "Light Gray Canvas": free, no API key, and a quiet greyscale that recolours cleanly.
       labelTiles adds street / neighbourhood names on top ("" = no names). Any {z}/{x}/{y} tile URL works here;
       (OpenStreetMap's own tiles, https://tile.openstreetmap.org/{z}/{x}/{y}.png, are the other keyless option.)
       NOTE: CARTO's basemaps now require an API key, which is why they're not used. */
    tiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    labelTiles: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ &middot; Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',

    center: [40.7306, -73.9866],   // New York City
    zoom: 12, minZoom: 10, maxZoom: 16,
    pin: 18,                        // pin size in px
    geocodeMax: 20                  // most live address look-ups per visit (see "3." above)
  }, window.THIRD_SPACES_MAP || {});

  const LEAFLET = {
    js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
    css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'
  };
  const MODE_KEY = 'thirdSpacesIndexMode', GEO_KEY = 'thirdSpacesGeo';

  const body = document.body, view = $('#mapView'), noteEl = $('#mapNote');
  if (!view || !window.ThirdSpaces) return;           // markup or app.js missing → leave the grid alone

  /* ------------------------------------------------------------ coordinates */
  const keyOf = p => `${p.name}|${p.address}`.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9|]+/g, ' ').trim();     // same recipe as geocode.js
  const valid = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;

  let cache = {};
  try { cache = JSON.parse(localStorage.getItem(GEO_KEY) || '{}') || {}; } catch (e) { cache = {}; }
  const saveCache = () => { try { localStorage.setItem(GEO_KEY, JSON.stringify(cache)); } catch (e) { /* private mode */ } };

  // coords.js keys are tidied here (case, commas, spaces) so a hand-typed key still matches; if the address in the sheet was
  // edited since, a place is still found by its NAME as long as that name appears once in coords.js
  const tidy = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9|]+/g, ' ').trim();
  let COORDS = null, BYNAME = null;
  function buildCoords() {
    COORDS = {}; BYNAME = {};
    Object.entries(window.THIRD_SPACES_COORDS || {}).forEach(([k, v]) => {
      const t = tidy(k).replace(/ ?\| ?/, '|'); COORDS[t] = v;
      const n = t.split('|')[0]; BYNAME[n] = n in BYNAME ? null : v;                // null = name used twice → don't guess
    });
  }
  function coordsFor(p) {
    if (valid(p.lat, p.lng)) return [p.lat, p.lng];
    if (!COORDS) buildCoords();
    const k = keyOf(p), c = COORDS[k] || BYNAME[tidy(p.name)] || cache[k];
    return c && valid(c[0], c[1]) ? c : null;
  }
  window.ThirdSpaces.coordsFor = coordsFor;                    // handy for checking in the console

  /* ------------------------------------------------------------ the ivory + green recolouring */
  const hex = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };
  function installFilter() {
    if ($('#tsDuotoneSvg')) return;
    const cols = [CFG.dark, CFG.mid, CFG.light, CFG.paper].map(hex);
    const table = ch => cols.map(c => c[ch].toFixed(4)).join(' ');
    const gamma = `type="gamma" amplitude="1" exponent="${Number(CFG.contrast) || 5}" offset="0"`;
    body.insertAdjacentHTML('beforeend',
      `<svg id="tsDuotoneSvg" width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">
         <filter id="tsDuotone" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%">
           <feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0.2126 0.7152 0.0722 0 0  0 0 0 1 0"/>
           <feComponentTransfer><feFuncR ${gamma}/><feFuncG ${gamma}/><feFuncB ${gamma}/></feComponentTransfer>
           <feComponentTransfer>
             <feFuncR type="table" tableValues="${table(0)}"/>
             <feFuncG type="table" tableValues="${table(1)}"/>
             <feFuncB type="table" tableValues="${table(2)}"/>
           </feComponentTransfer>
         </filter>
       </svg>`);
  }

  /* ------------------------------------------------------------ Leaflet (loaded on first use) */
  function loadLeaflet() {
    if (window.L) return Promise.resolve();
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET.css;
    const js = document.createElement('script'); js.src = LEAFLET.js;
    const done = el => new Promise((res, rej) => { el.onload = res; el.onerror = () => rej(new Error('could not load ' + (el.src || el.href))); });
    const both = Promise.all([done(css), done(js)]);
    document.head.append(css, js);
    return both;
  }

  /* ------------------------------------------------------------ the map */
  let map = null, layer = null, building = false, needsFit = true, geoBusy = false, geoDone = 0, loadError = '';
  const failed = new Set();
  const visible = () => body.dataset.indexMode === 'map' && ['index', 'submit', 'about'].includes(body.dataset.view) && view.clientWidth > 0;
  const note = txt => { noteEl.textContent = txt || ''; };

  function initMap() {
    installFilter();
    map = L.map('map', {
      center: CFG.center, zoom: CFG.zoom, minZoom: CFG.minZoom, maxZoom: CFG.maxZoom,
      zoomControl: false, wheelPxPerZoomLevel: 90
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noreferrer">Leaflet</a>');
    L.tileLayer(CFG.tiles, { maxZoom: CFG.maxZoom, attribution: CFG.attribution }).addTo(map);
    if (CFG.labelTiles) L.tileLayer(CFG.labelTiles, { maxZoom: CFG.maxZoom }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }

  function refresh(fit) {
    if (!map) return;
    const list = window.ThirdSpaces.getFiltered();
    const size = CFG.pin;
    const icon = L.divIcon({ className: 'ts-pin', html: '<span></span>', iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
    layer.clearLayers();
    const pts = []; let missing = 0;
    list.forEach(p => {
      const c = coordsFor(p);
      if (!c) { missing++; return; }
      const m = L.marker(c, { icon, keyboard: true, riseOnHover: true });
      const tip = document.createElement('span'); tip.textContent = p.name;
      m.bindTooltip(tip, { direction: 'top', offset: [0, -size / 2], className: 'ts-tip', opacity: 1 });
      m.on('add', () => { const el = m.getElement(); if (el) el.setAttribute('aria-label', 'View details for ' + p.name); });
      m.on('click', () => window.ThirdSpaces.openPlace(p.uid, m.getElement()));
      m.addTo(layer);
      pts.push(c);
    });
    if (fit && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 15 });
    const shown = pts.length;
    let txt = shown + (shown === 1 ? ' place' : ' places');
    if (loadError) txt = loadError;
    else if (geoBusy) txt += ' · locating more…';
    else if (missing) txt += ' · ' + missing + ' not placed yet';
    note(list.length ? txt : 'No places match those filters');
  }

  /* places with no coordinates are looked up one by one (polite: ~1 per second, capped, remembered) */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function geocodeMissing() {
    if (geoBusy || !map) return;
    const todo = window.ThirdSpaces.getFiltered().filter(p => p.address && !coordsFor(p) && !failed.has(keyOf(p)));
    if (!todo.length || geoDone >= CFG.geocodeMax) return;
    geoBusy = true; refresh(false);
    for (const p of todo) {
      if (geoDone >= CFG.geocodeMax || !visible()) break;
      geoDone++;
      const k = keyOf(p);
      try {
        const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=' + encodeURIComponent(p.address);
        const hit = (await (await fetch(url, { headers: { Accept: 'application/json' } })).json())[0];
        if (hit && valid(+hit.lat, +hit.lon)) { cache[k] = [+(+hit.lat).toFixed(6), +(+hit.lon).toFixed(6)]; saveCache(); }
        else failed.add(k);
      } catch (e) { failed.add(k); }
      refresh(false);
      await sleep(1100);
    }
    geoBusy = false; refresh(false);
  }

  /* build the map once it is actually on screen, then keep it in sync */
  async function sync() {
    if (!visible()) return;
    if (!map) {
      if (building) return;
      building = true;
      try { await loadLeaflet(); initMap(); loadError = ''; }
      catch (e) { loadError = 'The map could not load — check your connection and refresh'; note(loadError); building = false; return; }
      building = false;
    }
    map.invalidateSize();
    if (needsFit) { refresh(true); needsFit = false; } else refresh(false);
    geocodeMissing();
  }

  /* ------------------------------------------------------------ Grid / Map switch */
  function setMode(m) {
    m = m === 'map' ? 'map' : 'grid';
    body.dataset.indexMode = m;
    $('#viewGrid').setAttribute('aria-pressed', m === 'grid');
    $('#viewMap').setAttribute('aria-pressed', m === 'map');
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* private mode */ }
    if (m === 'map') { window.scrollTo(0, 0); requestAnimationFrame(sync); }
  }
  $('#viewGrid').addEventListener('click', () => setMode('grid'));
  $('#viewMap').addEventListener('click', () => setMode('map'));

  // the grid re-rendered (filters changed / sheet refreshed) → redraw the pins
  document.addEventListener('ts:render', () => {
    needsFit = true;
    if (visible() && map) { refresh(true); needsFit = false; geocodeMissing(); } else if (visible()) sync();
  });
  window.addEventListener('hashchange', () => requestAnimationFrame(sync));
  if (window.ResizeObserver) new ResizeObserver(() => {                  // sidebar collapse, window resize, view switches
    if (map && view.clientWidth > 0) map.invalidateSize();
    if (visible() && !map) sync();
  }).observe(view);

  let start = 'grid'; try { if (localStorage.getItem(MODE_KEY) === 'map') start = 'map'; } catch (e) { /* ignore */ }
  setMode(start);
})();
