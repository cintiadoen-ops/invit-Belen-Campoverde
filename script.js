(() => {
  const pages = [...document.querySelectorAll('.page')];
  const book = document.querySelector('.book');
  const prev = document.querySelector('#prev-page');
  const next = document.querySelector('#next-page');
  const indicator = document.querySelector('#page-indicator');
  const navigation = document.querySelector('.book-nav');
  let current = 0;
  let turning = false;
  let wheelDistance = 0;
  let lastWheelNavigation = 0;

  /* ------------------------------------------------------------------
     Sombra que la hoja proyecta sobre la página de abajo
     ------------------------------------------------------------------ */
  const castShadow = document.createElement('div');
  castShadow.className = 'page-shadow';
  castShadow.setAttribute('aria-hidden', 'true');
  book.appendChild(castShadow);

  /* ------------------------------------------------------------------
     Animación 3D de la hoja
     ------------------------------------------------------------------ */
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const PIVOT = 14; // la bisagra está a 14px del borde izquierdo

  // p = 0 hoja cerrada sobre el libro · p = 1 hoja volteada a la izquierda
  function setTurn(page, p, width, perspective) {
    const theta = p * Math.PI;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    const flat = p >= 0.5; // a 90° la hoja es un canto: ya no se ve

    const transform = `rotateY(${(-p * 180).toFixed(2)}deg)`;
    page.style.setProperty('-webkit-transform', transform);
    page.style.transform = transform;
    page.style.visibility = 'visible';
    page.style.setProperty('--shade', (flat ? 1 : sin).toFixed(3));

    // dónde cae en pantalla el borde libre de la hoja (con perspectiva)
    const reach = width - PIVOT;
    const depth = reach * sin;
    const edge = width / 2 + (PIVOT + reach * cos - width / 2) * (perspective / (perspective - depth));
    castShadow.style.setProperty('--edge', `${Math.max(0, edge).toFixed(1)}px`);
    castShadow.style.opacity = flat ? '0' : Math.max(0, Math.sin(2 * theta)).toFixed(3);
  }

  function updatePageState() {
    book.classList.toggle('cover-visible', current === 0);
    pages.forEach((page, i) => {
      const active = i === current;
      page.classList.toggle('active', active);
      page.classList.toggle('is-turned', i < current);
      page.setAttribute('aria-hidden', String(!active));
      page.style.zIndex = active ? '100' : String(i < current ? i + 1 : pages.length - i);
    });
    navigation.classList.toggle('on-cover', current === 0);
    indicator.textContent = `${String(current + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;
    prev.disabled = turning || current === 0;
    next.disabled = turning || current === pages.length - 1;
  }

  function showPage(index) {
    const target = Math.max(0, Math.min(index, pages.length - 1));
    if (turning) return;
    if (target === current) {
      updatePageState();
      return;
    }

    const forward = target > current;
    const pageToTurn = pages[forward ? current : target];
    const isCover = pageToTurn === pages[0];
    const duration = isCover ? 1350 : 1000; // la tapa pesa más
    const from = forward ? 0 : 1;
    const to = forward ? 1 : 0;

    const finish = () => {
      turning = false;
      current = target;
      pageToTurn.classList.remove('is-turning-forward', 'is-turning-back');
      pageToTurn.style.removeProperty('-webkit-transform');
      pageToTurn.style.transform = '';
      pageToTurn.style.visibility = '';
      pageToTurn.style.removeProperty('--shade');
      castShadow.style.opacity = '0';
      updatePageState();
    };

    if (reducedMotion()) {
      finish();
      return;
    }

    turning = true;
    book.classList.remove('cover-visible');
    prev.disabled = true;
    next.disabled = true;
    pageToTurn.style.zIndex = '103';
    pageToTurn.classList.add(forward ? 'is-turning-forward' : 'is-turning-back');

    const width = book.clientWidth;
    const perspective = parseFloat(getComputedStyle(book).perspective) || 1800;
    const startedAt = performance.now();
    setTurn(pageToTurn, from, width, perspective);

    const frame = now => {
      const t = Math.min(1, (now - startedAt) / duration);
      const p = from + (to - from) * easeInOutCubic(t);
      setTurn(pageToTurn, p, width, perspective);
      if (t < 1) requestAnimationFrame(frame);
      else finish();
    };
    requestAnimationFrame(frame);
  }

  prev.addEventListener('click', () => showPage(current - 1));
  next.addEventListener('click', () => showPage(current + 1));
  document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => showPage(Number(button.dataset.go))));
  book.addEventListener('wheel', event => {
    const direction = Math.sign(event.deltaY);
    if (!direction || (direction < 0 && current === 0) || (direction > 0 && current === pages.length - 1)) return;

    for (let element = event.target; element instanceof HTMLElement && element !== book; element = element.parentElement) {
      const style = getComputedStyle(element);
      const scrollable = /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
      if (scrollable && (direction < 0 ? element.scrollTop > 0 : element.scrollTop + element.clientHeight < element.scrollHeight)) return;
    }

    event.preventDefault();
    const now = Date.now();
    if (now - lastWheelNavigation < 450) return;
    const delta = event.deltaY * (event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? book.clientHeight : 1);
    wheelDistance += delta;
    if (Math.abs(wheelDistance) < 40) return;

    showPage(current + Math.sign(wheelDistance));
    wheelDistance = 0;
    lastWheelNavigation = now;
  }, { passive: false });
  document.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') showPage(current + 1);
    if (event.key === 'ArrowLeft') showPage(current - 1);
  });
  const storageKey = 'belen-campoverde-rsvp-v1';
  const readEntries = () => { try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { return []; } };
  document.querySelector('#rsvp-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const occasions = [...form.querySelectorAll('input[name="occasion"]:checked')].map(item => item.value);
    const message = document.querySelector('#form-message');
    if (!occasions.length) { message.textContent = 'Selecciona al menos una ocasión para confirmar.'; return; }
    const entry = { name: form.elements.name.value.trim(), occasions, createdAt: new Date().toISOString() };
    const entries = readEntries();
    entries.push(entry);
    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
      const endpoint = window.RSVP_CONFIG?.googleAppsScriptUrl?.trim();
      if (endpoint) {
        fetch(endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(entry) }).catch(() => {});
      }
      const whatsAppText = [
        'Hola Belén, confirmo mi asistencia.',
        `Nombre: ${entry.name}`,
        `Asistiré a: ${entry.occasions.join(', ')}`
      ].join('\n');
      const whatsAppUrl = `https://wa.me/593978692094?text=${encodeURIComponent(whatsAppText)}`;
      window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
      message.textContent = 'Se abrió WhatsApp con tu confirmación. Revísala y pulsa Enviar para que le llegue a Belén.';
      form.reset();
    } catch {
      message.textContent = 'No se pudo guardar en este dispositivo. Revisa el espacio disponible.';
    }
  });
  showPage(0);
})();
