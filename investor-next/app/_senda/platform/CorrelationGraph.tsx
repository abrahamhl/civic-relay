'use client';

import type { Locale } from '../data/types';
import EvidenceBadge from '../components/EvidenceBadge';
import type { EntityKind, PlatformScenario } from './platform-data';

const KIND_POS: Record<EntityKind, { x: number; y: number }> = {
  event: { x: 130, y: 185 },
  sensor: { x: 320, y: 95 },
  route: { x: 320, y: 275 },
  decision: { x: 540, y: 110 },
  team: { x: 720, y: 195 }
};

const KIND_LABEL: Record<EntityKind, Record<Locale, string>> = {
  event: { en: 'EVENT', es: 'EVENTO', nl: 'GEBEURTENIS' },
  sensor: { en: 'SENSOR', es: 'SENSOR', nl: 'SENSOR' },
  route: { en: 'ROUTE', es: 'RUTA', nl: 'ROUTE' },
  team: { en: 'TEAM / PERSON', es: 'EQUIPO / PERSONA', nl: 'TEAM / PERSOON' },
  decision: { en: 'DECISION', es: 'DECISIÓN', nl: 'BESLISSING' }
};

export default function CorrelationGraph({
  locale,
  scenario,
  selectedId,
  onSelect
}: {
  locale: Locale;
  scenario: PlatformScenario;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  // Primary 5 correlated nodes (Event, Sensor, Route, Decision, Team)
  const coreNodes = scenario.entities.slice(0, 5);
  const activeId = selectedId && coreNodes.some((n) => n.id === selectedId) ? selectedId : coreNodes[0]?.id;

  const activeLinks = scenario.links.filter((l) => l.fromId === activeId || l.toId === activeId);
  const primaryLink = activeLinks[0] ?? scenario.links[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 18, gap: 14, overflow: 'auto' }}>
      <div className="s-between">
        <div>
          <div className="s-micro s-faint s-mono">CORRELATION GRAPH · {scenario.code}</div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>
            {locale === 'es'
              ? 'Evento <-> Sensor <-> Ruta <-> Equipo <-> Decisión'
              : locale === 'nl'
              ? 'Gebeurtenis <-> Sensor <-> Route <-> Team <-> Beslissing'
              : 'Event <-> Sensor <-> Route <-> Team <-> Decision'}
          </div>
        </div>
        <EvidenceBadge locale={locale} evidenceId={primaryLink.evidenceId} />
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 280,
          borderRadius: 16,
          border: '1px solid var(--s-line)',
          background: 'var(--s-bg-elev)',
          display: 'grid',
          placeItems: 'center',
          padding: 12
        }}
      >
        <svg viewBox="0 0 850 360" role="img" aria-label="Correlation graph" style={{ width: '100%', height: '100%', maxHeight: 360 }}>
          {/* Edges */}
          {scenario.links.map((link) => {
            const fromNode = coreNodes.find((n) => n.id === link.fromId);
            const toNode = coreNodes.find((n) => n.id === link.toId);
            if (!fromNode || !toNode) return null;
            const p1 = KIND_POS[fromNode.kind];
            const p2 = KIND_POS[toNode.kind];
            const highlighted = link.fromId === activeId || link.toId === activeId;
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2 - 10;

            return (
              <g key={`${link.fromId}-${link.toId}`}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={highlighted ? 'var(--s-accent)' : 'var(--s-line-strong)'}
                  strokeWidth={highlighted ? 2.6 : 1.4}
                  strokeDasharray={highlighted ? undefined : '4 4'}
                />
                <text
                  x={mx}
                  y={my}
                  textAnchor="middle"
                  fill={highlighted ? 'var(--s-accent)' : 'var(--s-text-3)'}
                  fontSize="11"
                  fontWeight={highlighted ? '600' : '400'}
                >
                  {link.relation[locale]}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {coreNodes.map((node) => {
            const pos = KIND_POS[node.kind];
            const isSelected = node.id === activeId;
            const connected = scenario.links.some(
              (l) => (l.fromId === activeId && l.toId === node.id) || (l.toId === activeId && l.fromId === node.id)
            );
            const ringColor =
              node.kind === 'event'
                ? 'var(--s-crit)'
                : node.kind === 'sensor'
                ? 'var(--s-warn)'
                : node.kind === 'route'
                ? 'var(--s-accent)'
                : node.kind === 'team'
                ? 'var(--s-ok)'
                : 'var(--s-sim)';

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x}, ${pos.y})`}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={node.title[locale]}
                onClick={() => onSelect(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(node.id);
                  }
                }}
              >
                <rect
                  x="-96"
                  y="-34"
                  width="192"
                  height="68"
                  rx="14"
                  fill={isSelected ? 'var(--s-accent-soft)' : 'var(--s-bg-sunk)'}
                  stroke={isSelected ? ringColor : connected ? 'var(--s-accent)' : 'var(--s-line-strong)'}
                  strokeWidth={isSelected ? 2.4 : 1.2}
                />
                <circle cx="-78" cy="-14" r="4.5" fill={ringColor} />
                <text x="-66" y="-10" fill="var(--s-text-3)" fontSize="10" fontWeight="600">
                  {KIND_LABEL[node.kind][locale]}
                </text>
                <text x="-82" y="12" fill="var(--s-text)" fontSize="12" fontWeight="600">
                  {node.title[locale].slice(0, 26)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Plain-language correlation explanation */}
      <div className="s-card" style={{ padding: 16 }}>
        <div className="s-between" style={{ marginBottom: 6 }}>
          <strong style={{ fontSize: 13.5, color: 'var(--s-accent)' }}>
            {locale === 'es' ? 'Explicación de la correlación' : locale === 'nl' ? 'Correlatie-uitleg' : 'Correlation explanation'}
          </strong>
          <EvidenceBadge locale={locale} evidenceId={primaryLink.evidenceId} compact />
        </div>
        <p className="s-small" style={{ margin: 0, color: 'var(--s-text)' }}>
          {primaryLink.explanation[locale]}
        </p>
      </div>
    </div>
  );
}
