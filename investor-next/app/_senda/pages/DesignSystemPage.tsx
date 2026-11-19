'use client';

import { ArrowRight, ShieldCheck, Radio, Layers } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import { EVIDENCE_RECORDS, STATUS_META } from '../data/evidence';
import type { EvidenceStatus, Locale } from '../data/types';

const STATUSES: EvidenceStatus[] = ['confirmed', 'observed', 'predicted', 'simulated', 'untested'];

export default function DesignSystemPage({ locale = 'es' }: { locale?: Locale }) {
  const tokens = [
    { name: '--s-bg', label: 'Background', sample: 'var(--s-bg)' },
    { name: '--s-bg-elev', label: 'Surface Elevated', sample: 'var(--s-bg-elev)' },
    { name: '--s-bg-sunk', label: 'Surface Sunk', sample: 'var(--s-bg-sunk)' },
    { name: '--s-accent', label: 'Signal Blue Accent', sample: 'var(--s-accent)' },
    { name: '--s-ok', label: 'Traffic: Confirmed', sample: 'var(--s-ok)' },
    { name: '--s-obs', label: 'Traffic: Observed', sample: 'var(--s-obs)' },
    { name: '--s-warn', label: 'Traffic: Predicted', sample: 'var(--s-warn)' },
    { name: '--s-crit', label: 'Traffic: Critical', sample: 'var(--s-crit)' },
    { name: '--s-sim', label: 'Traffic: Simulated', sample: 'var(--s-sim)' },
    { name: '--s-none', label: 'Traffic: Untested', sample: 'var(--s-none)' }
  ];

  return (
    <PageShell locale={locale} active="design">
      <section className="s-section-tight">
        <div className="s-container">
          <p className="s-eyebrow">SENDA DESIGN SYSTEM · INTERNAL SPEC</p>
          <h1 className="s-h1">Tokens, tipografía y componentes base</h1>
          <p className="s-lead s-read">
            Rejilla de 12 columnas, contenedor máximo 1200 px, ancho de lectura 720 px, escala 4/8 px,
            una sola familia tipográfica (Inter), un solo color de acento (azul señal) y semáforo reservado
            exclusivamente a estados de evidencia y alerta.
          </p>
        </div>
      </section>

      <section className="s-section-tight s-sunk">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">Paleta y tokens (:root)</h2>
          <div className="s-grid s-grid-4">
            {tokens.map((t) => (
              <div key={t.name} className="s-card" style={{ padding: 16 }}>
                <div
                  style={{
                    height: 56,
                    borderRadius: 12,
                    background: t.sample,
                    border: '1px solid var(--s-line-strong)',
                    marginBottom: 12
                  }}
                />
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.label}</div>
                <code className="s-mono s-faint">{t.name}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="s-section-tight">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">EvidenceBadge (5 estados interactivos)</h2>
          <p className="s-muted s-read">
            Pulsa cualquier etiqueta para abrir su hoja nativa de procedencia (&lt;dialog closedby=&quot;any&quot;&gt;) con fuente, fecha, método, SHA y límites.
          </p>
          <div className="s-grid s-grid-3">
            {STATUSES.map((st) => {
              const rec = EVIDENCE_RECORDS.find((r) => r.status === st) ?? EVIDENCE_RECORDS[0];
              return (
                <div key={st} className="s-card s-stack">
                  <EvidenceBadge locale={locale} record={rec} statusOverride={st} />
                  <h3 className="s-h3">{STATUS_META[st].label[locale]}</h3>
                  <p>{STATUS_META[st].desc[locale]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="s-section-tight s-sunk">
        <div className="s-container s-stack-lg">
          <h2 className="s-h2">Escala tipográfica y controles</h2>
          <div className="s-card s-stack">
            <div className="s-display">Display 56–84 px</div>
            <div className="s-h1">Heading 1 · Tracking negativo</div>
            <div className="s-h2">Heading 2 · Claridad editorial</div>
            <div className="s-h3">Heading 3 · Subtítulo de tarjeta</div>
            <p className="s-read" style={{ margin: 0 }}>
              Cuerpo 17–19 px, interlineado 1.5, ancho máximo de lectura 720 px. Números tabulares:{' '}
              <span className="s-num">506 / 506 · 94,2 % · 0,0184 · 2026-11-19</span>.
            </p>
            <div className="s-row" style={{ marginTop: 12 }}>
              <button type="button" className="s-btn s-btn-primary">
                <span>Acción primaria</span>
                <ArrowRight aria-hidden="true" />
              </button>
              <button type="button" className="s-btn s-btn-secondary">Acción secundaria</button>
              <button type="button" className="s-btn s-btn-ghost">Enlace fantasma</button>
            </div>
          </div>

          <div className="s-grid s-grid-3">
            <div className="s-card s-card-lift">
              <div className="s-card-icon"><Radio aria-hidden="true" /></div>
              <h3 className="s-h3">Iconografía Lucide</h3>
              <p>Trazo fino uniforme en toda la interfaz. Cero emojis en UI.</p>
            </div>
            <div className="s-card s-card-lift">
              <div className="s-card-icon"><Layers aria-hidden="true" /></div>
              <h3 className="s-h3">Superficies limpias</h3>
              <p>Radio 22–28 px, bordes 1 px de baja opacidad y sombras suaves.</p>
            </div>
            <div className="s-card s-card-lift">
              <div className="s-card-icon"><ShieldCheck aria-hidden="true" /></div>
              <h3 className="s-h3">WCAG 2.2 AA</h3>
              <p>Objetivos táctiles ≥ 44 px, foco visible y soporte completo de teclado.</p>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
