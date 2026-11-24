(() => {
  const doc = document.documentElement;
  doc.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  $$('.pillars li, .chain li, .tags li, .card-format').forEach(el => el.style.setProperty('--i', [...el.parentElement.children].indexOf(el)));

  // reveal + counters
  const countUp = el => {
    const end = +el.dataset.count;
    if (reduce || !end) return;
    const t0 = performance.now(), dur = 1400;
    const tick = t => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('[data-count]', e.target).forEach(countUp);
      if (e.target.matches('[data-count]')) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
  $$('.reveal, .tags, .case, .principle-task').forEach(el => io.observe(el));
  // safety net: anything already scrolled past (fast jumps, anchor links) is shown too
  let pending = false;
  addEventListener('scroll', () => {
    if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      $$('.reveal:not(.in), .tags:not(.in), .case:not(.in), .principle-task:not(.in)').forEach(el => {
        if (el.getBoundingClientRect().top < innerHeight * 0.9) {
          el.classList.add('in'); $$('[data-count]', el).forEach(countUp); io.unobserve(el);
        }
      });
    });
  }, { passive: true });

  // nav: hide on scroll down, active section
  const nav = $('#nav');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    nav.classList.toggle('is-hidden', y > 400 && y > lastY + 4 && !menuOpen());
    if (y < lastY - 4 || y < 400) nav.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });
  const links = $$('.nav-links a');
  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach(a => { const s = $(a.getAttribute('href')); if (s) spy.observe(s); });

  // nav over dark sections
  const darkSet = new Set();
  const darkIo = new IntersectionObserver(entries => {
    entries.forEach(e => e.isIntersecting ? darkSet.add(e.target) : darkSet.delete(e.target));
    nav.classList.toggle('on-dark', darkSet.size > 0 && !menuOpen());
  }, { rootMargin: '-40px 0px -92% 0px' });
  $$('.dark, .footer').forEach(s => darkIo.observe(s));

  // mobile menu
  const toggle = $('.menu-toggle'), mnav = $('#mobile-nav');
  const menuOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setMenu = open => {
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    mnav.hidden = !open;
    mnav.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) nav.classList.remove('is-hidden');
    nav.classList.toggle('on-dark', !open && darkSet.size > 0);
  };
  toggle.addEventListener('click', () => setMenu(!menuOpen()));
  mnav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen()) { setMenu(false); toggle.focus(); } });
  matchMedia('(min-width: 1021px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  // speed switch
  const speed = $('.speed');
  const speedBtns = $$('[data-set-speed]');
  const setSpeed = v => {
    speed.dataset.speed = v;
    speedBtns.forEach(b => b.setAttribute('aria-pressed', b.dataset.setSpeed === v));
  };
  speedBtns.forEach(b => {
    b.addEventListener('click', () => setSpeed(b.dataset.setSpeed));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const v = e.key === 'ArrowRight' ? '2' : '1';
      setSpeed(v); $(`[data-set-speed="${v}"]`).focus();
    });
  });
  // show the transition once when the block is first seen
  if (!reduce) {
    setSpeed('1');
    const so = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      so.disconnect();
      setTimeout(() => { if (speed.dataset.touched !== '1') setSpeed('2'); }, 1100);
    }, { threshold: 0.45 });
    so.observe(speed);
    speedBtns.forEach(b => b.addEventListener('click', () => { speed.dataset.touched = '1'; }));
  }

  // intent links preselect the form topic
  const form = $('#lead');
  const msgLabel = $('#f-msg-label'), msg = $('#f-msg');
  const applyIntent = v => {
    const r = $(`input[name="intent"][value="${v}"]`, form);
    if (r) r.checked = true;
    const speaker = v === 'speaker';
    msgLabel.textContent = speaker ? 'О мероприятии' : 'О бизнесе и задаче';
    msg.placeholder = speaker ? 'Формат, дата, город, аудитория' : 'Сфера, размер команды, что хотите изменить';
  };
  $$('[data-intent]').forEach(a => a.addEventListener('click', () => applyIntent(a.dataset.intent)));
  $$('input[name="intent"]', form).forEach(r => r.addEventListener('change', () => applyIntent(r.value)));

  // form: prepare the message for Telegram or email
  const status = $('#form-status');
  const check = (input, errId) => {
    const ok = input.value.trim().length > 1;
    input.setAttribute('aria-invalid', String(!ok));
    $('#' + errId).hidden = ok;
    return ok;
  };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const channel = e.submitter?.dataset.channel || 'telegram';
    const name = $('#f-name'), contact = $('#f-contact');
    const okName = check(name, 'e-name'), okContact = check(contact, 'e-contact');
    if (!okName || !okContact) { (okName ? contact : name).focus(); return; }
    const speaker = $('input[name="intent"]:checked', form).value === 'speaker';
    const topic = speaker ? 'Приглашение выступить' : 'Обсудить бизнес';
    const text = [`Здравствуйте, Виктория! ${topic}.`, `Имя: ${name.value.trim()}`, `Контакт: ${contact.value.trim()}`, msg.value.trim() && `${speaker ? 'О мероприятии' : 'О бизнесе и задаче'}: ${msg.value.trim()}`].filter(Boolean).join('\n');
    if (channel === 'email') {
      location.href = `mailto:vika.talkan@gmail.com?subject=${encodeURIComponent(topic + ' — с сайта')}&body=${encodeURIComponent(text)}`;
      status.textContent = 'Открываем почту с готовым письмом.';
      return;
    }
    let copied = false;
    try { await navigator.clipboard.writeText(text); copied = true; } catch {}
    window.open('https://t.me/vika_talkan', '_blank', 'noopener');
    status.textContent = copied
      ? 'Текст скопирован. Вставьте его в открывшийся чат с Викторией и отправьте.'
      : 'Откройте чат @vika_talkan и отправьте сообщение с этими данными.';
  });
  $$('#f-name, #f-contact').forEach(i => i.addEventListener('input', () => {
    if (i.getAttribute('aria-invalid') === 'true') check(i, i.id === 'f-name' ? 'e-name' : 'e-contact');
  }));
})();
