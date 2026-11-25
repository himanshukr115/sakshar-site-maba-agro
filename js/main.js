/* Maba Agro — interactions. No dependencies. */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ── 3D hero: loaded after the page itself, so text and images paint first ── */
  const grow = $('[data-grow]');
  if (grow && grow.dataset.src) {
    const conn = navigator.connection || {};
    const lite = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    const go = () => { const sc = document.createElement('script'); sc.src = grow.dataset.src; sc.async = true; sc.onerror = () => grow.classList.add('no-webgl'); document.body.append(sc); };
    const idle = (f) => ('requestIdleCallback' in window ? requestIdleCallback(f, { timeout: 1200 }) : setTimeout(f, 200));
    if (lite) grow.classList.add('no-webgl');
    else if (document.readyState === 'complete') idle(go);
    else addEventListener('load', () => idle(go), { once: true });
  }

  /* ── Page ready: drives the hero entrance ── */
  requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('is-ready')));

  /* ── One scroll loop for everything ──
     Scroll events only schedule a frame; each frame reads layout once (from cached
     section positions) and then writes. No getBoundingClientRect storms while scrolling. */
  const frameTasks = [];
  let ticking = false;
  const runFrame = () => { ticking = false; const y = scrollY; for (const f of frameTasks) f(y); };
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(runFrame); } };
  addEventListener('scroll', schedule, { passive: true });
  // positions are measured up front and re-measured when the page height changes
  const measures = [];
  const remeasure = () => { for (const m of measures) m(); schedule(); };
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  addEventListener('resize', remeasure);
  addEventListener('load', remeasure);
  if ('ResizeObserver' in window) { let rt; new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(remeasure, 120); }).observe(document.body); }

  /* ── Header: glass bar after scrolling, tucks away while reading, follows the tone ── */
  const header = $('.site-header');
  const wa = $('.wa-float');
  let lastY = scrollY, hh = header.offsetHeight;
  const LIGHT = new Set(['mist', 'linen', 'cream', 'white']);
  let toneBoxes = [];
  measures.push(() => { hh = header.offsetHeight; toneBoxes = $$('[data-tone]').map((el) => { const t = docTop(el); return { t, b: t + el.offsetHeight, el }; }); });
  let lightNow = null;
  frameTasks.push((y) => {
    const probe = y + hh * .6;
    let light = false;
    for (const box of toneBoxes) {
      if (box.t <= probe && box.b > probe) {
        let t = box.el.dataset.tone;
        if (t === 'bridge') { const k = (probe - box.t) / (box.b - box.t); t = k < .14 ? box.el.dataset.from : k > .86 ? box.el.dataset.to : 'night'; }
        light = LIGHT.has(t); break;
      }
    }
    if (light !== lightNow) { header.classList.toggle('on-light', light); lightNow = light; }
    header.classList.toggle('is-scrolled', y > 60);
    if (!document.body.classList.contains('menu-open')) header.classList.toggle('is-hidden', y > 700 && y > lastY + 4);
    if (y < lastY - 4) header.classList.remove('is-hidden');
    wa && wa.classList.toggle('is-on', y > 500);
    lastY = y;
  });

  /* ── Gentle parallax on photo bridges (transform only, GPU-composited) ── */
  if (!reduce) {
    let pars = [];
    measures.push(() => { pars = $$('.br-img, .founder-bg').map((el) => { const p = el.parentElement; const t = docTop(p); return { el, t, h: p.offsetHeight }; }); });
    frameTasks.push((y) => {
      const vh = innerHeight;
      for (const p of pars) {
        const top = p.t - y;
        if (top + p.h < -50 || top > vh + 50) continue;
        const k = (top + p.h / 2 - vh / 2) / (vh + p.h);
        p.el.style.transform = `translate3d(0, ${(k * -12).toFixed(2)}%, 0)`;
      }
    });
  }

  /* ── Mobile menu ── */
  const btn = $('.menu-btn'), menu = $('#mobile-menu');
  if (btn) {
    const set = (open) => {
      btn.setAttribute('aria-expanded', open); menu.hidden = !open;
      document.body.classList.toggle('menu-open', open);
      window.__lenis && (open ? window.__lenis.stop() : window.__lenis.start());
      if (open) header.classList.remove('is-hidden');
    };
    btn.addEventListener('click', () => set(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { set(false); btn.focus(); } });
  }

  /* ── Scroll reveal ── */
  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((ens) => ens.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    revealEls.forEach((el) => io.observe(el));
  } else revealEls.forEach((el) => el.classList.add('is-in'));

  /* ── Count-up numbers ── */
  const counters = $$('[data-count]');
  if (counters.length && !reduce) {
    const io = new IntersectionObserver((ens) => ens.forEach((en) => {
      if (!en.isIntersecting) return; io.unobserve(en.target);
      const el = en.target, to = +el.dataset.count, t0 = performance.now();
      const tick = (t) => { const k = clamp((t - t0) / 1400, 0, 1); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }), { threshold: .6 });
    counters.forEach((c) => io.observe(c));
  }

  /* ── Images that may not exist yet: cutouts and pack renders ── */
  const watch = (sel, cls) => $$(sel).forEach((im) => {
    const ok = () => im.naturalWidth > 0 && im.parentNode.classList.add(cls);
    if (im.complete) ok(); else im.addEventListener('load', ok);
  });
  watch('img.cut-img', 'has-cut'); watch('img.pack-img', 'has-pack');

  /* ── Hero: rotating word ── */
  const rot = $('.rot');
  if (rot && !reduce) {
    const words = rot.dataset.rotate.split('|'), w = $('.rot-w', rot); let i = 0;
    setInterval(() => {
      w.classList.add('out');
      setTimeout(() => {
        i = (i + 1) % words.length; w.textContent = words[i];
        w.classList.remove('out'); w.classList.add('in');
        requestAnimationFrame(() => requestAnimationFrame(() => w.classList.remove('in')));
      }, 380);
    }, 2600);
  }

  /* ── Product pack carousel ── */
  const prod = $('[data-products]');
  if (prod) {
    const cards = $$('.pk', prod), copies = $$('.pk-copy', prod), n = cards.length, order = $('[data-order]', prod);
    const names = copies.map((c) => $('h3', c).childNodes[0].textContent.trim());
    let cur = 0, timer;
    const set = (i) => {
      cur = (i + n) % n;
      cards.forEach((c, k) => {
        let pos = k - cur; if (pos > n / 2) pos -= n; if (pos < -n / 2) pos += n;
        const a = Math.abs(pos);
        c.style.setProperty('--pos', pos);
        c.style.setProperty('--sc', a === 0 ? 1 : a === 1 ? .74 : .5);
        c.style.setProperty('--op', a === 0 ? 1 : a === 1 ? .95 : 0);
        c.style.setProperty('--z', 10 - a);
        c.style.setProperty('--sat', a === 0 ? 1 : .75);
        c.classList.toggle('is-on', a === 0); c.setAttribute('aria-hidden', a !== 0);
      });
      copies.forEach((c, k) => c.classList.toggle('is-on', k === cur));
      if (order) order.href = order.href.replace(/text=.*$/, 'text=' + encodeURIComponent(`Hello Maba Agro, I would like to order ${names[cur]}.`));
    };
    const go = (d) => { set(cur + d); restart(); };
    const restart = () => { clearInterval(timer); if (!reduce) timer = setInterval(() => set(cur + 1), 4500); };
    $$('.round-btn', prod).forEach((b) => b.addEventListener('click', () => go(+b.dataset.dir)));
    cards.forEach((c, k) => c.addEventListener('click', () => { if (k !== cur) { set(k); restart(); } }));
    let sx = null; const stage = $('.pk-stage', prod);
    stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (sx !== null && Math.abs(e.clientX - sx) > 40) go(e.clientX < sx ? 1 : -1); sx = null; });
    set(0); restart();
  }

  /* ── Milestone cards: arrow buttons scroll the track ── */
  $$('.milestones').forEach((sec) => {
    const track = $('[data-track]', sec);
    $$('.round-btn', sec).forEach((b) => b.addEventListener('click', () => track.scrollBy({ left: +b.dataset.dir * (track.firstElementChild.offsetWidth + 18), behavior: reduce ? 'auto' : 'smooth' })));
  });

  /* ── Web3Forms: send JSON, read { success } ── */
  const sendForm = async (endpoint, payload) => {
    const ctrl = 'AbortController' in window ? new AbortController() : null;
    const timer = ctrl && setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined });
      const data = await res.json().catch(() => ({}));
      return res.ok && data.success !== false;
    } catch (err) { return false; } finally { timer && clearTimeout(timer); }
  };
  const waLink = (wa, text) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`;

  /* ── Call-back form → email (Web3Forms), WhatsApp as a fallback ── */
  $$('[data-callback]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = f.phone.value.trim();
    if (!/^[0-9+ ]{10,15}$/.test(v)) { f.classList.add('is-invalid'); f.phone.focus(); return; }
    f.classList.remove('is-invalid');
    const text = `Please call me back about fresh mushrooms. My number: ${v}`;
    const btn = $('button', f);
    if (!f.dataset.endpoint) { window.open(waLink(f.dataset.wa, text), '_blank', 'noopener'); return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Sending…';
    const ok = await sendForm(f.dataset.endpoint, { access_key: f.dataset.key, subject: 'Call-back request from mabaagro.com', from_name: 'Maba Agro website', phone: v, message: text, page: location.href });
    btn.disabled = false;
    if (ok) { (window.dataLayer = window.dataLayer || []).push({ event: 'generate_lead', form: 'callback' }); f.reset(); btn.textContent = 'Request sent ✓'; setTimeout(() => { btn.textContent = label; }, 4000); }
    else { btn.textContent = label; window.open(waLink(f.dataset.wa, text), '_blank', 'noopener'); }
  }));

  /* ── Spore-to-plate timeline ── */
  const tl = $('[data-timeline]');
  if (tl) {
    const line = $('.tl-line span', tl), steps = $$('.tl-step', tl), list = $('ol', tl);
    let lt = 0, lh = 1, tops = [];
    measures.push(() => { lt = docTop(list); lh = list.offsetHeight || 1; tops = steps.map(docTop); });
    frameTasks.push((y) => {
      const mark = y + innerHeight * .6;
      line && line.style.setProperty('--p', clamp((mark - lt) / lh, 0, 1).toFixed(4));
      steps.forEach((st, i) => st.classList.toggle('is-on', tops[i] < mark));
    });
  }

  /* ── Journal filters (with #topic-xxx deep links) ── */
  const chips = $$('.chip[data-filter]');
  const feat = $('.j-feature');
  const applyFilter = (c, scroll) => {
    chips.forEach((x) => { x.classList.toggle('is-on', x === c); x.setAttribute('aria-pressed', x === c); });
    const f = c.dataset.filter;
    $$('.p-grid-all .post-card, .j-feature .post-card').forEach((p) => { p.hidden = f !== 'all' && p.dataset.cat !== f; });
    if (feat) feat.hidden = f !== 'all' && feat.querySelector('.post-card').dataset.cat !== f;
    if (scroll) $('.filters').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  };
  chips.forEach((c) => c.addEventListener('click', () => {
    applyFilter(c);
    history.replaceState(null, '', c.dataset.key ? '#topic-' + c.dataset.key : location.pathname);
  }));
  const fromHash = () => { const m = location.hash.match(/^#topic-(.+)$/); const c = m && chips.find((x) => x.dataset.key === m[1]); if (c) applyFilter(c, true); };
  if (chips.length) { fromHash(); addEventListener('hashchange', fromHash); }

  /* ── Copy article link ── */
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); } catch (e) { const t = document.createElement('textarea'); t.value = b.dataset.copy; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
    b.classList.add('is-copied'); b.setAttribute('aria-label', 'Link copied'); setTimeout(() => { b.classList.remove('is-copied'); b.setAttribute('aria-label', 'Copy link'); }, 1800);
  }));

  /* ── Table of contents highlight ── */
  const tocLinks = $$('.toc a');
  if (tocLinks.length) {
    const io = new IntersectionObserver((ens) => ens.forEach((en) => {
      if (en.isIntersecting) tocLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
    }), { rootMargin: '-20% 0px -70% 0px' });
    tocLinks.forEach((a) => { const el = document.getElementById(a.getAttribute('href').slice(1)); el && io.observe(el); });
  }

  /* ── Enquiry forms → WhatsApp (or a form endpoint if configured) ── */
  $$('form.enquiry').forEach((form) => {
    const status = $('.f-status', form);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let ok = true;
      $$('input[required], select[required], textarea[required]', form).forEach((el) => {
        const bad = !el.value.trim() || (el.pattern && !new RegExp(`^${el.pattern}$`).test(el.value.trim()));
        el.closest('.f').classList.toggle('is-invalid', bad); if (bad && ok) { el.focus(); ok = false; }
      });
      if (!ok) { status.textContent = 'Please fill in the highlighted fields. Phone numbers need 10 to 15 digits.'; status.className = 'f-status is-error'; return; }
      const fd = new FormData(form);
      const kind = form.dataset.kind === 'wholesale' ? 'Wholesale enquiry' : 'Website message';
      const lines = [`${kind}, mabaagro.com`];
      const label = { name: 'Name', phone: 'Phone', business: 'Business', type: 'Type', city: 'City', volume: 'Weekly volume', email: 'Email', message: 'Message' };
      for (const k of Object.keys(label)) { const v = fd.get(k); if (v) lines.push(`${label[k]}: ${v}`); }
      const vars = fd.getAll('varieties'); if (vars.length) lines.push(`Varieties: ${vars.join(', ')}`);
      const sub = $('button[type=submit]', form);
      if (form.dataset.endpoint) {
        if (fd.get('botcheck')) return; // spam bots tick the hidden box
        const payload = { access_key: fd.get('access_key'), subject: fd.get('subject'), from_name: fd.get('from_name') };
        for (const k of Object.keys(label)) { const v = fd.get(k); if (v && !['name', 'email', 'message'].includes(k)) payload[label[k]] = v; }
        if (vars.length) payload.Varieties = vars.join(', ');
        if (fd.get('email')) payload.email = fd.get('email'); // lets the team hit "reply"
        payload.name = fd.get('name');
        payload.message = lines.join('\n'); payload.Page = location.href;
        sub.disabled = true; status.className = 'f-status'; status.textContent = 'Sending…';
        const ok = await sendForm(form.dataset.endpoint, payload);
        sub.disabled = false;
        if (ok) { (window.dataLayer = window.dataLayer || []).push({ event: 'generate_lead', form: form.dataset.kind }); form.reset(); status.textContent = 'Thank you. Your enquiry is with our team and we’ll reply within one working day.'; }
        else { status.className = 'f-status is-error'; status.innerHTML = `Your message didn’t send. Check your connection and try again, or <a href="${waLink(form.dataset.wa, lines.join('\n'))}" target="_blank" rel="noopener">send it on WhatsApp</a>.`; }
        return;
      }
      window.open(`https://wa.me/${form.dataset.wa}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
      status.className = 'f-status'; status.textContent = 'WhatsApp opened with your enquiry filled in. Press send there to reach us.';
    });
    $$('input, select, textarea', form).forEach((el) => el.addEventListener('input', () => el.closest('.f')?.classList.remove('is-invalid')));
  });

  /* ── Gallery lightbox ── */
  const lb = $('.lightbox');
  if (lb) {
    const im = $('img', lb), cap = $('figcaption', lb); let opener;
    const close = () => { lb.hidden = true; window.__lenis && window.__lenis.start(); opener && opener.focus(); };
    $$('.gal-item').forEach((b) => b.addEventListener('click', () => {
      opener = b; im.onerror = () => { im.onerror = null; im.src = b.dataset.fallback; };
      im.src = b.dataset.src; im.alt = b.dataset.caption; cap.textContent = b.dataset.caption; lb.hidden = false; window.__lenis && window.__lenis.stop(); $('.lb-close', lb).focus();
    }));
    lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lb-close')) close(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) close(); });
  }
  remeasure();
})();
