/* ============================================================
   DS NAV — построение левой навигации и подсветка текущей страницы
   Структура: Основы · Компоненты (Атомы / Молекулы / Организмы) · Правила и паттерны
   ============================================================ */
(function () {
  var ROOT = window.__DS_ROOT || '';
  var NAV = [
    {
      cat: 'Основы',
      items: [
        { label: 'Типографика', href: 'pages/foundations/Typography.html' },
        { label: 'Цвета',       href: 'pages/foundations/Colors.html' },
        { label: 'Иконки',      href: 'pages/foundations/Icons.html' },
        { label: 'Скругления',  href: 'pages/foundations/Radius.html' },
        { label: 'Тени',        href: 'pages/foundations/Elevation.html' },
        { label: 'Сетка и отступы', soon: true }
      ]
    },
    {
      cat: 'Компоненты',
      groups: [
        {
          group: 'Атомы',
          items: [
            { label: 'Button',       href: 'pages/atoms/Buttons.html' },
            { label: 'IconButton',   href: 'pages/atoms/IconButton.html' },
            { label: 'Link',         href: 'pages/atoms/Link.html' },
            { label: 'Checkbox',     href: 'pages/atoms/Checkbox.html' },
            { label: 'Radiobutton',  href: 'pages/atoms/Radiobutton.html' },
            { label: 'Switch',       href: 'pages/atoms/Switch.html' },
            { label: 'Badge',        href: 'pages/atoms/Badge.html' },
            { label: 'Chip',         href: 'pages/atoms/Chip.html' },
            { label: 'Avatar',       href: 'pages/atoms/Avatar.html' },
            { label: 'Divider',      href: 'pages/atoms/Divider.html' },
            { label: 'ProgressBar',  href: 'pages/atoms/ProgressBar.html' }
          ]
        },
        {
          group: 'Молекулы',
          items: [
            { label: 'ButtonGroup',      href: 'pages/molecules/ButtonGroup.html' },
            { label: 'Breadcrumbs',       href: 'pages/molecules/Breadcrumbs.html' },
            { label: 'Tooltip',          href: 'pages/molecules/Tooltip.html' },
            { label: 'Context Menu',     href: 'pages/molecules/ContextMenu.html' },
            { label: 'Tab',              href: 'pages/molecules/Tab.html' },
            { label: 'SegmentControl',   href: 'pages/molecules/SegmentControl.html' },
            { label: 'Splitter',         href: 'pages/molecules/Splitter.html' },
            { label: 'InputText',        href: 'pages/molecules/InputText.html' },
            { label: 'InputDate',        href: 'pages/molecules/InputDate.html' },
            { label: 'InputAutocomplete', href: 'pages/molecules/InputAutocomplete.html' },
            { label: 'Select',           href: 'pages/molecules/Select.html' },
            { label: 'ReadOnlyField',    href: 'pages/molecules/ReadOnlyField.html' },
            { label: 'Toast',            href: 'pages/molecules/Toast.html' },
            { label: 'Pagination',       href: 'pages/molecules/Pagination.html' }
          ]
        },
        {
          group: 'Организмы',
          items: [
            { label: 'Modal',    href: 'pages/organisms/Modal.html' },
            { label: 'Popover',  href: 'pages/organisms/Popover.html' },
            { label: 'RiskMetric', href: 'pages/organisms/RiskMetric.html' },
            { label: 'SnackBar',   href: 'pages/organisms/SnackBar.html' },
            { label: 'Entity',     href: 'pages/organisms/Entity.html' },
            { label: 'TableCell',  href: 'pages/organisms/TableCell.html' }
          ]
        },
        {
          group: 'Компоненты подкачки',
          items: [
            { label: 'Alert',         href: 'pages/loading/Alert.html' },
            { label: 'Label / Helper', href: 'pages/loading/LabelHelper.html' }
          ]
        }
      ]
    },
    {
      cat: 'Правила и паттерны',
      items: [
        { label: 'Аудит разделов',        href: 'pages/patterns/SectionsAudit.html' },
        { label: 'Редполитика',           soon: true },
        { label: 'Тон оф войс',           soon: true },
        { label: 'Паттерны интерфейса',   soon: true }
      ]
    }
  ];

  // текущий файл
  var current = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (current === '') current = 'index.html';

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function makeLink(item) {
    if (item.soon) {
      var s = el('span', 'ds-nav__link is-soon');
      s.appendChild(el('span', 'ds-nav__dot'));
      s.appendChild(el('span', 'ds-nav__label', item.label));
      s.appendChild(el('span', 'ds-nav__soon-badge', 'Скоро'));
      return s;
    }
    var a = el('a', 'ds-nav__link');
    a.href = ROOT + item.href;
    a.appendChild(el('span', 'ds-nav__dot'));
    a.appendChild(el('span', 'ds-nav__label', item.label));
    if (item.href.split('/').pop().toLowerCase() === current) {
      a.classList.add('is-active');
      a.setAttribute('aria-current', 'page');
    }
    return a;
  }

  // ---- построение DOM ----
  var nav = el('nav', 'ds-nav');
  nav.setAttribute('aria-label', 'Навигация по дизайн-системе');

  var brand = el('a', 'ds-nav__brand');
  brand.href = ROOT + 'index.html';
  var logo = el('span', 'ds-nav__logo');
  logo.appendChild(el('img'));
  logo.querySelector('img').src = ROOT + 'uploads/logo.svg';
  logo.querySelector('img').alt = 'IBP';
  brand.appendChild(logo);
  var bt = el('span', 'ds-nav__brandtext');
  bt.appendChild(el('span', 'ds-nav__title', 'ДС IBP'));
  bt.appendChild(el('span', 'ds-nav__sub', 'Investment Banking Platform'));
  brand.appendChild(bt);
  if (current === 'index.html') brand.classList.add('is-active');
  nav.appendChild(brand);

  var scroll = el('div', 'ds-nav__scroll');

  NAV.forEach(function (block) {
    var cat = el('div', 'ds-nav__cat');
    cat.appendChild(el('div', 'ds-nav__cat-label', block.cat));

    if (block.items) {
      block.items.forEach(function (it) { cat.appendChild(makeLink(it)); });
    }
    if (block.groups) {
      block.groups.forEach(function (g) {
        var gl = el('div', 'ds-nav__group-label', g.group);
        var real = g.items.filter(function (i) { return !i.soon; }).length;
        if (real) gl.appendChild(el('span', 'ds-nav__count', String(real)));
        cat.appendChild(gl);
        g.items.forEach(function (it) { cat.appendChild(makeLink(it)); });
      });
    }
    scroll.appendChild(cat);
  });

  nav.appendChild(scroll);

  // мобильный тоггл + бэкдроп
  var toggle = el('button', 'ds-nav__toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Открыть навигацию');
  toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var backdrop = el('div', 'ds-nav__backdrop');

  function setOpen(open) {
    document.body.classList.toggle('ds-nav-open', open);
  }
  toggle.addEventListener('click', function () { setOpen(!document.body.classList.contains('ds-nav-open')); });
  backdrop.addEventListener('click', function () { setOpen(false); });
  nav.addEventListener('click', function (e) { if (e.target.closest('.ds-nav__link')) setOpen(false); });

  function mount() {
    document.body.classList.add('ds-has-nav');
    document.body.insertBefore(backdrop, document.body.firstChild);
    document.body.insertBefore(nav, document.body.firstChild);
    document.body.appendChild(toggle);
    // прокрутка к активному пункту, если он ниже сгиба
    var active = nav.querySelector('.ds-nav__link.is-active');
    if (active) {
      var top = active.offsetTop;
      if (top > scroll.clientHeight - 80) scroll.scrollTop = top - scroll.clientHeight / 2;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
