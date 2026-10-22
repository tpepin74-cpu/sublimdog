/* Sublim'dog — interactions du site (sans dépendance) */
(() => {
  'use strict';
  const SD = window.SD || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const R = window.R || (u => u);
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };

  document.documentElement.classList.remove('no-js');

  /* ---------- Menu liquide : encoche + bulle à ressort qui suivent la souris, le clavier, le doigt et le défilement ---------- */
  const scrollToEl = el => el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  const dockEl = $('[data-dock]');
  const Dock = dockEl ? (() => {
    const svg = $('.dock-shape', dockEl), path = $('path', svg), bubble = $('.dock-bubble', dockEl), label = $('.dock-label', dockEl);
    const items = $$('.dock-item', dockEl), page = +dockEl.dataset.active, onHome = dockEl.hasAttribute('data-home');
    let W = 0, H = 0, x = 0, v = 0, target = 0, raf = 0, last = 0, near = null, centers = [];
    let cur = page, peek = -1, shown = -1, going = false, respy = () => {}, B = 56, NW = 40, ND = 38, lw = 0;
    const RC = 24, K = 260, C = 22;   // coins ; ressort (raideur, amortissement) ; bulle B, encoche NW × ND : selon la place (measure)
    const shape = (cx, s) => {
      const w = NW + s * 12, d = ND - s * 9, a = Math.max(RC, cx - w), b = Math.min(W - RC, cx + w);
      const ca = cx - (cx - a) / 2, cb = cx + (b - cx) / 2;   // près d'un bord, l'encoche se resserre de ce côté au lieu de boucler
      return `M ${RC} 0 H ${a} C ${ca} 0 ${ca} ${d} ${cx} ${d} C ${cb} ${d} ${cb} 0 ${b} 0 H ${W - RC} Q ${W} 0 ${W} ${RC} V ${H - RC} Q ${W} ${H} ${W - RC} ${H} H ${RC} Q 0 ${H} 0 ${H - RC} V ${RC} Q 0 0 ${RC} 0 Z`;
    };
    const draw = (s = 0) => {
      path.setAttribute('d', shape(x, s));
      bubble.style.transform = `translateX(${x - B / 2}px) scale(${1 + s * .28}, ${1 - s * .14})`;
      label.style.transform = `translateX(${Math.max(10, Math.min(W - lw - 10, x - lw / 2))}px)`;   // l'étiquette reste dans la barre
      label.style.opacity = String(1 - Math.min(1, s * 2.5));
    };
    const step = now => {
      const dt = Math.min(.032, (now - last) / 1000); last = now;
      v += (K * (target - x) - C * v) * dt; x += v * dt;
      draw(Math.min(1, Math.abs(v) / 900));
      if (near && Math.abs(target - x) < 10) { const f = near; near = null; f(); }
      if (Math.abs(target - x) < .3 && Math.abs(v) < 6) { x = target; v = 0; draw(); raf = 0; return; }
      raf = requestAnimationFrame(step);
    };
    const run = instant => {
      if (reduce || instant) { cancelAnimationFrame(raf); raf = 0; x = target; v = 0; draw(); if (near) { const f = near; near = null; f(); } return; }
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
    };
    const paint = i => {
      items.forEach((it, k) => it.classList.toggle('is-up', k === i));
      if (i !== shown) {
        shown = i; bubble.innerHTML = $('svg', items[i]).outerHTML;
        if (!reduce) { bubble.classList.remove('swap'); void bubble.offsetWidth; bubble.classList.add('swap'); }
      }
      if (label.textContent !== items[i].dataset.label) { label.textContent = items[i].dataset.label; lw = label.offsetWidth; }
    };
    const show = (i, o = {}) => { paint(i); target = centers[i] + (o.lean || 0); run(o.instant); };
    const rest = instant => show(cur, { instant });
    const setCur = i => { cur = i; items.forEach((it, k) => it.classList.toggle('is-on', k === i)); };
    const measure = () => {
      const r = dockEl.getBoundingClientRect(); W = r.width; H = r.height; svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      centers = items.map(it => { const b = it.getBoundingClientRect(); return b.left - r.left + b.width / 2; });
      const big = centers.length < 2 || centers[1] - centers[0] >= 56;   // huit icônes sur un petit écran : bulle et encoche plus petites
      B = big ? 56 : 48; NW = big ? 40 : 34; ND = big ? 38 : 33; dockEl.style.setProperty('--bub', B + 'px');
      lw = label.offsetWidth; rest(true);
    };
    const nearest = rx => centers.reduce((b, c, k) => (Math.abs(c - rx) < Math.abs(centers[b] - rx) ? k : b), 0);
    const follow = ev => {   // la bulle suit le pointeur et se penche vers lui
      const rx = ev.clientX - dockEl.getBoundingClientRect().left, i = nearest(rx);
      peek = i; show(i, { lean: Math.max(-10, Math.min(10, (rx - centers[i]) * .25)) });
    };

    /* ----- défilement de l'accueil : chaque section allume l'icône de sa page ----- */
    (() => {
      const secs = $$('[data-spy]');
      if (!onHome || !secs.length) return;
      let ticking = false;
      const pick = () => {
        const line = innerHeight * .38; let s = secs[0];
        for (const el of secs) if (el.getBoundingClientRect().top <= line) s = el;
        if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) s = secs[secs.length - 1];
        return s;
      };
      const apply = el => {
        const i = +el.dataset.spy; if (i === cur || going) return;
        setCur(i); if (peek < 0 && !$('.sheet.is-open')) rest();
      };
      const tick = () => { ticking = false; apply(pick()); };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }, { passive: true });
      setTimeout(tick, 60); respy = tick;
    })();

    function activate(i) {
      const it = items[i];
      if (it.getAttribute('aria-current') === 'page') { scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }   // la page où l'on est : retour en haut
      setCur(i); show(i); going = true;
      let left = false; const leave = () => { if (!left) { left = true; location.href = it.href; } };
      near = leave; run(); setTimeout(leave, 700);
    }

    /* souris et stylet : la bulle suit le survol, revient à sa place en sortant */
    dockEl.addEventListener('pointermove', ev => { if (ev.pointerType === 'touch') scrub(ev); else follow(ev); });
    dockEl.addEventListener('pointerleave', ev => { if (ev.pointerType !== 'touch' && peek >= 0) { peek = -1; rest(); } });
    /* doigt : glisser le long du menu, relâcher sur l'icône voulue */
    let sx = null, scrubbing = false, handled = 0;
    dockEl.addEventListener('pointerdown', ev => { if (ev.pointerType === 'touch') { sx = ev.clientX; scrubbing = false; } });
    const scrub = ev => { if (sx === null || (!scrubbing && Math.abs(ev.clientX - sx) < 12)) return; scrubbing = true; follow(ev); };
    dockEl.addEventListener('pointerup', ev => {
      if (ev.pointerType !== 'touch' || sx === null) return; sx = null;
      if (!scrubbing) return; scrubbing = false; handled = performance.now(); const i = peek; peek = -1; activate(i);
    });
    dockEl.addEventListener('pointercancel', () => { sx = null; if (scrubbing) { scrubbing = false; peek = -1; rest(); } });
    /* clavier : flèches entre les icônes, la bulle se place sans animation */
    dockEl.addEventListener('focusin', ev => { const it = ev.target.closest('.dock-item'); if (!it || !it.matches(':focus-visible')) return; const i = items.indexOf(it); peek = i; show(i, { instant: true }); });
    dockEl.addEventListener('focusout', ev => { if (!dockEl.contains(ev.relatedTarget) && peek >= 0) { peek = -1; rest(true); } });
    dockEl.addEventListener('keydown', ev => {
      const it = ev.target.closest('.dock-item'); if (!it) return;
      const k = ev.key; if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
      ev.preventDefault(); const i = items.indexOf(it), n = items.length;
      items[k === 'Home' ? 0 : k === 'End' ? n - 1 : (i + (k === 'ArrowRight' ? 1 : -1) + n) % n].focus();
    });
    items.forEach((it, i) => it.addEventListener('click', ev => {
      if (performance.now() - handled < 500) { ev.preventDefault(); ev.stopPropagation(); return; }
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button > 0) return;
      ev.preventDefault(); ev.stopPropagation(); activate(i);
    }));

    setCur(page); paint(page); measure();
    /* retour arrière (cache du navigateur) : la bulle revient sur la page affichée */
    addEventListener('pageshow', ev => { if (ev.persisted) { going = false; near = null; peek = -1; setCur(page); rest(true); respy(); } });
    addEventListener('resize', measure); if (document.fonts) document.fonts.ready.then(measure);
    return {
      back: () => { peek = -1; rest(); },
    };
  })() : null;

  /* ---------- Héros de l'accueil : diapositives en boucle ---------- */
  (() => {
    const box = $('[data-slider]'); if (!box) return;
    const slides = $$('.hero-slide', box), plays = $$('[data-play]', box), DUR = 7000;
    const dotsOf = s => $$('[data-go]', s);
    let cur = 0, timer = 0, paused = reduce, left = DUR, started = 0, sx = null, sy = 0;
    const holds = new Set();   // focus, survol des commandes, onglet caché, héros hors écran
    box.style.setProperty('--dur', DUR + 'ms');
    const setPlay = () => {
      box.classList.toggle('is-paused', paused); box.classList.toggle('is-auto', !paused);
      plays.forEach(p => p.setAttribute('aria-label', paused ? 'Relancer le défilement' : 'Mettre en pause le défilement'));
    };
    function show(i, user) {
      i = (i + slides.length) % slides.length; if (i === cur) return;
      const from = slides[cur], to = slides[i]; cur = i;
      from.classList.remove('is-on'); from.setAttribute('aria-hidden', 'true'); from.inert = true;
      to.inert = false; to.removeAttribute('aria-hidden'); to.classList.add('is-on');
      slides.forEach(s => dotsOf(s).forEach((d, k) => { if (k === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); }));
      restartBar();
      /* le focus suit : il passe sur le même bouton dans la diapositive affichée */
      if (user && user.focus) { const t = user.matches('[data-play]') ? $('[data-play]', to) : dotsOf(to)[i]; if (t) t.focus({ preventScroll: true }); }
      left = DUR; if (user && !paused) arm();
    }
    function arm() { clearTimeout(timer); if (paused || holds.size) return; started = performance.now(); timer = setTimeout(() => { left = DUR; show(cur + 1); arm(); }, left); }
    function hold(why, on) {
      const was = holds.size > 0; if (on) holds.add(why); else holds.delete(why);
      const now = holds.size > 0; if (was === now) return; box.classList.toggle('is-held', now);
      if (now) { clearTimeout(timer); if (!paused) left = Math.max(800, left - (performance.now() - started)); } else arm();
    }
    function restartBar() { const bar = $('span', dotsOf(slides[cur])[cur] || box); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; } }
    box.addEventListener('click', ev => {
      const d = ev.target.closest('[data-go]'); if (d) { show(+d.dataset.go, d); return; }
      if (ev.target.closest('[data-play]')) { paused = !paused; setPlay(); if (!paused) { left = DUR; restartBar(); arm(); } else clearTimeout(timer); }
    });
    /* focus au clavier ou survol des commandes : la diapositive reste affichée (le héros remplit l'écran : pas d'arrêt au simple survol) */
    $$('.slider-ctrl', box).forEach(c => {
      c.addEventListener('pointerenter', ev => { if (ev.pointerType === 'mouse') hold('survol', true); });
      c.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') hold('survol', false); });
    });
    box.addEventListener('focusin', () => hold('focus', true));
    box.addEventListener('focusout', ev => { if (!box.contains(ev.relatedTarget)) hold('focus', false); });
    /* au doigt : glisser vers la gauche ou la droite */
    box.addEventListener('touchstart', ev => { const t = ev.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    box.addEventListener('touchend', ev => {
      if (sx === null) return; const t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) show(cur + (dx < 0 ? 1 : -1), {});
    }, { passive: true });
    /* onglet en arrière-plan ou héros hors de l'écran : pas de défilement */
    document.addEventListener('visibilitychange', () => hold('onglet', document.hidden));
    if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => hold('ecran', !e.isIntersecting)), { threshold: .2 }).observe(box);
    setPlay(); arm();
  })();

  /* ---------- Bandeau du palmarès : vitesse constante quelle que soit la longueur, pause au bouton et hors écran,
     à l'arrêt si le visiteur a demandé moins d'animations (le bouton le relance) ---------- */
  (() => {
    const band = document.querySelector('[data-pband]'); if (!band) return;
    const btn = band.querySelector('[data-pband-play]'), tracks = band.querySelectorAll('.pb-track');
    const rq = matchMedia('(prefers-reduced-motion: reduce)');
    let playing = !rq.matches;
    const speed = [26, 42];   // px par seconde : ruban de derrière, ruban de devant
    const size = () => tracks.forEach((t, i) => { const w = t.scrollWidth / 2; if (w) t.style.setProperty('--pd', Math.round(w / speed[i] * 10) / 10 + 's'); });
    const set = () => {
      band.classList.toggle('is-paused', !playing); band.classList.toggle('is-playing', playing);
      btn.setAttribute('aria-label', playing ? 'Mettre en pause le défilement du palmarès' : 'Relancer le défilement du palmarès');
    };
    btn.addEventListener('click', () => { playing = !playing; set(); });
    if (rq.addEventListener) rq.addEventListener('change', e => { playing = !e.matches; set(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => band.classList.toggle('is-off', !en.isIntersecting)).observe(band);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 200); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
    size(); set();
  })();

  /* ---------- Heure du salon (Europe/Zurich) ---------- */
  function zurichNow() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = t => (parts.find(p => p.type === t) || {}).value;
    const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
    return { dow, min: (+get('hour')) * 60 + (+get('minute')) };
  }
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const fmtH = s => { const [h, m] = s.split(':'); return m === '00' ? `${+h} h` : `${+h} h ${m}`; };
  function openStatus() {
    if (!SD.hours) return { open: false, text: '' };
    const { dow, min } = zurichNow();
    const today = SD.hours[dow] || [];
    for (const [a, b] of today) {
      if (min >= toMin(a) && min < toMin(b)) return { open: true, text: `Ouvert maintenant · jusqu'à ${fmtH(b)}` };
    }
    for (const [a] of today) if (min < toMin(a)) return { open: false, text: `Fermé · ouvre à ${fmtH(a)}` };
    for (let i = 1; i <= 7; i++) {
      const d = (dow + i) % 7, h = SD.hours[d];
      if (h && h.length) return { open: false, text: `Fermé · réouverture ${i === 1 ? 'demain' : SD.days[d].toLowerCase()} à ${fmtH(h[0][0])}` };
    }
    return { open: false, text: 'Fermé' };
  }
  const st = openStatus();
  $$('[data-open-now]').forEach(el => { el.textContent = st.text; el.classList.add('open-now'); el.classList.toggle('is-open', st.open); });
  const { dow } = zurichNow();
  $$(`.hours tr[data-dow="${dow}"]`).forEach(tr => tr.classList.add('today'));

  /* ---------- Bulle du toiletteur en ligne : une accroche par visite, après quelques secondes ---------- */
  const Bot = (() => {
    const box = $('[data-bot]'), teaser = box && $('[data-bot-teaser]', box), KEY = 'sd-bot';
    const get = () => { try { return sessionStorage.getItem(KEY); } catch (e) { return '1'; } };
    const set = () => { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} };
    const hide = () => { if (teaser && !teaser.hidden) { teaser.hidden = true; } };
    if (teaser && !get() && !document.body.classList.contains('is-flow')) {
      setTimeout(() => { if (!get() && !$('.sheet.is-open')) { teaser.hidden = false; set(); } }, 6000);
    }
    if (box) $('[data-bot-dismiss]', box).addEventListener('click', () => { hide(); set(); $('.bot-btn', box).focus(); });
    return { seen() { hide(); set(); } };
  })();

  /* ---------- Feuille du toiletteur en ligne ---------- */
  let lastFocus = null;
  function openSheet(id) {
    const s = document.getElementById(id); if (!s) return;
    const open = $('.sheet.is-open'); if (open && open !== s) closeSheet(open, true);
    lastFocus = lastFocus && open ? lastFocus : document.activeElement;
    s.classList.add('is-open'); document.documentElement.style.overflow = 'hidden';
    $$('[data-bot]').forEach(b => b.classList.toggle('is-open', id === 'concierge'));
    if (id === 'concierge') Bot.seen();
    $$(`[aria-controls="${id}"]`).forEach(t => t.setAttribute('aria-expanded', 'true'));
    if (id === 'concierge') { const box = $('[data-concierge="sheet"]', s); if (box && !box._c) box._c = new Concierge(box, 'sheet'); setTimeout(() => { const i = $('input', s); i && !matchMedia('(pointer:coarse)').matches && i.focus(); }, 300); }
    else { const f = $('a,button', s); f && f.focus(); }
  }
  function closeSheet(s, keep) {
    if (!s) return;
    s.classList.remove('is-open'); document.documentElement.style.overflow = '';
    $$(`[aria-controls="${s.id}"]`).forEach(t => t.setAttribute('aria-expanded', 'false'));
    $$('[data-bot]').forEach(b => b.classList.remove('is-open'));
    if (Dock && !keep) Dock.back();
    if (!keep) { lastFocus && lastFocus.focus && lastFocus.focus(); lastFocus = null; }
  }
  document.addEventListener('click', ev => {
    const o = ev.target.closest('[data-open]');
    if (o) { ev.preventDefault(); const s = document.getElementById(o.dataset.open); if (s && s.classList.contains('is-open') && o.getAttribute('aria-expanded') === 'true') closeSheet(s); else openSheet(o.dataset.open); return; }
    const h = ev.target.closest('.sheet a[href*="#"]');   // lien vers une section de la page en cours : on ferme la feuille d'abord
    if (h && h.pathname === location.pathname && h.hash) { closeSheet(h.closest('.sheet'), true); return; }
    const c = ev.target.closest('[data-close]'); if (c) { closeSheet(c.closest('.sheet')); }
  });
  document.addEventListener('keydown', ev => {
    const s = $('.sheet.is-open'); if (!s) return;
    if (ev.key === 'Escape') { closeSheet(s); return; }
    if (ev.key === 'Tab') { /* focus maintenu dans la feuille ouverte */
      const f = $$('a[href],button:not([disabled]),input,select,textarea', s).filter(x => x.offsetParent !== null);
      if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); z.focus(); }
      else if (!ev.shiftKey && document.activeElement === z) { ev.preventDefault(); a.focus(); }
    }
  });


  /* ---------- Le toiletteur en ligne : agent à choix guidés + saisie libre ---------- */
  const svc = slug => (SD.services || []).find(s => s.slug === slug);
  const typo = t => t.replace(/ ([?!;»])/g, '\u202f$1').replace(/« /g, '«\u202f').replace(/(\S) :(\s)/g, '$1\u00a0:$2');
  const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const T = (label, to, primary) => ({ label, to, primary });
  const DEVIS = (label = 'Demander un devis', soin) => T(label, 'url:/devis/' + (soin ? '?soin=' + soin : ''), true);
  const MAIN = () => [DEVIS(), T('Trouver le bon soin', 'q1'), T('Trouver sa coupe', 'coupe'), T('Durées et prix', 'durees'), T('Les produits d’Allison', 'produits'),
    T('Horaires & accès', 'acces'), T('Allison & palmarès', 'palmares'), T('Pandora', 'pandora'), T('Parler au salon', 'contact')];
  const AGAIN = T('Autre question', 'start');
  const NODES = {
    start: () => ({ say: ["Bonjour, je suis le toiletteur en ligne de Sublim'dog. Je vous guide vers la bonne page et vers votre devis.", 'Que cherchez-vous ?'], chips: MAIN() }),
    menu: () => ({ say: ['Que cherchez-vous d’autre ?'], chips: MAIN() }),
    devis: () => ({ say: ['Le plus simple : la demande de devis. Sa photo, sa race, son poids, le soin et vos dates, en trois minutes : la durée du soin s’affiche en direct.', 'Allison vous répond avec votre devis et un créneau.'],
      chips: [DEVIS(), T('Voir les durées', 'durees'), AGAIN] }),
    q1: () => ({ say: ['Parlons de votre chien. Quel âge a-t-il ?'], chips: [T('Moins de 6 mois', 'rec:premier-toilettage-chiot'), T('Adulte', 'q2'), T('Senior', 'q2')] }),
    q2: () => ({ say: ['Quel est son type de poil ?'], chips: [T('Bouclé ou frisé', 'q3'), T('Long', 'q3'), T('Dur, à épiler', 'q3'), T('Court', 'rec:soin-argile')] }),
    q3: () => ({ say: ['Et pour ce rendez-vous, vous recherchez plutôt…'], chips: [T('Une exposition, un concours', 'rec:toilettage-exposition'), T('Une coupe nette au quotidien', 'rec:entretien-coupe'), T('Un soin de la peau et du poil', 'rec:soin-argile'), T('Démêler un pelage noué', 'rec:entretien-coupe')] }),
    durees: () => ({ say: ['Le prix vous est donné avec le devis, selon votre chien. Les durées indicatives, selon le poids et le pelage :', '<ul style="margin:0;padding-left:1.1em">' + (SD.services || []).map(s => `<li>${s.short} : ${s.duration}</li>`).join('') + '</ul>', 'La demande de devis calcule la durée pour votre chien.'],
      chips: [DEVIS(), T('Toutes les durées', 'url:/soins/#durees'), AGAIN] }),
    coupe: () => ({ say: ['Joignez sa photo à votre demande de devis : je vous propose les coupes adaptées à son poil, et vous pouvez décrire la vôtre.', 'Allison vous conseille la coupe qui lui ira le mieux et vous envoie votre devis.'],
      chips: [DEVIS('Demander un devis'), T('Voir les soins', 'url:/soins/'), AGAIN] }),
    produits: () => ({ say: ['Allison utilise les cosmétiques Special One, en vente chez Petdesign.fr, avec les outils Bloom.', 'Avec son lien : −10 % sur votre première commande.'],
      chips: [T('Voir ses produits', 'url:/boutique/', true), T('Demander un devis', 'url:/devis/'), AGAIN] }),
    acces: () => { const o = openStatus(); return { say: ['Le salon est ouvert du lundi au vendredi, de 9 h à 12 h et de 13 h à 18 h, sur rendez-vous.', `<strong>${o.text}</strong>`, `${SD.site.street}, ${SD.site.zip} ${SD.site.city} (JU), à quelques minutes de Porrentruy.`],
      chips: [T('Itinéraire', 'ext:' + SD.site.maps_dir), T('Horaires & accès', 'url:/salon/'), DEVIS()] }; },
    palmares: () => ({ say: ["Allison Cabibbo est championne d'Europe de toilettage 2025, avec trois victoires consécutives au Diamex Master Groomer (2024, 2025, 2026)."],
      chips: [T('Le palmarès', 'url:/palmares/'), T('Rencontrer Allison', 'url:/allison-cabibbo/'), DEVIS()] }),
    pandora: () => ({ say: ["Pandora est la mascotte du salon : un caniche royal blanc, ambassadrice de Sublim'dog."], chips: [T('Rencontrer Pandora', 'url:/pandora/'), DEVIS(), AGAIN] }),
    actu: () => ({ say: ['Victoires, presse et partenaires : tout est dans les actualités.'], chips: [T('Les actualités', 'url:/actualites/'), DEVIS(), AGAIN] }),
    contact: () => ({ say: ["Le salon répond du lundi au vendredi, pendant les heures d'ouverture.", 'Pour un devis, la demande en ligne est le plus rapide.'], chips: [DEVIS(), T('Appeler le ' + SD.site.tel, 'tel'), T('WhatsApp', 'wa')] }),
    chats: () => ({ say: ['Oui, le salon accueille aussi les chats, sur rendez-vous.', 'Indiquez-le dans votre demande de devis, ou appelez le salon.'], chips: [DEVIS(), T('Appeler le salon', 'tel'), AGAIN] }),
    merci: () => ({ say: ['Avec plaisir ! Belle journée à vous et à votre compagnon.'], chips: [AGAIN] }),
    fallback: () => ({ say: ["Je n'ai pas la réponse à cette question. Le plus sûr : demandez un devis, ou appelez le salon.", 'Ou choisissez un sujet :'], chips: [DEVIS(), T('Appeler le salon', 'tel'), ...MAIN().slice(1, 5)] }),
  };
  const recNode = slug => () => ({ say: ['Je vous recommande :'], card: slug, chips: [DEVIS('Devis pour ce soin', slug), T('Voir le détail', 'url:/soins/' + slug + '/'), AGAIN] });
  const INTENTS = [
    [/merci|super|parfait|top\b/, 'merci'], [/chat|felin/, 'chats'],
    [/devis|reserv|rdv|rendez|dispo|creneau|date|prendre|estimation/, 'devis'], [/prix|tarif|cout|combien|chf|cher|duree|temps|long/, 'durees'],
    [/produit|shampo|cosmet|special one|boutique|acheter|petdesign|bloom|brosse|peigne|dentifrice/, 'produits'],
    [/horaire|heure|ouvert|ferme|samedi|dimanche|aujourd/, 'acces'], [/adresse|ou se|acces|venir|itineraire|parking|\balle\b|porrentruy/, 'acces'],
    [/pandora|mascotte/, 'pandora'], [/studio|apercu|previsu|essayer|quelle coupe|coupe|style|look/, 'coupe'],
    [/chiot|bebe|premier|jeune/, 'rec:premier-toilettage-chiot'], [/expo|concours|ring|show|compet|championnat/, 'rec:toilettage-exposition'],
    [/noeud|nœud|demel|feutre|griffe|ongle/, 'rec:entretien-coupe'],
    [/argile|bain|spa|soin|peau|odeur|sent/, 'rec:soin-argile'], [/tonte|tondre|entretien|toilettage/, 'rec:entretien-coupe'],
    [/allison|champion|palmares|titre|europe|diamex/, 'palmares'], [/actu|presse|news|article/, 'actu'],
    [/telephone|appel|contact|whatsapp|joindre|parler/, 'contact'], [/bonjour|salut|hello|coucou/, 'start'],
  ];

  function Concierge(root, mode) {
    this.root = root; this.mode = mode;
    root.innerHTML = `<div class="cc-head"><img class="logo" src="${R('/assets/brand/logo.svg')}" alt="" width="40" height="40"><div><div class="cc-title">Le toiletteur en ligne</div><div class="cc-status">Répond tout de suite</div></div>
      ${mode === 'sheet' ? '<button class="cc-close" type="button" data-close aria-label="Fermer le toiletteur en ligne"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>' : ''}</div>
      <div class="cc-log" role="log" aria-live="polite" aria-label="Conversation"></div><div class="cc-chips" role="group" aria-label="Suggestions"></div>
      <form class="cc-form"><label class="sr-only" for="cc-in-${mode}">Votre question</label><input id="cc-in-${mode}" autocomplete="off" enterkeyhint="send" placeholder="Écrivez votre question…">
      <button type="submit" aria-label="Envoyer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 20 4l-4.5 16-3.5-6.5z"/><path d="M12 13.5 20 4"/></svg></button></form>`;
    this.log = $('.cc-log', root); this.chips = $('.cc-chips', root);
    $('form', root).addEventListener('submit', ev => { ev.preventDefault(); const i = $('input', root); const v = i.value.trim(); if (!v) return; i.value = ''; this.user(v); this.go(this.match(v)); });
    this.chips.addEventListener('click', ev => { const b = ev.target.closest('[data-to]'); if (!b) return; const to = b.dataset.to;
      if (/^(url|ext|tel|wa)/.test(to)) return; ev.preventDefault(); this.user(b.textContent.trim()); this.go(to); });
    this.go('start', true);
  }
  Concierge.prototype.match = function (v) { const n = norm(v); for (const [re, to] of INTENTS) if (re.test(n)) return to; return 'fallback'; };
  Concierge.prototype.user = function (t) { const m = document.createElement('div'); m.className = 'msg msg-user'; m.textContent = t; this.log.appendChild(m); this.scroll(); };
  Concierge.prototype.scroll = function () { this.log.scrollTop = this.log.scrollHeight; };
  Concierge.prototype.go = async function (id, instant) {
    const fn = id.startsWith('rec:') ? recNode(id.slice(4)) : NODES[id] || NODES.fallback; const n = fn();
    this.chips.innerHTML = '';
    for (const line of n.say) { await this.bot(line, instant); }
    if (n.card) { const s = svc(n.card); if (s) await this.bot(`<a class="msg-card" href="${R('/soins/' + s.slug + '/')}"><img class="is-stk" src="${R(s.img)}" alt="" loading="lazy" style="background:${s.bg}"><span>${s.name}</span><small>${s.duration}</small></a>`, instant, true); }
    this.chips.innerHTML = n.chips.map(c => {
      const cls = 'chip' + (c.primary ? ' chip-primary' : '');
      if (c.to.startsWith('url:')) return `<a class="${cls}" data-to="url" href="${R(c.to.slice(4))}">${c.label}</a>`;
      if (c.to.startsWith('ext:')) return `<a class="${cls}" data-to="ext" href="${c.to.slice(4)}" target="_blank" rel="noopener">${c.label}</a>`;
      if (c.to === 'tel') return `<a class="${cls}" data-to="tel" href="tel:${SD.site.tel_e164}">${c.label}</a>`;
      if (c.to === 'wa') return `<a class="${cls}" data-to="wa" href="https://wa.me/${SD.site.whatsapp}" target="_blank" rel="noopener">${c.label}</a>`;
      return `<button class="${cls}" type="button" data-to="${c.to === 'start' && !instant ? 'menu' : c.to}">${typo(c.label)}</button>`;
    }).join('');
    this.scroll();
  };
  Concierge.prototype.bot = function (html, instant, raw) {
    return new Promise(res => {
      const add = () => { const m = document.createElement('div'); m.className = 'msg msg-bot'; m.innerHTML = raw ? html : `<p>${typo(html)}</p>`; this.log.appendChild(m); this.scroll(); res(); };
      if (instant || reduce) return add();
      const t = document.createElement('div'); t.className = 'msg msg-bot typing'; t.innerHTML = '<i></i><i></i><i></i>'; this.log.appendChild(t); this.scroll();
      setTimeout(() => { t.remove(); add(); }, Math.min(900, 280 + html.length * 6));
    });
  };
  $$('[data-concierge="inline"]').forEach(box => {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { io.disconnect(); box._c = new Concierge(box, 'inline'); } }, { rootMargin: '200px' });
    io.observe(box);
  });

  /* ---------- Galerie plein écran ---------- */
  const gal = $('[data-gallery]');
  if (gal) {
    const items = $$('.g-item', gal);
    const dlg = document.createElement('dialog'); dlg.className = 'lightbox'; dlg.setAttribute('aria-label', 'Galerie');
    dlg.innerHTML = `<button class="lb-close" type="button" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      <div class="lb-track">${items.map(b => { const img = $('img', b); const set = img.getAttribute('srcset').split(', '); const big = set[set.length - 1].split(' ')[0];
        return `<figure class="lb-slide"><img src="${big}" alt="${img.alt}" loading="lazy"><figcaption>${$('figcaption', b).textContent}</figcaption></figure>`; }).join('')}</div>
      <button class="lb-nav lb-prev" type="button" aria-label="Photo précédente"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 6 8.5 12l6 6"/></svg></button>
      <button class="lb-nav lb-next" type="button" aria-label="Photo suivante"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9.5 6l6 6-6 6"/></svg></button>`;
    document.body.appendChild(dlg);
    const slides = $$('.lb-slide', dlg); let at = 0;
    const goTo = i => { at = (i + slides.length) % slides.length; slides.forEach((x, k) => { x.hidden = k !== at; }); };
    items.forEach((b, i) => b.addEventListener('click', () => { goTo(i); dlg.showModal(); }));
    $('.lb-close', dlg).addEventListener('click', () => dlg.close());
    $('.lb-prev', dlg).addEventListener('click', () => goTo(at - 1));
    $('.lb-next', dlg).addEventListener('click', () => goTo(at + 1));
    dlg.addEventListener('keydown', ev => { if (ev.key === 'ArrowRight') goTo(at + 1); if (ev.key === 'ArrowLeft') goTo(at - 1); });
    dlg.addEventListener('click', ev => { if (ev.target.classList.contains('lb-slide')) dlg.close(); });
    let x0 = null;
    dlg.addEventListener('touchstart', ev => { x0 = ev.touches[0].clientX; }, { passive: true });
    dlg.addEventListener('touchend', ev => { if (x0 === null) return; const dx = ev.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) goTo(at + (dx < 0 ? 1 : -1)); });
    goTo(0);
  }

  /* ---------- Filtres des actualités ---------- */
  $$('[data-filter]').forEach(b => b.addEventListener('click', () => {
    $$('[data-filter]').forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false'));
    $$('[data-news] .post').forEach(p => { p.hidden = !(b.dataset.filter === 'tout' || p.dataset.cat === b.dataset.filter); });
    $$('.news-year').forEach(g => {
      g.hidden = !$$('.post', g).some(p => !p.hidden);
      $$(`[data-anchors] a[href="#${g.id}"]`).forEach(a => { a.parentNode.hidden = g.hidden; });
    });
    dispatchEvent(new Event('sd:anchors'));
  }));

  /* ---------- Carte Google : chargée sur consentement (nLPD) ---------- */
  $$('[data-map-load]').forEach(b => b.addEventListener('click', () => {
    const box = b.closest('[data-map]'); const f = document.createElement('iframe');
    f.src = box.dataset.map; f.title = "Plan d'accès au salon Sublim'dog à Alle"; f.loading = 'lazy'; f.referrerPolicy = 'no-referrer-when-downgrade';
    box.innerHTML = ''; box.appendChild(f);
  }));


  /* ---------- Menu d'ancres des pages internes : une pastille liquide suit la section lue ---------- */
  $$('[data-anchors]').forEach(nav => {
    const box = $('.anchors-in', nav), inner = $('.anchors-track', nav), pill = $('.anchors-pill', nav), links = $$('a', nav);
    const edges = () => { const over = inner.scrollWidth > inner.clientWidth + 2; box.classList.toggle('is-scroll', over);
      box.classList.toggle('at-start', inner.scrollLeft < 4); box.classList.toggle('at-end', inner.scrollLeft + inner.clientWidth >= inner.scrollWidth - 4); };
    inner.addEventListener('scroll', edges, { passive: true });
    const secs = links.map(a => document.getElementById(decodeURIComponent(a.hash.slice(1))));
    let cur = -1, lockUntil = 0, ticking = false;
    let eL = 0, eR = 0, vL = 0, vR = 0, tL = 0, tR = 0, af = 0, lt = 0;
    const paint = () => { pill.style.transform = `translateX(${eL}px)`; pill.style.width = `${Math.max(0, eR - eL)}px`; };
    const frame = now => {   // deux bords à ressort : le bord qui mène part vite, l'autre suit (effet goutte)
      const dt = Math.min(.032, (now - lt) / 1000); lt = now;
      const kL = tL < eL ? 380 : 190, kR = tR > eR ? 380 : 190;
      vL += (kL * (tL - eL) - 1.7 * Math.sqrt(kL) * vL) * dt; eL += vL * dt;
      vR += (kR * (tR - eR) - 1.7 * Math.sqrt(kR) * vR) * dt; eR += vR * dt;
      paint();
      if (Math.abs(tL - eL) + Math.abs(tR - eR) < .6 && Math.abs(vL) + Math.abs(vR) < 8) { eL = tL; eR = tR; paint(); af = 0; return; }
      af = requestAnimationFrame(frame);
    };
    const place = (i, instant) => {
      if (i === cur && !instant) return;
      cur = i;
      links.forEach((a, k) => { if (k === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      nav.classList.toggle('has-on', i >= 0);
      if (i < 0) return;
      const a = links[i]; tL = a.offsetLeft; tR = a.offsetLeft + a.offsetWidth;
      if (instant || reduce || !nav.classList.contains('is-ready')) { cancelAnimationFrame(af); af = 0; eL = tL; eR = tR; vL = vR = 0; paint(); nav.classList.add('is-ready'); }
      else if (!af) { lt = performance.now(); af = requestAnimationFrame(frame); }
      if (inner.scrollWidth > inner.clientWidth + 2) inner.scrollTo({ left: Math.max(0, a.offsetLeft - (inner.clientWidth - a.offsetWidth) / 2), behavior: reduce || instant ? 'auto' : 'smooth' });
    };
    const pick = () => {
      const line = nav.getBoundingClientRect().bottom + innerHeight * .22; let i = -1;
      secs.forEach((el, k) => { if (el && !el.hidden && !(el.parentNode && el.parentNode.hidden) && el.getBoundingClientRect().top <= line) i = k; });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) { for (let k = secs.length - 1; k >= 0; k--) if (secs[k] && !links[k].parentNode.hidden) { i = k; break; } }
      return i;
    };
    const tick = () => { ticking = false; if (performance.now() < lockUntil) return; place(pick()); };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } }, { passive: true });
    if ('onscrollend' in window) addEventListener('scrollend', () => { if (lockUntil) { lockUntil = 0; tick(); } });
    const remeasure = () => { const i = cur; cur = -2; place(i, true); edges(); };
    addEventListener('resize', remeasure); addEventListener('sd:anchors', remeasure);
    if (document.fonts) document.fonts.ready.then(remeasure);
    links.forEach((a, k) => a.addEventListener('click', ev => {
      const el = secs[k]; if (!el) return;
      ev.preventDefault(); place(k);
      lockUntil = performance.now() + 1400; setTimeout(() => { lockUntil = 0; tick(); }, 1450);
      scrollToEl(el);
      try { history.replaceState(null, '', a.hash); } catch (e) {}
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }));
    place(pick(), true); edges();
  });

  /* ---------- Application installable ---------- */

  window.SDapp = { openSheet, openStatus, store };
})();
