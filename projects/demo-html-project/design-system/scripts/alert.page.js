/* =========================================================================
   alert.page.js — конструктор и демо страницы компонента Alert.
   Компонент — чистый CSS (styles/alert.css). Здесь: сборка разметки Алерта
   из опций, конструктор, демонстрации разделов, интерактив (свернуть/закрыть),
   заполнение redline / a11y / типографики / цветов через getComputedStyle.
   ========================================================================= */
(function () {
  'use strict';

  var TONE_ICON = {
    info:    'Info-circle-filled',
    warning: 'alert-triangle-filled',
    error:   'alert-circle-filled',
    success: 'check-circle-filled'
  };
  var TONE_LABEL = { info: 'Info', warning: 'Warning', error: 'Error', success: 'Success' };
  var TONES = ['info', 'warning', 'error', 'success'];

  var DEMO_TITLE = 'Заголовок компонента';
  var DEMO_TEXT  = 'Добавление холдинга в разработке. Для корректного отображения Клиента необходимо заводить сделку на головную компанию, либо другую компанию группы';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------- сборка разметки Алерта ---------------- */
  function alertHTML(o) {
    o = o || {};
    var tone = o.tone || 'info';
    var size = o.size || 'm';
    var icon = o.icon !== false;
    var title = o.title || '';
    var text = o.text || '';
    var buttons = o.buttons || 'none';   // none | one | two | link
    var actions = o.actions || 'none';   // none | close | both
    var collapsed = o.collapsed ? ' alert--collapsed' : '';
    var role = (tone === 'error' || tone === 'warning') ? 'alert' : 'status';
    var live = (tone === 'error' || tone === 'warning') ? 'assertive' : 'polite';

    var body = '';
    if (title) body += '<p class="alert__title">' + esc(title) + '</p>';
    if (text) body += '<p class="alert__text">' + esc(text) + '</p>';
    if (buttons === 'one') {
      body += '<div class="alert__buttons"><button type="button" class="btn btn--outline btn--xs"><span class="btn__label">' + esc(o.btnLabel || 'Завести сделку') + '</span></button></div>';
    } else if (buttons === 'two') {
      body += '<div class="alert__buttons">'
        + '<button type="button" class="btn btn--outline btn--xs"><span class="btn__label">' + esc(o.btnLabel || 'Завести сделку') + '</span></button>'
        + '<button type="button" class="btn btn--transparent btn--xs"><span class="btn__label">' + esc(o.btn2Label || 'Позже') + '</span></button>'
        + '</div>';
    } else if (buttons === 'link') {
      body += '<div class="alert__buttons"><a class="link link--accent link--s" href="#" onclick="return false">' + esc(o.linkLabel || 'Подробнее') + '</a></div>';
    }

    var acts = '';
    if (actions === 'both') {
      acts += '<button type="button" class="alert__act alert__collapse" aria-label="Свернуть" aria-expanded="' + (collapsed ? 'false' : 'true') + '"><i data-icon="chevron-up"></i></button>';
    }
    if (actions === 'close' || actions === 'both') {
      acts += '<button type="button" class="alert__act alert__close" aria-label="Закрыть"><i data-icon="close"></i></button>';
    }

    return '<div class="alert alert--' + tone + ' alert--' + size + collapsed + '" role="' + role + '" aria-live="' + live + '">'
      + (icon ? '<span class="alert__icon" aria-hidden="true"><i data-icon="' + TONE_ICON[tone] + '"></i></span>' : '')
      + '<div class="alert__body">' + body + '</div>'
      + (acts ? '<div class="alert__actions">' + acts + '</div>' : '')
      + '</div>';
  }

  function paintIcons(root) { if (window.dsIcons) window.dsIcons.apply(root || document); }
  function setHTML(id, html) { var el = document.getElementById(id); if (el) { el.innerHTML = html; paintIcons(el); } return el; }

  /* ---------------- конструктор ---------------- */
  function initPlayground() {
    var tone = document.getElementById('c-tone');
    var size = document.getElementById('c-size');
    var btns = document.getElementById('c-buttons');
    var acts = document.getElementById('c-actions');
    var title = document.getElementById('c-title');
    var text = document.getElementById('c-text');
    var iconT = document.getElementById('c-icon');
    if (!tone) return;

    iconT.addEventListener('click', function () {
      iconT.setAttribute('aria-pressed', iconT.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      render();
    });

    function render() {
      var o = {
        tone: tone.value,
        size: size.value,
        buttons: btns.value,
        actions: acts.value,
        title: title.value.trim(),
        text: text.value.trim(),
        icon: iconT.getAttribute('aria-pressed') === 'true'
      };
      setHTML('pg-preview', alertHTML(o));

      var cls = 'alert alert--' + o.tone + ' alert--' + o.size;
      var code = document.getElementById('pg-code');
      if (code) {
        code.innerHTML = '<code>&lt;div class="' + cls + '" role="'
          + ((o.tone === 'error' || o.tone === 'warning') ? 'alert' : 'status') + '"&gt;…&lt;/div&gt;</code>';
      }
    }

    [tone, size, btns, acts].forEach(function (s) { s.addEventListener('change', render); });
    [title, text].forEach(function (i) { i.addEventListener('input', render); });
    render();
  }

  /* ---------------- демо разделов ---------------- */
  function initDemos() {
    // Использование
    setHTML('use-inline', alertHTML({ tone: 'info', title: DEMO_TITLE, text: DEMO_TEXT }));
    setHTML('use-action', alertHTML({ tone: 'warning', title: 'Требуется подтверждение', text: 'Реквизиты контрагента изменились. Проверьте их перед отправкой на согласование.', buttons: 'two', actions: 'close', btnLabel: 'Проверить', btn2Label: 'Позже' }));

    // Alert vs Toast vs SnackBar — витрина
    setHTML('diff-alert', alertHTML({ tone: 'info', size: 's', title: 'Инлайн-сообщение', text: 'Живёт в потоке блока.' }));
    var diffToast = document.getElementById('diff-toast');
    if (diffToast) diffToast.innerHTML = '<div style="display:inline-flex;align-items:center;gap:10px;background:var(--c-cgrey-700,#333F48);color:#fff;border-radius:8px;padding:10px 16px;font:var(--type-body-s)">Процесс запущен</div>';
    var diffSnack = document.getElementById('diff-snack');
    if (diffSnack) diffSnack.innerHTML = '<div style="background:var(--bg-tile);border:1px solid var(--border-light);border-radius:12px;box-shadow:0 10px 30px rgba(40,50,55,.16);padding:12px 14px;max-width:260px"><div style="font:var(--type-body-s-strong);color:var(--text-black);margin-bottom:2px">Готово</div><div style="font:var(--type-body-xs);color:var(--text-secondary)">Уведомление в углу экрана.</div></div>';

    // Тоны
    setHTML('var-tones', TONES.map(function (t) {
      return alertHTML({ tone: t, title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one', actions: 'both' });
    }).join(''));

    // Состав
    setHTML('var-compose', [
      alertHTML({ tone: 'info', title: DEMO_TITLE, actions: 'close' }),
      alertHTML({ tone: 'info', text: DEMO_TEXT, actions: 'close' }),
      alertHTML({ tone: 'info', title: DEMO_TITLE, text: DEMO_TEXT }),
      alertHTML({ tone: 'info', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one' }),
      alertHTML({ tone: 'info', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one', actions: 'both' })
    ].join(''));

    // Кнопки и ссылки
    setHTML('var-buttons', [
      alertHTML({ tone: 'success', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one', btnLabel: 'Открыть сделку' }),
      alertHTML({ tone: 'success', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'two', btnLabel: 'Открыть сделку', btn2Label: 'Скрыть' }),
      alertHTML({ tone: 'success', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'link', linkLabel: 'Подробнее' })
    ].join(''));

    // Размеры
    setHTML('size-m', alertHTML({ tone: 'info', size: 'm', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one', actions: 'both' }));
    setHTML('size-s', alertHTML({ tone: 'info', size: 's', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one', actions: 'both' }));

    // Контент — do/don't
    var badIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    var goodIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';
    var icBad = document.getElementById('ic-bad'); if (icBad) icBad.innerHTML = badIcon;
    var icGood = document.getElementById('ic-good'); if (icGood) icGood.innerHTML = goodIcon;
    setHTML('guide-bad', alertHTML({ tone: 'error', title: 'Ошибка', text: 'Произошла ошибка. Ошибка при сохранении данных произошла.', buttons: 'one', btnLabel: 'ОК' }));
    setHTML('guide-good', alertHTML({ tone: 'error', title: 'Не удалось сохранить', text: 'Сервер недоступен. Изменения не сохранены — повторите попытку через минуту.', buttons: 'one', btnLabel: 'Повторить' }));

    // Поведение — закрытие
    renderDismiss();
    document.getElementById('dismiss-reset') && document.getElementById('dismiss-reset').addEventListener('click', renderDismiss);

    // Поведение — сворачивание
    setHTML('beh-collapse', alertHTML({ tone: 'info', title: 'Как работает раскрытие холдинга', text: DEMO_TEXT, buttons: 'one', actions: 'both' }));

    // Поведение — позиция в потоке (стек)
    setHTML('beh-flow', [
      alertHTML({ tone: 'error', title: 'Проверьте реквизиты', text: 'ИНН контрагента не прошёл проверку в реестре.', actions: 'close' }),
      alertHTML({ tone: 'info', text: 'Черновик сохраняется автоматически каждые 30 секунд.', actions: 'close' })
    ].join(''));

    // Анимация
    renderAnim();
    document.getElementById('anim-replay') && document.getElementById('anim-replay').addEventListener('click', renderAnim);

    // Состояния действий
    renderStateSpecs();

    // таблицы
    fillSizeTable();
    fillA11y();
    fillTypeTable();
    fillColorRef();
    fillDevSpec();

    // копирование кода
    wireCopy();
  }

  function renderDismiss() {
    setHTML('beh-dismiss', alertHTML({ tone: 'warning', title: 'Сообщение можно закрыть', text: 'Нажмите крестик — Алерт свернётся по высоте и исчезнет. Кнопка ниже вернёт его.', buttons: 'one', btnLabel: 'Действие', actions: 'close' }));
  }

  function renderAnim() {
    var host = document.getElementById('anim-demo');
    if (!host) return;
    host.innerHTML = alertHTML({ tone: 'success', title: 'Готово', text: 'Сделка маршрутизирована.', actions: 'close' });
    paintIcons(host);
    var al = host.querySelector('.alert');
    if (!al) return;
    al.style.overflow = 'hidden';
    var h = al.offsetHeight;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    al.style.height = '0'; al.style.opacity = '0';
    // eslint-disable-next-line no-unused-expressions
    al.offsetHeight;
    al.style.transition = reduce ? 'opacity .2s ease' : 'height .2s ease-out, opacity .2s ease-out';
    al.style.height = h + 'px'; al.style.opacity = '1';
    al.addEventListener('transitionend', function () {
      al.style.height = ''; al.style.overflow = ''; al.style.transition = '';
    }, { once: true });
  }

  function renderStateSpecs() {
    var host = document.getElementById('state-specs');
    if (!host) return;
    var rows = [
      ['Default', 'Иконка-действие в покое', 'Цвет Text_Inactive, фон прозрачный'],
      ['Hover', 'Наведение курсора', 'Цвет Text_Secondary, лёгкая подложка в тон (12%)'],
      ['Active', 'Нажатие', 'Цвет акцента тона'],
      ['Focus', 'Фокус с клавиатуры', 'Обводка 2px тона, offset 1px']
    ];
    host.innerHTML = rows.map(function (r) {
      return '<div class="spec__row">'
        + '<div class="spec__state">' + r[0] + '<small>' + r[1] + '</small></div>'
        + '<div class="spec__sample"><button type="button" class="alert__act" aria-label="' + r[0] + '" style="color:var(--text-inactive)"><i data-icon="close"></i></button></div>'
        + '<div style="font:var(--type-body-s);color:var(--text-secondary)">' + r[2] + '</div>'
        + '</div>';
    }).join('');
    // тонируем sample через родителя-alert контекст (акцент info)
    host.querySelectorAll('.spec__sample').forEach(function (s) { s.style.setProperty('--alert-accent', 'var(--info)'); s.style.setProperty('--primary', 'var(--info)'); });
    paintIcons(host);
  }

  /* ---------------- анатомия с маркерами ---------------- */
  function initAnatomy() {
    var dia = document.getElementById('anat-diagram');
    if (!dia) return;
    dia.innerHTML = alertHTML({ tone: 'info', title: DEMO_TITLE, text: DEMO_TEXT, buttons: 'one', actions: 'both' });
    paintIcons(dia);
    var al = dia.querySelector('.alert');
    function place() {
      dia.querySelectorAll('.mk').forEach(function (m) { m.remove(); });
      function mark(target, dx, dy) {
        if (!target) return;
        var ar = al.getBoundingClientRect(), tr = target.getBoundingClientRect();
        if (!ar.width) return;
        var x = tr.left - ar.left + (dx == null ? tr.width / 2 : dx);
        var y = tr.top - ar.top + (dy == null ? tr.height / 2 : dy);
        var m = document.createElement('span'); m.className = 'mk';
        m.style.left = x + 'px'; m.style.top = y + 'px';
        dia.appendChild(m);
      }
      mark(al, 8, 8);                                    // 1 контейнер
      mark(al.querySelector('.alert__icon'), null, null);// 2 иконка
      mark(al.querySelector('.alert__title'), 6, 8);     // 3 заголовок
      mark(al.querySelector('.alert__text'), 6, 8);      // 4 текст
      mark(al.querySelector('.alert__buttons'), 22, 12); // 5 кнопки
      mark(al.querySelector('.alert__actions'), null, 10);// 6 действия
    }
    requestAnimationFrame(place);
    setTimeout(place, 250);
    window.addEventListener('load', place);
    if (window.ResizeObserver) new ResizeObserver(place).observe(dia);
  }

  /* ---------------- таблицы (getComputedStyle) ---------------- */
  function px(v) { return Math.round(parseFloat(v)) + 'px'; }

  function fillSizeTable() {
    var body = document.querySelector('#size-table tbody');
    if (!body) return;
    var m = document.querySelector('#size-m .alert');
    var s = document.querySelector('#size-s .alert');
    if (!m || !s) return;
    function pad(el) { var c = getComputedStyle(el); return px(c.paddingTop) + ' / ' + px(c.paddingLeft); }
    function icon(el) { var i = el.querySelector('.alert__icon'); return i ? px(getComputedStyle(i).width) : '—'; }
    function gap(el) { return px(getComputedStyle(el).columnGap || getComputedStyle(el).gap); }
    var rows = [
      ['Паддинг (верт / гор)', pad(m), pad(s)],
      ['Зазор иконка↔тело', gap(m), gap(s)],
      ['Размер иконки', icon(m), icon(s)],
      ['Радиус', px(getComputedStyle(m).borderTopLeftRadius), px(getComputedStyle(s).borderTopLeftRadius)],
      ['Токен заголовка', 'Body M Strong', 'Body S Strong'],
      ['Токен текста', 'Body S', 'Body XS']
    ];
    body.innerHTML = rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td class="rt-num">' + r[1] + '</td><td class="rt-num">' + r[2] + '</td></tr>';
    }).join('');
  }

  function fillA11y() {
    var body = document.querySelector('#a11y-table tbody');
    if (!body) return;
    var rows = [
      ['Info', 'status', 'polite', 'Информирование — не прерывает, озвучивается по завершении фразы'],
      ['Success', 'status', 'polite', 'Подтверждение результата — не требует немедленной реакции'],
      ['Warning', 'alert', 'assertive', 'Предупреждение — важно узнать сразу'],
      ['Error', 'alert', 'assertive', 'Ошибка — объявляется немедленно, прерывает чтение']
    ];
    body.innerHTML = rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><code class="tok">' + r[1] + '</code></td><td><code class="tok">' + r[2] + '</code></td><td style="color:var(--text-secondary)">' + r[3] + '</td></tr>';
    }).join('');
  }

  function fillTypeTable() {
    var body = document.querySelector('#type-table tbody');
    if (!body) return;
    var rows = [
      ['Заголовок', '--type-body-m-strong', '--type-body-s-strong', 'Text_Black'],
      ['Текст', '--type-body-s', '--type-body-xs', 'Text_Secondary'],
      ['Кнопка', '--type-button-xs', '--type-button-xs', 'тон (акцент)'],
      ['Ссылка', '--type-body-s', '--type-body-s', 'тон (акцент)']
    ];
    body.innerHTML = rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td><code class="tok">' + r[1] + '</code></td><td><code class="tok">' + r[2] + '</code></td><td style="color:var(--text-secondary)">' + r[3] + '</td></tr>';
    }).join('');
  }

  function resolveColor(expr) {
    var probe = document.createElement('span');
    probe.style.color = expr; probe.style.display = 'none';
    document.body.appendChild(probe);
    var c = getComputedStyle(probe).color;
    probe.remove();
    // rgb → hex
    var m = c.match(/\d+/g);
    if (!m) return c;
    return '#' + m.slice(0, 3).map(function (n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); }).join('').toUpperCase();
  }

  function fillColorRef() {
    var host = document.getElementById('color-ref');
    if (!host) return;
    var map = {
      info: ['--info-bg', '--info'],
      warning: ['--warning-bg', '--warning'],
      error: ['--error-bg-light', '--error'],
      success: ['--success-bg', '--success']
    };
    host.innerHTML = TONES.map(function (t) {
      var surface = map[t][0], accent = map[t][1];
      var sHex = resolveColor('var(' + surface + ')');
      var aHex = resolveColor('var(' + accent + ')');
      return '<div class="cref-group"><h3>' + TONE_LABEL[t] + '</h3><div class="cref-rows">'
        + crefRow('Заливка контейнера', surface, sHex)
        + crefRow('Акцент (иконка / кнопки)', accent, aHex)
        + '</div></div>';
    }).join('');
  }
  function crefRow(role, token, hex) {
    return '<div class="cref-row">'
      + '<span class="cref-sw"><span class="cf" style="background:var(' + token + ')"></span></span>'
      + '<span class="cref-meta"><p class="role">' + role + '</p><p class="tname">' + token + '</p></span>'
      + '<span class="cref-hex">' + hex + '</span>'
      + '</div>';
  }

  function fillDevSpec() {
    var body = document.querySelector('#dev-spec-table tbody');
    if (!body) return;
    var m = document.querySelector('#size-m .alert');
    var s = document.querySelector('#size-s .alert');
    if (!m || !s) return;
    function val(el, prop) { return px(getComputedStyle(el)[prop]); }
    function iconW(el) { var i = el.querySelector('.alert__icon'); return i ? px(getComputedStyle(i).width) : '—'; }
    function actW(el) { var a = el.querySelector('.alert__act'); return a ? px(getComputedStyle(a).width) : '—'; }
    var rows = [
      ['Паддинг верт.', val(m, 'paddingTop'), val(s, 'paddingTop'), '--alert-pad'],
      ['Паддинг гор.', val(m, 'paddingLeft'), val(s, 'paddingLeft'), '--alert-pad'],
      ['Зазор иконка↔тело', px(getComputedStyle(m).columnGap), px(getComputedStyle(s).columnGap), '--alert-gap'],
      ['Размер иконки', iconW(m), iconW(s), '--alert-icon'],
      ['Кнопка-действие', actW(m), actW(s), '.alert__act (24 / 22)'],
      ['Радиус', val(m, 'borderTopLeftRadius'), val(s, 'borderTopLeftRadius'), '--radius-m']
    ];
    body.innerHTML = rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><td class="rt-num">' + r[1] + '</td><td class="rt-num">' + r[2] + '</td><td><code class="tok">' + r[3] + '</code></td></tr>';
    }).join('');
  }

  /* ---------------- интерактив: свернуть / закрыть (делегирование) ---------------- */
  function initInteractions() {
    document.addEventListener('click', function (e) {
      var col = e.target.closest && e.target.closest('.alert__collapse');
      if (col) {
        var a1 = col.closest('.alert');
        var now = a1.classList.toggle('alert--collapsed');
        col.setAttribute('aria-expanded', String(!now));
        return;
      }
      var cl = e.target.closest && e.target.closest('.alert__close');
      if (cl) {
        dismissAlert(cl.closest('.alert'));
      }
    });
  }

  function dismissAlert(al) {
    if (!al) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    al.style.overflow = 'hidden';
    al.style.height = al.offsetHeight + 'px';
    al.style.marginTop = getComputedStyle(al).marginTop;
    // eslint-disable-next-line no-unused-expressions
    al.offsetHeight;
    al.style.transition = reduce
      ? 'opacity .18s ease'
      : 'height .2s ease, opacity .18s ease, margin .2s ease, padding .2s ease';
    al.style.opacity = '0';
    if (!reduce) {
      al.style.height = '0'; al.style.paddingTop = '0'; al.style.paddingBottom = '0'; al.style.marginTop = '0';
    }
    al.addEventListener('transitionend', function () { al.remove(); }, { once: true });
    setTimeout(function () { if (al.parentNode) al.remove(); }, 400);
  }

  /* ---------------- копирование кода ---------------- */
  function wireCopy() {
    document.querySelectorAll('.code-panel__copy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var t = document.getElementById(btn.dataset.copyTarget);
        if (!t) return;
        navigator.clipboard.writeText(t.innerText).then(function () {
          btn.classList.add('is-copied');
          var lbl = btn.querySelector('.copy-label'); var prev = lbl ? lbl.textContent : '';
          if (lbl) lbl.textContent = 'Скопировано';
          setTimeout(function () { btn.classList.remove('is-copied'); if (lbl) lbl.textContent = prev; }, 1600);
        });
      });
    });
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    initPlayground();
    initDemos();
    initAnatomy();
    initInteractions();
  });
})();
