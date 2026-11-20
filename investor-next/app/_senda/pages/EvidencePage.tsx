'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import { EVIDENCE_RECORDS, STATUS_META } from '../data/evidence';
import type { EvidenceStatus, Locale } from '../data/types';

const FILTER_ORDER: Array<'all' | EvidenceStatus> = [
  'all',
  'confirmed',
  'observed',
  'predicted',
  'simulated',
  'untested'
];

const BENCHMARK_STRATEGIES = [
  { name: 'WAIT', delivery: 0, energy: 0 },
  { name: 'CGR_EARLIEST', delivery: 58.3, energy: 406 },
  { name: 'EPIDEMIC_CAPPED', delivery: 65.0, energy: 1314 },
  { name: 'PROPHET_WARM', delivery: 81.7, energy: 1361 },
  { name: 'SPRAY_AND_FOCUS', delivery: 85.0, energy: 1448 },
  { name: 'ARR_REPLAN_V2', delivery: 94.2, energy: 694, highlight: true },
  { name: 'EPIDEMIC_CEILING', delivery: 96.7, energy: 4420 }
];

export default function EvidencePage({ locale }: { locale: Locale }) {
  const [statusFilter, setStatusFilter] = useState<'all' | EvidenceStatus>('all');
  const [query, setQuery] = useState('');

  const copy = {
    en: {
      eyebrow: 'EVIDENCE REGISTER',
      title: 'Every capability tied to code, benchmarks, and verifiable data.',
      lead: 'Fed directly from docs/investor/EVIDENCE_REGISTER.md, evidence/senda/, and experimental results. Click any status badge for full provenance.',
      all: 'All',
      searchPlaceholder: 'Filter by scenario, hypothesis, SHA, or source...',
      tableCaption: 'SENDA Claim-to-Evidence Ledger (click status badges for provenance)',
      colScenario: 'Scenario / Claim',
      colHypothesis: 'Hypothesis',
      colResult: 'Result',
      colStatus: 'Status',
      colDateSha: 'Date / SHA',
      colSource: 'Source',
      empty: 'No evidence records match your current filter.',
      chart1Title: 'Scenario S01: Delivery time under 8 h cellular outage (minutes, lower is faster)',
      chart1Note: 'SENDA multipath (4 min) vs direct-to-cell pass (91 min) vs cellular-only baseline (480 min).',
      chart2Title: 'H-ARR-R Benchmark (120 blocks): Delivery rate (%) vs mean energy (mJ)',
      chart2Note: 'ARR_REPLAN_V2 achieves 94.2% delivery using 84% less energy than EPIDEMIC_CEILING (694 mJ vs 4,420 mJ).'
    },
    es: {
      eyebrow: 'REGISTRO DE EVIDENCIAS',
      title: 'Cada capacidad enlazada a código, benchmarks y datos verificables.',
      lead: 'Alimentado desde docs/investor/EVIDENCE_REGISTER.md, evidence/senda/ y resultados experimentales. Pulsa cualquier etiqueta para ver su procedencia.',
      all: 'Todos',
      searchPlaceholder: 'Filtrar por escenario, hipótesis, SHA o fuente...',
      tableCaption: 'Tabla trazable de evidencias de SENDA (pulsa cada estado para ver la ficha)',
      colScenario: 'Escenario / Afirmación',
      colHypothesis: 'Hipótesis',
      colResult: 'Resultado',
      colStatus: 'Estado',
      colDateSha: 'Fecha / SHA',
      colSource: 'Enlace',
      empty: 'Ningún registro coincide con el filtro actual.',
      chart1Title: 'Escenario S01: Tiempo de entrega en apagón móvil de 8 h (minutos, menor es mejor)',
      chart1Note: 'SENDA multicanal (4 min) frente a satélite directo (91 min) y línea base celular (480 min).',
      chart2Title: 'Benchmark H-ARR-R (120 bloques): Tasa de entrega (%) y energía media (mJ)',
      chart2Note: 'ARR_REPLAN_V2 logra 94,2 % de entrega con un 84 % menos de energía que EPIDEMIC_CEILING (694 mJ frente a 4.420 mJ).'
    },
    nl: {
      eyebrow: 'BEWIJSREGISTER',
      title: 'Elke capaciteit gekoppeld aan code, benchmarks en verifieerbare data.',
      lead: 'Gevoed vanuit docs/investor/EVIDENCE_REGISTER.md, evidence/senda/ en experimentele resultaten. Klik op een statuslabel voor volledige herkomst.',
      all: 'Alle',
      searchPlaceholder: 'Filter op scenario, hypothese, SHA of bron...',
      tableCaption: 'SENDA Bewijsregister (klik op statuslabels voor herkomst)',
      colScenario: 'Scenario / Claim',
      colHypothesis: 'Hypothese',
      colResult: 'Resultaat',
      colStatus: 'Status',
      colDateSha: 'Datum / SHA',
      colSource: 'Bron',
      empty: 'Geen bewijsregels gevonden voor dit filter.',
      chart1Title: 'Scenario S01: Bezorgtijd bij 8 uur netwerkuitval (minuten, lager is sneller)',
      chart1Note: 'SENDA multipath (4 min) vs direct-to-cell (91 min) vs alleen mobiel (480 min).',
      chart2Title: 'H-ARR-R Benchmark (120 blokken): Bezorgpercentage (%) en gemiddelde energie (mJ)',
      chart2Note: 'ARR_REPLAN_V2 haalt 94,2% bezorging met 84% minder energie dan EPIDEMIC_CEILING (694 mJ vs 4.420 mJ).'
    }
  }[locale];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return EVIDENCE_RECORDS.filter((rec) => {
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
      if (!q) return true;
      return (
        rec.id.toLowerCase().includes(q) ||
        rec.scenario[locale].toLowerCase().includes(q) ||
        rec.hypothesis[locale].toLowerCase().includes(q) ||
        rec.result[locale].toLowerCase().includes(q) ||
        rec.sha.toLowerCase().includes(q) ||
        rec.sourcePath.toLowerCase().includes(q)
      );
    });
  }, [locale, query, statusFilter]);

  return (
    <PageShell locale={locale} active="evidence">
      <section className="s-section-tight">
        <div className="s-container">
          <div className="s-read">
            <p className="s-eyebrow">{copy.eyebrow}</p>
            <h1 className="s-h1">{copy.title}</h1>
            <p className="s-lead">{copy.lead}</p>
          </div>
        </div>
      </section>

      {/* Filterable Responsive Table */}
      <section className="s-section-tight s-sunk">
        <div className="s-container s-stack-lg">
          <div className="s-between" style={{ gap: 16 }}>
            <div className="s-chipbar" role="group" aria-label="Evidence status filters">
              {FILTER_ORDER.map((st) => {
                const count =
                  st === 'all'
                    ? EVIDENCE_RECORDS.length
                    : EVIDENCE_RECORDS.filter((r) => r.status === st).length;
                return (
                  <button
                    key={st}
                    type="button"
                    className="s-chip"
                    aria-pressed={statusFilter === st}
                    onClick={() => setStatusFilter(st)}
                  >
                    <span>{st === 'all' ? copy.all : STATUS_META[st].label[locale]}</span>
                    <span className="s-num s-micro" style={{ opacity: 0.72 }}>
                      ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            <div style={{ position: 'relative', minWidth: 'min(320px, 100%)', flex: '0 1 340px' }}>
              <Search
                size={16}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--s-text-3)',
                  pointerEvents: 'none'
                }}
              />
              <input
                type="search"
                className="s-input"
                style={{ paddingLeft: 40 }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchPlaceholder}
              />
            </div>
          </div>

          {/* Responsive semantic table per modern-web-guidance (responsive-table) */}
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="evidence-table-caption"
            className="s-table-wrap"
          >
            <table className="s-table s-table-responsive">
              <caption id="evidence-table-caption">{copy.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy.colScenario}</th>
                  <th scope="col">{copy.colHypothesis}</th>
                  <th scope="col">{copy.colResult}</th>
                  <th scope="col">{copy.colStatus}</th>
                  <th scope="col">{copy.colDateSha}</th>
                  <th scope="col">{copy.colSource}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32 }}>
                      {copy.empty}
                    </td>
                  </tr>
                ) : (
                  filtered.map((rec) => (
                    <tr key={rec.id}>
                      <th scope="row">
                        <div>{rec.scenario[locale]}</div>
                        <code className="s-mono s-faint" style={{ fontWeight: 400 }}>
                          {rec.id}
                        </code>
                      </th>
                      <td data-label={copy.colHypothesis}>{rec.hypothesis[locale]}</td>
                      <td data-label={copy.colResult}>{rec.result[locale]}</td>
                      <td data-label={copy.colStatus}>
                        <EvidenceBadge locale={locale} record={rec} />
                      </td>
                      <td data-label={copy.colDateSha} className="s-num" style={{ whiteSpace: 'nowrap' }}>
                        <div>{rec.date}</div>
                        <code className="s-mono s-faint">{rec.sha}</code>
                      </td>
                      <td data-label={copy.colSource}>
                        <a
                          href={rec.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="s-link s-row"
                          style={{ gap: 4, whiteSpace: 'nowrap' }}
                        >
                          <span className="s-mono">{rec.sourcePath.split('/').pop()}</span>
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sober 2D Dataviz Charts */}
      <section className="s-section">
        <div className="s-container s-grid s-grid-2">
          {/* Chart 1: S01 Delivery Comparison */}
          <article className="s-card s-stack">
            <div className="s-between">
              <h2 className="s-h3">{copy.chart1Title}</h2>
              <EvidenceBadge locale={locale} evidenceId="EV-S01-ROUTE" />
            </div>
            <div className="s-bars" style={{ marginTop: 8 }}>
              {[
                { label: 'SENDA Multipath (BLE + Sat)', val: 4, pct: 3, color: 'var(--s-ok)' },
                { label: 'SENDA Direct-to-Cell (LEO pass)', val: 91, pct: 19, color: 'var(--s-accent)' },
                { label: 'WhatsApp / Cellular Baseline', val: 480, pct: 100, color: 'var(--s-sim)' }
              ].map((row) => (
                <div key={row.label} className="s-bar-row">
                  <span>{row.label}</span>
                  <div className="s-bar-track" aria-hidden="true">
                    <div className="s-bar-fill" style={{ width: `${row.pct}%`, background: row.color }} />
                  </div>
                  <b className="s-num">{row.val} min</b>
                </div>
              ))}
            </div>
            <p className="s-small s-faint">{copy.chart1Note}</p>
          </article>

          {/* Chart 2: H-ARR-R 120-block benchmark */}
          <article className="s-card s-stack">
            <div className="s-between">
              <h2 className="s-h3">{copy.chart2Title}</h2>
              <EvidenceBadge locale={locale} evidenceId="EV-ARR-V2" />
            </div>
            <div className="s-bars" style={{ marginTop: 8 }}>
              {BENCHMARK_STRATEGIES.map((s) => (
                <div key={s.name} className="s-bar-row">
                  <span className="s-mono" style={{ fontWeight: s.highlight ? 700 : 400, color: s.highlight ? 'var(--s-text)' : 'var(--s-text-2)' }}>
                    {s.name}
                  </span>
                  <div className="s-bar-track" aria-hidden="true">
                    <div
                      className="s-bar-fill"
                      style={{
                        width: `${Math.max(2, s.delivery)}%`,
                        background: s.highlight ? 'var(--s-accent)' : 'var(--s-sim)'
                      }}
                    />
                  </div>
                  <b className="s-num" style={{ fontSize: 13 }}>
                    {s.delivery}% · {s.energy}mJ
                  </b>
                </div>
              ))}
            </div>
            <p className="s-small s-faint">{copy.chart2Note}</p>
          </article>
        </div>
      </section>
    </PageShell>
  );
}
