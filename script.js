(() => {
  const pages = [...document.querySelectorAll('.page')];
  const book = document.querySelector('.book');
  const prev = document.querySelector('#prev-page');
  const next = document.querySelector('#next-page');
  const indicator = document.querySelector('#page-indicator');
  const navigation = document.querySelector('.book-nav');
  let current = 0;
  let wheelDistance = 0;
  let lastWheelNavigation = 0;
  function showPage(index) {
    current = Math.max(0, Math.min(index, pages.length - 1));
    pages.forEach((page, i) => page.classList.toggle('active', i === current));
    navigation.classList.toggle('on-cover', current === 0);
    indicator.textContent = `${String(current + 1).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;
    prev.disabled = current === 0;
    next.disabled = current === pages.length - 1;
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
