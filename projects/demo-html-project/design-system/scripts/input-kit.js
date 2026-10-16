/* =========================================================================
   Input Kit — общая фабрика для страниц InputText / InputDate /
   InputAutocomplete. Строит .inp из спецификации.
   Требует: icons-data.js подключён ДО этого файла (window.DS_ICONS).
   Экспорт: window.DSInputKit = { makeInput, esc, icon }
   ========================================================================= */
(function () {
  'use strict';
  const L = window.DS_ICONS || {};
  function icon(name) {
    return L[name] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>';
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

  /* чип внутри поля / во внешнем стеке.
     «+N» — чип-счётчик свёрнутых значений: без крестика удаления,
     по клику раскрывает полный список (в доках — статичный). */
  function makeChip(label, o = {}) {
    const isCounter = /^\+\d+$/.test(String(label).trim());
    const ch = document.createElement('span');
    ch.className = 'chip chip--edit chip--' + (o.size || 's');
    if (o.disabled) ch.classList.add('chip--disabled');
    else ch.tabIndex = 0;
    if (isCounter) {
      ch.setAttribute('aria-label', 'Показать все значения (ещё ' + String(label).trim().slice(1) + ')');
      ch.innerHTML = '<span class="chip__label">' + esc(label) + '</span>';
      return ch;
    }
    ch.innerHTML = '<span class="chip__label">' + esc(label) + '</span>' +
      '<span class="chip__remove" role="button" aria-label="Удалить ' + esc(label) + '">' + icon('close') + '</span>';
    if (o.onRemove) ch.querySelector('.chip__remove').addEventListener('click', (e) => { e.stopPropagation(); o.onRemove(label, ch); });
    return ch;
  }

  /*
    makeInput(spec):
      size 'm'|'s' · table bool (без label/helper) · width px|'auto'
      label · helper · helperError bool
      state: 'default'|'hover'|'focus'|'error'|'error-focus'|'warning'|'warning-focus'|'disabled'
      lead bool (иконка поиска) · prefix · postfix
      value · placeholder · multiline bool
      summary ('Value 1, +4') · chips [..] · ext [..] (внешний стек)
      clear · informer · calendar · chevron bool · open bool
      tip: текст тултипа ошибки/предупреждения (показывается при *-focus)
      live bool — рабочий ввод (крестик чистит поле)
      id — id контрола для label[for]
  */
  function makeInput(spec = {}) {
    const s = spec;
    const root = document.createElement('div');
    const size = s.size || 'm';
    root.className = 'inp inp--' + size;
    if (s.table) root.classList.add('inp--table');
    if (s.multiline) root.classList.add('inp--multiline');
    const st = s.state || 'default';
    if (st.startsWith('error')) root.classList.add('inp--error');
    if (st.startsWith('warning')) root.classList.add('inp--warning');
    if (st === 'disabled') root.classList.add('inp--disabled');
    if (st === 'hover') root.classList.add('is-hover');
    if (st === 'focus' || st.endsWith('-focus')) root.classList.add('is-focus');
    if (s.open) root.classList.add('is-open');
    if (s.width === 'auto') root.style.width = 'auto';
    else if (s.width) root.style.width = s.width + 'px';

    const disabled = st === 'disabled';

    /* label */
    if (s.label && !s.table) {
      const lb = document.createElement('label');
      lb.className = 'ds-label ds-label--left' + (disabled ? ' ds-label--disabled' : '');
      if (s.id) lb.htmlFor = s.id;
      lb.innerHTML = '<span class="ds-label__text">' + esc(s.label) + '</span>';
      root.appendChild(lb);
    }

    /* field */
    const f = document.createElement('div');
    f.className = 'inp__field';
    if (s.lead) { const li = document.createElement('span'); li.className = 'inp__lead'; li.innerHTML = icon('search'); f.appendChild(li); }
    if (s.prefix) { const p = document.createElement('span'); p.className = 'inp__prefix'; p.textContent = s.prefix; f.appendChild(p); }
    if (s.chips && s.chips.length) {
      const cw = document.createElement('span'); cw.className = 'inp__chips';
      s.chips.forEach(c => cw.appendChild(makeChip(c, { size: size === 's' ? 'xs' : 's', disabled, onRemove: s.onChipRemove })));
      f.appendChild(cw);
    }
    if (s.summary) { const sm = document.createElement('span'); sm.className = 'inp__summary'; sm.textContent = s.summary; f.appendChild(sm); }

    const ctl = document.createElement(s.multiline ? 'textarea' : 'input');
    ctl.className = 'inp__control';
    if (!s.multiline) ctl.type = 'text';
    else ctl.rows = s.rows || 2;
    if (s.id) ctl.id = s.id;
    if (s.value != null) ctl.value = s.value;
    if (s.placeholder) ctl.placeholder = s.placeholder;
    if (disabled) ctl.disabled = true;
    if (st.startsWith('error')) ctl.setAttribute('aria-invalid', 'true');
    f.appendChild(ctl);
    if (s.postfix) { const p = document.createElement('span'); p.className = 'inp__postfix'; p.textContent = s.postfix; f.appendChild(p); }

    /* actions — порядок слева направо: информер · крестик очистки · календарь · шеврон.
       Информер (статичная иконка-подсказка) всегда левее крестика и шеврона. */
    const actions = [];
    if (s.informer) actions.push(['informer', 'info-circle', 'Подсказка']);
    if (s.clear !== false && (s.clear || s.value || (s.chips && s.chips.length) || s.summary)) actions.push(['clear', 'close', 'Очистить поле']);
    if (s.calendar) actions.push(['calendar', 'calendar', 'Открыть календарь']);
    if (s.chevron) actions.push(['chev', 'chevron-down', 'Показать список']);
    if (actions.length) {
      const aw = document.createElement('span'); aw.className = 'inp__acts';
      actions.forEach(([kind, glyph, aria]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'inp__act' + (kind === 'chev' ? ' inp__act--chev' : '') + (kind === 'informer' ? ' inp__act--static' : '');
        b.setAttribute('aria-label', aria);
        if (disabled) b.disabled = true;
        b.innerHTML = icon(glyph);
        if (kind === 'clear' && s.live) b.addEventListener('click', () => { ctl.value = ''; ctl.dispatchEvent(new Event('input', { bubbles: true })); ctl.focus(); });
        if (kind === 'clear' && s.onClear) b.addEventListener('click', s.onClear);
        aw.appendChild(b);
      });
      f.appendChild(aw);
    }
    root.appendChild(f);

    /* тултип ошибки/предупреждения — статично, при *-focus */
    if (s.tip && st.endsWith('-focus')) {
      const t = document.createElement('span');
      const kind = st.startsWith('error') ? 'error' : 'warning';
      t.className = 'tip tip--bottom tip--start tip--multiline' + (kind === 'error' ? ' tip--error' : '');
      if (kind === 'warning') t.style.setProperty('--tip-bg', 'var(--warning)');
      t.style.marginTop = '6px';
      t.style.alignSelf = 'flex-start';
      t.setAttribute('role', 'alert');
      t.innerHTML = esc(s.tip) + '<span class="tip__arrow"></span>';
      root.appendChild(t);
    }

    /* helper */
    if (s.helper && !s.table) {
      const h = document.createElement('span');
      h.className = 'ds-helper ds-helper--left'
        + (s.helperError || st.startsWith('error') ? ' ds-helper--error' : '')
        + (disabled ? ' ds-helper--disabled' : '');
      h.textContent = s.helper;
      root.appendChild(h);
    }

    /* внешний стек чипов (Chips Ext) */
    if (s.ext && s.ext.length) {
      const ew = document.createElement('div');
      ew.className = 'inp-ext';
      ew.setAttribute('role', 'group');
      ew.setAttribute('aria-label', 'Выбранные значения');
      s.ext.forEach(c => ew.appendChild(makeChip(c, { size: size === 's' ? 'xs' : 's', disabled, onRemove: s.onChipRemove })));
      root.appendChild(ew);
    }

    root._field = f;
    root._control = ctl;
    return root;
  }

  window.DSInputKit = { makeInput, makeChip, esc, icon };
})();
