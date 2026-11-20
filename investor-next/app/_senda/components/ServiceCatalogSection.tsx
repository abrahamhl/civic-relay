'use client';

import { useState } from 'react';
import { ExternalLink, Layers } from 'lucide-react';
import { SERVICE_CATALOG } from '../data/services';
import type { Locale } from '../data/types';

type ServiceFilter = 'all' | 'comms' | 'command' | 'hazard' | 'rescue';

export default function ServiceCatalogSection({
  locale,
  title,
  lead
}: {
  locale: Locale;
  title: string;
  lead: string;
}) {
  const [svcFilter, setSvcFilter] = useState<ServiceFilter>('all');

  const filterLabels: Record<ServiceFilter, string> = {
    en: { all: 'All (12)', comms: 'Offline Comms', command: 'Control & 4D', hazard: 'Fire, Flood & Sat', rescue: 'Rail, Road & Rescue' },
    es: { all: 'Todos (12)', comms: 'Comunicaciones sin red', command: 'Mando y Visor 4D', hazard: 'Fuego, Riada y Satélite', rescue: 'Ferrocarril y Rescate' },
    nl: { all: 'Alle (12)', comms: 'Offline comms', command: 'Commando & 4D', hazard: 'Brand, Water & Sat', rescue: 'Spoor & Redding' }
  }[locale];

  const visibleServices =
    svcFilter === 'all'
      ? SERVICE_CATALOG
      : SERVICE_CATALOG.filter((s) => s.category === svcFilter);

  return (
    <section className="s-section s-sunk">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Layers size={15} aria-hidden="true" />
            <span>SENDA ECOSYSTEM</span>
          </p>
          <h2 className="s-h2">{title}</h2>
          <p className="s-lead">{lead}</p>
        </div>

        <div className="s-chipbar" role="group" aria-label="Service categories">
          {(['all', 'comms', 'command', 'hazard', 'rescue'] as ServiceFilter[]).map((cat) => (
            <button
              key={cat}
              type="button"
              className="s-chip"
              aria-pressed={svcFilter === cat}
              onClick={() => setSvcFilter(cat)}
            >
              {filterLabels[cat]}
            </button>
          ))}
        </div>

        <div className="s-grid s-grid-3">
          {visibleServices.map((svc) => (
            <a
              key={svc.id}
              href={svc.href}
              className="s-card s-card-lift"
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <div className="s-between">
                <strong style={{ fontSize: 16, color: 'var(--s-text)' }}>{svc.title[locale]}</strong>
                <ExternalLink size={15} style={{ color: 'var(--s-accent)', flex: 'none' }} aria-hidden="true" />
              </div>
              <p style={{ flex: 1 }}>{svc.desc[locale]}</p>
              <div className="s-between" style={{ paddingTop: 10, borderTop: '1px solid var(--s-line)' }}>
                <code className="s-mono s-faint">{svc.href}</code>
                <span className="s-micro" style={{ color: 'var(--s-accent)', fontWeight: 600 }}>
                  {locale === 'es' ? 'Abrir módulo' : locale === 'nl' ? 'Open module' : 'Launch module'}
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
