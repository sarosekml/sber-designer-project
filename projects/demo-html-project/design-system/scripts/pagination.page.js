/* =========================================================================
   Pagination — documentation page logic
   Требует: icons-data.js подключён ДО этого файла (window.DS_ICONS).
   ========================================================================= */
(function () {
  const L = window.DS_ICONS || {};
  const icon = (n) => L[n] || '';
  const WARN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
  function range(a, b) { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; }

  /* =========================================================================
     WINDOWING ALGORITHM — какие номера страниц показывать, где «…»
     boundaryCount — сколько номеров у каждого края всегда видно (по умолч. 1)
     siblingCount  — сколько номеров вокруг текущей страницы (по умолч. 1)
     ========================================================================= */
  function pageWindow(current, total, siblingCount, boundaryCount) {
    siblingCount = siblingCount == null ? 1 : siblingCount;
    boundaryCount = boundaryCount == null ? 1 : boundaryCount;
    if (total <= 1) return [1];
    const totalNumbers = boundaryCount * 2 + siblingCount * 2 + 3;
    if (total <= totalNumbers) return range(1, total);

    const leftSibling = Math.max(current - siblingCount, 1);
    const rightSibling = Math.min(current + siblingCount, total);
    const showLeftEllipsis = leftSibling > boundaryCount + 2;
    const showRightEllipsis = rightSibling < total - boundaryCount - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
      const leftItemCount = boundaryCount + siblingCount * 2 + 2;
      return [...range(1, leftItemCount), '...', ...range(total - boundaryCount + 1, total)];
    }
    if (showLeftEllipsis && !showRightEllipsis) {
      const rightItemCount = boundaryCount + siblingCount * 2 + 2;
      return [...range(1, boundaryCount), '...', ...range(total - rightItemCount + 1, total)];
    }
    if (showLeftEllipsis && showRightEllipsis) {
      return [...range(1, boundaryCount), '...', ...range(leftSibling, rightSibling), '...', ...range(total - boundaryCount + 1, total)];
    }
    return range(1, total);
  }
  window.PGN_pageWindow = pageWindow; // exposed for the dev "how it's computed" demo

  /* =========================================================================
     FACTORY — .pgn (pager)
     o: { total, pageSize, page, pageSizeOptions, showPageSize, compact,
          disabled, loading, onChange(page), onPageSizeChange(size) }
     ========================================================================= */
  const DEFAULT_SIZES = [5, 10, 15, 20, 50, 'all'];
  function sizeLabel(v) { return v === 'all' ? 'Все' : String(v); }
  function totalPages(total, pageSize) { return pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / pageSize)); }

  function buildPager(o = {}) {
    const opts = Object.assign({
      total: 800, pageSize: 50, page: 1, pageSizeOptions: DEFAULT_SIZES,
      showPageSize: true, compact: false, disabled: false, loading: false, responsive: true,
      onChange: null, onPageSizeChange: null,
    }, o);

    const host = document.createElement('div');
    host.className = 'pgn' + (opts.compact ? ' pgn--compact' : '') + (opts.disabled ? ' pgn--disabled' : '') + (opts.loading ? ' pgn--loading' : '');
    if (opts.disabled) host.setAttribute('aria-disabled', 'true');

    const tp = totalPages(opts.total, opts.pageSize);
    const page = Math.min(Math.max(1, opts.page), tp);

    /* ---------- pagesize ---------- */
    if (opts.showPageSize) {
      const anchor = document.createElement('span');
      anchor.className = 'ddl-anchor';
      const trg = document.createElement('button');
      trg.type = 'button';
      trg.className = 'pgn__pagesize';
      trg.setAttribute('aria-haspopup', 'listbox');
      trg.innerHTML = 'Показывать строк: <b>' + sizeLabel(opts.pageSize) + '</b><span class="pgn__pagesize__chev">' + (icon('chevron-down') || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>') + '</span>';
      if (opts.disabled) trg.disabled = true;
      const list = document.createElement('div');
      list.className = 'ddl ddl--floating';
      list.setAttribute('role', 'listbox');
      opts.pageSizeOptions.forEach((v) => {
        const it = document.createElement('button');
        it.type = 'button';
        it.className = 'ddl__item';
        it.setAttribute('role', 'option');
        it.setAttribute('aria-selected', String(v === opts.pageSize));
        it.innerHTML = '<span class="ddl__item-body"><span class="ddl__item-label">' + sizeLabel(v) + '</span></span>';
        it.addEventListener('click', () => {
          set(false);
          if (opts.onPageSizeChange) opts.onPageSizeChange(v);
        });
        list.appendChild(it);
      });
      anchor.appendChild(trg); anchor.appendChild(list);
      host.appendChild(anchor);

      let open = false;
      function place() {
        list.style.minWidth = trg.offsetWidth + 'px';
        const ar = anchor.getBoundingClientRect();
        const vh = document.documentElement.clientHeight;
        const fr = trg.getBoundingClientRect();
        const lh = list.offsetHeight, gap = 6;
        let placement = 'bottom';
        if ((vh - fr.bottom) < lh + gap && fr.top > lh) placement = 'top';
        const y = placement === 'top' ? (fr.top - ar.top) - gap - lh : (fr.bottom - ar.top) + gap;
        list.style.left = Math.round(fr.left - ar.left) + 'px';
        list.style.top = Math.round(y) + 'px';
        list.style.setProperty('--ddl-origin', (placement === 'top' ? 'bottom' : 'top') + ' left');
      }
      function set(v) {
        open = v;
        list.classList.toggle('is-open', open);
        trg.classList.toggle('is-open', open);
        if (open) { place(); document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', onEsc); }
        else { document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', onEsc); }
      }
      function outside(e) { if (!anchor.contains(e.target)) set(false); }
      function onEsc(e) { if (e.key === 'Escape') set(false); }
      trg.addEventListener('click', () => { if (!opts.disabled) set(!open); });
      window.addEventListener('resize', () => { if (open) place(); });
    }

    /* ---------- range ---------- */
    const rangeEl = document.createElement('span');
    rangeEl.className = 'pgn__range';
    rangeEl.textContent = page + ' из ' + tp;
    host.appendChild(rangeEl);

    if (opts.loading) {
      const sp = document.createElement('span'); sp.className = 'pgn__spinner'; host.appendChild(sp);
    }

    /* ---------- nav (перестраиваемый: число номеров зависит от tier) ---------- */
    const CHEV_L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>';
    const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>';
    const nav = document.createElement('nav');
    nav.className = 'pgn__nav';
    nav.setAttribute('aria-label', 'Страницы');

    function makeArrow(dir) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pgn__arrow';
      b.setAttribute('aria-label', dir < 0 ? 'Предыдущая страница' : 'Следующая страница');
      b.innerHTML = dir < 0 ? (icon('chevron-left') || CHEV_L) : (icon('chevron-right') || CHEV_R);
      const atBound = dir < 0 ? page <= 1 : page >= tp;
      if (atBound || opts.disabled) b.setAttribute('aria-disabled', 'true');
      b.addEventListener('click', () => {
        if (opts.disabled) return;
        const target = page + dir;
        if (target >= 1 && target <= tp && opts.onChange) opts.onChange(target);
      });
      return b;
    }

    function renderNav(sibling, boundary, inNavRange) {
      nav.innerHTML = '';
      nav.appendChild(makeArrow(-1));
      pageWindow(page, tp, sibling, boundary).forEach((p) => {
        if (p === '...') {
          const e = document.createElement('span'); e.className = 'pgn__ellipsis';
          e.setAttribute('aria-hidden', 'true'); e.textContent = '\u2026'; nav.appendChild(e);
          return;
        }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pgn__num'; b.textContent = String(p);
        b.setAttribute('aria-label', 'Страница ' + p);
        if (p === page) b.setAttribute('aria-current', 'page');
        else b.addEventListener('click', () => { if (!opts.disabled && opts.onChange) opts.onChange(p); });
        if (opts.disabled) b.disabled = true;
        nav.appendChild(b);
      });
      if (inNavRange) {
        const r = document.createElement('span'); r.className = 'pgn__range';
        r.textContent = page + ' из ' + tp;
        nav.appendChild(r);
      }
      nav.appendChild(makeArrow(1));
    }
    renderNav(1, 1, opts.compact);
    host.appendChild(nav);

    /* ---------- responsive controller (ResizeObserver → data-tier) ---------- */
    const TIERS = {
      l:  { sibling: 1, boundary: 1, compact: false },
      m:  { sibling: 0, boundary: 1, compact: false },
      s:  { sibling: 0, boundary: 1, compact: true  },
      xs: { sibling: 0, boundary: 0, compact: true  },
    };
    function tierFor(w) { return w >= 680 ? 'l' : w >= 520 ? 'm' : w >= 380 ? 's' : 'xs'; }
    function applyTier(w) {
      const t = tierFor(w);
      if (host.dataset.tier === t) return;
      host.dataset.tier = t;
      const row = host.closest('.pgn-row');
      if (row) {
        row.dataset.tier = t;
        const footer = row.closest('.pgn-footer');
        if (footer) footer.querySelectorAll(':scope > .pgn-row').forEach((r) => { r.dataset.tier = t; });
      }
      const c = TIERS[t];
      host.classList.toggle('pgn--compact', c.compact);
      renderNav(c.sibling, c.boundary, c.compact);
    }
    const AUTO = !opts.compact && opts.responsive !== false;
    if (AUTO && typeof ResizeObserver !== 'undefined') {
      requestAnimationFrame(() => {
        const measured = host.closest('.pgn-row') || host.parentElement || host;
        applyTier(measured.getBoundingClientRect().width || 800);
        const ro = new ResizeObserver((es) => {
          if (!host.isConnected) { ro.disconnect(); return; }
          applyTier(es[0].target.getBoundingClientRect().width);
        });
        ro.observe(measured);
      });
    }

    return host;
  }
  window.PGN_build = buildPager;

  /* ---------- Action_panel (bulk selection) ---------- */
  function buildBulk(o = {}) {
    const opts = Object.assign({ count: 4, actions: ['Экспорт', 'Согласовать', 'Удалить'] }, o);
    const host = document.createElement('div');
    host.className = 'pgn-bulk';
    const c = document.createElement('span'); c.className = 'pgn-bulk__count';
    c.innerHTML = 'Выбрано строк: <b>' + opts.count + '</b>';
    const acts = document.createElement('div'); acts.className = 'pgn-bulk__actions';
    opts.actions.forEach((label) => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'btn btn--s btn--outline';
      b.textContent = label; acts.appendChild(b);
    });
    host.append(c, acts);
    return host;
  }
  window.PGN_buildBulk = buildBulk;

  /* ---------- Pagi_counters (info summary) ---------- */
  function buildInfo(o = {}) {
    const opts = Object.assign({ items: [['Сумма дохода', '23 597 млрд ₽']], warn: 'Превышение лимита' }, o);
    const host = document.createElement('div'); host.className = 'pgn-info';
    opts.items.forEach(([label, value]) => {
      const it = document.createElement('span'); it.className = 'pgn-info__item';
      it.innerHTML = escapeHtml(label) + ': <b>' + escapeHtml(value) + '</b>';
      host.appendChild(it);
    });
    if (opts.warn) {
      const w = document.createElement('span'); w.className = 'pgn-info__warn'; w.innerHTML = WARN + '<span>' + escapeHtml(opts.warn) + '</span>';
      host.appendChild(w);
    }
    return host;
  }
  window.PGN_buildInfo = buildInfo;

  /* ---------- Row composition ---------- */
  function buildRow(o = {}) {
    const host = document.createElement('div'); host.className = 'pgn-row';
    const left = document.createElement('div'); left.className = 'pgn-row__left';
    if (o.info) left.appendChild(buildInfo(o.info));
    const right = document.createElement('div'); right.className = 'pgn-row__right';
    right.appendChild(buildPager(o.pager || {}));
    host.append(left, right);
    return host;
  }
  window.PGN_buildRow = buildRow;

  /* ---------- Footer composition — Action_panel (опционально, НАД) + обычная строка ---------- */
  function buildFooter(o = {}) {
    const wrap = document.createElement('div'); wrap.className = 'pgn-footer';
    const selectionCount = o.selectionCount || 0;
    if (selectionCount > 0) {
      const bulkRow = document.createElement('div'); bulkRow.className = 'pgn-row pgn-row--bulk';
      bulkRow.appendChild(buildBulk(Object.assign({ count: selectionCount }, o.bulk || {})));
      wrap.appendChild(bulkRow);
    }
    wrap.appendChild(buildRow(o));
    return wrap;
  }
  window.PGN_buildFooter = buildFooter;

  function mount(id, node) { const el = document.getElementById(id); if (el && node) el.appendChild(node); }

  /* ============================ PLAYGROUND ============================ */
  (function () {
    const controls = document.getElementById('pg-controls');
    const preview = document.getElementById('pg-preview');
    const codeEl = document.getElementById('pg-code');
    if (!controls || !preview) return;

    const state = { total: 800, pageSize: 50, page: 3, left: 'none', selection: 0, system: 'default', showPageSize: true };

    function select(label, options, getCur, onPick) {
      const wrap = document.createElement('div'); wrap.className = 'ctl';
      const l = document.createElement('div'); l.className = 'lbl'; l.textContent = label; wrap.appendChild(l);
      const box = document.createElement('div'); box.className = 'pg-select';
      const sel = document.createElement('select');
      options.forEach(([val, txt]) => { const op = document.createElement('option'); op.value = val; op.textContent = txt; if (String(val) === String(getCur())) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', () => { onPick(sel.value); render(); });
      box.appendChild(sel); wrap.appendChild(box); return wrap;
    }
    function sw(label, key) {
      const t = document.createElement('button'); t.type = 'button'; t.className = 'toggle'; t.dataset.key = key;
      t.setAttribute('aria-pressed', String(state[key]));
      t.innerHTML = '<span class="sw"></span><span>' + label + '</span>';
      t.addEventListener('click', () => { state[key] = !state[key]; t.setAttribute('aria-pressed', String(state[key])); render(); });
      return t;
    }

    controls.appendChild(select('Всего строк', [['16', '16'], ['84', '84'], ['320', '320'], ['800', '800'], ['15000', '15 000']], () => state.total, v => { state.total = +v; if (state.page > totalPages(state.total, state.pageSize)) state.page = totalPages(state.total, state.pageSize); }));
    controls.appendChild(select('Размер страницы', DEFAULT_SIZES.map(v => [String(v), sizeLabel(v)]), () => state.pageSize, v => { state.pageSize = v === 'all' ? 'all' : +v; const tp = totalPages(state.total, state.pageSize); if (state.page > tp) state.page = tp; }));
    controls.appendChild(select('Левый слот', [['none', 'Нет'], ['info', 'Инфо-сводка']], () => state.left, v => state.left = v));
    controls.appendChild(select('Выбрано строк (Action panel)', [['0', 'Нет'], ['2', '2'], ['4', '4'], ['12', '12']], () => state.selection, v => state.selection = +v));
    controls.appendChild(select('Состояние', [['default', 'Default'], ['disabled', 'Disabled'], ['loading', 'Loading']], () => state.system, v => state.system = v));

    const optWrap = document.createElement('div'); optWrap.className = 'ctl';
    const ol = document.createElement('div'); ol.className = 'lbl'; ol.textContent = 'Опции'; optWrap.appendChild(ol);
    const toggles = document.createElement('div'); toggles.className = 'toggles';
    toggles.appendChild(sw('Селектор размера страницы', 'showPageSize'));
    optWrap.appendChild(toggles); controls.appendChild(optWrap);

    function render() {
      preview.innerHTML = '';
      const tp = totalPages(state.total, state.pageSize);
      if (state.page > tp) state.page = tp;
      const disabled = state.system === 'disabled';
      const loading = state.system === 'loading';

      const node = buildFooter({
        selectionCount: state.selection,
        info: state.left === 'info' ? {} : null,
        pager: {
          total: state.total, pageSize: state.pageSize, page: state.page,
          showPageSize: state.showPageSize,
          disabled, loading,
          onChange: (p) => { state.page = p; render(); },
          onPageSizeChange: (v) => { state.pageSize = v; state.page = 1; render(); },
        },
      });
      node.style.width = '100%';
      preview.appendChild(node);

      const cls = 'pgn' + (disabled ? ' pgn--disabled' : '') + (loading ? ' pgn--loading' : '');
      codeEl.innerHTML = '<code>&lt;div class="pgn-row"&gt;…&lt;div class="' + cls + '"&gt;…&lt;/div&gt;&lt;/div&gt;</code> — страница ' + Math.min(state.page, tp) + ' из ' + tp;
    }
    render();
    window.addEventListener('resize', render);
  })();

  /* ============================ USAGE — mock table ============================ */
  (function () {
    const host = document.getElementById('use-table');
    if (!host) return;
    const rows = [
      ['06.06.2022', 'Реструктуризация', 'Согласовано'],
      ['06.06.2022', 'Реструктуризация', 'Согласовано'],
      ['05.06.2022', 'Новая сделка', 'На согласовании'],
      ['04.06.2022', 'Реструктуризация', 'Согласовано'],
      ['01.06.2022', 'Закрытие', 'Согласовано'],
    ];
    const table = document.createElement('div'); table.className = 'tbl';
    const head = document.createElement('div'); head.className = 'tbl__row tbl__row--head';
    head.innerHTML = '<span>Дата изменений</span><span>Тип изменений</span><span>Статус</span>';
    table.appendChild(head);
    rows.forEach(r => {
      const row = document.createElement('div'); row.className = 'tbl__row';
      row.innerHTML = '<span>' + r[0] + '</span><span>' + r[1] + '</span><span class="tbl__status">' + r[2] + '</span>';
      table.appendChild(row);
    });
    table.appendChild(buildRow({ pager: { total: 780, pageSize: 50, page: 2, onChange() {} } }));
    host.appendChild(table);
  })();

  /* ============================ ANATOMY ============================ */
  (function () {
    const d = document.getElementById('anat-diagram');
    if (!d) return;
    const row = buildRow({ info: {}, pager: { total: 800, pageSize: 50, page: 5, onChange() {} } });
    row.style.width = '720px'; row.style.maxWidth = '100%';
    d.appendChild(row);
    requestAnimationFrame(() => {
      const marks = [
        ['1', '9%', '-16px'],
        ['2', '26%', 'calc(100% + 16px)'],
        ['3', '40%', '-16px'],
        ['4', '58%', 'calc(100% + 16px)'],
        ['5', '68%', '-16px'],
        ['6', '80%', 'calc(100% + 16px)'],
        ['7', '92%', '-16px'],
      ];
      marks.forEach(([n, left, top]) => {
        const m = document.createElement('span'); m.className = 'mk'; m.textContent = n;
        m.style.left = left; m.style.top = top; d.appendChild(m);
      });
    });
  })();

  /* ============================ SCROLL BEHAVIOUR DEMOS ============================ */
  (function () {
    const hHost = document.getElementById('demo-hscroll');
    if (hHost) {
      const cols = ['UID объекта', 'Идентификатор организации', 'CRM ID', 'ИНН', 'Краткое наименование', 'ОГРН', 'КПП', 'Территориальный банк'];
      const wide = document.createElement('div'); wide.className = 'tbl tbl--wide';
      const head = document.createElement('div'); head.className = 'tbl__row tbl__row--head';
      head.innerHTML = cols.map(c => '<span>' + c + '</span>').join('');
      wide.appendChild(head);
      for (let i = 0; i < 4; i++) {
        const row = document.createElement('div'); row.className = 'tbl__row';
        row.innerHTML = cols.map(() => '<span>1234567890</span>').join('');
        wide.appendChild(row);
      }
      const scrollBox = document.createElement('div'); scrollBox.className = 'demo-scroll__body'; scrollBox.appendChild(wide);
      hHost.appendChild(scrollBox);
      hHost.appendChild(buildRow({ pager: { total: 320, pageSize: 20, page: 1, showPageSize: false, onChange() {} } }));
    }

    const vHost = document.getElementById('demo-vscroll');
    if (vHost) {
      const list = document.createElement('div'); list.className = 'demo-vscroll__body';
      for (let i = 1; i <= 14; i++) {
        const row = document.createElement('div'); row.className = 'tbl__row';
        row.innerHTML = '<span>Строка ' + i + '</span><span>—</span><span>—</span>';
        list.appendChild(row);
      }
      const footer = buildRow({ pager: { total: 320, pageSize: 20, page: 1, showPageSize: false, onChange() {} } });
      footer.classList.add('demo-vscroll__footer');
      vHost.appendChild(list);
      vHost.appendChild(footer);
    }
  })();

  /* ============================ SPLITTER (master-detail) DEMO ============================ */
  (function () {
    const wrap = document.getElementById('demo-split');
    if (!wrap) return;
    const left = document.createElement('div'); left.className = 'demo-split__pane demo-split__pane--list';
    const spl = document.createElement('div'); spl.className = 'spl'; spl.setAttribute('role', 'separator'); spl.tabIndex = 0;
    const grip = document.createElement('span'); grip.className = 'spl__grip'; for (let i = 0; i < 6; i++) grip.appendChild(document.createElement('i'));
    spl.appendChild(grip);
    const right = document.createElement('div'); right.className = 'demo-split__pane demo-split__pane--detail';
    right.innerHTML = '<div class="demo-split__detailhead">ОАО «Ромашка»</div><div class="demo-split__detailrow"><span>ИНН</span><b>6396227173</b></div><div class="demo-split__detailrow"><span>КПП</span><b>021101001</b></div><div class="demo-split__detailrow"><span>ОГРН</span><b>1943422814273</b></div>';

    const table = document.createElement('div'); table.className = 'tbl';
    const head = document.createElement('div'); head.className = 'tbl__row tbl__row--head';
    head.innerHTML = '<span>UID</span><span>Наименование</span><span>ИНН</span>';
    table.appendChild(head);
    for (let i = 0; i < 6; i++) {
      const row = document.createElement('div'); row.className = 'tbl__row' + (i === 1 ? ' tbl__row--focus' : '');
      row.innerHTML = '<span>1234567890</span><span>ОАО «Ромашка»</span><span>6396227173</span>';
      table.appendChild(row);
    }
    left.appendChild(table);
    left.appendChild(buildRow({ pager: { total: 320, pageSize: 16, page: 2, onChange() {} } }));

    wrap.append(left, spl, right);

    const DEFAULT_W = 0.62;
    function setSplit(frac) {
      frac = Math.max(0.3, Math.min(0.78, frac));
      wrap.style.setProperty('--split-frac', (frac * 100).toFixed(2) + '%');
    }
    setSplit(DEFAULT_W);
    spl.addEventListener('pointerdown', (e) => {
      e.preventDefault(); spl.setPointerCapture(e.pointerId); spl.classList.add('spl--move');
      const wr = wrap.getBoundingClientRect();
      function onMove(ev) { setSplit((ev.clientX - wr.left) / wr.width); }
      function onUp() { spl.classList.remove('spl--move'); spl.removeEventListener('pointermove', onMove); spl.removeEventListener('pointerup', onUp); }
      spl.addEventListener('pointermove', onMove); spl.addEventListener('pointerup', onUp);
    });
    spl.addEventListener('dblclick', () => setSplit(DEFAULT_W));
  })();

  /* ============================ CONTENT — windowing examples ============================ */
  (function () {
    const rows = [
      ['Мало страниц — «…» не нужен', 6, 3],
      ['Текущая в начале', 24, 2],
      ['Текущая в середине', 24, 12],
      ['Текущая в конце', 24, 23],
      ['Единственная страница', 1, 1],
    ];
    const host = document.getElementById('content-windows');
    if (!host) return;
    rows.forEach(([label, total, page]) => {
      const wrap = document.createElement('div'); wrap.className = 'window-row';
      const cap = document.createElement('span'); cap.className = 'window-row__cap'; cap.textContent = label + ' (' + total + ' стр.)';
      const nav = document.createElement('div'); nav.className = 'pgn';
      const nv = document.createElement('div'); nv.className = 'pgn__nav';
      const prevB = document.createElement('span'); prevB.className = 'pgn__arrow'; prevB.innerHTML = icon('chevron-left');
      if (page <= 1) prevB.setAttribute('aria-disabled', 'true');
      nv.appendChild(prevB);
      pageWindow(page, total, 1, 1).forEach(p => {
        if (p === '...') { const e = document.createElement('span'); e.className = 'pgn__ellipsis'; e.textContent = '\u2026'; nv.appendChild(e); return; }
        const b = document.createElement('span'); b.className = 'pgn__num'; b.textContent = p;
        if (p === page) b.setAttribute('aria-current', 'page');
        nv.appendChild(b);
      });
      const nextB = document.createElement('span'); nextB.className = 'pgn__arrow'; nextB.innerHTML = icon('chevron-right');
      if (page >= total) nextB.setAttribute('aria-disabled', 'true');
      nv.appendChild(nextB);
      nav.appendChild(nv);
      wrap.append(cap, nav);
      host.appendChild(wrap);
    });
  })();

  /* ============================ CONTENT — pagesize options ============================ */
  (function () {
    const host = document.getElementById('content-pagesize');
    if (!host) return;
    const anchor = document.createElement('span'); anchor.className = 'ddl-anchor';
    const trg = document.createElement('button'); trg.type = 'button'; trg.className = 'pgn__pagesize is-open';
    trg.innerHTML = 'Показывать строк: <b>20</b><span class="pgn__pagesize__chev">' + icon('chevron-down') + '</span>';
    const list = document.createElement('div'); list.className = 'ddl ddl--floating ddl--pinned';
    DEFAULT_SIZES.forEach(v => {
      const it = document.createElement('div'); it.className = 'ddl__item'; it.setAttribute('role', 'option');
      it.setAttribute('aria-selected', String(v === 20));
      it.innerHTML = '<span class="ddl__item-body"><span class="ddl__item-label">' + sizeLabel(v) + '</span></span>';
      list.appendChild(it);
    });
    anchor.append(trg, list);
    host.appendChild(anchor);
    requestAnimationFrame(() => { list.style.position = 'static'; list.style.marginTop = '6px'; list.style.opacity = '1'; list.style.visibility = 'visible'; list.style.transform = 'none'; });
  })();

  /* ============================ STATES (spec) ============================ */
  (function () {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;';
    document.body.appendChild(probe);
    function resolveHex(token) {
      const cssVal = token.startsWith('--') ? 'var(' + token + ')' : token;
      probe.style.backgroundColor = 'transparent'; probe.style.backgroundColor = cssVal;
      const v = getComputedStyle(probe).backgroundColor;
      let r, g, b, a = 1, m = v.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
      if (m) { r = +m[1] * 255; g = +m[2] * 255; b = +m[3] * 255; if (m[4] !== undefined) a = +m[4]; }
      else { const n = v.match(/[\d.]+/g); if (!n) return ''; r = +n[0]; g = +n[1]; b = +n[2]; if (n[3] !== undefined) a = +n[3]; }
      const hx = n => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
      let s = '#' + hx(r) + hx(g) + hx(b); if (a < 1) s += ', ' + Math.round(a * 100) + '%'; return s;
    }
    function cline(role, token, name, raw) {
      const cssVal = token.startsWith('--') ? 'var(' + token + ')' : token;
      return `<div class="spec__cline"><b>${role}</b><span class="spec__sw" style="background:${cssVal}"></span><span><span class="tnm">${name}</span></span><span class="raw">${raw} · ${resolveHex(token)}</span></div>`;
    }
    function miniNav(mkFn) {
      const nav = document.createElement('div'); nav.className = 'pgn__nav';
      mkFn(nav);
      return nav;
    }
    const rows = [
      ['Default (номер)', () => miniNav(nav => {
        [1, 2, 3].forEach(p => { const b = document.createElement('span'); b.className = 'pgn__num'; b.textContent = p; nav.appendChild(b); });
      }), [
        ['Текст', '--text-secondary', 'Text_Secondary', 'CGrey_500'],
        ['Фон', 'transparent', '—', 'без заливки'],
      ]],
      ['Hover', () => miniNav(nav => {
        [1, 2, 3].forEach(p => { const b = document.createElement('span'); b.className = 'pgn__num' + (p === 2 ? ' is-hover' : ''); b.textContent = p; if (p === 2) { b.style.background = 'var(--tertiary-light)'; b.style.color = 'var(--text-primary)'; } nav.appendChild(b); });
      }), [
        ['Фон', '--tertiary-light', 'Tertiary_Light', 'Swamp_50'],
        ['Текст', '--text-primary', 'Text_Primary', 'CGrey_600'],
      ]],
      ['Current (текущая)', () => miniNav(nav => {
        [1, 2, 3].forEach(p => { const b = document.createElement('span'); b.className = 'pgn__num'; b.textContent = p; if (p === 2) b.setAttribute('aria-current', 'page'); nav.appendChild(b); });
      }), [
        ['Фон', '--bgtable-row-focus', 'BGTable_RowFocus', 'Swamp_a700'],
        ['Текст', '--text-black', 'Text_Black', 'CGrey_800'],
      ]],
      ['Arrow · Default / Disabled', () => miniNav(nav => {
        const p = document.createElement('span'); p.className = 'pgn__arrow'; p.innerHTML = icon('chevron-left'); nav.appendChild(p);
        const n = document.createElement('span'); n.className = 'pgn__arrow'; n.setAttribute('aria-disabled', 'true'); n.innerHTML = icon('chevron-right'); nav.appendChild(n);
      }), [
        ['Default', '--text-secondary', 'Text_Secondary', 'CGrey_500'],
        ['Disabled', '--text-inactive', 'Text_Inactive', 'CGrey_300'],
      ]],
      ['Disabled (весь компонент)', () => {
        const nav = miniNav(nav => {
          [1, 2].forEach(p => { const b = document.createElement('span'); b.className = 'pgn__num'; if (p === 1) b.setAttribute('aria-current', 'page'); b.textContent = p; nav.appendChild(b); });
        });
        nav.closest && null;
        const wrap = document.createElement('div'); wrap.className = 'pgn pgn--disabled'; wrap.appendChild(nav);
        return wrap;
      }, [
        ['Текст', '--text-inactive', 'Text_Inactive', 'CGrey_300'],
        ['Current фон', '--disabled-bg', 'DisabledBG', 'CGrey_50'],
      ]],
    ];
    const host = document.getElementById('state-specs');
    if (!host) return;
    rows.forEach(([title, mkr, colors]) => {
      const spec = document.createElement('div'); spec.className = 'spec';
      const row = document.createElement('div'); row.className = 'spec__row';
      const a = document.createElement('div'); a.className = 'spec__state'; a.textContent = title; row.appendChild(a);
      const b = document.createElement('div'); b.className = 'spec__sample'; b.appendChild(mkr()); row.appendChild(b);
      const c = document.createElement('div'); c.className = 'spec__colors'; c.innerHTML = colors.map(cc => cline(cc[0], cc[1], cc[2], cc[3])).join(''); row.appendChild(c);
      spec.appendChild(row); host.appendChild(spec);
    });
    probe.remove();
  })();

  /* ============================ LOADING demo ============================ */
  (function () {
    mount('demo-loading', buildPager({ total: 800, pageSize: 50, page: 3, loading: true, onChange() {} }));
  })();

  /* ============================ ADAPTIVITY demos ============================ */
  (function () {
    // фиксированные снимки уровней
    const host = document.getElementById('adapt-tiers');
    if (host) {
      const samples = [
        ['l · ≥ 680px — полный набор', 720],
        ['m · ≥ 520px — сокращённый (1 … N … Last)', 560],
        ['s · ≥ 380px — вертикаль, только стрелки', 420],
        ['xs · < 380px — пагинатор в две строки', 320],
      ];
      samples.forEach(([label, w]) => {
        const wrap = document.createElement('div'); wrap.className = 'adapt-sample';
        const cap = document.createElement('p'); cap.className = 'demo-rowlabel'; cap.textContent = label;
        const frame = document.createElement('div'); frame.className = 'adapt-frame'; frame.style.width = w + 'px'; frame.style.maxWidth = '100%';
        frame.appendChild(buildRow({ info: {}, pager: { total: 480, pageSize: 20, page: 6, onChange() {} } }));
        wrap.append(cap, frame);
        host.appendChild(wrap);
      });
    }
    // живой ресайз
    const live = document.getElementById('adapt-live');
    if (live) live.appendChild(buildRow({ info: {}, pager: { total: 480, pageSize: 20, page: 6, onChange() {} } }));
  })();

  /* ============================ BUTTON states (structure section) ============================ */
  (function () {
    const host = document.getElementById('btn-states');
    if (!host) return;
    function num(text, opt = {}) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pgn__num';
      b.textContent = text;
      if (opt.current) b.setAttribute('aria-current', 'page');
      if (opt.hover) { b.style.background = 'var(--tertiary-light)'; b.style.color = 'var(--text-primary)'; }
      if (opt.focus) { b.style.outline = '2px solid var(--primary)'; b.style.outlineOffset = '1px'; }
      if (opt.disabled) { b.disabled = true; b.style.color = 'var(--text-inactive)'; }
      return b;
    }
    function arrow(dir, opt = {}) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pgn__arrow';
      b.innerHTML = icon(dir < 0 ? 'chevron-left' : 'chevron-right');
      if (opt.disabled) b.setAttribute('aria-disabled', 'true');
      if (opt.hover) { b.style.background = 'var(--tertiary-light)'; b.style.color = 'var(--text-primary)'; }
      return b;
    }
    const cells = [
      ['Default', num('7')],
      ['Hover', num('7', { hover: true })],
      ['Focus', num('7', { focus: true })],
      ['Current', num('7', { current: true })],
      ['Disabled', num('7', { disabled: true })],
      ['Arrow', arrow(-1)],
      ['Arrow · hover', arrow(1, { hover: true })],
      ['Arrow · disabled', arrow(-1, { disabled: true })],
      ['Ellipsis', (() => { const e = document.createElement('span'); e.className = 'pgn__ellipsis'; e.textContent = '\u2026'; return e; })()],
    ];
    cells.forEach(([label, el]) => {
      const cell = document.createElement('div'); cell.className = 'btnstate';
      const box = document.createElement('div'); box.className = 'btnstate__box'; box.appendChild(el);
      const cap = document.createElement('p'); cap.className = 'btnstate__cap'; cap.textContent = label;
      cell.append(box, cap); host.appendChild(cell);
    });
  })();

  /* ============================ BULK / INFO demos ============================ */
  (function () {
    mount('demo-bulk', buildFooter({ selectionCount: 4, pager: { total: 320, pageSize: 20, page: 1, onChange() {} } }));
    mount('demo-info', buildRow({ info: {}, pager: { total: 320, pageSize: 20, page: 1, onChange() {} } }));
    mount('demo-plain', buildRow({ pager: { total: 320, pageSize: 20, page: 1, onChange() {} } }));
  })();

  /* ============================ ACCESSIBILITY demo ============================ */
  (function () { mount('a11y-demo', buildPager({ total: 320, pageSize: 20, page: 4, onChange() {} })); })();

  /* ============================ COLOR REFERENCE ============================ */
  (function () {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;';
    document.body.appendChild(probe);
    function resolveHex(cssValue) {
      probe.style.backgroundColor = 'transparent'; probe.style.backgroundColor = cssValue;
      const v = getComputedStyle(probe).backgroundColor;
      let r, g, b, a = 1, m = v.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
      if (m) { r = +m[1] * 255; g = +m[2] * 255; b = +m[3] * 255; if (m[4] !== undefined) a = +m[4]; }
      else { const n = v.match(/[\d.]+/g); if (!n) return cssValue; r = +n[0]; g = +n[1]; b = +n[2]; if (n[3] !== undefined) a = +n[3]; }
      const hx = n => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
      let s = '#' + hx(r) + hx(g) + hx(b); if (a < 1) s += ' · ' + Math.round(a * 100) + '%'; return s;
    }
    const groups = [
      { name: 'Номер страницы', rows: [['Default текст', '--text-secondary'], ['Hover фон', '--tertiary-light'], ['Hover текст', '--text-primary'], ['Current фон', '--bgtable-row-focus'], ['Current текст', '--text-black']] },
      { name: 'Стрелки / прочее', rows: [['Default', '--text-secondary'], ['Disabled', '--text-inactive'], ['Разделитель строки', '--border-light']] },
      { name: 'Pagesize', rows: [['Текст (лейбл)', '--text-secondary'], ['Значение', '--text-primary'], ['Рамка открыт', '--border-primary']] },
      { name: 'Disabled', rows: [['Текст', '--text-inactive'], ['Current фон', '--disabled-bg']] },
    ];
    document.getElementById('color-ref').innerHTML = groups.map(g => `
      <section class="cref-group">
        <h3>${g.name}</h3>
        <div class="cref-rows">
          ${g.rows.map(([role, tok]) => `
            <div class="cref-row">
              <div class="cref-sw"><div class="cf" style="background:${tok.startsWith('--') ? 'var(' + tok + ')' : tok};"></div></div>
              <div class="cref-meta"><p class="role">${role}</p><p class="tname">${tok}</p></div>
              <div class="cref-hex">${resolveHex(tok.startsWith('--') ? 'var(' + tok + ')' : tok)}</div>
            </div>`).join('')}
        </div>
      </section>`).join('');
    probe.remove();
  })();

  /* ============================ DEV SPEC TABLE (measured) ============================ */
  (function () {
    const tbody = document.querySelector('#dev-spec-table tbody');
    if (!tbody) return;
    const host = document.createElement('div');
    host.style.cssText = 'position:absolute; left:-9999px; top:0; visibility:hidden;';
    const row = buildRow({ pager: { total: 800, pageSize: 50, page: 2, onChange() {} } });
    host.appendChild(row);
    document.body.appendChild(host);

    const pgnRow = row;
    const pager = row.querySelector('.pgn');
    const num = row.querySelector('.pgn__num[aria-current="page"]') || row.querySelector('.pgn__num');
    const arrow = row.querySelector('.pgn__arrow');
    const sizeBtn = row.querySelector('.pgn__pagesize');

    const csRow = getComputedStyle(pgnRow);
    const csNum = getComputedStyle(num);
    const csArrow = getComputedStyle(arrow);
    const csSize = sizeBtn ? getComputedStyle(sizeBtn) : null;
    const csNav = getComputedStyle(row.querySelector('.pgn__nav'));

    const data = {
      rowH: Math.round(parseFloat(csRow.minHeight || csRow.height)),
      rowPadX: Math.round(parseFloat(csRow.paddingLeft)),
      numSize: Math.round(parseFloat(csNum.width)),
      numRadius: Math.round(parseFloat(csNum.borderTopLeftRadius)),
      numFont: Math.round(parseFloat(csNum.fontSize)),
      arrowSize: Math.round(parseFloat(csArrow.width)),
      navGap: Math.round(parseFloat(csNav.columnGap || csNav.gap)),
      sizeH: csSize ? Math.round(parseFloat(csSize.height)) : null,
      sizeFont: csSize ? Math.round(parseFloat(csSize.fontSize)) : null,
    };
    host.remove();

    const rows = [
      ['Высота строки колонтитула', () => data.rowH + ' px'],
      ['Паддинг строки по X', () => data.rowPadX + ' px'],
      ['Сторона кнопки номера / стрелки', () => data.numSize + ' px'],
      ['Радиус кнопки номера', () => data.numRadius + ' px'],
      ['Типографика номера (кегль)', () => data.numFont + ' px'],
      ['Зазор между кнопками nav', () => data.navGap + ' px'],
      ['Высота триггера pagesize', () => data.sizeH + ' px'],
      ['Типографика pagesize (кегль)', () => data.sizeFont + ' px'],
    ];
    tbody.innerHTML = rows.map(([label, fn]) => `<tr><td>${label}</td><td class="rt-num">${fn()}</td></tr>`).join('');
  })();

  /* ============================ DEV CODE PANELS — copy buttons ============================ */
  (function () {
    document.querySelectorAll('.code-panel__copy').forEach(btn => {
      const target = document.getElementById(btn.dataset.copyTarget);
      if (!target) return;
      const label = btn.querySelector('.copy-label');
      btn.addEventListener('click', async () => {
        const text = target.textContent;
        try { await navigator.clipboard.writeText(text); }
        catch (e) {
          const ta = document.createElement('textarea');
          ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); } catch (e2) {}
          ta.remove();
        }
        btn.classList.add('is-copied');
        const prev = label.textContent;
        label.textContent = 'Скопировано';
        setTimeout(() => { btn.classList.remove('is-copied'); label.textContent = prev; }, 1600);
      });
    });
  })();

})();
