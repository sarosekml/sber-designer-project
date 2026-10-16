import { useState } from 'react';
import { AppShell, Breadcrumbs, PageHeader, Tabs } from '../../components/layout';
import { Card, KpiCard } from '../../components/cards';
import { Badge, Button, SearchField, SelectControl, Status, Tag } from '../../components/primitives';
import { LineChart, BarChart } from '../../components/charts';
import { MetricBar } from '../../components/patterns';

const CO = [
  { id:'C1',n:'СеверПром Металлургия',s:'Металлургия',r:'Сделка D-2487',n24:14,cr:2,hi:4,se:-0.42,ri:'Высокий',ls:'Задержка CAPEX',ow:'Анна Смирнова' },
  { id:'C2',n:'Восток Логистика',s:'Логистика',r:'Fund II',n24:8,cr:0,hi:2,se:0.18,ri:'Средний',ls:'Рост оборота',ow:'Михаил Орлов' },
  { id:'C3',n:'Нева Тех',s:'B2B software',r:'A-1042, D-2511',n24:6,cr:1,hi:1,se:0.31,ri:'Низкий',ls:'Крупный контракт',ow:'Елена Ким' },
  { id:'C4',n:'Урал ЭнергоСервис',s:'Энергосервис',r:'Кредитная экспозиция',n24:5,cr:2,hi:1,se:-0.58,ri:'Высокий',ls:'Иск 1.2 млрд',ow:'Дмитрий Волков' },
  { id:'C5',n:'МедТех Солюшнс',s:'Медтех',r:'Pipeline D-2504',n24:4,cr:0,hi:1,se:0.44,ri:'Низкий',ls:'Инвестор вошел',ow:'Павел Егоров' },
  { id:'C6',n:'АгроСнаб Холдинг',s:'Агро',r:'Fund I',n24:7,cr:0,hi:2,se:-0.11,ri:'Средний',ls:'Снижение маржи',ow:'Наталья Петрова' },
];

const NW = [
  { id:'N1',ti:'СеверПром переносит запуск прокатного цеха на III кв. 2027',so:'Деловой Вестник',tm:'Сегодня, 09:18',co:'СеверПром Металлургия',ty:'CAPEX delay',im:'Critical',se:-0.61,re:96,im2:88,li:'D-2487, finmodel_v3.2',ow:'Анна Смирнова',st:'Follow-up',su:'Перенос запуска цеха из-за задержек поставки оборудования. Влияние на EBITDA 2027 и DSCR.',it:'Снижение EBITDA 2027 на 1.5-2.0 млрд, DSCR с 1.62x до 1.43x',ac:'Обновить финмодель и запросить CAPEX schedule.' },
  { id:'N2',ti:'Урал ЭнергоСервис получил иск на 1.2 млрд руб.',so:'Право и Бизнес',tm:'Сегодня, 08:47',co:'Урал ЭнергоСервис',ty:'Legal claim',im:'Critical',se:-0.74,re:91,im2:82,li:'credit_watch',ow:'Дмитрий Волков',st:'Risk review',su:'Иск на 1.2 млрд по спору о EPC-контракте. ~9% EBITDA 2025.',it:'Давление на ликвидность, рост legal risk',ac:'Запросить позицию юрдепартамента.' },
  { id:'N3',ti:'Нева Тех подписала 5-летний контракт на пром. ПО',so:'Tech Markets Daily',tm:'Сегодня, 08:12',co:'Нева Тех',ty:'Contract win',im:'High',se:0.62,re:88,im2:76,li:'A-1042, D-2511',ow:'Елена Ким',st:'Reviewed',su:'Контракт увеличит recurring revenue на 11-14% в 2027.',it:'Улучшение инвесткейса',ac:'Добавить в investment memo D-2511.' },
  { id:'N4',ti:'Восток Логистика: складской оборот +18% в мае',so:'Logistics Review',tm:'Вчера, 18:34',co:'Восток Логистика',ty:'KPI',im:'Medium',se:0.28,re:75,im2:54,li:'Fund II, A-0931',ow:'Михаил Орлов',st:'Viewed',su:'Рост за счет новых площадок и e-commerce.',it:'Рост операционных KPI',ac:'Обновить KPI в карточке актива.' },
  { id:'N5',ti:'АгроСнаб: снижение маржинальности из-за логистики',so:'АгроФинанс',tm:'Вчера, 17:10',co:'АгроСнаб Холдинг',ty:'Margin pressure',im:'High',se:-0.39,re:84,im2:69,li:'Fund I',ow:'Наталья Петрова',st:'Comment needed',su:'EBITDA margin снизится на 1.5-2.0 п.п.',it:'Снижение EBITDA, пересмотр valuation',ac:'Проверить sensitivity model.' },
  { id:'N6',ti:'МедТех Солюшнс привлекла стратег. инвестора',so:'Venture Health Monitor',tm:'Вчера, 15:42',co:'МедТех Солюшнс',ty:'Strategic investor',im:'High',se:0.71,re:86,im2:78,li:'D-2504, I-118',ow:'Павел Егоров',st:'Saved',su:'Инвестор снижает риск коммерциализации.',it:'Снижение execution risk',ac:'Запросить cap table.' },
  { id:'N7',ti:'СеверПром: долгосрочный контракт на поставку проката',so:'Металлургический Обзор',tm:'Вчера, 14:21',co:'СеверПром Металлургия',ty:'Контракты',im:'High',se:0.36,re:82,im2:65,li:'D-2487',ow:'Анна Смирнова',st:'Needs review',su:'Контракт компенсирует риск задержки CAPEX.',it:'Позитив для выручки',ac:'Включить в credit memo.' },
  { id:'N8',ti:'Рейтинг СеверПром Group подтвержден как стабильный',so:'Рейтинг Эксперт',tm:'12 июн, 19:05',co:'СеверПром Металлургия',ty:'Кредитный рейтинг',im:'Medium',se:0.22,re:79,im2:58,li:'D-2487, bond_draft',ow:'Анна Смирнова',st:'Viewed',su:'Агентство подтвердило стабильный прогноз.',it:'Поддержка облигационного выпуска',ac:'Добавить в DCM memo.' },
  { id:'N9',ti:'Сбой отгрузок сырья для СеверПрома',so:'Supply Chain Monitor',tm:'12 июн, 16:40',co:'СеверПром Металлургия',ty:'Supply chain',im:'Medium',se:-0.27,re:70,im2:49,li:'D-2487',ow:'Дмитрий Волков',st:'Monitoring',su:'Временный сбой, есть альтернативные поставщики.',it:'Краткосрочный операционный риск',ac:'Monitoring item.' },
  { id:'N10',ti:'Восток Логистика: buyout миноритария',so:'Market Signals',tm:'12 июн, 13:55',co:'Восток Логистика',ty:'M&A / ownership',im:'Medium',se:0,re:67,im2:61,li:'Fund II',ow:'Михаил Орлов',st:'Needs check',su:'Слух о buyout, требуется подтверждение.',it:'Изменение governance',ac:'Связаться с представителем компании.' },
];

const TABS = ['Все новости','Портфель','Активные сделки','Watchlist','Alerts','Сохраненные','Источники','Архив'];

function sentColor(v: number) { return v >= 0.35 ? 'var(--c-success)' : v >= 0 ? 'var(--c-accent-2)' : v >= -0.35 ? 'var(--c-warning)' : 'var(--c-danger)'; }

function impBadge(v: string) {
  if (v === 'Critical') return 'danger' as const;
  if (v === 'High') return 'warning' as const;
  return 'neutral' as const;
}

export function NewsScreenmpa9bael() {
  const [selNews, setSelNews] = useState('N1');
  const [selCo, setSelCo] = useState('C1');
  const [view, setView] = useState<'cards'|'table'>('cards');
  const [tab, setTab] = useState('Все новости');

  const active = NW.find(n => n.id === selNews) ?? NW[0];
  const activeCo = CO.find(c => c.id === selCo) ?? CO[0];

  return (
    <AppShell section="News">
      <Breadcrumbs items={['Research','News','Companies']} />
      <PageHeader
        title="Новости по компаниям"
        subtitle="Мониторинг новостей, событий и риск-сигналов по компаниям портфеля, активным сделкам и watchlist."
        actions={
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <Button variant="secondary" size="sm">Обновить</Button>
            <Button variant="secondary" size="sm">Настроить alerts</Button>
            <Button variant="secondary" size="sm">Создать подборку</Button>
            <Button variant="secondary" size="sm">Экспортировать</Button>
          </div>
        }
      />

      {/* Summary strip */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',padding:'10px 0',fontSize:12,color:'var(--c-text-2)',borderBottom:'1px solid var(--c-divider)',marginBottom:12}}>
        <span>Последнее обновление: <strong>13 июня 2026, 10:42</strong></span>
        <span>|</span>
        <span>Источников: <strong>42</strong></span>
        <span>|</span>
        <span>Компаний в мониторинге: <strong>186</strong></span>
        <span>|</span>
        <span>Новостей за 24 часа: <strong>128</strong></span>
        <span>|</span>
        <span>AI-классификация: <span style={{color:'var(--c-success)'}}>включена</span></span>
      </div>

      {/* KPI cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:10,marginBottom:16}}>
        <KpiCard label="Critical news" value="7" delta="требуют проверки сегодня" />
        <KpiCard label="Negative sentiment" value="24" delta="sentiment ниже -0.35" />
        <KpiCard label="Linked to deals" value="31" delta="затрагивают активные сделки" />
        <KpiCard label="Risk triggers" value="14" delta="сработали правила риска" />
        <KpiCard label="Follow-up required" value="11" delta="назначить ответственных" />
        <KpiCard label="Coverage quality" value="92%" delta="покрытие watchlist источниками" />
      </div>

      {/* Tabs */}
      <Tabs items={TABS.map(t=>({label:t}))} active={tab} />

      {/* Filters bar */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',padding:'10px 0'}}>
        <SearchField placeholder="Поиск по новостям, компаниям, источникам..." />
        <SelectControl style={{width:120}}><option>24 часа</option><option>7 дней</option><option>30 дней</option></SelectControl>
        <SelectControl style={{width:130}}><option>Все важности</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></SelectControl>
        <SelectControl style={{width:130}}><option>Все sentiment</option><option>Позитивный</option><option>Негативный</option><option>Нейтральный</option></SelectControl>
        <SelectControl style={{width:130}}><option>Все типы</option><option>CAPEX</option><option>Legal</option><option>Контракты</option><option>KPI</option></SelectControl>
        <div style={{marginLeft:'auto',display:'flex',gap:4}}>
          <Button size="sm" variant={view==='cards'?'primary':'secondary'} onClick={()=>setView('cards')}>Карточки</Button>
          <Button size="sm" variant={view==='table'?'primary':'secondary'} onClick={()=>setView('table')}>Таблица</Button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div style={{display:'grid',gridTemplateColumns:'22% 48% 30%',gap:12,marginTop:8}}>

        {/* Left: companies */}
        <div>
          <div style={{display:'flex',gap:4,marginBottom:8}}>
            <Button size="sm" variant="secondary">Все</Button>
            <Button size="sm" variant="secondary">Портфель</Button>
            <Button size="sm" variant="secondary">Сделки</Button>
            <Button size="sm" variant="secondary">Watchlist</Button>
          </div>
          <div style={{fontSize:11,color:'var(--c-text-3)',marginBottom:6}}>Saved views</div>
          {[
            {n:'Critical today',c:7},{n:'Portfolio risk',c:18},{n:'Deal monitoring',c:31},
            {n:'Negative sentiment',c:24},{n:'Credit watch',c:16},{n:'M&A signals',c:9}
          ].map(v=>(
            <div key={v.n} style={{fontSize:12,padding:'3px 0',cursor:'pointer',color:'var(--c-text-2)'}}>
              {v.n} <span style={{color:'var(--c-accent-2)'}}>{v.c}</span>
            </div>
          ))}
          <div style={{fontSize:11,color:'var(--c-text-3)',margin:'10px 0 6px'}}>Компании</div>
          {CO.map(c=>(
            <div key={c.id}
              onClick={()=>setSelCo(c.id)}
              style={{
                padding:'6px 8px',marginBottom:4,borderRadius:6,cursor:'pointer',
                background:selCo===c.id?'var(--c-surface-3)':'transparent',
                border:'1px solid '+(selCo===c.id?'var(--c-border-strong)':'transparent')
              }}>
              <div style={{fontSize:13,fontWeight:600}}>{c.n}</div>
              <div style={{fontSize:11,color:'var(--c-text-3)'}}>{c.s} · {c.r}</div>
              <div style={{display:'flex',gap:8,fontSize:11,marginTop:2}}>
                <span>Новостей: <strong>{c.n24}</strong></span>
                <span style={{color:'var(--c-danger)'}}>Critical: {c.cr}</span>
                <span style={{color:sentColor(c.se)}}>Sent: {c.se>0?'+':''}{c.se.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Center: news feed */}
        <div>
          {NW.map(n=>(
            <div key={n.id}
              onClick={()=>setSelNews(n.id)}
              style={{
                padding:'10px 12px',marginBottom:6,borderRadius:8,cursor:'pointer',
                background:selNews===n.id?'var(--c-surface-3)':'var(--c-surface)',
                border:'1px solid '+(selNews===n.id?'var(--c-accent-border)':'var(--c-border)')
              }}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <Badge tone={impBadge(n.im)}>{n.im}</Badge>
                  <span style={{fontSize:11,color:'var(--c-text-3)'}}>{n.tm}</span>
                  <span style={{fontSize:11,color:'var(--c-text-3)'}}>· {n.so}</span>
                </div>
                <span style={{fontSize:12,color:sentColor(n.se),fontWeight:600}}>
                  {n.se>0?'+':''}{n.se.toFixed(2)}
                </span>
              </div>
              <div style={{fontSize:13,fontWeight:600,lineHeight:1.4,marginBottom:4}}>{n.ti}</div>
              <div style={{fontSize:11,color:'var(--c-text-2)',lineHeight:1.4,marginBottom:4}}>{n.su}</div>
              <div style={{display:'flex',gap:8,alignItems:'center',fontSize:11,color:'var(--c-text-3)'}}>
                <span>{n.co}</span>
                <span>·</span>
                <span>Relevance: {n.re}%</span>
                <span>·</span>
                <span>Impact: {n.im2}%</span>
                <span>·</span>
                <span>{n.st}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Right: detail panel */}
        <div>
          <Card title={active.ti}>
            <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8}}>
              <Badge tone={impBadge(active.im)}>{active.im}</Badge>
              <span style={{fontSize:11,color:'var(--c-text-3)'}}>{active.tm} · {active.so}</span>
            </div>
            <div style={{fontSize:12,color:'var(--c-text-2)',lineHeight:1.5,marginBottom:10}}>
              <strong>AI-summary:</strong> {active.su}
            </div>
            <div style={{fontSize:12,color:'var(--c-text-2)',marginBottom:8}}>
              <strong>Влияние:</strong> {active.it}
            </div>
            <div style={{fontSize:12,color:'var(--c-text-2)',marginBottom:10}}>
              <strong>Рекомендация:</strong> {active.ac}
            </div>
            <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:10}}>
              <Button size="sm">Создать follow-up</Button>
              <Button size="sm" variant="secondary">Назначить</Button>
              <Button size="sm" variant="secondary">В memo</Button>
              <Button size="sm" variant="secondary">Отправить</Button>
            </div>
            <div style={{fontSize:11,color:'var(--c-text-3)'}}>
              Связанные объекты: {active.li}<br/>
              Ответственный: {active.ow}
            </div>
          </Card>

          {/* Company profile */}
          <div style={{marginTop:12}}>
            <Card title={activeCo.n}>
              <div style={{fontSize:11,color:'var(--c-text-3)',marginBottom:6}}>
                {activeCo.s} · {activeCo.r}
              </div>
              <div style={{fontSize:12,marginBottom:4}}>
                <strong>Риск:</strong> {activeCo.ri}
              </div>
              <div style={{fontSize:12,marginBottom:4}}>
                <strong>Последнее:</strong> {activeCo.ls}
              </div>
              <div style={{fontSize:12}}>
                <strong>Ответственный:</strong> {activeCo.ow}
              </div>
            </Card>
          </div>

          {/* Sentiment trend */}
          <div style={{marginTop:12}}>
            <Card title="Sentiment trend (30 дн)">
              <LineChart
                label="Sentiment"
                values={[0.08,-0.05,-0.21,-0.42]}
                tone="accent"
              />
              <div style={{fontSize:10,color:'var(--c-text-3)',marginTop:4}}>
                СеверПром · ВостокЛог · НеваТех · УралЭС · АгроСнаб
              </div>
            </Card>
          </div>

          {/* Risk heatmap */}
          <div style={{marginTop:12}}>
            <Card title="Risk signal heatmap">
              <div style={{display:'grid',gridTemplateColumns:'auto repeat(5,1fr)',gap:2,fontSize:10}}>
                <span></span>
                {['Fin','Legal','Oper','Market','ESG'].map(h=><span key={h} style={{textAlign:'center',color:'var(--c-text-3)'}}>{h}</span>)}
                {CO.map(c=>(
                  <div key={c.id} style={{display:'contents'}}>
                    <span style={{padding:'2px 0'}}>{c.n.slice(0,8)}</span>
                    {[0,1,2,3,4].map(i=>{
                      const v = (c.se < -0.3 ? 3 : c.se < 0 ? 2 : 1);
                      return <span key={i} style={{
                        height:16,background:v===3?'var(--c-danger)':v===2?'var(--c-warning)':'var(--c-success)',
                        borderRadius:2,opacity:0.7
                      }}/>
                    })}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Bottom: alerts + deals impact */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginTop:16}}>
        <Card title="Активные alerts">
          <div style={{fontSize:12}}>
            {[
              {a:'CAPEX delay alert',c:'СеверПром',s:'Open',o:'Анна Смирнова'},
              {a:'Legal claim alert',c:'Урал ЭнергоСервис',s:'Open',o:'Дмитрий Волков'},
              {a:'Rating watch alert',c:'СеверПром',s:'Reviewed',o:'Павел Егоров'},
              {a:'Margin pressure alert',c:'АгроСнаб',s:'Comment needed',o:'Наталья Петрова'},
            ].map(a=>(
              <div key={a.a} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--c-divider)'}}>
                <span>{a.a} — {a.c}</span>
                <span style={{color:a.s==='Open'?'var(--c-danger)':'var(--c-text-3)'}}>{a.s} ({a.o})</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Влияние на сделки">
          <div style={{fontSize:12}}>
            {[
              {d:'D-2487',c:'СеверПром',n:21,cr:3,r:'CAPEX delay / DSCR',s:'Обновить модель'},
              {d:'D-2511',c:'Нева Тех',n:8,cr:1,r:'Cap table / contract',s:'Добавить в memo'},
              {d:'D-2504',c:'МедТех',n:6,cr:0,r:'Новый инвестор',s:'Запросить cap table'},
              {d:'D-2479',c:'Урал ЭС',n:10,cr:2,r:'Legal / refinancing',s:'Risk review'},
            ].map(d=>(
              <div key={d.d} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--c-divider)'}}>
                <span><strong>{d.d}</strong> {d.c}</span>
                <span>Новостей: {d.n} (crit: {d.cr})</span>
                <span style={{color:'var(--c-text-3)'}}>{d.r}</span>
                <span>{d.s}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Follow-up tasks */}
      <div style={{marginTop:16}}>
        <Card title="Follow-up задачи">
          <div style={{fontSize:12}}>
            {[
              {t:'Обновить DSCR в модели D-2487',n:'Перенос цеха',c:'СеверПром',o:'Анна Смирнова',d:'14 июн',s:'В работе'},
              {t:'Запросить позицию клиента по CAPEX',n:'Перенос цеха',c:'СеверПром',o:'Иван Петров',d:'14 июн',s:'Open'},
              {t:'Проверить судебные резервы',n:'Иск 1.2 млрд',c:'Урал ЭС',o:'Дмитрий Волков',d:'15 июн',s:'Open'},
              {t:'Обновить cap table',n:'Новый инвестор',c:'МедТех',o:'Павел Егоров',d:'16 июн',s:'Open'},
            ].map(t=>(
              <div key={t.t} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',borderBottom:'1px solid var(--c-divider)'}}>
                <span>{t.t}</span>
                <span>{t.c} · {t.o}</span>
                <span>{t.d}</span>
                <Badge tone={t.s==='Open'?'danger':'info'}>{t.s}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
