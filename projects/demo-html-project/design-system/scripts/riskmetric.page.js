/* =========================================================================
   RiskMetric — страница ДС: конструктор, редлайн, демо.
   Композиция: Chip (readonly, S) + кнопка-информер (.chip__info) + Popover.
   ========================================================================= */

const RM_ZONES = {
  none:      { label: '—',         name: 'нет данных',    code: '—',           tone: null },
  green:     { label: 'Зеленая',   name: 'зеленая',       code: 'Green Zone',  tone: 'success' },
  watchlist: { label: 'Watchlist', name: 'watchlist',     code: 'Watchlist',   tone: 'warning' },
  red:       { label: 'Красная',   name: 'красная',       code: 'Red Zone',    tone: 'error-solid' },
  black:     { label: 'Черная',    name: 'черная',        code: 'Black Zone',  tone: 'dark-solid' },
};
const RM_ZONE_TOKEN = { green: '--st-green-dark', watchlist: '--st-orange-dark', red: '--st-red-dark', black: '--st-grey-dark' };

let rmSeq = 0;

function rmAriaLabel(rating, zoneKey) {
  const ratingTxt = rating != null ? ('рейтинг ' + rating) : 'рейтинг не определён';
  const zoneTxt = zoneKey === 'none' ? 'зона проблемности не определена' : ('зона проблемности — ' + RM_ZONES[zoneKey].name);
  return 'Риск-метрика. ' + ratingTxt + ', ' + zoneTxt + '.';
}

/* ---------- фабрика чипа: label (рейтинг/тире) + кнопка-информер ---------- */
function makeRiskChip(o = {}) {
  const { rating = null, zone = 'none', size = 's' } = o;
  const z = RM_ZONES[zone] || RM_ZONES.none;
  const hasZone = zone !== 'none';
  const hasInfo = hasZone || rating != null;

  const el = document.createElement('span');
  el.className = 'chip chip--readonly chip--rounded chip--' + size + (hasZone ? ' chip--' + z.tone : ' chip--outline');
  el.setAttribute('aria-label', rmAriaLabel(rating, zone));

  const lb = document.createElement('span');
  lb.className = 'chip__label';
  lb.textContent = rating != null ? String(rating) : '—';
  el.appendChild(lb);

  let btn = null;
  if (hasInfo) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip__info';
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Показать детали риск-метрики');
    btn.innerHTML = '<i data-icon="info-circle"></i>';
    el.appendChild(btn);
  }
  return { el, btn };
}

/* ---------- Popover_RiskMetric: Header (заголовок+✕) + Body, без Footer ---------- */
function buildRiskPopover(o = {}) {
  const {
    rating = 26, zone = 'red', ratingDate = '24.10.2025', zoneDate = '24.10.2025',
    segment = 'Международный финансовый институт, НЕ относящийся к группе активов с риском 0%',
    profile = 'Непроектный', state = 'default', width = 'm',
  } = o;
  const titleId = 'rm-pop-title-' + (++rmSeq);
  const pop = document.createElement('div');
  pop.className = 'pop pop--w-' + width + ' pop--bottom pop--start pop--floating';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-modal', 'false');
  pop.setAttribute('aria-labelledby', titleId);

  const head = document.createElement('div');
  head.className = 'pop__head';
  head.innerHTML = '<h3 class="pop__title" id="' + titleId + '">Рейтинг и зона проблемности</h3>' +
    '<span class="pop__close"><button type="button" class="ibtn ibtn--neutral ibtn--s" aria-label="Закрыть"><i data-icon="close"></i></button></span>';
  pop.appendChild(head);

  const body = document.createElement('div');
  body.className = 'pop__body';

  if (state === 'loading') {
    body.setAttribute('aria-busy', 'true');
    body.innerHTML = '<span class="pop__skeleton pop__skeleton--title" style="--sk-w:55%;"></span>' +
      '<span class="pop__skeleton" style="--sk-w:100%;"></span>' +
      '<span class="pop__skeleton pop__skeleton--title" style="--sk-w:45%;"></span>' +
      '<span class="pop__skeleton" style="--sk-w:80%;"></span>';
  } else if (state === 'error') {
    body.setAttribute('role', 'alert');
    body.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' +
      '<span style="flex:none; width:20px; height:20px; color:var(--error);"><i data-icon="alert-circle"></i></span>' +
      '<p style="margin:0; font:var(--type-body-s); color:var(--text-primary);">Не удалось загрузить риск-метрику. Проверьте соединение и попробуйте ещё раз.</p></div>';
  } else {
    body.innerHTML =
      rmZoneBlockHTML(zone, zoneDate) +
      rmRateBlockHTML(rating, ratingDate) +
      '<div class="rm-field"><p class="rm-field__label">Риск-сегмент</p><p class="rm-field__value">' + segment + '</p></div>' +
      '<div class="rm-field"><p class="rm-field__label">Риск-профиль</p><p class="rm-field__value">' + profile + '</p></div>';
  }
  pop.appendChild(body);
  const arrowEl = document.createElement('span'); arrowEl.className = 'pop__arrow'; pop.appendChild(arrowEl);
  return { pop, body };
}

/* ---------- позиционирование (см. Popover — placePop). Стейдж = сам .pop-anchor,
   он тесно облегает кнопку-триггер, поэтому координаты считаются от неё же. ---------- */
function rmPlacePop(anchor, pop, target, placement, align, gap) {
  gap = gap == null ? 8 : gap;
  const sr = anchor.getBoundingClientRect();
  const tr = target.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const tl = tr.left - sr.left, tt = tr.top - sr.top;
  const cx = tl + tr.width / 2, cy = tt + tr.height / 2;
  let x = 0, y = 0;
  if (placement === 'top') y = tt - gap - ph;
  else if (placement === 'bottom') y = tt + tr.height + gap;
  if (align === 'center') x = cx - pw / 2;
  else if (align === 'start') x = cx - 18;
  else x = cx - (pw - 18);
  /* охрана от правого края viewport — используется в широких demo-таблицах */
  const viewportRight = window.innerWidth - 16;
  const absLeft = sr.left + x;
  if (absLeft + pw > viewportRight) x -= (absLeft + pw - viewportRight);
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
}

/* ---------- единый реестр: одновременно открыт только один поповер ---------- */
let rmOpen = null; /* { pop, btn } */
function rmClose() {
  if (!rmOpen) return;
  rmOpen.pop.classList.remove('is-open');
  rmOpen.btn.setAttribute('aria-expanded', 'false');
  rmOpen = null;
}
document.addEventListener('click', (e) => {
  if (rmOpen && !rmOpen.pop.contains(e.target) && e.target !== rmOpen.btn && !rmOpen.btn.contains(e.target)) rmClose();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && rmOpen) { const b = rmOpen.btn; rmClose(); b.focus(); }
});

/* ---------- строительные блоки Body (переиспользуются поповером и демо) ---------- */
function rmZoneBlockHTML(zone, zoneDate) {
  const color = RM_ZONE_TOKEN[zone] ? ' style="color:var(' + RM_ZONE_TOKEN[zone] + ')"' : '';
  const val = zone === 'none' ? '—' : RM_ZONES[zone].label;
  return '<div class="rm-block">' +
    '<div class="rm-block__row"><span class="rm-block__label">Зона проблемности</span><span class="rm-block__value rm-block__value--strong"' + color + '>' + val + '</span></div>' +
    '<div class="rm-block__row"><span class="rm-block__label">Дата расчета</span><span class="rm-block__value">' + (zone === 'none' ? '—' : zoneDate) + '</span></div>' +
  '</div>';
}
function rmRateBlockHTML(rating, ratingDate) {
  return '<div class="rm-block">' +
    '<div class="rm-block__row"><span class="rm-block__label">Рейтинг контрагента</span><span class="rm-block__value rm-block__value--strong">' + (rating != null ? rating : '—') + '</span></div>' +
    '<div class="rm-block__row"><span class="rm-block__label">Дата расчета</span><span class="rm-block__value">' + (rating != null ? ratingDate : '—') + '</span></div>' +
  '</div>';
}

/* ---------- монтирует живой инстанс: анкор + чип + (опц.) поповер ---------- */
function mountRiskMetric(container, o = {}) {
  const anchor = document.createElement('span');
  anchor.className = 'pop-anchor';
  const { el, btn } = makeRiskChip(o);
  anchor.appendChild(el);
  container.appendChild(anchor);
  if (!btn) { window.dsIcons && window.dsIcons.apply(anchor); return { anchor, btn: null, pop: null }; }

  const { pop } = buildRiskPopover(Object.assign({ rating: o.rating, zone: o.zone }, o.popover || {}));
  anchor.appendChild(pop);
  pop.id = 'rm-pop-' + (++rmSeq);
  btn.setAttribute('aria-controls', pop.id);

  function open() {
    if (rmOpen && rmOpen.pop !== pop) rmClose();
    rmPlacePop(anchor, pop, btn, 'bottom', 'start', 8);
    pop.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    rmOpen = { pop, btn };
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    pop.classList.contains('is-open') ? rmClose() : open();
  });
  const closeBtn = pop.querySelector('.pop__close .ibtn');
  if (closeBtn) closeBtn.addEventListener('click', (e) => { e.stopPropagation(); rmClose(); btn.focus(); });

  window.dsIcons && window.dsIcons.apply(anchor);
  return { anchor, btn, pop, open };
}

/* ========================================================================= */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- КОНСТРУКТОР ---------------- */
  (function () {
    const controls = document.getElementById('pg-controls');
    const stage = document.getElementById('pg-stage');
    if (!controls || !stage) return;

    const state = { zone: 'red', rating: '26', popState: 'default' };
    let inst = null;

    function ctl(labelText, options, get, set) {
      const wrap = document.createElement('div'); wrap.className = 'ctl';
      const l = document.createElement('div'); l.className = 'lbl'; l.textContent = labelText; wrap.appendChild(l);
      const box = document.createElement('div'); box.className = 'pg-select';
      const sel = document.createElement('select');
      options.forEach(([v, t]) => { const op = document.createElement('option'); op.value = v; op.textContent = t; if (v === get()) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', () => { set(sel.value); render(); });
      box.appendChild(sel); wrap.appendChild(box); return wrap;
    }

    controls.appendChild(ctl('Зона проблемности', [
      ['none', 'Нет данных'], ['green', 'Зелёная'], ['watchlist', 'Watchlist'], ['red', 'Красная'], ['black', 'Чёрная'],
    ], () => state.zone, v => state.zone = v));

    controls.appendChild(ctl('Рейтинг контрагента', [
      ['none', 'Нет данных'], ['1', '1'], ['5', '5'], ['12', '12'], ['18', '18'], ['26', '26'],
    ], () => state.rating, v => state.rating = v));

    controls.appendChild(ctl('Состояние поповера', [
      ['default', 'Обычное'], ['loading', 'Загрузка'], ['error', 'Ошибка'],
    ], () => state.popState, v => state.popState = v));

    const hint = document.createElement('p');
    hint.style.cssText = 'font:var(--type-body-s); color:var(--text-inactive); margin:-8px 0 0;';
    hint.textContent = 'Кликните по иконке-информеру в превью, чтобы открыть Popover_RiskMetric.';
    controls.appendChild(hint);

    function render() {
      stage.innerHTML = '';
      const box = document.createElement('div'); box.style.cssText = 'padding-top:60px;';
      const rating = state.rating === 'none' ? null : Number(state.rating);
      inst = mountRiskMetric(box, {
        rating, zone: state.zone,
        popover: { rating, zone: state.zone, state: state.popState },
      });
      stage.appendChild(box);
    }
    render();
  })();

  /* ---------------- ИСПОЛЬЗОВАНИЕ: строка таблицы контрагентов ---------------- */
  (function () {
    const host = document.getElementById('use-table');
    if (!host) return;
    const rows = [
      ['ООО «Северная верфь»', 26, 'red'],
      ['АО «Балтийский лизинг»', 12, 'watchlist'],
      ['ПАО «Речной торговый банк»', 4, 'green'],
      ['Фонд «Прибрежные инвестиции»', null, 'black'],
      ['ИП Смирнов А. К.', null, 'none'],
    ];
    rows.forEach(([name, rating, zone]) => {
      const row = document.createElement('div'); row.className = 'rm-usage-row';
      const nm = document.createElement('span'); nm.className = 'rm-usage-row__name'; nm.textContent = name; row.appendChild(nm);
      const cellWrap = document.createElement('span'); cellWrap.className = 'rm-usage-row__metric'; row.appendChild(cellWrap);
      mountRiskMetric(cellWrap, { rating, zone });
      host.appendChild(row);
    });
  })();

  /* ---------------- АНАТОМИЯ ---------------- */
  (function () {
    const host = document.getElementById('anat-stage');
    if (!host) return;
    const box = document.createElement('div'); box.style.cssText = 'padding-top:60px;';
    const inst = mountRiskMetric(box, { rating: 26, zone: 'red', popover: { rating: 26, zone: 'red' } });
    host.appendChild(box);
    requestAnimationFrame(() => { inst.open(); });
  })();

  /* ---------------- РАЗМЕРЫ: redline Chip S ---------------- */
  (function () {
    const host = document.getElementById('sizes-demo');
    if (!host) return;
    mountRiskMetric(host, { rating: 26, zone: 'red', popover: { rating: 26, zone: 'red' } });
  })();

  /* ---------------- СОСТОЯНИЯ: матрица 4×4 (комбинация × зона) ---------------- */
  (function () {
    const grid = document.getElementById('states-matrix');
    if (!grid) return;
    const cols = ['green', 'watchlist', 'red', 'black'];
    grid.appendChild(document.createElement('div'));
    cols.forEach(c => { const h = document.createElement('div'); h.className = 'rm-matrix__colhead'; h.textContent = RM_ZONES[c].label; grid.appendChild(h); });

    const rowDefs = [
      ['Rate + Zone', (c) => ({ rating: 26, zone: c })],
      ['Zone', (c) => ({ rating: null, zone: c })],
    ];
    rowDefs.forEach(([label, mk]) => {
      const rh = document.createElement('div'); rh.className = 'rm-matrix__rowhead'; rh.textContent = label; grid.appendChild(rh);
      cols.forEach(c => { const cell = document.createElement('div'); cell.className = 'rm-matrix__cell'; grid.appendChild(cell); mountRiskMetric(cell, mk(c)); });
    });

    /* Rate и None не зависят от зоны — одна ячейка на всю ширину */
    const rateRowLabel = document.createElement('div'); rateRowLabel.className = 'rm-matrix__rowhead'; rateRowLabel.textContent = 'Rate'; grid.appendChild(rateRowLabel);
    const rateCell = document.createElement('div'); rateCell.className = 'rm-matrix__cell rm-matrix__cell--span'; grid.appendChild(rateCell);
    mountRiskMetric(rateCell, { rating: 26, zone: 'none', popover: { rating: 26, zone: 'none' } });
    const rateNote = document.createElement('span'); rateNote.className = 'rm-matrix__note'; rateNote.textContent = 'не зависит от зоны — всегда outline, дефолтный бордер'; rateCell.appendChild(rateNote);

    const noneRowLabel = document.createElement('div'); noneRowLabel.className = 'rm-matrix__rowhead'; noneRowLabel.textContent = 'None'; grid.appendChild(noneRowLabel);
    const noneCell = document.createElement('div'); noneCell.className = 'rm-matrix__cell rm-matrix__cell--span'; grid.appendChild(noneCell);
    mountRiskMetric(noneCell, { rating: null, zone: 'none' });
    const noneNote = document.createElement('span'); noneNote.className = 'rm-matrix__note'; noneNote.textContent = 'нет ни рейтинга, ни зоны — иконка-информер отсутствует'; noneCell.appendChild(noneNote);
  })();

  /* ---------------- Один поповер одновременно ---------------- */
  (function () {
    const host = document.getElementById('single-open-demo');
    if (!host) return;
    const defs = [
      { name: 'ООО «Восток-Ресурс»', rating: 9, zone: 'green' },
      { name: 'АО «Метротранс»', rating: 21, zone: 'watchlist' },
      { name: 'ООО «Дельта-Финанс»', rating: null, zone: 'black' },
    ];
    defs.forEach(d => {
      const row = document.createElement('div'); row.className = 'rm-usage-row';
      const nm = document.createElement('span'); nm.className = 'rm-usage-row__name'; nm.textContent = d.name; row.appendChild(nm);
      const cell = document.createElement('span'); cell.className = 'rm-usage-row__metric'; row.appendChild(cell);
      mountRiskMetric(cell, { rating: d.rating, zone: d.zone });
      host.appendChild(row);
    });
  })();

  /* ---------------- Загрузка и ошибка ---------------- */
  (function () {
    const host = document.getElementById('states-load-error');
    if (!host) return;
    [['Загрузка', 'loading'], ['Ошибка', 'error']].forEach(([label, st]) => {
      const cell = document.createElement('div'); cell.className = 'state-cell';
      const cap = document.createElement('div'); cap.className = 'state-cap'; cap.textContent = label; cell.appendChild(cap);
      const box = document.createElement('div'); box.style.cssText = 'padding-top:60px;'; cell.appendChild(box);
      const inst = mountRiskMetric(box, { rating: 26, zone: 'red', popover: { rating: 26, zone: 'red', state: st } });
      host.appendChild(cell);
      requestAnimationFrame(() => inst.open());
    });
  })();

  /* ---------------- КОМПОНЕНТЫ ПОДКАЧКИ ПОПОВЕРА ---------------- */
  (function () {
    const zoneHost = document.getElementById('feeder-zone');
    if (zoneHost) {
      ['green', 'watchlist', 'red', 'black', 'none'].forEach(z => {
        const w = document.createElement('div'); w.innerHTML = rmZoneBlockHTML(z, '24.10.2025'); zoneHost.appendChild(w.firstChild);
      });
    }
    const rateHost = document.getElementById('feeder-rate');
    if (rateHost) {
      const a = document.createElement('div'); a.innerHTML = rmRateBlockHTML(26, '24.10.2025'); rateHost.appendChild(a.firstChild);
      const b = document.createElement('div'); b.innerHTML = rmRateBlockHTML(null, '24.10.2025'); rateHost.appendChild(b.firstChild);
    }
    const fieldHost = document.getElementById('feeder-fields');
    if (fieldHost) {
      fieldHost.innerHTML =
        '<div class="rm-field"><p class="rm-field__label">Риск-сегмент</p><p class="rm-field__value">Международный финансовый институт, НЕ относящийся к группе активов с риском 0%</p></div>' +
        '<div class="rm-field"><p class="rm-field__label">Риск-профиль</p><p class="rm-field__value">Непроектный</p></div>';
    }
  })();

  /* ---------------- ЦВЕТА ---------------- */
  (function () {
    const root = document.getElementById('color-ref');
    if (!root) return;
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
      { name: 'Зоны — светлая заливка (Зелёная / Watchlist)', rows: [['Зеленая — фон', '--st-green-light'], ['Зеленая — текст', '--st-green-dark'], ['Watchlist — фон', '--st-orange-light'], ['Watchlist — текст', '--st-orange-dark']] },
      { name: 'Зоны — solid-заливка (Красная / Чёрная)', rows: [['Красная — фон', '--st-red'], ['Чёрная — фон', '--st-grey'], ['Текст и иконка (обе)', '--c-mgrey-50']] },
      { name: 'Нет зоны (Outline)', rows: [['Border', '--st-system-mid'], ['Текст', '--st-system-dark'], ['Иконка', '--st-system']] },
      { name: 'Popover — поверхность и блок подкачки', rows: [['Фон поповера', '--bg-popup'], ['Фон блока', '--c-cgrey-50'], ['Граница', '--border-light'], ['Радиус', '--radius-popup']] },
    ];
    root.innerHTML = groups.map(g => `
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

  /* ---------------- DEV: redline измерено на живом экземпляре ---------------- */
  (function () {
    const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;top:0;'; document.body.appendChild(host);
    const { el } = makeRiskChip({ rating: 26, zone: 'red' });
    host.appendChild(el);
    const cs = getComputedStyle(el);
    const info = el.querySelector('.chip__info');
    const rows = [
      ['Высота', cs.height],
      ['Паддинг X', cs.paddingLeft],
      ['Зазор label ↔ информер', cs.columnGap],
      ['Радиус', cs.borderTopLeftRadius],
      ['Кегль текста', cs.fontSize],
      ['Иконка-информер', info ? getComputedStyle(info).width : '—'],
    ];
    host.remove();
    const r = v => { const n = parseFloat(v); return isNaN(n) ? v : (Math.round(n * 10) / 10) + ' px'; };
    const rowsHtml = rows.map(([p, v]) => `<tr><td>${p}</td><td class="rt-num">${r(v)}</td></tr>`).join('');
    ['#dev-chip-table tbody', '#dev-chip-table-dup tbody'].forEach(sel => {
      const tb = document.querySelector(sel);
      if (tb) tb.innerHTML = rowsHtml;
    });
    const tbody2 = document.querySelector('#dev-pop-table tbody');
    if (tbody2) {
      const host = document.createElement('div'); host.style.cssText = 'position:absolute;left:-9999px;top:0;'; document.body.appendChild(host);
      const { pop } = buildRiskPopover({ rating: 26, zone: 'red' });
      pop.classList.remove('pop--floating'); pop.style.position = 'static';
      host.appendChild(pop);
      const cs = getComputedStyle(pop);
      const head = pop.querySelector('.pop__head'), body = pop.querySelector('.pop__body');
      const rows = [
        ['Ширина (w-m)', cs.width],
        ['Радиус', cs.borderRadius],
        ['Паддинг Header (Y/X)', getComputedStyle(head).paddingTop + ' / ' + getComputedStyle(head).paddingLeft],
        ['Паддинг Body (Y/X)', getComputedStyle(body).paddingTop + ' / ' + getComputedStyle(body).paddingLeft],
        ['Зазор от триггера', '8 px'],
      ];
      host.remove();
      const r = v => { const n = parseFloat(v); return isNaN(n) ? v : (Math.round(n * 10) / 10) + ' px'; };
      tbody2.innerHTML = rows.map(([p, v]) => `<tr><td>${p}</td><td class="rt-num">${typeof v === 'string' && v.indexOf('/') > -1 ? v.split(' / ').map(r).join(' / ') : r(v)}</td></tr>`).join('');
    }
  })();

  /* ---------------- CONTENT: примеры зон в таблице ---------------- */
  (function () {
    const map = { green: 'content-ex-green', watchlist: 'content-ex-watchlist', red: 'content-ex-red', black: 'content-ex-black', none: 'content-ex-none' };
    Object.keys(map).forEach(zone => {
      const cell = document.getElementById(map[zone]);
      if (!cell) return;
      mountRiskMetric(cell, zone === 'none' ? { rating: null, zone: 'none' } : { rating: 26, zone, popover: { rating: 26, zone } });
    });
  })();

  /* ---------------- ПРЕДЛАГАЕМЫЕ ДОПОЛНЕНИЯ ---------------- */
  (function () {
    const host = document.getElementById('proposals');
    if (!host) return;
    const items = [
      { name: 'Disabled / нет доступа', desc: 'Пользователю не хватает прав на риск-данные контрагента — чип приглушается (StDisabled), информер неактивен, tooltip «Нет доступа к риск-метрике».' },
      { name: 'Индикатор тренда', desc: 'Стрелка рядом с рейтингом (arrow-trend-up/down) — сравнение с прошлым расчётом. Не влияет на тон чипа, только на смысловую пиктограмму слева.' },
      { name: 'Компактный вариант «только зона»', desc: 'Для узких колонок — чип без числа, только цветной индикатор зоны + информер. Тот же Popover, тот же набор тонов.' },
    ];
    items.forEach(it => {
      const p = document.createElement('div'); p.className = 'prop';
      const demo = document.createElement('div'); demo.className = 'pdemo';
      const chip = document.createElement('span'); chip.className = 'chip chip--readonly chip--rounded chip--s chip--error-solid'; chip.style.opacity = '.55';
      chip.innerHTML = '<span class="chip__label">26</span>';
      demo.appendChild(chip);
      const n = document.createElement('div'); n.className = 'pname'; n.textContent = it.name;
      const d = document.createElement('div'); d.className = 'pdesc'; d.textContent = it.desc;
      p.append(demo, n, d); host.appendChild(p);
    });
  })();

  /* ---------------- DEV: copy-to-clipboard ---------------- */
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
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      btn.classList.add('is-copied');
      const prev = label.textContent; label.textContent = 'Скопировано';
      setTimeout(() => { btn.classList.remove('is-copied'); label.textContent = prev; }, 1600);
    });
  });

});
