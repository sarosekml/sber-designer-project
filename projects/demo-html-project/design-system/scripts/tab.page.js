/* =========================================================================
   Tab — documentation page logic
   ========================================================================= */
(function () {
  const L = window.DS_ICONS || {};
  const icon = (n) => L[n] || '';

  /* разбиение целого числа на разряды: 1234 -> "1 234" */
  function groupNum(n) {
    if (n == null || n === '') return null;
    const s = String(n).replace(/\D/g, '');
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  }

  /* ---------- tab factory ----------
     o: {
       orient:'horiz'|'vert', size:'m'|'s',
       label, icon:null|'<name>', badge:null|number,
       state:'default'|'hover'|'selected', disabled
     } */
  function makeTab(o = {}) {
    const {
      orient = 'horiz', size = 'm', label = 'Text',
      icon: ic = null, badge = null,
      state = 'default', disabled = false, standalone = true,
    } = o;

    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tab tab--' + size + ' tab--' + orient;
    if (standalone) el.classList.add('tab--standalone');
    el.setAttribute('role', 'tab');

    const selected = state === 'selected';
    if (selected) { el.classList.add('tab--selected'); el.setAttribute('aria-selected', 'true'); }
    else el.setAttribute('aria-selected', 'false');
    if (state === 'hover') el.classList.add('is-hover');
    if (disabled) { el.classList.add('tab--disabled'); el.setAttribute('aria-disabled', 'true'); }
    el.tabIndex = disabled ? -1 : (selected ? 0 : -1);

    if (ic) {
      const i = document.createElement('span'); i.className = 'tab__icon'; i.innerHTML = icon(ic); el.appendChild(i);
    }
    const lb = document.createElement('span'); lb.className = 'tab__label'; lb.textContent = label; el.appendChild(lb);
    if (badge != null) {
      const b = document.createElement('span'); b.className = 'tab__badge'; b.textContent = groupNum(badge); el.appendChild(b);
    }
    return el;
  }

  /* group helper */
  function makeGroup(orient, opts) {
    const g = document.createElement('div');
    g.className = 'tabs tabs--' + orient;
    g.setAttribute('role', 'tablist');
    opts.forEach(o => g.appendChild(makeTab(Object.assign({ orient, standalone: false }, o))));
    return g;
  }

  /* make a tablist actually switch (single-select) */
  function wireTablist(group) {
    const tabs = [...group.querySelectorAll('.tab')];
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('tab--disabled')) return;
        tabs.forEach(t => { t.classList.remove('tab--selected'); t.setAttribute('aria-selected', 'false'); t.tabIndex = -1; });
        tab.classList.add('tab--selected'); tab.setAttribute('aria-selected', 'true'); tab.tabIndex = 0;
      });
    });
    group.addEventListener('keydown', (e) => {
      const live = tabs.filter(t => !t.classList.contains('tab--disabled'));
      const cur = document.activeElement;
      let i = live.indexOf(cur);
      const horiz = group.classList.contains('tabs--horiz');
      const next = horiz ? 'ArrowRight' : 'ArrowDown';
      const prev = horiz ? 'ArrowLeft' : 'ArrowUp';
      if (e.key === next) { e.preventDefault(); i = (i + 1) % live.length; live[i].focus(); live[i].click(); }
      else if (e.key === prev) { e.preventDefault(); i = (i - 1 + live.length) % live.length; live[i].focus(); live[i].click(); }
      else if (e.key === 'Home') { e.preventDefault(); live[0].focus(); live[0].click(); }
      else if (e.key === 'End') { e.preventDefault(); live[live.length - 1].focus(); live[live.length - 1].click(); }
    });
  }

  /* ---------- overflow group: fit as many tabs as the container allows,
     the rest collapse behind a "more" (⋯) trigger with a dropdown menu ---------- */
  const MORE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';

  function makeOverflowTabs(items, o = {}) {
    const size = o.size || 'm';
    const host = document.createElement('div'); host.className = 'tabs-overflow';
    const group = document.createElement('div'); group.className = 'tabs tabs--horiz'; group.setAttribute('role', 'tablist');
    host.appendChild(group);

    let selected = items.findIndex(it => it.state === 'selected');
    if (selected < 0) selected = 0;

    const tabEls = items.map((it, i) => {
      const t = makeTab(Object.assign({ orient: 'horiz', size, standalone: false }, it, { state: 'default' }));
      t.addEventListener('click', () => { selected = i; update(); });
      return t;
    });
    tabEls.forEach(t => group.appendChild(t));

    const moreBtn = document.createElement('button');
    moreBtn.type = 'button';
    moreBtn.className = 'tab tab--' + size + ' tab--horiz tab--more';
    moreBtn.setAttribute('aria-haspopup', 'true');
    moreBtn.setAttribute('aria-expanded', 'false');
    moreBtn.setAttribute('aria-label', 'Показать остальные разделы');
    const mi = document.createElement('span'); mi.className = 'tab__icon'; mi.innerHTML = MORE_ICON; moreBtn.appendChild(mi);
    group.appendChild(moreBtn);

    const menu = document.createElement('div'); menu.className = 'tabs-overflow__menu'; menu.setAttribute('role', 'menu');
    host.appendChild(menu);

    function closeMenu() { menu.classList.remove('is-open'); moreBtn.setAttribute('aria-expanded', 'false'); moreBtn.classList.remove('is-menu-open'); }
    function openMenu() { menu.classList.add('is-open'); moreBtn.setAttribute('aria-expanded', 'true'); moreBtn.classList.add('is-menu-open'); }
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.classList.contains('is-open')) closeMenu(); else openMenu();
    });
    document.addEventListener('click', (e) => { if (!host.contains(e.target)) closeMenu(); });
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

    function layout() {
      tabEls.forEach(t => { t.style.display = ''; });
      moreBtn.style.display = 'none';
      const available = host.clientWidth;
      if (!available) return;
      const widths = tabEls.map(t => t.getBoundingClientRect().width);
      const total = widths.reduce((a, b) => a + b, 0);
      if (total <= available + 0.5) { buildMenu(); return; }
      moreBtn.style.display = '';
      const moreWidth = moreBtn.getBoundingClientRect().width;
      let sum = 0, cutoff = tabEls.length;
      for (let i = 0; i < widths.length; i++) {
        sum += widths[i];
        if (sum + moreWidth > available) { cutoff = i; break; }
      }
      cutoff = Math.max(cutoff, 1);
      tabEls.forEach((t, i) => { t.style.display = i < cutoff ? '' : 'none'; });
      buildMenu();
    }

    function buildMenu() {
      menu.innerHTML = '';
      tabEls.forEach((t, i) => {
        if (t.style.display !== 'none') return;
        const it = items[i];
        const btn = document.createElement('button');
        btn.type = 'button'; btn.className = 'tabs-overflow__item'; btn.setAttribute('role', 'menuitemradio');
        btn.setAttribute('aria-checked', String(i === selected));
        if (it.icon) { const ic2 = document.createElement('span'); ic2.className = 'tab__icon'; ic2.innerHTML = icon(it.icon); btn.appendChild(ic2); }
        const lb = document.createElement('span'); lb.className = 'tab__label'; lb.textContent = it.label; btn.appendChild(lb);
        if (it.badge != null) { const bd = document.createElement('span'); bd.className = 'tab__badge'; bd.textContent = groupNum(it.badge); btn.appendChild(bd); }
        btn.addEventListener('click', () => { selected = i; closeMenu(); update(); });
        menu.appendChild(btn);
      });
    }

    function update() {
      tabEls.forEach((t, i) => {
        const sel = i === selected;
        t.classList.toggle('tab--selected', sel);
        t.setAttribute('aria-selected', String(sel));
      });
      layout();
    }

    requestAnimationFrame(update);
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
    if (window.ResizeObserver) new ResizeObserver(layout).observe(host);

    return host;
  }

  /* ---------- scroll arrows: wraps a .tabs-scroll with prev/next buttons that
     fade in/out depending on whether there is more content to reach on that side ---------- */
  function makeScrollArrows(scrollEl) {
    const wrap = document.createElement('div'); wrap.className = 'tabs-scroll-wrap';
    wrap.appendChild(scrollEl);

    function mkArrow(dir) {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'tabs-scroll__arrow tabs-scroll__arrow--' + dir;
      b.setAttribute('aria-label', dir === 'left' ? 'Прокрутить влево' : 'Прокрутить вправо');
      b.innerHTML = dir === 'left'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
      b.addEventListener('click', () => { scrollEl.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' }); });
      return b;
    }
    const left = mkArrow('left'), right = mkArrow('right');
    wrap.appendChild(left); wrap.appendChild(right);

    function update() {
      const max = scrollEl.scrollWidth - scrollEl.clientWidth;
      left.classList.toggle('is-visible', scrollEl.scrollLeft > 4);
      right.classList.toggle('is-visible', scrollEl.scrollLeft < max - 4);
    }
    scrollEl.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('load', update);
    if (window.ResizeObserver) new ResizeObserver(update).observe(scrollEl);
    requestAnimationFrame(update);

    return wrap;
  }

  /* ============================ PLAYGROUND ============================ */
  (function () {
    const state = { orient: 'horiz', size: 'm', leadingIcon: 'none', hasBadge: false, badgeVal: '9', tabState: 'default', isSelected: true };
    const controls = document.getElementById('pg-controls');
    const preview = document.getElementById('pg-preview');
    const codeEl = document.getElementById('pg-code');

    function select(label, options, getCur, onPick) {
      const wrap = document.createElement('div'); wrap.className = 'ctl';
      const l = document.createElement('div'); l.className = 'lbl'; l.textContent = label; wrap.appendChild(l);
      const box = document.createElement('div'); box.className = 'pg-select';
      const sel = document.createElement('select');
      options.forEach(([val, txt]) => { const op = document.createElement('option'); op.value = val; op.textContent = txt; if (val === getCur()) op.selected = true; sel.appendChild(op); });
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

    controls.appendChild(select('Ориентация', [['horiz', 'Horizontal'], ['vert', 'Vertical']], () => state.orient, v => state.orient = v));
    controls.appendChild(select('Размер', [['m', 'M · 40'], ['s', 'S · 32']], () => state.size, v => state.size = v));
    controls.appendChild(select('Иконка', [['none', 'Нет'], ['bar-chart', 'bar-chart'], ['file', 'file'], ['user', 'user'], ['settings', 'settings'], ['pie-chart', 'pie-chart']], () => state.leadingIcon, v => state.leadingIcon = v));
    controls.appendChild(select('Состояние', [['default', 'Default'], ['hover', 'Hover = Focus'], ['disabled', 'Disabled']], () => state.tabState, v => state.tabState = v));

    const optWrap = document.createElement('div'); optWrap.className = 'ctl';
    const ol = document.createElement('div'); ol.className = 'lbl'; ol.textContent = 'Опции'; optWrap.appendChild(ol);
    const toggles = document.createElement('div'); toggles.className = 'toggles';
    toggles.appendChild(sw('Selected', 'isSelected'));
    toggles.appendChild(sw('Бейдж', 'hasBadge'));
    optWrap.appendChild(toggles); controls.appendChild(optWrap);

    function render() {
      const disabled = state.tabState === 'disabled';
      const selected = state.isSelected && !disabled;
      const o = {
        orient: state.orient, size: state.size, label: 'Text',
        icon: state.leadingIcon === 'none' ? null : state.leadingIcon,
        badge: state.hasBadge ? state.badgeVal : null,
        state: disabled ? 'default' : state.tabState, disabled, standalone: false,
      };
      preview.innerHTML = '';
      // wrap a single tab in a small group so the rail shows
      const g = document.createElement('div');
      g.className = 'tabs tabs--' + state.orient + (state.orient === 'vert' ? '' : '');
      if (state.orient === 'vert') g.style.minWidth = '220px';
      const tabEl = makeTab(o);
      if (selected) { tabEl.classList.add('tab--selected'); tabEl.setAttribute('aria-selected', 'true'); }
      g.appendChild(tabEl);
      preview.appendChild(g);

      const cls = ['tab', 'tab--' + state.size, 'tab--' + state.orient];
      if (selected) cls.push('tab--selected');
      if (disabled) cls.push('tab--disabled');
      codeEl.innerHTML = '<code>&lt;button class="' + cls.join(' ') + '"&gt;…&lt;/button&gt;</code>';
    }
    render();
  })();

  /* ============================ USAGE ============================ */
  (function () {
    // horizontal tabs on a page
    const h = document.getElementById('use-horiz');
    const hg = makeGroup('horiz', [
      { label: 'Сделки', state: 'selected' },
      { label: 'Проекты' },
      { label: 'Документы' },
      { label: 'Архив' },
    ]);
    wireTablist(hg); h.appendChild(hg);

    // vertical tabs on a modal
    const v = document.getElementById('use-vert');
    const vg = makeGroup('vert', [
      { label: 'Основная информация', badge: 3 },
      { label: 'Продукты' },
      { label: 'Сроки', badge: 6, state: 'selected' },
      { label: 'Команда сделки', badge: 3 },
      { label: 'Прочее' },
    ]);
    wireTablist(vg); v.appendChild(vg);
  })();

  /* ============================ ANATOMY ============================ */
  (function () {
    const d = document.getElementById('anat-diagram');
    const g = document.createElement('div'); g.className = 'tabs tabs--horiz tabs--bare';
    const tab = makeTab({ orient: 'horiz', size: 'm', label: 'Текст', icon: 'bar-chart', badge: 9, state: 'selected', standalone: false });
    g.appendChild(tab); d.appendChild(g);
    requestAnimationFrame(() => {
      const marks = [
        ['1', '50%', 'calc(100% + 16px)'],   // container / rail
        ['2', '12%', '-16px'],               // leading icon
        ['3', '46%', '-16px'],               // text
        ['4', '86%', '-16px'],               // badge
      ];
      marks.forEach(([n, left, top]) => {
        const m = document.createElement('span'); m.className = 'mk'; m.textContent = n;
        m.style.left = left; m.style.top = top; d.appendChild(m);
      });
    });
  })();

  /* ============================ ORIENTATION ============================ */
  (function () {
    const h = document.getElementById('orient-horiz');
    const hg = makeGroup('horiz', [
      { label: 'Обзор', state: 'selected' }, { label: 'Продукты', badge: 12 },
      { label: 'История' }, { label: 'Документы', badge: 3 },
    ]);
    wireTablist(hg); h.appendChild(hg);

    const v = document.getElementById('orient-vert');
    const vg = makeGroup('vert', [
      { label: 'Обзор', state: 'selected' }, { label: 'Продукты', badge: 12 },
      { label: 'История' }, { label: 'Документы', badge: 3 },
    ]);
    wireTablist(vg); v.appendChild(vg);
  })();

  /* ============================ SIZES ============================ */
  (function () {
    const g = document.getElementById('sizes-grid');
    const cols = [['M', 'm'], ['S', 's']];
    g.appendChild(document.createElement('div'));
    cols.forEach(([nm]) => { const h = document.createElement('div'); h.className = 'col-head'; h.textContent = nm; g.appendChild(h); });

    const rows = [
      ['Текст', (sz) => makeTab({ size: sz, label: 'Text', state: 'selected' })],
      ['+ иконка', (sz) => makeTab({ size: sz, label: 'Text', icon: 'bar-chart', state: 'selected' })],
      ['+ бейдж', (sz) => makeTab({ size: sz, label: 'Text', badge: 9, state: 'selected' })],
    ];
    rows.forEach(([rl, build]) => {
      const rh = document.createElement('div'); rh.className = 'row-head'; rh.textContent = rl; g.appendChild(rh);
      cols.forEach(([, sz]) => { const c = document.createElement('div'); c.className = 'cell'; c.appendChild(build(sz)); g.appendChild(c); });
    });

    const tbl = [
      ['M', '40 px', 'Body M · 16/20', '20 px', '20 px', 'Базовый: страницы, модалки'],
      ['S', '32 px', 'Body S · 14/16', '18 px', '16 px', 'Плотные места, узкие модалки'],
    ];
    document.querySelector('#sizes-table tbody').innerHTML = tbl.map(r =>
      `<tr><td><b>${r[0]}</b></td><td class="rt-num">${r[1]}</td><td>${r[2]}</td><td class="rt-num">${r[3]}</td><td class="rt-num">${r[4]}</td><td>${r[5]}</td></tr>`).join('');
  })();

  /* ============================ STATES (spec tables) ============================ */
  (function () {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;';
    document.body.appendChild(probe);
    function resolveHex(token) {
      probe.style.backgroundColor = 'transparent'; probe.style.backgroundColor = 'var(' + token + ')';
      const v = getComputedStyle(probe).backgroundColor;
      let r, g, b, a = 1, m = v.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/i);
      if (m) { r = +m[1] * 255; g = +m[2] * 255; b = +m[3] * 255; if (m[4] !== undefined) a = +m[4]; }
      else { const n = v.match(/[\d.]+/g); if (!n) return ''; r = +n[0]; g = +n[1]; b = +n[2]; if (n[3] !== undefined) a = +n[3]; }
      const hx = n => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
      let s = '#' + hx(r) + hx(g) + hx(b); if (a < 1) s += ', ' + Math.round(a * 100) + '%'; return s;
    }
    function cline(role, token, name, raw) {
      return `<div class="spec__cline"><b>${role}</b><span class="spec__sw" style="background:var(${token})"></span><span><span class="tnm">${name}</span></span><span class="raw">${raw} · ${resolveHex(token)}</span></div>`;
    }

    const unselected = [
      ['Default', { label: 'Text', badge: 3, state: 'default' }, [
        ['Текст', '--text-secondary', 'Text_Secondary', 'CGrey_500'],
        ['Иконка', '--text-secondary', 'Text_Secondary', 'CGrey_500'],
        ['Бейдж', '--st-system-midlight', 'StSystem_MidLight', 'Swamp_400, 32%'],
      ]],
      ['Hover = Focus', { label: 'Text', badge: 3, state: 'hover' }, [
        ['Fill', '--primary-bg', 'Active_PrimaryBG', 'Emerald_500, 6%'],
        ['Текст', '--text-primary', 'Text_Primary', 'CGrey_600'],
        ['Иконка', '--text-primary', 'Text_Primary', 'CGrey_600'],
      ]],
    ];
    const selected = [
      ['Default', { label: 'Text', badge: 3, state: 'selected' }, [
        ['Индикатор', '--primary', 'Primary', 'Emerald_500'],
        ['Текст', '--text-primary', 'Text_Primary', 'CGrey_600'],
        ['Иконка', '--primary', 'Primary', 'Emerald_500'],
      ]],
      ['Hover = Focus', { label: 'Text', badge: 77, state: 'selected', _hover: true }, [
        ['Fill', '--primary-bg', 'Active_PrimaryBG', 'Emerald_500, 6%'],
        ['Индикатор', '--primary', 'Primary', 'Emerald_500'],
        ['Текст', '--text-primary', 'Text_Primary', 'CGrey_600'],
        ['Бейдж', '--st-system-midlight', 'StSystem_MidLight', 'без изменений'],
      ]],
    ];
    const disabledRow = [
      ['Disabled', { label: 'Text', badge: 3, state: 'default', disabled: true }, [
        ['Текст', '--st-disabled-dark', 'StDisabled_Dark', 'CGrey_600, 40%'],
        ['Иконка', '--st-disabled', 'StDisabled', 'CGrey_600, 24%'],
        ['Бейдж', '--st-disabled-midlight', 'StDisabled_MidLight', 'CGrey_600, 8%'],
      ]],
    ];

    function buildSpec(title, states) {
      const spec = document.createElement('div'); spec.className = 'spec';
      const head = document.createElement('div'); head.className = 'spec__head'; head.textContent = title; spec.appendChild(head);
      states.forEach(([st, opt, colors]) => {
        const row = document.createElement('div'); row.className = 'spec__row';
        const a = document.createElement('div'); a.className = 'spec__state'; a.textContent = st; row.appendChild(a);
        const b = document.createElement('div'); b.className = 'spec__sample';
        const grp = document.createElement('div'); grp.className = 'tabs tabs--horiz';
        const tab = makeTab(Object.assign({ orient: 'horiz', size: 'm', standalone: false }, opt));
        if (opt._hover) tab.classList.add('is-hover');
        grp.appendChild(tab); b.appendChild(grp); row.appendChild(b);
        const c = document.createElement('div'); c.className = 'spec__colors';
        c.innerHTML = colors.map(cc => cline(cc[0], cc[1], cc[2], cc[3])).join(''); row.appendChild(c);
        spec.appendChild(row);
      });
      return spec;
    }

    const host = document.getElementById('state-specs');
    host.appendChild(buildSpec('Unselected', unselected));
    host.appendChild(buildSpec('Selected', selected));
    host.appendChild(buildSpec('Disabled', disabledRow));
    probe.remove();
  })();

  /* ============================ BADGE BEHAVIOUR ============================ */
  (function () {
    // grouping demo: 1 / 2 / 4 digits
    const g = document.getElementById('badge-grid');
    const cols = [['M', 'm'], ['S', 's']];
    g.appendChild(document.createElement('div'));
    cols.forEach(([nm]) => { const h = document.createElement('div'); h.className = 'col-head'; h.textContent = nm; g.appendChild(h); });
    const rows = [['Один знак', 9], ['Два знака', 99], ['Четыре знака', 9999]];
    rows.forEach(([rl, val]) => {
      const rh = document.createElement('div'); rh.className = 'row-head'; rh.textContent = rl; g.appendChild(rh);
      cols.forEach(([, sz]) => {
        const c = document.createElement('div'); c.className = 'cell';
        c.appendChild(makeTab({ size: sz, label: 'Text', badge: val, state: 'default' })); g.appendChild(c);
      });
    });

    // alignment: horiz badge hugs text, vert badge to the right edge
    const ah = document.getElementById('badge-align-h');
    const hg = makeGroup('horiz', [{ label: 'Сделки', badge: 1234, state: 'selected' }, { label: 'Архив', badge: 8 }]);
    wireTablist(hg); ah.appendChild(hg);

    const av = document.getElementById('badge-align-v');
    av.style.minWidth = '240px';
    const vg = makeGroup('vert', [{ label: 'Сделки', badge: 1234, state: 'selected' }, { label: 'Архив', badge: 8 }]);
    wireTablist(vg); av.appendChild(vg);
  })();

  /* ============================ ICON / LEADING ============================ */
  (function () {
    const host = document.getElementById('leading-demo');
    const hg = makeGroup('horiz', [
      { label: 'Дашборд', icon: 'bar-chart', state: 'selected' },
      { label: 'Документы', icon: 'file', badge: 4 },
      { label: 'Команда', icon: 'user' },
      { label: 'Настройки', icon: 'settings' },
    ]);
    wireTablist(hg); host.appendChild(hg);

    const host2 = document.getElementById('leading-icononly');
    const hg2 = document.createElement('div'); hg2.className = 'tabs tabs--horiz';
    [['bar-chart', true], ['pie-chart', false], ['list-view-01', false], ['layout-grid-01', false]].forEach(([ic, sel]) => {
      const t = makeTab({ orient: 'horiz', size: 'm', label: '', icon: ic, state: sel ? 'selected' : 'default', standalone: false });
      t.querySelector('.tab__label').remove();
      t.style.padding = '0 14px';
      t.setAttribute('aria-label', ic);
      hg2.appendChild(t);
    });
    wireTablist(hg2); host2.appendChild(hg2);
  })();

  /* ============================ OVERFLOW: SCROLL + FIT/MENU ============================ */
  (function () {
    const overflowItems = [
      { label: 'Возможные сделки', state: 'selected' }, { label: 'Сделки ДИД' },
      { label: 'Сделки моего деска' }, { label: 'Мои сделки' }, { label: 'В архиве' },
      { label: 'Закрытые' }, { label: 'На согласовании' }, { label: 'Черновики' },
    ];

    // pattern A — horizontal scroll, hidden scrollbar (container narrower than content), with arrows
    const host = document.getElementById('overflow-demo');
    const wrap = document.createElement('div'); wrap.className = 'tabs-scroll';
    const g = makeGroup('horiz', overflowItems);
    wireTablist(g); wrap.appendChild(g); host.appendChild(makeScrollArrows(wrap));

    // pattern B — fit + "⋯" trigger opening a dropdown with the rest
    const hostFit = document.getElementById('overflow-fit');
    hostFit.appendChild(makeOverflowTabs(overflowItems));

    // truncation: a vert tab with a very long label
    const t = document.getElementById('overflow-trunc');
    t.style.maxWidth = '260px';
    const vg = makeGroup('vert', [
      { label: 'Основная информация по сделке и контрагенту', badge: 3, state: 'selected' },
      { label: 'Продукты' },
    ]);
    wireTablist(vg); t.appendChild(vg);
  })();

  /* ============================ FULL-WIDTH (equal) ============================ */
  (function () {
    const host = document.getElementById('fitted-demo');
    const g = document.createElement('div'); g.className = 'tabs tabs--horiz tabs--fill';
    g.setAttribute('role', 'tablist');
    [{ label: 'День', state: 'selected' }, { label: 'Неделя' }, { label: 'Месяц' }, { label: 'Год' }].forEach(o =>
      g.appendChild(makeTab(Object.assign({ orient: 'horiz', standalone: false }, o))));
    wireTablist(g); host.appendChild(g);
  })();

  /* ============================ TYPOGRAPHY ============================ */
  (function () {
    const rows = [
      ['M', 'm', 'Body M', '16 px / Regular'],
      ['S', 's', 'Body S', '14 px / Regular'],
    ];
    const tb = document.querySelector('#typo-table tbody');
    rows.forEach(r => {
      const tr = document.createElement('tr');
      const t0 = document.createElement('td'); t0.innerHTML = '<b>' + r[0] + '</b>';
      const t1 = document.createElement('td'); const g = document.createElement('div'); g.className = 'tabs tabs--horiz tabs--bare';
      g.appendChild(makeTab({ size: r[1], label: 'Text', state: 'selected', standalone: false })); t1.appendChild(g);
      const t2 = document.createElement('td'); t2.innerHTML = '<code class="tok">--type-body-' + r[1] + '</code>';
      const t3 = document.createElement('td'); t3.className = 'rt-num'; t3.textContent = r[3];
      tr.append(t0, t1, t2, t3); tb.appendChild(tr);
    });
  })();

  /* ============================ GUIDELINES ============================ */
  (function () {
    const BAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    const GOOD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
    document.getElementById('ic-bad1').innerHTML = BAD;
    document.getElementById('ic-bad2').innerHTML = BAD;
    document.getElementById('ic-good1').innerHTML = GOOD;
    document.getElementById('ic-good2').innerHTML = GOOD;
    document.getElementById('ic-good3').innerHTML = GOOD;

    // pair 1 — длина текста метки
    const g1 = makeGroup('horiz', [{ label: 'Обзор', state: 'selected' }, { label: 'История' }, { label: 'Документы' }]);
    document.getElementById('guide-good1').appendChild(g1);

    const g2bad = makeGroup('horiz', [
      { label: 'Перейти на страницу обзора сделки', state: 'selected' },
      { label: 'Открыть полную историю операций' },
    ]);
    document.getElementById('guide-bad1').appendChild(g2bad);

    // pair 2 — количество табов в группе
    const g3 = makeGroup('vert', [{ label: 'Сроки', badge: 6, state: 'selected' }, { label: 'Продукты', badge: 3 }]);
    g3.style.minWidth = '180px';
    document.getElementById('guide-good2').appendChild(g3);

    const g4 = document.createElement('div'); g4.className = 'tabs tabs--horiz';
    g4.appendChild(makeTab({ orient: 'horiz', label: 'Единственный раздел', state: 'selected', standalone: false }));
    document.getElementById('guide-bad2').appendChild(g4);

    // solo — без пары «не так», отдельная рекомендация про бейдж
    const g5 = makeGroup('horiz', [{ label: 'Сделки', badge: 128, state: 'selected' }, { label: 'Архив', badge: 6 }]);
    document.getElementById('guide-good3').appendChild(g5);
  })();

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
      { name: 'Unselected', rows: [
        ['Текст', '--text-secondary'], ['Иконка', '--text-secondary'],
        ['Hover fill', '--primary-bg'], ['Рейл', '--border-light'],
      ] },
      { name: 'Selected', rows: [
        ['Индикатор', '--primary'], ['Текст', '--text-primary'],
        ['Hover fill', '--primary-bg'],
      ] },
      { name: 'Disabled', rows: [
        ['Текст', '--st-disabled-dark'], ['Иконка', '--st-disabled'], ['Бейдж', '--st-disabled-midlight'],
      ] },
      { name: 'Бейдж', rows: [
        ['Фон', '--st-system-midlight'], ['Текст', '--text-primary'],
      ] },
    ];
    document.getElementById('color-ref').innerHTML = groups.map(g => `
      <section class="cref-group">
        <h3>${g.name}</h3>
        <div class="cref-rows">
          ${g.rows.map(([role, tok]) => `
            <div class="cref-row">
              <div class="cref-sw"><div class="cf" style="background:var(${tok});"></div></div>
              <div class="cref-meta"><p class="role">${role}</p><p class="tname">${tok}</p></div>
              <div class="cref-hex">${resolveHex('var(' + tok + ')')}</div>
            </div>`).join('')}
        </div>
      </section>`).join('');
    probe.remove();
  })();

  /* ============================ ACCESSIBILITY DEMO ============================ */
  (function () {
    const host = document.getElementById('a11y-demo');
    if (!host) return;
    const g = makeGroup('horiz', [
      { label: 'Обзор', state: 'selected' }, { label: 'История' }, { label: 'Документы', badge: 3 },
    ]);
    wireTablist(g); host.appendChild(g);
  })();

  /* ============================ DEV SPEC TABLE (measured, not hardcoded) ============================ */
  (function () {
    const tbody = document.querySelector('#dev-spec-table tbody');
    if (!tbody) return;

    function measure(size) {
      const host = document.createElement('div');
      host.style.cssText = 'position:absolute; left:-9999px; top:0; visibility:hidden;';
      const g = document.createElement('div'); g.className = 'tabs tabs--horiz';
      const t = makeTab({ size, label: 'Текст', icon: 'bar-chart', badge: 9, state: 'selected', standalone: false });
      g.appendChild(t); host.appendChild(g);
      document.body.appendChild(host);

      const cs = getComputedStyle(t);
      const csAfter = getComputedStyle(t, '::after');
      const iconEl = t.querySelector('.tab__icon');
      const badgeEl = t.querySelector('.tab__badge');
      const csIcon = iconEl ? getComputedStyle(iconEl) : null;
      const csBadge = badgeEl ? getComputedStyle(badgeEl) : null;

      const data = {
        height: Math.round(parseFloat(cs.height)),
        padX: Math.round(parseFloat(cs.paddingLeft)),
        gap: Math.round(parseFloat(cs.columnGap || cs.gap)),
        icon: csIcon ? Math.round(parseFloat(csIcon.width)) : null,
        indicator: Math.round(parseFloat(csAfter.height)),
        badgeMin: csBadge ? Math.round(parseFloat(csBadge.minWidth)) : null,
        fontSize: Math.round(parseFloat(cs.fontSize)),
        lineHeight: Math.round(parseFloat(cs.lineHeight)),
      };
      host.remove();
      return data;
    }

    const d = { m: measure('m'), s: measure('s') };
    const rows = [
      ['Высота таба', sz => d[sz].height + ' px'],
      ['Паддинг по X', sz => d[sz].padX + ' px'],
      ['Зазор (иконка / текст / бейдж)', sz => d[sz].gap + ' px'],
      ['Иконка', sz => d[sz].icon + ' px'],
      ['Толщина индикатора', sz => d[sz].indicator + ' px'],
      ['Бейдж — min-width', sz => d[sz].badgeMin + ' px'],
      ['Типографика (кегль / строка)', sz => d[sz].fontSize + ' / ' + d[sz].lineHeight + ' px'],
    ];
    tbody.innerHTML = rows.map(([label, fn]) =>
      `<tr><td>${label}</td><td class="rt-num">${fn('m')}</td><td class="rt-num">${fn('s')}</td></tr>`
    ).join('');
  })();

})();
