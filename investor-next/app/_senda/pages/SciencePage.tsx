'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ExternalLink, Copy, Check, FlaskConical, Eye, BookOpen } from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import LazySection from '../components/LazySection';
import { ARCHITECTURAL_RENDERS, SCIENCE_MODULES, SCIENCE_PAPERS } from '../data/science';
import type { Locale } from '../data/types';

const InteractiveLabsHub = dynamic(() => import('../components/InteractiveLabsHub'), { ssr: false });

export default function SciencePage({ locale }: { locale: Locale }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [embedVisor, setEmbedVisor] = useState(false);

  const copy = {
    en: {
      eyebrow: 'OPEN SCIENCE, PAPERS & RESEARCH ENGINES',
      title: 'Analytical physics, open datasets, and reproducible papers.',
      lead: 'Every scientific module pairs closed-form derivations with real environmental datasets (Copernicus, NOAA GOES-R/GFS/HRRR, USGS, Rijkswaterstaat) and interactive 3D/4D web laboratories.',
      hypothesis: 'Hypothesis',
      method: 'Method',
      result: 'Key Findings',
      papersTitle: 'Five scientific papers & reproducible derivations',
      papersLead: 'Formal manuscripts and analytical models cross-referenced with open code, verifiable datasets, and BibTeX citations.',
      allPapersBtn: 'Open full papers index',
      readPaper: 'Read paper',
      copyBib: 'Copy BibTeX',
      copied: 'Copied',
      rendersTitle: 'Architectural & mathematical SVG vector renders',
      rendersLead: 'High-precision vector schematics illustrating PAER routing, Merkle audit proofs, ITU-R P.838 curves, rail safety, and edge hardware.',
      openSvg: 'Open full SVG',
      visorTitle: 'Interactive 4D Scientific Viewer, Terrain Flyovers & Vision',
      visorLead: 'Launch the 4D Scientific Viewer (/senda/visor.html) and inspect our mathematical physics reel, 3D wildfire capture, Langtang Nepal flyover, and real YOLOX traffic vision.',
      loadVisor: 'Load embedded 4D Viewer',
      openVisorTab: 'Open 4D Viewer full screen'
    },
    es: {
      eyebrow: 'CIENCIA ABIERTA, PAPERS Y MOTORES DE INVESTIGACIÓN',
      title: 'Física analítica, datos reales y papers reproducibles.',
      lead: 'Cada módulo científico une derivaciones matemáticas cerradas con datos ambientales reales (Copernicus, NOAA GOES-R/GFS/HRRR, USGS, Rijkswaterstaat) y laboratorios interactivos 3D/4D en el navegador.',
      hypothesis: 'Hipótesis',
      method: 'Método',
      result: 'Resultados clave',
      papersTitle: 'Cinco papers científicos y derivaciones reproducibles',
      papersLead: 'Manuscritos técnicos y modelos analíticos conectados directamente al código abierto, conjuntos de datos y citas BibTeX.',
      allPapersBtn: 'Abrir índice completo de papers',
      readPaper: 'Leer paper',
      copyBib: 'Copiar BibTeX',
      copied: 'Copiado',
      rendersTitle: 'Renders vectoriales SVG de arquitectura y física',
      rendersLead: 'Diagramas de alta precisión de la topología PAER, pruebas Merkle RFC 6962, curvas ITU-R P.838, seguridad ferroviaria y pasarelas COTS.',
      openSvg: 'Abrir SVG completo',
      visorTitle: 'Visor 4D científico, sobrevuelos reales y visión artificial',
      visorLead: 'Abre el Visor 4D científico (/senda/visor.html) y revisa la pieza de física matemática, incendio 3D, sobrevuelo 3D en Nepal y visión vial real con YOLOX.',
      loadVisor: 'Cargar Visor 4D incrustado',
      openVisorTab: 'Abrir Visor 4D a pantalla completa'
    },
    nl: {
      eyebrow: 'OPEN WETENSCHAP, PAPERS & ONDERZOEKSENGINES',
      title: 'Analytische fysica, open datasets en reproduceerbare papers.',
      lead: 'Elke onderzoeksmodule koppelt gesloten wiskundige modellen aan echte satelliet- en meetdata (Copernicus, NOAA, USGS, Rijkswaterstaat) en interactieve 3D/4D-labs.',
      hypothesis: 'Hypothese',
      method: 'Methode',
      result: 'Belangrijkste resultaten',
      papersTitle: 'Vijf wetenschappelijke papers & reproduceerbare afleidingen',
      papersLead: 'Technische manuscripten verbonden met open broncode, verifieerbare datasets en BibTeX-citaties.',
      allPapersBtn: 'Open volledige paperindex',
      readPaper: 'Lees paper',
      copyBib: 'Kopieer BibTeX',
      copied: 'Gekopieerd',
      rendersTitle: 'Architectuur- en fysica-vectorrenders (SVG)',
      rendersLead: 'Nauwkeurige vectorschema’s van PAER-topologie, Merkle RFC 6962, ITU-R P.838-curven, spoorveiligheid en COTS-hardware.',
      openSvg: 'Open volledige SVG',
      visorTitle: 'Interactieve 4D-viewer, terreinvluchten & verkeersvisie',
      visorLead: 'Open de 4D-viewer (/senda/visor.html) en bekijk de wiskundige fysicavideo, 3D-natuurbrand, Langtang-vlucht en echte YOLOX-verkeersanalyse.',
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
                  <EvidenceBadge locale={locale} evidenceId={mod.evidenceId} statusOverride={mod.status} />
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

      {/* All 5 Papers Deck */}
      <section className="s-section">
        <div className="s-container s-stack-lg">
          <div className="s-between">
            <div className="s-read">
              <h2 className="s-h2">{copy.papersTitle}</h2>
              <p className="s-lead">{copy.papersLead}</p>
            </div>
            <a href="/senda/papers/index.html" className="s-btn s-btn-secondary">
              <BookOpen size={16} aria-hidden="true" />
              <span>{copy.allPapersBtn}</span>
            </a>
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

      {/* Architectural SVG Vector Renders */}
      <section className="s-section s-sunk">
        <div className="s-container s-stack-lg">
          <div className="s-read">
            <h2 className="s-h2">{copy.rendersTitle}</h2>
            <p className="s-lead">{copy.rendersLead}</p>
          </div>

          <div className="s-grid s-grid-3">
            {ARCHITECTURAL_RENDERS.map((r) => (
              <article key={r.id} className="s-card s-card-lift" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    borderRadius: 14,
                    overflow: 'hidden',
                    border: '1px solid var(--s-line)',
                    background: '#090b0f',
                    aspectRatio: '16 / 10',
                    display: 'grid',
                    placeItems: 'center'
                  }}
                >
                  <img
                    src={r.src}
                    alt={r.title[locale]}
                    loading="lazy"
                    width={640}
                    height={400}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <strong style={{ fontSize: 15 }}>{r.title[locale]}</strong>
                <p className="s-small" style={{ flex: 1 }}>{r.caption[locale]}</p>
                <a href={r.src} target="_blank" rel="noopener noreferrer" className="s-btn s-btn-ghost s-btn-sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
                  <span>{copy.openSvg}</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4D Viewer + Scientific & Vision Videos */}
      <section className="s-section">
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
              src="/media/m95/senda-m95-reel-math-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-reel-math-es.mp4',
                en: '/media/m95/senda-m95-reel-math-en.mp4'
              }}
              poster="/media/m95/senda-m95-reel-math-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-reel-math-es.vtt',
                en: '/media/m95/senda-m95-reel-math-en.vtt',
                nl: '/media/m95/senda-m95-reel-math-nl.vtt'
              }}
              title={
                locale === 'es'
                  ? 'Teoremas matemáticos y física de propagación'
                  : locale === 'nl'
                  ? 'Wiskundige stellingen & propagatiefysica'
                  : 'Mathematical theorems & propagation physics'
              }
              caption={
                locale === 'es'
                  ? 'Resumen visual bilingüe con subtítulos en ES, EN y NL.'
                  : locale === 'nl'
                  ? 'Tweetalig overzicht met ES-, EN- en NL-ondertiteling.'
                  : 'Bilingual visual summary with ES, EN, and NL subtitles.'
              }
              evidenceId="EV-CORE-506"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-demo-real-incendio-3d.mp4"
              poster="/media/senda-film-poster-es.jpg"
              title="SENDA-3D · San Martín de Valdeiglesias"
              caption={
                locale === 'es'
                  ? 'Relieve Copernicus DEM GLO-30 + cicatriz Sentinel-2 + campo de viento 3D.'
                  : locale === 'nl'
                  ? 'Copernicus DEM GLO-30 + Sentinel-2-litteken + 3D-windveld.'
                  : 'Copernicus DEM GLO-30 terrain + Sentinel-2 scar + 3D wind field.'
              }
              evidenceId="EV-FIRE-SMV"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-demo/SENDA-nepal-sobrevuelo.mp4"
              poster="/media/senda-ruta-poster-en.jpg"
              title={
                locale === 'es'
                  ? 'Sobrevuelo 3D satelital · Langtang, Nepal'
                  : locale === 'nl'
                  ? '3D Satellietvlucht · Langtang, Nepal'
                  : '3D Satellite Flyover · Langtang, Nepal'
              }
              caption={
                locale === 'es'
                  ? 'Evento USGS us7000tbwb (M 5,2) + cambio NDVI Sentinel-2 + ruta de 44,6 km.'
                  : locale === 'nl'
                  ? 'USGS us7000tbwb (M 5,2) + Sentinel-2 NDVI-verandering + 44,6 km route.'
                  : 'USGS us7000tbwb (M 5.2) + Sentinel-2 NDVI change + 44.6 km least-cost route.'
              }
              evidenceId="EV-NEPAL-3D"
            />
            <MediaVideo
              locale={locale}
              src="/media/vision/dashcam.mp4"
              poster="/media/vision/dashcam-poster.jpg"
              title={
                locale === 'es'
                  ? 'Visión artificial vial · YOLOX-s + ByteTrack'
                  : locale === 'nl'
                  ? 'Verkeersvisie · YOLOX-s + ByteTrack'
                  : 'Road Computer Vision · YOLOX-s + ByteTrack'
              }
              caption={
                locale === 'es'
                  ? 'Conteo y seguimiento vehicular local preservando la privacidad en cada fotograma.'
                  : locale === 'nl'
                  ? 'Lokale voertuigtelling en -tracking met privacy-by-design.'
                  : 'On-device vehicle counting and tracking with privacy by design.'
              }
              evidenceId="EV-CONSOLE-16K"
            />
          </div>
        </div>
      </section>

      {/* Live Scientific Theorems, Calibration & Physics Simulators */}
      <LazySection id="labs" placeholderHeight={680} rootMargin="400px 0px">
        <InteractiveLabsHub locale={locale} defaultLab="theorems" id="science-labs" />
      </LazySection>
    </PageShell>
  );
}
