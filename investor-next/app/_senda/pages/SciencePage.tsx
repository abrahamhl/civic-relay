'use client';

import { useState } from 'react';
import { ExternalLink, Copy, Check, FlaskConical, AlertCircle, Eye } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import { SCIENCE_MODULES, SCIENCE_PAPERS } from '../data/science';
import type { Locale } from '../data/types';

export default function SciencePage({ locale }: { locale: Locale }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [embedVisor, setEmbedVisor] = useState(false);

  const copy = {
    en: {
      eyebrow: 'OPEN SCIENCE & RESEARCH MODULES',
      title: 'Hypotheses, methods, and inconclusive results published openly.',
      lead: 'Every scientific module states its exact hypothesis, dataset, validation script, and limitations — including experiments where the statistical threshold was not met.',
      hypothesis: 'Hypothesis',
      method: 'Method',
      result: 'Result',
      inconclusiveTag: 'INCONCLUSIVE RESULT',
      papersTitle: 'Working papers & reproducible derivations',
      papersLead: 'Preprints and analytical derivations cross-linked to source code and public datasets. Not externally peer-reviewed journal publications yet.',
      readPaper: 'Read document',
      copyBib: 'Copy BibTeX',
      copied: 'Copied',
      visorTitle: 'Interactive 4D Scientific Viewer & Real Terrain Captures',
      visorLead: 'Explore the 4D scientific viewer (/senda/visor.html) or watch real captures of San Martín de Valdeiglesias (Sentinel-2 + GFS) and Langtang, Nepal (USGS + Copernicus DEM).',
      loadVisor: 'Load embedded 4D Viewer',
      openVisorTab: 'Open 4D Viewer full screen'
    },
    es: {
      eyebrow: 'CIENCIA ABIERTA Y MÓDULOS DE INVESTIGACIÓN',
      title: 'Hipótesis, métodos y resultados inconclusos publicados sin filtro.',
      lead: 'Cada módulo científico declara su hipótesis, conjunto de datos, script reproducible y límites — incluidos los experimentos sin soporte estadístico.',
      hypothesis: 'Hipótesis',
      method: 'Método',
      result: 'Resultado',
      inconclusiveTag: 'RESULTADO INCONCLUSO',
      papersTitle: 'Papers y derivaciones reproducibles',
      papersLead: 'Preprints y derivaciones analíticas vinculadas a código abierto y datos públicos. Todavía sin revisión por pares en revista externa.',
      readPaper: 'Leer documento',
      copyBib: 'Copiar BibTeX',
      copied: 'Copiado',
      visorTitle: 'Visor 4D científico y capturas sobre terreno real',
      visorLead: 'Abre el Visor 4D científico (/senda/visor.html) o revisa las capturas reales de San Martín de Valdeiglesias (Sentinel-2 + GFS) y Langtang, Nepal (USGS + Copernicus DEM).',
      loadVisor: 'Cargar Visor 4D incrustado',
      openVisorTab: 'Abrir Visor 4D a pantalla completa'
    },
    nl: {
      eyebrow: 'OPEN WETENSCHAP & ONDERZOEKSMODULES',
      title: 'Hypothesen, methoden en onbesliste resultaten transparant gepubliceerd.',
      lead: 'Elke onderzoeksmodule vermeldt hypothese, dataset, reproduceerbaar script en beperkingen — inclusief experimenten die geen statistische drempel haalden.',
      hypothesis: 'Hypothese',
      method: 'Methode',
      result: 'Resultaat',
      inconclusiveTag: 'ONBESLIST RESULTAAT',
      papersTitle: 'Werkdocumenten & reproduceerbare afleidingen',
      papersLead: 'Preprints en analytische modellen gekoppeld aan broncode en open datasets. Nog geen externe peer-reviewed tijdschriftpublicaties.',
      readPaper: 'Document lezen',
      copyBib: 'Kopieer BibTeX',
      copied: 'Gekopieerd',
      visorTitle: 'Interactieve 4D Wetenschappelijke Viewer & Terreinopnames',
      visorLead: 'Open de 4D-viewer (/senda/visor.html) of bekijk echte opnames van San Martín de Valdeiglesias en Langtang, Nepal.',
      loadVisor: 'Laad 4D-viewer ingesloten',
      openVisorTab: 'Open 4D-viewer op volledig scherm'
    }
  }[locale];

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <PageShell locale={locale} active="science">
      <section className="s-section-tight">
        <div className="s-container">
          <div className="s-read">
            <p className="s-eyebrow">{copy.eyebrow}</p>
            <h1 className="s-h1">{copy.title}</h1>
            <p className="s-lead">{copy.lead}</p>
          </div>
        </div>
      </section>

      {/* Science Modules */}
      <section className="s-section-tight s-sunk">
        <div className="s-container">
          <div className="s-grid s-grid-2">
            {SCIENCE_MODULES.map((mod) => (
              <article key={mod.id} className="s-card s-stack" style={{ display: 'flex', flexDirection: 'column' }}>
                <div className="s-between">
                  <span className="s-pill">
                    <FlaskConical size={13} aria-hidden="true" />
                    <span>{mod.tag[locale]}</span>
                  </span>
                  <div className="s-row" style={{ gap: 6 }}>
                    {mod.inconclusive && (
                      <span className="s-badge" data-status="critical">
                        <AlertCircle aria-hidden="true" />
                        <span>{copy.inconclusiveTag}</span>
                      </span>
                    )}
                    <EvidenceBadge locale={locale} evidenceId={mod.evidenceId} statusOverride={mod.status} />
                  </div>
                </div>

                <h2 className="s-h3">{mod.title[locale]}</h2>

                <dl className="s-dl" style={{ flex: 1 }}>
                  <dt>{copy.hypothesis}</dt>
                  <dd>{mod.hypothesis[locale]}</dd>
                  <dt>{copy.method}</dt>
                  <dd>{mod.method[locale]}</dd>
                  <dt>{copy.result}</dt>
                  <dd>{mod.result[locale]}</dd>
                </dl>

                <div className="s-row" style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--s-line)' }}>
                  <a
                    href={mod.paperHref}
                    target={mod.paperHref.startsWith('http') ? '_blank' : undefined}
                    rel={mod.paperHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="s-btn s-btn-secondary s-btn-sm"
                  >
                    <span>{mod.paperLabel[locale]}</span>
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                  {mod.viewerHref && mod.viewerLabel && (
                    <a href={mod.viewerHref} className="s-btn s-btn-ghost s-btn-sm">
                      <Eye size={14} aria-hidden="true" />
                      <span>{mod.viewerLabel[locale]}</span>
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Papers Deck */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <div className="s-read">
            <h2 className="s-h2">{copy.papersTitle}</h2>
            <p className="s-lead">{copy.papersLead}</p>
          </div>

          <div className="s-grid s-grid-2">
            {SCIENCE_PAPERS.map((paper) => (
              <article key={paper.id} className="s-card s-stack">
                <div className="s-between">
                  <span className="s-micro s-faint s-mono">{paper.tag[locale]}</span>
                  <EvidenceBadge locale={locale} evidenceId={paper.evidenceId} compact />
                </div>
                <h3 className="s-h3">{paper.title[locale]}</h3>
                <p>{paper.summary[locale]}</p>
                <div
                  className="s-mono"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'var(--s-bg-sunk)',
                    border: '1px solid var(--s-line)',
                    overflowX: 'auto',
                    fontSize: 12.5
                  }}
                >
                  {paper.formula}
                </div>
                <div className="s-row">
                  <a href={paper.href} className="s-btn s-btn-primary s-btn-sm">
                    <span>{copy.readPaper}</span>
                    <ExternalLink size={14} aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    className="s-btn s-btn-secondary s-btn-sm"
                    onClick={() => handleCopy(paper.id, paper.bibtex)}
                  >
                    {copiedId === paper.id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    <span>{copiedId === paper.id ? copy.copied : copy.copyBib}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4D Viewer + Real Terrain Videos */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <div className="s-read">
              <h2 className="s-h2">{copy.visorTitle}</h2>
              <p className="s-lead">{copy.visorLead}</p>
            </div>
            <div className="s-row">
              {!embedVisor && (
                <button
                  type="button"
                  className="s-btn s-btn-primary"
                  onClick={() => setEmbedVisor(true)}
                >
                  {copy.loadVisor}
                </button>
              )}
              <a href="/senda/visor.html" className="s-btn s-btn-secondary">
                <span>{copy.openVisorTab}</span>
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </div>

          {embedVisor && (
            <div className="s-card" style={{ padding: 0, overflow: 'hidden' }}>
              <iframe
                src="/senda/visor.html"
                title="SENDA 4D Scientific Viewer"
                style={{ width: '100%', height: 560, border: 0, display: 'block' }}
                loading="lazy"
              />
            </div>
          )}

          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-demo-real-incendio-3d.mp4"
              poster="/media/senda-film-poster-es.jpg"
              caption={
                locale === 'es'
                  ? 'SENDA-3D: relieve Copernicus + Sentinel-2 en San Martín de Valdeiglesias'
                  : locale === 'nl'
                  ? 'SENDA-3D: Copernicus-reliëf + Sentinel-2 in San Martín de Valdeiglesias'
                  : 'SENDA-3D: Copernicus terrain + Sentinel-2 burn scar (San Martín de Valdeiglesias)'
              }
              evidenceId="EV-FIRE-SMV"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-nepal-sobrevuelo.mp4"
              poster="/media/senda-ruta-poster-en.jpg"
              caption={
                locale === 'es'
                  ? 'Langtang, Nepal: USGS us7000tbwb (M 5,2) + cambio Sentinel-2 + ruta de 44,6 km'
                  : locale === 'nl'
                  ? 'Langtang, Nepal: USGS us7000tbwb (M 5,2) + Sentinel-2-verandering + 44,6 km route'
                  : 'Langtang, Nepal: USGS us7000tbwb (M 5.2) + Sentinel-2 change + 44.6 km route'
              }
              evidenceId="EV-NEPAL-3D"
            />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
