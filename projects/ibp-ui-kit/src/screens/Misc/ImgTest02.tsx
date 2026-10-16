import React from 'react';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  title: string;
};

type FieldProps = {
  label: string;
  value: React.ReactNode;
};

type IconProps = {
  size?: number;
};

const navItems = [
  'menu',
  'home',
  'document',
  'settings',
  'payment',
  'building',
  'profile',
  'calendar',
  'gear',
  'sliders',
] as const;

function Card({ children, className = '', title }: CardProps) {
  return (
    <section className={`payment-card ${className}`} aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ArrowCircleIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.4 6.7 11.8 10l-3.4 3.3M6.6 10h5.1"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function BackIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6.5 4 2.8 7.7l3.7 3.7M3.2 7.7h7a3 3 0 0 1 3 3V12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CloseCircleIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m6.7 6.7 4.6 4.6M11.3 6.7l-4.6 4.6"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function OpenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M8 5H5.8A1.8 1.8 0 0 0 4 6.8v7.4A1.8 1.8 0 0 0 5.8 16h7.4a1.8 1.8 0 0 0 1.8-1.8V12M11 4h5v5M9.5 10.5 16 4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function DownloadIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true">
      <path
        d="M11 3.5v10M7.1 10.4 11 14.3l3.9-3.9M5 18h12"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function TrendIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M5.2 12.7 12.8 5M8.8 5h4v4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function NavGlyph({ name }: { name: (typeof navItems)[number] }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.65,
  };

  if (name === 'menu') {
    return (
      <>
        <path d="M5 7h14" {...common} />
        <path d="M5 12h14" {...common} />
        <path d="M5 17h9" {...common} />
      </>
    );
  }

  if (name === 'home') {
    return (
      <>
        <path d="M4.5 11 12 4.5 19.5 11" {...common} />
        <path d="M6.5 10.3v8h11v-8" {...common} />
      </>
    );
  }

  if (name === 'document') {
    return (
      <>
        <path d="M7 4.5h7l3 3V19H7z" {...common} />
        <path d="M14 4.5V8h3" {...common} />
        <path d="M9 12h6M9 15h4" {...common} />
      </>
    );
  }

  if (name === 'settings') {
    return (
      <>
        <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6z" {...common} />
        <path d="M12 4v2M12 18v2M5.1 8l1.7 1M17.2 15l1.7 1M5.1 16l1.7-1M17.2 9l1.7-1" {...common} />
      </>
    );
  }

  if (name === 'payment') {
    return (
      <>
        <rect x="5" y="5.5" width="14" height="13" rx="2" {...common} />
        <path d="M8.4 8h7.2M9 14.6h6M10.2 11.2h3.6" {...common} />
        <path d="M12 10.2v5" {...common} />
      </>
    );
  }

  if (name === 'building') {
    return (
      <>
        <path d="M5.5 19h13M7 19V8h7v11M14 19V5h3.5v14" {...common} />
        <path d="M9 10.5h2.5M9 13.2h2.5M9 16h2.5" {...common} />
      </>
    );
  }

  if (name === 'profile') {
    return (
      <>
        <path d="M6.5 19v-3.2a3 3 0 0 1 3-3h5a3 3 0 0 1 3 3V19" {...common} />
        <path d="M12 4.7a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" {...common} />
      </>
    );
  }

  if (name === 'calendar') {
    return (
      <>
        <rect x="5" y="5.8" width="14" height="13" rx="2" {...common} />
        <path d="M8 4v3M16 4v3M5 9.2h14" {...common} />
        <circle cx="16.7" cy="8" r="2.2" fill="#13b5a1" />
        <path d="M16.7 6.9v1.7M15.9 7.7h1.6" stroke="#fff" strokeLinecap="round" strokeWidth="1.1" />
      </>
    );
  }

  if (name === 'gear') {
    return (
      <>
        <circle cx="12" cy="12" r="3" {...common} />
        <path
          d="M12 4.5v2M12 17.5v2M6.7 6.7l1.4 1.4M15.9 15.9l1.4 1.4M4.5 12h2M17.5 12h2M6.7 17.3l1.4-1.4M15.9 8.1l1.4-1.4"
          {...common}
        />
      </>
    );
  }

  return (
    <>
      <path d="M5 8h8M16 8h3M5 16h3M11 16h8" {...common} />
      <circle cx="14.5" cy="8" r="1.7" {...common} />
      <circle cx="9.5" cy="16" r="1.7" {...common} />
    </>
  );
}

export function ImgTest02() {
  return (
    <main className="payment-screen" data-sd-screen-root="true" aria-label="img test 02">
      <style>{`
        .payment-screen {
          min-height: 100vh;
          background: #f3f8f7;
          color: #263633;
          font-family: Inter, "Segoe UI", Arial, sans-serif;
          letter-spacing: 0;
        }

        .payment-screen * {
          box-sizing: border-box;
        }

        .shell {
          display: flex;
          min-height: 100vh;
        }

        .sidebar {
          position: sticky;
          top: 0;
          width: 56px;
          height: 100vh;
          flex: 0 0 56px;
          background: #fbfdfc;
          border-right: 1px solid #e6efed;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 15px 0 18px;
          gap: 18px;
        }

        .nav-cluster {
          width: 100%;
          display: grid;
          justify-items: center;
          gap: 14px;
        }

        .nav-separator {
          width: 34px;
          height: 1px;
          background: #dce9e6;
        }

        .nav-button {
          width: 48px;
          height: 48px;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #b5cfca;
          display: grid;
          place-items: center;
          padding: 0;
        }

        .nav-button svg {
          width: 24px;
          height: 24px;
        }

        .nav-button.active {
          background: #e7f1ef;
          color: #4b9f94;
        }

        .user-badge {
          margin-top: auto;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          color: #9bb3ae;
          border: 1px solid #dce8e5;
          display: grid;
          place-items: center;
          font-size: 10px;
          font-weight: 600;
        }

        .content {
          width: 100%;
          padding: 17px 24px 40px 24px;
        }

        .breadcrumbs {
          display: flex;
          align-items: center;
          gap: 9px;
          color: #748480;
          font-size: 13px;
          line-height: 1;
          margin-bottom: 17px;
        }

        .breadcrumbs strong {
          color: #56635f;
          font-weight: 600;
        }

        .header-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: 14px;
        }

        .title-line {
          min-width: 0;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px 31px;
        }

        .title-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .payment-screen h1 {
          margin: 0;
          color: #24312f;
          font-size: 29px;
          line-height: 1.08;
          font-weight: 700;
        }

        .trend {
          color: #48ad5b;
          display: inline-flex;
          transform: translateY(1px);
        }

        .actions,
        .status-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .status-pill,
        .back-pill,
        .type-pill,
        .done-pill {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          white-space: nowrap;
          line-height: 1;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
        }

        .status-pill {
          gap: 5px;
          padding: 4px 9px 4px 5px;
          color: #126dad;
          background: #eff9ff;
          border: 1px solid #37a7df;
        }

        .back-pill {
          gap: 5px;
          padding: 5px 11px 5px 7px;
          color: #19a291;
          background: #effbf9;
          border: 1px solid #8bd7cc;
        }

        .primary-action,
        .danger-action {
          min-height: 41px;
          border-radius: 9px;
          background: #f9fffd;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0 16px;
          font-size: 15px;
          font-weight: 600;
          white-space: nowrap;
        }

        .primary-action {
          color: #0d9d8d;
          border: 1px solid #80d2c8;
        }

        .danger-action {
          color: #b52929;
          border: 1px solid #e88989;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 15px;
        }

        .payment-card {
          min-height: 217px;
          background: #ffffff;
          border-radius: 7px;
          padding: 23px 25px 26px;
          box-shadow: 0 1px 0 rgba(132, 157, 151, 0.03);
        }

        .payment-card h2 {
          margin: 0 0 24px;
          color: #2c3d39;
          font-size: 22px;
          line-height: 1.12;
          font-weight: 700;
        }

        .span-4 {
          grid-column: span 4;
        }

        .span-3 {
          grid-column: span 3;
        }

        .span-6 {
          grid-column: span 6;
        }

        .sum-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 26px 34px;
        }

        .counterparty-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 28px 45px;
        }

        .task-grid {
          display: grid;
          gap: 16px;
        }

        .docs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          column-gap: 86px;
          row-gap: 28px;
        }

        .field {
          min-width: 0;
          display: grid;
          gap: 8px;
        }

        .field span,
        .doc-item span {
          color: #74827f;
          font-size: 12px;
          line-height: 1.2;
          font-weight: 400;
        }

        .field strong,
        .doc-title,
        .purpose-text {
          color: #334440;
          font-size: 18px;
          line-height: 1.27;
          font-weight: 400;
        }

        .money {
          white-space: nowrap;
        }

        .money .currency-muted {
          color: #98a6a3;
          font-weight: 400;
        }

        .deal-title {
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .deal-title svg,
        .doc-link svg {
          color: #a9cfc9;
          flex: 0 0 auto;
        }

        .type-pill {
          padding: 5px 10px;
          color: #126dad;
          background: #f3fbff;
          border: 1px solid #53aed8;
        }

        .purpose-card,
        .task-card,
        .documents-card {
          min-height: 256px;
        }

        .purpose-text {
          max-width: 390px;
          font-size: 19px;
          line-height: 1.28;
        }

        .done-pill {
          padding: 4px 9px;
          color: #3d8c44;
          background: #e9f8e9;
          border: 1px solid #bfe4bd;
          font-size: 13px;
        }

        .doc-item {
          min-width: 0;
          display: grid;
          gap: 8px;
        }

        .doc-link {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .doc-title {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (max-width: 1220px) {
          .header-row {
            align-items: stretch;
            flex-direction: column;
          }

          .actions {
            justify-content: flex-end;
          }

          .span-4,
          .span-3,
          .span-6 {
            grid-column: span 6;
          }

          .documents-card {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .shell {
            display: block;
          }

          .sidebar {
            position: static;
            width: 100%;
            height: 56px;
            flex-direction: row;
            justify-content: flex-start;
            overflow-x: auto;
            padding: 4px 10px;
            gap: 8px;
          }

          .nav-cluster {
            display: flex;
            width: auto;
            gap: 6px;
          }

          .nav-separator,
          .user-badge {
            display: none;
          }

          .nav-button {
            width: 42px;
            height: 42px;
            flex: 0 0 42px;
          }

          .content {
            padding: 16px 12px 28px;
          }

          .breadcrumbs {
            flex-wrap: wrap;
            line-height: 1.35;
          }

          .payment-screen h1 {
            font-size: 25px;
          }

          .title-line,
          .actions,
          .status-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .primary-action,
          .danger-action {
            width: 100%;
            justify-content: center;
          }

          .cards-grid {
            gap: 12px;
          }

          .span-4,
          .span-3,
          .span-6 {
            grid-column: 1 / -1;
          }

          .payment-card {
            min-height: auto;
            padding: 20px;
          }

          .sum-grid,
          .counterparty-grid,
          .docs-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .doc-title {
            white-space: normal;
          }
        }
      `}</style>

      <div className="shell">
        <aside className="sidebar" aria-label="Навигация">
          <div className="nav-cluster">
            {navItems.slice(0, 1).map((item) => (
              <button className="nav-button" key={item} type="button" aria-label={item}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <NavGlyph name={item} />
                </svg>
              </button>
            ))}
          </div>
          <div className="nav-cluster">
            {navItems.slice(1, 2).map((item) => (
              <button className="nav-button" key={item} type="button" aria-label={item}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <NavGlyph name={item} />
                </svg>
              </button>
            ))}
          </div>
          <div className="nav-separator" />
          <div className="nav-cluster">
            {navItems.slice(2, 4).map((item) => (
              <button className="nav-button" key={item} type="button" aria-label={item}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <NavGlyph name={item} />
                </svg>
              </button>
            ))}
          </div>
          <div className="nav-cluster">
            {navItems.slice(4, 5).map((item) => (
              <button className="nav-button active" key={item} type="button" aria-label={item}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <NavGlyph name={item} />
                </svg>
              </button>
            ))}
          </div>
          <div className="nav-separator" />
          <div className="nav-cluster">
            {navItems.slice(5, 8).map((item) => (
              <button className="nav-button" key={item} type="button" aria-label={item}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <NavGlyph name={item} />
                </svg>
              </button>
            ))}
          </div>
          <div className="nav-separator" />
          <div className="nav-cluster">
            {navItems.slice(8).map((item) => (
              <button className="nav-button" key={item} type="button" aria-label={item}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <NavGlyph name={item} />
                </svg>
              </button>
            ))}
          </div>
          <div className="user-badge">ИБ</div>
        </aside>

        <div className="content">
          <nav className="breadcrumbs" aria-label="Хлебные крошки">
            <span>Главная</span>
            <span>/</span>
            <span>Реестр платежей</span>
            <span>/</span>
            <strong>Платеж от 30.07.2024</strong>
          </nav>

          <header className="header-row">
            <div className="title-line">
              <div className="title-wrap">
                <h1>Платеж от 30.07.2024</h1>
                <span className="trend">
                  <TrendIcon />
                </span>
              </div>
              <div className="status-actions">
                <span className="status-pill">
                  <ArrowCircleIcon size={18} />
                  Счет сформирован
                </span>
                <span className="back-pill">
                  <BackIcon />В реестр платежей
                </span>
              </div>
            </div>

            <div className="actions">
              <button className="primary-action" type="button">
                <ArrowCircleIcon />
                Подтвердить отправку счета клиенту
              </button>
              <button className="danger-action" type="button">
                <CloseCircleIcon />
                Отменить
              </button>
            </div>
          </header>

          <div className="cards-grid">
            <Card className="span-4" title="Сумма">
              <div className="sum-grid">
                <Field
                  label="Сумма с НДС, руб."
                  value={
                    <span className="money">
                      5 792 800,29 <span className="currency-muted">руб.</span>
                    </span>
                  }
                />
                <Field
                  label="НДС 20%, руб."
                  value={
                    <span className="money">
                      1 448 200,07 <span className="currency-muted">руб.</span>
                    </span>
                  }
                />
                <Field
                  label="Сумма без НДС, руб."
                  value={
                    <span className="money">
                      7 241 045,36 <span className="currency-muted">руб.</span>
                    </span>
                  }
                />
              </div>
            </Card>

            <Card className="span-4" title="Контрагент">
              <div className="counterparty-grid">
                <Field label="Платежный контрагент" value='ООО "Ромашка"' />
                <Field label="ИНН" value="6123012938" />
                <Field label="КПП" value="33432423423" />
                <Field label="КПП КН" value="33432423423" />
              </div>
            </Card>

            <Card className="span-4" title="Сделка">
              <div className="task-grid">
                <Field
                  label="№ сделки"
                  value={
                    <span className="deal-title">
                      M&A Сделка №45697354
                      <OpenIcon />
                    </span>
                  }
                />
                <Field label="Тип сделки" value={<span className="type-pill">sell-side</span>} />
              </div>
            </Card>

            <Card className="span-3 purpose-card" title="Назначение платежа">
              <p className="purpose-text">
                Услуги организатора по Соглашению "№ 456321" от "12.09.2024" об организации размещения облигаций
              </p>
            </Card>

            <Card className="span-3 task-card" title="Связанная задача">
              <div className="task-grid">
                <Field label="Номер объекта" value="№ IB34769" />
                <Field label="Исполнитель" value="Иванов С.П." />
                <Field label="Статус" value={<span className="done-pill">Выполнено</span>} />
              </div>
            </Card>

            <Card className="span-6 documents-card" title="Документы">
              <div className="docs-grid">
                <div className="doc-item">
                  <span>Договор</span>
                  <div className="doc-link">
                    <strong className="doc-title">Договор № 3764 от 20.03.2025.pdf</strong>
                    <DownloadIcon />
                  </div>
                </div>
                <div className="doc-item">
                  <span>Акт</span>
                  <div className="doc-link">
                    <strong className="doc-title">№456321 от 12.09.2024</strong>
                    <DownloadIcon />
                  </div>
                </div>
                <div className="doc-item">
                  <span>Счет-фактура</span>
                  <div className="doc-link">
                    <strong className="doc-title">№456334567321 от 24.01.2025</strong>
                    <DownloadIcon />
                  </div>
                </div>
                <div className="doc-item">
                  <span>Счет</span>
                  <div className="doc-link">
                    <strong className="doc-title">Счет №324 к Акту от 27.03.2025.xlsx</strong>
                    <DownloadIcon />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
