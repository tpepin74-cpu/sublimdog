/* Sublim'dog — aide au devis : le chien (race, pelage, poids, état du poil), le soin et la prestation, la durée estimée
   d'après le tableau des temps du salon (window.SDT, tools/temps.py), les dates souhaitées, puis l'envoi par e-mail au salon. */
(() => {
  'use strict';
  const SD = window.SD, T = window.SDT;
  const form = document.getElementById('devis-form'); if (!form || !SD || !T) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const R = window.R || (u => u);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NB = '\u00a0';
  const KEY = 'sd-devis2';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
    del() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };
  const steps = $$('.step', form), LAST = 4, DONE = 5, MAXP = 3, MAXD = 3;
  const S = Object.assign({ prec: [], dates: [], canal: 'E-mail' }, store.get() || {});
  delete S.consent; delete S.site_web;
  const t0 = Date.now();
  let step = 0, files = [];

  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = t => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const hm = m => { if (m == null) return 'sur mesure'; const h = Math.floor(m / 60), mm = m % 60; return h && mm ? `${h}${NB}h${NB}${String(mm).padStart(2, '0')}` : h ? `${h}${NB}h` : `${mm}${NB}min`; };
  const span = (a, b) => (a == null ? 'sur mesure' : a === b ? hm(a) : `${hm(a)}${NB}à ${hm(b)}`);
  const svc = () => SD.services.find(s => s.slug === S.soin);
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const dLong = s => fromIso(s).toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' });
  const dowMon = d => (d.getDay() + 6) % 7;
  const ICON = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12 20 4l-4.5 16-3.5-6.5z"/><path d="M12 13.5 20 4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12h15M13.5 6l6 6-6 6"/></svg>',
    cut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.2 8 20 18.5M8.2 16 20 5.5"/></svg>',
    bath: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c3.2 4 5.2 6.9 5.2 9.7a5.2 5.2 0 0 1-10.4 0c0-2.8 2-5.7 5.2-9.7z"/><path d="M9.6 14.2a2.6 2.6 0 0 0 2.4 2.3"/></svg>',
    care: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.6 12 20 12 20z"/></svg>',
  };

  /* ----- tableau des temps : races, robes, prestations ----- */
  const CODES = T.codes.map(c => ({ id: c[0], name: c[1], kind: c[2], per: c[3] }));
  const BYID = Object.fromEntries(CODES.map(c => [c.id, c]));
  const BREEDS = T.b, GEN = BREEDS.find(b => /^Autre race/.test(b[0]));
  const byName = new Map(BREEDS.map(b => [norm(b[0]), b]));
  const SIZE_WORDS = new Set(['toy', 'nain', 'naine', 'moyen', 'moyenne', 'royal', 'royale', 'geant', 'mini', 'miniature', 'standard', 'petit', 'grand', 'de', 'du', 'a', 'poil']);
  function breedOf(v) {
    const q = norm(v); if (!q) return null;
    if (byName.has(q)) return byName.get(q);
    const words = q.split(' ').filter(w => w.length > 1 && !SIZE_WORDS.has(w)); if (!words.length) return null;
    const cand = BREEDS.filter(b => b !== GEN && words.every(w => norm(b[0]).split(' ').some(x => x.startsWith(w))));
    return cand.length === 1 ? cand[0] : null;
  }
  const dl = $('#races'); if (dl) dl.innerHTML = BREEDS.map(b => `<option value="${esc(b[0])}">`).join('');
  /* robes proposées : tous les pelages types, ceux de la race en tête (own = combien sont à elle) ;
     croisé ou race inconnue : les pelages types seuls */
  function robes() {
    const b = breedOf(S.race), breed = b && b !== GEN ? b : null;
    if (!breed || breed[1].length > 10) return { list: breed ? breed[1] : GEN[1], own: 0, breed };
    const mine = new Set(breed[1].map(x => x[1]));
    return { list: breed[1].concat(GEN[1].filter(x => !mine.has(x[1]))), own: breed[1].length, breed };
  }
  const robe = () => { const r = robes(), x = r.list[+S.robe]; return x && x[1] === S.pel ? x : null; };
  const codesOf = () => { const x = robe(); return x ? x[2].map(i => CODES[i].id) : []; };
  const poidsOk = () => S.poids != null && S.poids !== '';
  const W = () => +S.poids;

  /* ----- durées : prestation du tableau + ajustements (nœuds, mue, salissure, première visite, pauses) ----- */
  const bath = code => code === 'ARGILE' || (BYID[code] && (BYID[code].per === 'Bain seul' || BYID[code].per === 'Complet'));
  function base(code) {
    const w = W(), codes = codesOf();
    if (code === 'ARGILE') { const c = T.argile.find(x => codes.includes(x)); if (!c) return { m: null, conf: 2 }; const v = T.t[`${S.pel}|${c}`]; return v && v[0][w] != null ? { m: v[0][w] + T.pose, conf: v[1] } : { m: null, conf: 2 }; }
    const v = T.t[`${S.pel}|${code}`]; return v && v[0][w] != null ? { m: v[0][w], conf: v[1] } : { m: null, conf: 2 };
  }
  function adjust(code) {
    const w = W(), b = bath(code); let add = 0, conf = false, mesure = false;
    if (b && S.noeuds) {
      const n = T.noeuds.find(x => x[0] === S.noeuds);
      if (n) { if (n[2] == null) { if (S.noeuds === 'feutre') mesure = true; else conf = true; } else { add += n[2]; if (n[3]) conf = true; } }
    }
    (S.prec || []).forEach(id => {
      const p = T.prec.find(x => x[0] === id); if (!p || (p[5] && !b) || (id === 'mue' && code === 'S_MUE')) return;
      add += w <= 2 ? p[3] : p[4];
    });
    if (add >= T.seuil) conf = true;
    return { add, conf, mesure };
  }
  /* durée d'une prestation pour ce chien : { m: minutes | null (sur mesure), conf: à confirmer } ; null si le chien n'est pas encore décrit */
  function est(code) {
    if (!S.pel || !poidsOk()) return null;
    if (W() >= 6) return { m: null, conf: true };
    const b0 = base(code); if (b0.m == null) return { m: null, conf: true };
    const a = adjust(code); if (a.mesure) return { m: null, conf: true };
    return { m: b0.m + a.add, conf: b0.conf >= 1 || a.conf };
  }
  /* prestations d'un soin pour ce chien */
  function prestas(soin) {
    const codes = codesOf();
    if (soin === 'premier-toilettage-chiot') return codes.includes(T.chiot) ? [T.chiot] : [];
    if (soin === 'soin-argile') return T.argile.some(x => codes.includes(x)) ? ['ARGILE'] : [];
    if (soin === 'toilettage-exposition') return codes.filter(c => T.expo.includes(c));
    if (soin === 'entretien-coupe') return codes.filter(c => !T.expo.includes(c) && c !== T.chiot);
    return [];
  }
  /* fourchette d'un soin pour ce chien (avant le choix de la prestation) */
  function soinSpan(soin) {
    const list = prestas(soin).filter(c => c !== 'M_REMISE_CONFORT' && c !== 'S_HYGIENE').map(est).filter(x => x && x.m != null);
    if (!S.pel || !poidsOk()) return null;
    if (!list.length) return 'sur mesure';
    const ms = list.map(x => x.m); return span(Math.min(...ms), Math.max(...ms));
  }
  const prestaName = code => code === 'ARGILE' ? "Bain et soin à l'argile" : BYID[code] ? BYID[code].name : '';
  /* l'estimation affichée (barre, récapitulatif, e-mail) */
  function estimate() {
    if (!S.soin) return { txt: 'à préciser', conf: false };
    if (S.soin === 'conseil') return { txt: 'selon le soin conseillé', conf: true };
    if (!S.pel || !poidsOk()) return { txt: 'à préciser', conf: false };
    if (S.presta && S.presta !== 'conseil' && prestas(S.soin).includes(S.presta)) {
      const x = est(S.presta); return { txt: x.m == null ? 'sur mesure' : hm(x.m), conf: x.conf };
    }
    const sp = soinSpan(S.soin); return { txt: sp || 'à préciser', conf: true };
  }

  /* ----- photos : 3 au maximum, réduites avant l'envoi ----- */
  const drop = $('[data-drop]', form), input = $('[data-photos]', form), thumbs = $('[data-thumbs]', form);
  function renderThumbs() {
    thumbs.innerHTML = files.map((f, i) => `<li><img src="${f._url}" alt="Photo ${i + 1} de votre chien"><button type="button" class="thumb-x" data-rm="${i}" aria-label="Retirer la photo ${i + 1}">${ICON.x}</button></li>`).join('');
    drop.classList.toggle('is-full', files.length >= MAXP);
    input.disabled = files.length >= MAXP;
    render();
  }
  input.addEventListener('change', () => {
    Array.from(input.files || []).forEach(f => { if (/^image\//.test(f.type) && files.length < MAXP) { f._url = URL.createObjectURL(f); files.push(f); } });
    input.value = ''; renderThumbs();
  });
  thumbs.addEventListener('click', ev => {
    const b = ev.target.closest('[data-rm]'); if (!b) return;
    const f = files.splice(+b.dataset.rm, 1)[0]; if (f) URL.revokeObjectURL(f._url);
    renderThumbs(); input.focus();
  });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, () => drop.classList.add('is-over')));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('is-over')));
  const toBlob = (src, max = 1600) => new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), cv = document.createElement('canvas');
      cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      try { cv.toBlob(b => res(b), 'image/jpeg', .85); } catch (e) { res(null); }
    };
    im.onerror = () => res(null); im.src = src;
  });

  /* ----- pelage : dès la race choisie, tous les pelages, ceux de sa race en tête (présélectionné s'il n'y en a qu'un) ----- */
  function renderRobes() {
    const box = $('[data-robes]', form), help = $('[data-robes-help]', form);
    const r = robes(), key = r.breed ? r.breed[0] : '';
    if (S.robeFor !== key) { S.robeFor = key; S.robe = ''; S.pel = ''; }   // nouvelle race : on repart de ses pelages
    if (r.own === 1 && S.robe === '') { S.robe = '0'; S.pel = r.list[0][1]; }
    if (!robe()) { S.robe = ''; S.pel = ''; }
    const item = (x, i) => {
      const hint = i >= r.own && T.pel[x[1]] ? T.pel[x[1]][1] : '';   // exemples de races : seulement hors de sa race
      return `<label><input type="radio" name="robe" value="${i}"${String(i) === String(S.robe) ? ' checked' : ''}>${esc(x[0])}${hint && hint !== x[0] ? `<small>${esc(hint)}</small>` : ''}</label>`;
    };
    const group = (title, from, to, cls) => `${title ? `<p class="robe-group">${title}</p>` : ''}<div class="seg seg-robes${cls}">${r.list.slice(from, to).map((x, k) => item(x, from + k)).join('')}</div>`;
    const race = r.breed ? r.breed[0].toLowerCase() : '';
    box.innerHTML = r.own
      ? group(r.own > 1 ? `Les pelages du ${esc(race)}` : `Le pelage du ${esc(race)}`, 0, r.own, ' is-own') + group('Tous les autres pelages', r.own, r.list.length, '')
      : group('', 0, r.list.length, '');
    help.textContent = r.own === 1 ? 'Son pelage type est coché. S’il est différent, choisissez le sien.'
      : r.own ? 'Choisissez le sien : ceux de sa race sont en tête.'
      : r.breed ? `Tous les pelages se voient chez le ${race} : choisissez celui qui lui ressemble le plus.`
      : S.race && S.race.trim() ? 'Race hors de notre liste ou croisée : choisissez le pelage qui lui ressemble le plus.' : 'Indiquez sa race, ou choisissez le pelage qui lui ressemble le plus.';
  }

  /* ----- soins et prestations ----- */
  function renderSoins() {
    $$('[data-dur]', form).forEach(el => { const sp = soinSpan(el.dataset.dur); el.textContent = sp ? sp : (SD.services.find(s => s.slug === el.dataset.dur) || {}).duration || ''; });
  }
  function prestaItem(code, checked, info) {
    const x = est(code), c = BYID[code];
    const ph = T.photos[`${S.pel}|${code}`] || T.photos[`*|${code}`];
    const media = ph ? `<img src="${R(ph)}" alt="" width="400" height="500" loading="lazy">` : (code[0] === 'C' ? ICON.cut : code[0] === 'M' ? ICON.care : ICON.bath);
    const what = code === 'ARGILE' ? 'Bain, argile laissée poser, séchage et petits soins' : code === T.chiot ? 'Sans toilettage complet, au rythme du chiot'
      : !c ? '' : c.per === 'Bain seul' ? 'Sans coupe ni petits soins' : c.per === 'Soin isolé' ? 'Sans bain' : c.per === 'Sur mesure' ? 'Après examen du pelage' : code[0] === 'C' ? 'Bain, coupe et finitions compris' : 'Bain, séchage, brossage et petits soins';
    const inner = `<span class="presta-media${ph ? '' : ' is-ic'}" aria-hidden="true">${media}</span>
      <span class="presta-body"><strong>${esc(prestaName(code))}</strong><small>${what}</small></span>
      <span class="presta-dur">${x ? (x.m == null ? 'sur mesure' : hm(x.m)) : ''}${x && x.m != null && x.conf ? '<small>à confirmer</small>' : ''}</span>`;
    return info ? `<div class="presta is-info">${inner}</div>` : `<label class="presta"><input type="radio" name="presta" value="${code}"${checked ? ' checked' : ''}>${inner}</label>`;
  }
  function renderPresta() {
    const box = $('[data-presta-box]', form), list = $('[data-presta]', form), leg = $('[data-presta-legend]', form);
    if (!S.soin || S.soin === 'conseil') { box.hidden = true; S.presta = ''; return; }
    box.hidden = false;
    if (!S.pel || !poidsOk()) {
      list.innerHTML = `<p class="muted small presta-empty">Indiquez son pelage et son poids à l’étape « Chien » pour voir les durées. <button type="button" class="accent" data-goto="0">Revenir à l’étape Chien</button></p>`;
      leg.textContent = 'La prestation'; return;
    }
    const ps = prestas(S.soin);
    if (S.soin === 'premier-toilettage-chiot' || S.soin === 'soin-argile') {
      S.presta = ps[0] || '';
      leg.textContent = 'Ce qui est prévu';
      list.innerHTML = ps.length ? prestaItem(ps[0], true, true) : `<p class="muted small presta-empty">Pour ce pelage, Allison définit le soin avec vous : la durée est sur mesure.</p>`;
      return;
    }
    leg.textContent = S.soin === 'toilettage-exposition' ? 'La toilette de race' : 'La prestation';
    if (!ps.includes(S.presta) && S.presta !== 'conseil') S.presta = '';
    if (!ps.length) {
      list.innerHTML = `<p class="muted small presta-empty">Pas de toilette de race type pour ce pelage : Allison définit la toilette avec vous, sur mesure.</p>`;
      S.presta = 'conseil'; return;
    }
    const groups = [['Sans coupe', ps.filter(c => c[0] === 'X' || c[0] === 'S')], ['Avec coupe', ps.filter(c => c[0] === 'C')], ['Pelage très noué', ps.filter(c => c[0] === 'M')]].filter(g => g[1].length);
    list.innerHTML = groups.map(([t, cs]) => `<p class="presta-group">${t}</p><div class="presta-list">${cs.map(c => prestaItem(c, S.presta === c)).join('')}</div>`).join('')
      + `<div class="presta-list" style="margin-top:8px"><label class="presta presta-help"><input type="radio" name="presta" value="conseil"${S.presta === 'conseil' ? ' checked' : ''}><span class="presta-media is-ic" aria-hidden="true">${ICON.care}</span><span class="presta-body"><strong>Je ne sais pas encore</strong><small>Allison vous conseille</small></span><span class="presta-dur"></span></label></div>`;
  }

  /* ----- créneaux : les disponibilités du salon (son agenda, lu par /creneaux.php, ou ses horaires d'ouverture)
     croisées avec la durée du soin calculée pour ce chien. Le client choisit jusqu'à 3 créneaux souhaités. ----- */
  const CF = Object.assign({ endpoint: '', step: 30, lead: 1, days: 70, fallback: 120, closed: [] }, SD.slots || {});
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const hT = m => `${Math.floor(m / 60)}${NB}h${NB}${pad(m % 60)}`;
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  const dShort = s => fromIso(s).toLocaleDateString('fr-CH', { weekday: 'short', day: 'numeric', month: 'short' });
  const AV = { state: 'idle', source: '', busy: {}, today: null, updated: '', stale: false };
  delete S.dates; delete S.moment;
  S.slots = Array.isArray(S.slots) ? S.slots.filter(x => x && x.d && x.s != null) : [];
  let view = null, slotNote = '';

  function loadAvail() {
    if (AV.state !== 'idle') return;
    AV.state = 'loading';
    const done = j => {
      AV.state = 'ready'; AV.source = j ? j.source : (CF.endpoint ? 'injoignable' : 'horaires');
      AV.busy = (j && j.busy) || {}; AV.updated = (j && j.updated) || ''; AV.stale = !!(j && j.stale);
      const t = j && /^\d{4}-\d{2}-\d{2}$/.test(j.today || '') ? fromIso(j.today) : new Date(); t.setHours(0, 0, 0, 0); AV.today = t;
      S.slots = S.slots.filter(x => fromIso(x.d) >= firstDay());
      if (step === 2) renderSlots();
    };
    if (!CF.endpoint || !window.fetch) { done(null); return; }
    const ctl = window.AbortController ? new AbortController() : null, timer = setTimeout(() => ctl && ctl.abort(), 9000);
    fetch(R(CF.endpoint), { signal: ctl ? ctl.signal : undefined, headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null)).catch(() => null)
      .then(j => { clearTimeout(timer); done(j && j.ok ? j : null); });
  }
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const firstDay = () => addDays(AV.today || new Date(), CF.lead);
  const lastDay = () => addDays(AV.today || new Date(), CF.days);
  const ranges = d => (SD.hours[dowMon(d)] || []).map(([a, b]) => [toMin(a), toMin(b)]);
  const dayOpen = d => d >= firstDay() && d <= lastDay() && ranges(d).length > 0 && !CF.closed.includes(iso(d));

  /* durée à prévoir dans l'agenda : la prestation choisie, sinon la plus longue du soin, sinon une durée type */
  function plan() {
    if (S.soin && S.soin !== 'conseil' && S.pel && poidsOk()) {
      const ps = prestas(S.soin);
      if (S.presta && S.presta !== 'conseil' && ps.includes(S.presta)) { const x = est(S.presta); if (x && x.m != null) return { m: x.m, conf: x.conf, what: prestaName(S.presta) }; }
      const list = ps.filter(c => c !== 'M_REMISE_CONFORT' && c !== 'S_HYGIENE').map(est).filter(x => x && x.m != null);
      if (list.length) return { m: Math.max(...list.map(x => x.m)), conf: true, what: (svc() || {}).short || '', upper: true };
    }
    return { m: CF.fallback, conf: true, unknown: true, what: S.soin === 'conseil' ? 'Soin à conseiller' : (svc() || {}).short || '' };
  }
  const need = () => Math.ceil(plan().m / 15) * 15;
  /* le soin tient-il s'il commence à « start » ? → heure de fin, ou null. Un soin plus court que la demi-journée y tient en entier ;
     un soin plus long continue après la pause de midi. Aucune minute de travail ne chevauche une plage occupée. */
  function fit(d, start, D) {
    const rs = ranges(d), i = rs.findIndex(([a, b]) => start >= a && start < b); if (i < 0) return null;
    const over = D > rs[i][1] - rs[i][0], busy = AV.busy[iso(d)] || [];
    let left = D, t = start;
    for (let k = i; k < rs.length && left > 0; k++) {
      if (k > i && !over) return null;
      const a = Math.max(t, rs[k][0]), take = Math.min(left, rs[k][1] - a); if (take <= 0) continue;
      if (busy.some(([x, y]) => a < y && x < a + take)) return null;
      left -= take; t = a + take;
    }
    return left > 0 ? null : t;
  }
  function daySlots(d, D) {
    if (!dayOpen(d)) return [];
    const out = [];
    ranges(d).forEach(([a, b]) => { for (let s = a; s < b; s += CF.step) { const e = fit(d, s, D); if (e != null) out.push([s, e]); } });
    return out;
  }
  const slotKey = x => `${x.d}|${x.s}`;
  const slotText = (x, D) => { const e = fit(fromIso(x.d), x.s, D); return `${cap(dLong(x.d))}, ${hT(x.s)}${e != null ? ` – ${hT(e)}` : ''}`; };
  const picked = () => S.slots.slice().sort((a, b) => slotKey(a) < slotKey(b) ? -1 : 1);

  function renderSlots() {
    const box = $('[data-slots]', form); if (!box) return;
    const P = plan(), D = need();
    const src = { agenda: AV.stale ? 'D’après l’agenda du salon (copie de ce jour)' : 'En direct de l’agenda du salon', demo: 'Agenda de démonstration (aperçu du site)',
                  horaires: 'D’après les horaires d’ouverture : Allison confirme selon son agenda', injoignable: 'Agenda momentanément injoignable : créneaux d’après les horaires d’ouverture' }[AV.source] || '';
    $('[data-plan]', box).innerHTML = `<div class="plan-dur"><span class="plan-k">Durée prévue</span><strong>${hm(D)}</strong>${P.conf ? '<small>à confirmer</small>' : ''}</div>
      <p class="plan-what">${P.unknown ? `${P.what ? esc(P.what) + ' : ' : ''}durée à définir avec Allison, nous prévoyons ${hm(D)}.` : `${esc(P.what)}${P.upper ? ' : la plus longue prestation du soin' : ''} pour ${esc(S.chien || 'votre chien')}.`}
        <button type="button" class="accent" data-goto="1">Modifier</button></p>
      ${AV.state === 'ready' ? `<p class="plan-src is-${AV.source}"><span class="dot" aria-hidden="true"></span>${src}</p>` : ''}`;
    const cal = $('[data-cal]', box), times = $('[data-times]', box), quick = $('[data-quick]', box);
    if (AV.state !== 'ready') {
      cal.innerHTML = '<p class="muted small slots-wait">Chargement des disponibilités…</p>'; times.innerHTML = ''; quick.innerHTML = ''; renderPicked(D); return;
    }
    const before = S.slots.length;
    S.slots = S.slots.filter(x => dayOpen(fromIso(x.d)) && fit(fromIso(x.d), x.s, D) != null);
    if (S.slots.length < before) slotNote = 'Un créneau choisi ne convient plus à la durée du soin : il a été retiré.';
    // jour affiché : celui choisi s'il a encore de la place, sinon le premier jour libre
    const free = [];
    for (let d = firstDay(); d <= lastDay() && free.length < 60; d = addDays(d, 1)) { const sl = daySlots(d, D); if (sl.length) free.push([iso(d), sl]); }
    if (!S.day || !free.some(f => f[0] === S.day)) S.day = free.length ? free[0][0] : '';
    if (!view) { view = S.day ? fromIso(S.day) : firstDay(); view.setDate(1); }
    // les prochains créneaux libres, un par jour
    quick.innerHTML = free.length ? `<span class="quick-k">Au plus tôt</span>${free.slice(0, 3).map(([d, sl]) => {
      const on = S.slots.some(x => x.d === d && x.s === sl[0][0]);
      return `<button type="button" class="quick" data-slot="${d}|${sl[0][0]}" aria-pressed="${on}" aria-label="${esc(cap(dLong(d)))}, ${hT(sl[0][0])}">${esc(cap(dShort(d)))} · ${hT(sl[0][0])}</button>`;
    }).join('')}` : '';
    // le mois
    const y = view.getFullYear(), m = view.getMonth(), first = new Date(y, m, 1), lead = dowMon(first), days = new Date(y, m + 1, 0).getDate();
    const prevOk = new Date(y, m, 0) >= firstDay(), nextOk = new Date(y, m + 1, 1) <= lastDay();
    let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span class="cal-dow" aria-hidden="true">${d}</span>`).join('');
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let n = 1; n <= days; n++) {
      const d = new Date(y, m, n), s = iso(d), open = dayOpen(d), n2 = open ? daySlots(d, D).length : 0;
      const mine = S.slots.filter(x => x.d === s).length, lvl = n2 >= 9 ? 3 : n2 >= 4 ? 2 : n2 ? 1 : 0;
      const label = `${d.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long' })}, ${!open ? (d < firstDay() || d > lastDay() ? 'non proposé' : 'salon fermé') : n2 ? `${n2} créneau${n2 > 1 ? 'x' : ''}` : 'complet'}${mine ? `, ${mine} choisi${mine > 1 ? 's' : ''}` : ''}`;
      cells += `<button type="button" class="day${mine ? ' has-pick' : ''}${open && !n2 ? ' is-full' : ''}" data-day="${s}" ${n2 ? '' : 'disabled'} aria-pressed="${s === S.day}" aria-label="${label}">${n}<i class="lvl l${lvl}" aria-hidden="true"></i></button>`;
    }
    cal.innerHTML = `<div class="cal-head"><strong>${first.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })}</strong>
      <div class="cal-nav"><button type="button" data-m="-1" ${prevOk ? '' : 'disabled'} aria-label="Mois précédent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M14.5 6 8.5 12l6 6"/></svg></button>
      <button type="button" data-m="1" ${nextOk ? '' : 'disabled'} aria-label="Mois suivant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9.5 6l6 6-6 6"/></svg></button></div></div>
      <div class="cal-grid">${cells}</div>
      <p class="cal-legend" aria-hidden="true"><span><i class="lvl l3"></i>Beaucoup de place</span><span><i class="lvl l1"></i>Peu de place</span></p>`;
    // les heures du jour affiché
    if (!S.day) {
      times.innerHTML = `<p class="times-empty">Aucun créneau libre de ${hm(D)} dans les ${Math.round(CF.days / 7)} prochaines semaines. Cochez « Je suis flexible » : Allison vous propose une date.</p>`;
    } else {
      const sl = daySlots(fromIso(S.day), D), am = sl.filter(x => x[0] < 720), pm = sl.filter(x => x[0] >= 720);
      const btn = ([s, e]) => { const on = S.slots.some(x => x.d === S.day && x.s === s);
        return `<button type="button" class="slot" data-slot="${S.day}|${s}" aria-pressed="${on}" aria-label="${esc(cap(dLong(S.day)))}, ${hT(s)}, reprise vers ${hT(e)}"><strong>${hT(s)}</strong><small>reprise vers ${hT(e)}</small></button>`; };
      times.innerHTML = `<div class="times-head"><strong>${esc(cap(dLong(S.day)))}</strong><span>${sl.length} créneau${sl.length > 1 ? 'x' : ''} de ${hm(D)}</span></div>
        ${am.length ? `<p class="times-k">Matin</p><div class="times-list">${am.map(btn).join('')}</div>` : ''}
        ${pm.length ? `<p class="times-k">Après-midi</p><div class="times-list">${pm.map(btn).join('')}</div>` : ''}`;
    }
    renderPicked(D);
  }
  function renderPicked(D) {
    const p = $('[data-picked]', form); if (!p) return;
    const list = picked();
    p.innerHTML = list.length ? `<p class="picked-k">Vos créneaux souhaités <span>${list.length} sur ${MAXD}</span></p><ol class="picked-list">${list.map(x =>
      `<li><span>${esc(slotText(x, D))}</span><button type="button" class="thumb-x" data-unslot="${slotKey(x)}" aria-label="Retirer ${esc(slotText(x, D))}">${ICON.x}</button></li>`).join('')}</ol>` : '';
    err('dates', slotNote); slotNote = '';
  }
  function toggleSlot(key) {
    const [d, s] = key.split('|'), at = S.slots.findIndex(x => x.d === d && x.s === +s);
    if (at >= 0) S.slots.splice(at, 1);
    else if (S.slots.length >= MAXD) { slotNote = 'Trois créneaux au maximum : retirez-en un pour en choisir un autre.'; renderPicked(need()); return; }
    else { S.slots.push({ d, s: +s }); S.day = d; view = fromIso(d); view.setDate(1); }
    renderSlots(); save(); render();
  }

  /* ----- champs ----- */
  function hydrate() {
    $$('input,select,textarea', form).forEach(el => {
      const k = el.name; if (!k || k === 'consent' || k === 'site_web' || el.type === 'file') return;
      if (el.type === 'radio') el.checked = String(S[k]) === el.value;
      else if (el.type === 'checkbox' && k === 'prec') el.checked = (S.prec || []).includes(el.value);
      else if (el.type === 'checkbox') el.checked = !!S[k];
      else el.value = S[k] != null ? S[k] : '';
    });
  }
  const save = () => { const { consent, site_web, ...s } = S; store.set(s); };
  form.addEventListener('input', ev => {
    const el = ev.target, k = el.name; if (!k || k === 'site_web' || el.type === 'file') return;
    if (k === 'prec') S.prec = $$('input[name=prec]:checked', form).map(x => x.value);
    else if (el.type === 'checkbox') S[k] = el.checked;
    else if (el.type === 'radio') { if (el.checked) S[k] = el.value; }
    else S[k] = el.value;
    el.removeAttribute('aria-invalid');
    if (k === 'race') renderRobes();
    if (k === 'robe') { const x = robes().list[+S.robe]; S.pel = x ? x[1] : ''; err('pel'); }
    if (k === 'poids') err('poids');
    if (k === 'soin') { err('soin'); S.presta = ''; renderPresta(); }
    if (k === 'presta') err('presta');
    if (['robe', 'poids', 'noeuds', 'prec', 'race'].includes(k)) { renderSoins(); if (step === 1) renderPresta(); }
    save(); render();
  });
  form.addEventListener('click', ev => {
    const m = ev.target.closest('[data-m]');
    if (m && view) { view.setMonth(view.getMonth() + (+m.dataset.m)); renderSlots(); const again = $(`[data-m="${m.dataset.m}"]`, form); if (again && !again.disabled) again.focus(); return; }
    const d = ev.target.closest('[data-day]');
    if (d && !d.disabled) {
      S.day = d.dataset.day; renderSlots(); save();
      const again = $(`[data-day="${S.day}"]`, form); if (again) again.focus();
      const t = $('[data-times]', form);   // petit écran : les heures sont sous le calendrier
      if (t && t.getBoundingClientRect().top > innerHeight - 140) t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    const sl = ev.target.closest('[data-slot]');
    if (sl) {
      const k = sl.dataset.slot, quick = sl.classList.contains('quick'); toggleSlot(k);
      const again = $(`${quick ? '.quick' : '.slot'}[data-slot="${k}"]`, form) || $(`.slot[data-slot="${k}"]`, form); if (again) again.focus();
      return;
    }
    const un = ev.target.closest('[data-unslot]');
    if (un) { toggleSlot(un.dataset.unslot); const f = $('[data-picked] [data-unslot]', form) || $('.slot', form); if (f) f.focus(); return; }
    const g = ev.target.closest('[data-goto]'); if (g) { go(+g.dataset.goto); }
  });

  /* ----- validation ----- */
  function err(k, msg) { const p = $(`[data-err="${k}"]`, form); if (p) p.textContent = msg || ''; }
  function invalid(name, k, msg) { const el = $(`[name="${name}"]`, form); if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); } if (k) err(k, msg); return false; }
  function validate(i) {
    ['pel', 'poids', 'soin', 'presta', 'dates', 'contact'].forEach(k => err(k));
    if (i === 0) {
      if (!S.chien || !S.chien.trim()) return invalid('chien');
      if (!S.pel) { err('pel', 'Choisissez son pelage, ou « Je ne sais pas » : il fait la durée du soin.'); const r = $('[name=robe]', form); if (r) r.focus(); return false; }
      if (!poidsOk()) { err('poids', 'Indiquez son poids, même approximatif.'); $('[name=poids]', form).focus(); return false; }
    }
    if (i === 1) {
      if (!S.soin) { err('soin', 'Choisissez un soin, ou « Je ne sais pas encore ».'); $('[name=soin]', form).focus(); return false; }
      const ps = prestas(S.soin);
      if ((S.soin === 'entretien-coupe' || S.soin === 'toilettage-exposition') && ps.length && !S.presta) {
        err('presta', 'Choisissez une prestation, ou « Je ne sais pas encore ».'); const r = $('[name=presta]', form); if (r) r.focus(); return false;
      }
    }
    if (i === 2 && !S.slots.length && !S.flex) { err('dates', 'Choisissez au moins un créneau, ou cochez « Je suis flexible ».'); const f = $('.slot', form) || $('[name=flex]', form); if (f) f.focus(); return false; }
    if (i === 3) {
      if (!S.prenom || !S.prenom.trim()) return invalid('prenom', 'contact', 'Indiquez votre prénom.');
      if (!S.nom || !S.nom.trim()) return invalid('nom', 'contact', 'Indiquez votre nom.');
      if (!S.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(S.email)) return invalid('email', 'contact', 'Indiquez une adresse e-mail valide : le devis vous y sera envoyé.');
      if (!S.tel || S.tel.replace(/\D/g, '').length < 9) return invalid('tel', 'contact', 'Indiquez un numéro de téléphone valide.');
      if (!$('[name=consent]', form).checked) { err('contact', 'Merci d’accepter l’utilisation de ces informations pour établir le devis.'); $('[name=consent]', form).focus(); return false; }
    }
    return true;
  }

  /* ----- récapitulatif ----- */
  const poidsTxt = () => (!poidsOk() ? '' : W() >= 6 ? 'plus de 60 kg' : T.poids[W()]);
  const noeudsTxt = () => { const n = T.noeuds.find(x => x[0] === S.noeuds); return n ? n[1] : ''; };
  const precTxt = () => (S.prec || []).map(id => (T.prec.find(x => x[0] === id) || [])[1]).filter(Boolean);
  const prestaTxt = () => (S.presta === 'conseil' ? 'À conseiller par Allison' : S.presta ? prestaName(S.presta) : '');
  function rows(full) {
    const s = svc(), x = robe();
    const r = [['Chien', S.chien ? `${S.chien}${S.race ? ', ' + S.race : ''}` : (S.race || '—')]];
    r.push(['Pelage', x ? x[0] : '—'], ['Poids', poidsTxt() || '—']);
    if (S.noeuds) r.push(['Nœuds', noeudsTxt()]);
    if (precTxt().length) r.push(['Bon à savoir', precTxt().join(' · ')]);
    if (full && S.notes) r.push(['Remarques', S.notes]);
    r.push(['Soin', S.soin === 'conseil' ? 'À conseiller par Allison' : s ? s.short : '—']);
    if (S.soin && S.soin !== 'conseil' && prestaTxt()) r.push(['Prestation', prestaTxt()]);
    if (S.idee) r.push(['Votre idée', S.idee]);
    const D = need();
    r.push([S.slots.length > 1 ? 'Créneaux souhaités' : 'Créneau souhaité', S.slots.length ? picked().map(x => slotText(x, D)).join(' · ') : (S.flex ? 'Flexible' : '—')]);
    if (full) {
      if (S.flex && S.slots.length) r.push(['Flexible', 'Oui']);
      r.push(['Photos', files.length ? `${files.length} jointe${files.length > 1 ? 's' : ''}` : 'Aucune']);
      r.push(['Contact', [S.prenom, S.nom].filter(Boolean).join(' ') + (S.email ? ' · ' + S.email : '') + (S.tel ? ' · ' + S.tel : '')], ['Réponse par', S.canal || 'E-mail']);
    }
    return r;
  }
  const estTxt = () => { const x = estimate(); return x.txt + (x.conf && !/^(à préciser|sur mesure|selon)/.test(x.txt) ? ' (à confirmer)' : ''); };
  function recapHTML(full) {
    const s = svc(), x = estimate();
    const photo = files[0] ? files[0]._url : null;
    const media = photo ? `<div class="recap-media"><img src="${photo}" alt=""></div>` : s ? `<div class="recap-media is-stk" style="background:${s.bg}"><img src="${R(s.img)}" alt=""></div>` : '';
    return `<div class="recap">${media}<div class="recap-body"><h3>${S.chien ? 'Le devis de ' + esc(S.chien) : 'Votre demande de devis'}</h3>
      <dl>${rows(full).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <div class="total"><span>Durée estimée</span><strong>${esc(x.txt)}</strong></div>
      <p class="recap-note">${x.conf ? 'Durée indicative, à confirmer par Allison selon l’état réel du pelage.' : 'Durée indicative, marge comprise. Le prix vous est donné avec le devis.'}</p></div></div>`;
  }
  function render() {
    const r = $('[data-recap]'); if (r) r.innerHTML = recapHTML(false);
    const rm = $('[data-recap-main]', form); if (rm && step === LAST) rm.innerHTML = recapHTML(true);
    $('[data-sum-title]', form).textContent = S.chien ? `Le devis de ${S.chien}` : 'Votre devis';
    $('[data-sum-sub]', form).textContent = `Durée estimée : ${estimate().txt}`;
  }

  /* ----- étapes ----- */
  const labels = ['Votre chien', 'Le soin', 'Vos dates', 'Vos coordonnées', 'Envoi'];
  function go(i, noFocus) {
    step = Math.max(0, Math.min(DONE, i));
    steps.forEach(s => s.classList.toggle('is-active', +s.dataset.step === step));
    $$('.progress li', form).forEach((li, k) => { li.classList.toggle('done', k < step); li.classList.toggle('now', k === step); });
    $('[data-prev]', form).hidden = step === 0 || step === DONE;
    const next = $('[data-next]', form);
    next.disabled = false;
    next.innerHTML = step === LAST ? `Envoyer ma demande ${ICON.send}` : `Continuer ${ICON.arrow}`;
    $('[data-bar]', form).style.display = step === DONE ? 'none' : '';
    $('.progress', form).style.display = step === DONE ? 'none' : '';
    if (step === 1) { renderSoins(); renderPresta(); }
    if (step >= 1) loadAvail();
    if (step === 2) renderSlots();
    render();
    if (step < DONE) $('#step-live').textContent = `Étape ${step + 1} sur 5 : ${labels[step]}`;
    if (!noFocus) {
      const top = form.getBoundingClientRect().top + scrollY - 90;
      if (scrollY > top) scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
      const h = $('.step.is-active h2', form); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
  }
  $('[data-prev]', form).addEventListener('click', () => go(step - 1));
  $('[data-next]', form).addEventListener('click', () => {
    if (step < LAST) { if (validate(step)) go(step + 1); return; }
    for (let i = 0; i < LAST; i++) if (!validate(i)) { go(i); validate(i); return; }
    submit();
  });
  form.addEventListener('submit', ev => ev.preventDefault());

  /* ----- envoi ----- */
  function message() {
    return ['Bonjour Allison, voici ma demande de devis :', ...rows(true).map(([k, v]) => `• ${k} : ${v}`), `• Durée estimée par le site : ${estTxt()}`, 'Merci !'].join('\n');
  }
  function fields() {
    const s = svc(), x = robe();
    return {
      chien: S.chien, race: S.race, pelage: x ? x[0] : '', poids: poidsTxt(), noeuds: noeudsTxt(), precisions: precTxt().join(', '), notes: S.notes,
      soin: S.soin === 'conseil' ? 'À conseiller par Allison' : s ? s.name : '', prestation: S.soin === 'conseil' ? '' : prestaTxt(), idee: S.idee,
      creneaux: picked().map((x, i) => `${i + 1}. ${slotText(x, need())}`).join('\n'), flex: S.flex ? 'Oui' : 'Non', duree_prevue: hm(need()),
      agenda: { agenda: 'libres dans votre agenda au moment de la demande', demo: 'agenda de démonstration', horaires: 'd’après les horaires seulement (agenda non relié au site)', injoignable: 'd’après les horaires seulement (agenda injoignable)' }[AV.source] || '',
      prenom: S.prenom, nom: S.nom, email: S.email, tel: S.tel, canal: S.canal || 'E-mail', duree: estTxt(), resume: message(),
    };
  }
  async function submit() {
    const next = $('[data-next]', form); next.disabled = true; next.textContent = 'Envoi en cours…';
    let ok = false;
    if (SD.endpoint) {
      try {
        const fd = new FormData();
        Object.entries(fields()).forEach(([k, v]) => fd.append(k, v || ''));
        fd.append('site_web', form.site_web.value); fd.append('t', String(Date.now() - t0));
        for (let i = 0; i < files.length; i++) { const b = await toBlob(files[i]._url) || files[i]; if (b) fd.append('photos[]', b, `photo-${i + 1}.jpg`); }
        const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 45000);
        const r = await fetch(R(SD.endpoint), { method: 'POST', body: fd, signal: ctl.signal }); clearTimeout(timer);
        const j = await r.json(); ok = r.ok && j && j.ok === true;
      } catch (e) { ok = false; }
    }
    done(ok);
  }
  function done(ok) {
    const box = $('[data-done]', form); const msg = encodeURIComponent(message());
    const tel = `<a class="btn btn-2" href="tel:${SD.site.tel_e164}">Appeler le salon</a>`;
    if (ok) {
      box.innerHTML = `<img class="logo" src="${R('/assets/brand/logo.svg')}" alt="" width="110" height="110"><h2 id="s5">Merci, votre demande est envoyée !</h2>
        <p class="muted">Allison l’étudie et vous répond ${S.canal === 'E-mail' || !S.canal ? 'par e-mail' : 'par ' + S.canal.toLowerCase()} avec votre devis.</p>
        <div class="done-actions"><a class="btn" href="${R('/')}">Retour à l’accueil</a>${tel}</div>`;
      store.del();
    } else {
      const subj = encodeURIComponent(`Demande de devis${S.chien ? ' pour ' + S.chien : ''}`);
      box.innerHTML = `<img class="logo" src="${R('/assets/brand/logo.svg')}" alt="" width="110" height="110"><h2 id="s5">Votre demande est prête</h2>
        <p class="muted">L’envoi automatique n’a pas abouti. Envoyez-la en un geste${files.length ? ', en joignant les photos de votre chien' : ''} :</p>
        <div class="done-actions"><a class="btn" href="mailto:${SD.site.email_devis}?subject=${subj}&body=${msg}">Envoyer par e-mail</a>
        <a class="btn btn-2" href="https://wa.me/${SD.site.whatsapp}?text=${msg}" target="_blank" rel="noopener">Envoyer par WhatsApp</a>${tel}</div>`;
    }
    go(DONE);
  }

  /* ----- démarrage : ?soin= (cartes des soins, toiletteur en ligne) ?race= ----- */
  const q = new URLSearchParams(location.search);
  const OLD = { 'bain-spa': 'soin-argile', 'forfaits-conseils': 'conseil' };
  const qs = OLD[q.get('soin')] || q.get('soin');
  if (qs && (SD.services.some(s => s.slug === qs) || qs === 'conseil')) { if (S.soin !== qs) S.presta = ''; S.soin = qs; }
  if (q.get('race')) S.race = q.get('race').slice(0, 60);
  delete S.autrePel;
  renderRobes(); hydrate(); save(); renderThumbs(); renderSoins(); go(0, true);
})();
