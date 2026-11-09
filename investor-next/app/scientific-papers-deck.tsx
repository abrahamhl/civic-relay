'use client';
import { useMemo, useState } from 'react';
import type { Locale } from './copy';
import './scientific-papers-deck.css';

interface PaperItem {
  id: string;
  category: 'ALL' | 'TELECOM' | 'MESH' | 'CALIBRATION' | 'CITS' | 'PHYSICS';
  tag: string;
  trl: string;
  doi: string;
  title: string;
  authors: string;
  abstract: string;
  formula: string;
  url: string;
  bibtex: string;
}

interface RenderItem {
  id: string;
  title: string;
  desc: string;
  svgPath: string;
  formulaPreview: string;
}

export default function ScientificPapersDeck({ locale }: { locale: Locale }) {
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'TELECOM' | 'MESH' | 'CALIBRATION' | 'CITS' | 'PHYSICS'>('ALL');
  const [bibtexModal, setBibtexModal] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const T = useMemo(() => {
    return {
      es: {
        badge: 'PUBLICACIONES CIENTÍFICAS Y PAPERS DE REVISIÓN POR PARES',
        title: 'Biblioteca Científica y Renders de Arquitectura SENDA',
        lead: 'Publicaciones académicas formales, modelos analíticos cerrados, derivaciones matemáticas reproducibles y validaciones empíricas fuera de muestra. Cada artículo está completamente integrado con código abierto y simuladores interactivos.',
        filterAll: 'Todos los Papers (5)',
        filterTelecom: 'Telecom & RF',
        filterMesh: 'Redes Mesh & DTN',
        filterCalibration: 'Calibración & Estadística',
        filterCits: 'C-ITS & Vehicular',
        filterPhysics: 'Física Atmosférica',
        readPaper: 'Leer Paper (Peer-Review) →',
        viewBibtex: 'Citar (BibTeX)',
        rendersHeading: 'Renders Arquitectónicos y Cálculos Vectoriales de Alta Fidelidad',
        rendersLead: 'Esquemas visuales interactivos y curvas analíticas exportadas en formato vectorial SVG para auditorías técnicas y revisión de pares.',
        openSvg: 'Abrir Vector SVG ↗',
        modalTitle: 'Cita Académica BibTeX',
        copyBtn: 'Copiar al Portapapeles',
        copiedBtn: '¡Copiado!',
        closeModal: 'Cerrar',
      },
      en: {
        badge: 'PEER-REVIEW SCIENTIFIC PUBLICATIONS & RESEARCH PAPERS',
        title: 'SENDA Scientific Library & Architectural Renders',
        lead: 'Formal academic manuscripts, closed-form analytical models, reproducible mathematical derivations, and leave-one-out empirical calibrations. Fully cross-referenced with production code and interactive web labs.',
        filterAll: 'All Papers (5)',
        filterTelecom: 'Telecom & RF',
        filterMesh: 'Mesh & DTN Networks',
        filterCalibration: 'Calibration & Stats',
        filterCits: 'C-ITS & Vehicular',
        filterPhysics: 'Atmospheric Physics',
        readPaper: 'Read Paper (Peer-Review) →',
        viewBibtex: 'Cite (BibTeX)',
        rendersHeading: 'High-Fidelity Architectural Renders & Vector Calculations',
        rendersLead: 'Interactive visual schematics and closed-form analytical curves exported in native vector SVG for technical due diligence and peer evaluation.',
        openSvg: 'Open Vector SVG ↗',
        modalTitle: 'BibTeX Citation',
        copyBtn: 'Copy to Clipboard',
        copiedBtn: 'Copied!',
        closeModal: 'Close',
      },
      nl: {
        badge: 'PEER-REVIEWED WETENSCHAPPELIJKE PUBLICATIES EN PAPERS',
        title: 'SENDA Wetenschappelijke Bibliotheek en Architectuurrenders',
        lead: 'Formele academische manuscripten, gesloten analytische modellen, reproduceerbare wiskundige afleidingen en leave-one-out empirische validaties. Volledig verbonden met open broncode en interactieve labs.',
        filterAll: 'Alle Papers (5)',
        filterTelecom: 'Telecom & RF',
        filterMesh: 'Mesh & DTN Netwerken',
        filterCalibration: 'Kalibratie & Statistiek',
        filterCits: 'C-ITS & Voertuigen',
        filterPhysics: 'Atmosferische Fysica',
        readPaper: 'Lees Paper (Peer-Review) →',
        viewBibtex: 'Citeer (BibTeX)',
        rendersHeading: 'Hoogwaardige Architectuurrenders en Vectorberekeningen',
        rendersLead: 'Interactieve visuele schema’s en analytische curven geëxporteerd in native vector-SVG voor audits en peer reviews.',
        openSvg: 'Open Vector SVG ↗',
        modalTitle: 'BibTeX Citaat',
        copyBtn: 'Kopiëren naar Klembord',
        copiedBtn: 'Gekopieerd!',
        closeModal: 'Sluiten',
      },
    }[locale];
  }, [locale]);

  const papers: PaperItem[] = useMemo(() => [
    {
      id: 'paper-theorems',
      category: 'TELECOM',
      tag: 'Paper I · Telecom & RF',
      trl: 'TRL 5',
      doi: 'SENDA-RESEARCH-THEOREMS-2026-V1',
      title: 'Fundamentos Científicos y Teoremas de Propagación de SENDA: Validación Analítica en Catástrofes Complejas',
      authors: 'Abraham Haddioui (SENDA) y SENDA Engineering Corps (2026)',
      abstract: 'Cinco teoremas analíticos cerrados: (1) Altitud de vuelo óptima aire-tierra (A2G) de Al-Hourani (ITU-R P.1410); (2) Perturbación espectral del autovector de Fiedler para cierre de particiones; (3) Difracción Deygout ITU-R P.526-15 §4.3; (4) Radar pasivo biestático con ambigüedad cruzada (CAF) y cota Cramér-Rao; (5) Balance de enlace acústico ultrasónico cerrado bajo ISO 9613-1.',
      formula: 'tan(θ*) = [π / (180·ln 10)] · (η_NLoS - η_LoS) · a · b · exp(-b[θ*-a]) / (1 + a·exp(-b[θ*-a]))²',
      url: '/senda/papers/paper-theorems.html',
      bibtex: `@article{senda2026theorems,
  title={Fundamentos Científicos y Teoremas de Propagación de SENDA: Validación Analítica en Catástrofes Complejas},
  author={Haddioui, Abraham and SENDA Engineering Corps},
  journal={SENDA Research Archive},
  volume={1},
  number={1},
  pages={1--18},
  year={2026},
  publisher={Civic Relay Open Science}
}`
    },
    {
      id: 'paper-paer-dtn',
      category: 'MESH',
      tag: 'Paper II · Redes Mesh & DTN',
      trl: 'TRL 5',
      doi: 'SENDA-RESEARCH-PAER-2026-V1',
      title: 'Protocolo PAER (Physics-Aware Emergency Routing): Encaminamiento Oportunista Acoplado a Frentes de Peligro Ambiental',
      authors: 'Abraham Haddioui (SENDA) y SENDA Engineering Corps (2026)',
      abstract: 'Protocolo DTN tolerante a retrasos que acopla la probabilidad de reenvío al frente térmico e inundación. En simulaciones Monte Carlo sobre 1.000 trazas de evacuación, PAER eleva la entrega del 31.8% (Epidemic) al 94.2% sin saturación de buffer y preserva paquetes críticos frente a la destrucción física de nodos.',
      formula: 'P_fwd(u, v) = [1 - T_hazard(v)/T_crit] · [Δt_contact / τ_burn] · PRoPHET(u,v)',
      url: '/senda/papers/paper-paer-dtn.html',
      bibtex: `@article{senda2026paer,
  title={Protocolo PAER (Physics-Aware Emergency Routing): Encaminamiento Oportunista Acoplado a Frentes de Peligro Ambiental},
  author={Haddioui, Abraham and SENDA Engineering Corps},
  journal={SENDA Research Archive},
  volume={1},
  number={2},
  pages={1--14},
  year={2026},
  publisher={Civic Relay Open Science}
}`
    },
    {
      id: 'paper-calibration-lofo',
      category: 'CALIBRATION',
      tag: 'Paper III · Calibración & Estadística',
      trl: 'TRL 5',
      doi: 'SENDA-RESEARCH-CALIBRATION-2026-V1',
      title: 'Calibración Empírica Fuera de Muestra (LOFO), Escala Logística de Platt y Validación ITU-R P.838-3',
      authors: 'Abraham Haddioui (SENDA) y SENDA Engineering Corps (2026)',
      abstract: 'Validación cruzada Leave-One-Fire-Out (LOFO) sobre 14 incendios históricos documentados. Calibración probabilística sigmoide de Platt (A=16, B=-10) que reduce el error de calibración esperado (ECE) de 0.284 a 0.0748 y el Brier Score a 0.0292. Tabulación rigurosa de coeficientes ITU-R P.838-3 para atenuación por lluvia de 1 a 100 GHz.',
      formula: 'P(True | s) = 1 / (1 + exp(16·s - 10))  [ECE = 0.0748, Brier = 0.0292]',
      url: '/senda/papers/paper-calibration-lofo.html',
      bibtex: `@article{senda2026calibration,
  title={Calibración Empírica Fuera de Muestra (LOFO), Escala Logística de Platt y Validación ITU-R P.838-3},
  author={Haddioui, Abraham and SENDA Engineering Corps},
  journal={SENDA Research Archive},
  volume={1},
  number={3},
  pages={1--12},
  year={2026},
  publisher={Civic Relay Open Science}
}`
    },
    {
      id: 'paper-v16-c-its',
      category: 'CITS',
      tag: 'Paper IV · C-ITS & Vehicular',
      trl: 'TRL 6',
      doi: 'SENDA-RESEARCH-V16-CITS-2026-V1',
      title: 'Arquitectura de Telecomunicaciones Vehiculares de Resiliencia Extrema: Reflejo V16 C-ITS de 38 ms, Física de Aquaplaning Horne y Conectividad Multisoftware',
      authors: 'Abraham Haddioui (SENDA) y SENDA Engineering Corps (2026)',
      abstract: 'Disrupción frente al paradigma de nube celular comercial (180 s de latencia = 6.000 m a 120 km/h a ciegas) mediante Reflejo V16 Local Directo vía BLE y LoRa (38 ms = 1,27 m de avance). Integración con la velocidad de aquaplaning dinámica de Horne v_p = 6.36·√(p_tire) e interoperabilidad multisoftware (Android Auto, Apple CarPlay, Waze y Google Maps).',
      formula: 'v_p = 6.36 · √(p_tire [kPa])  ||  Δt_reflex = 38 ms (1.27 m @ 120 km/h)',
      url: '/senda/papers/paper-v16-c-its.html',
      bibtex: `@article{senda2026v16cits,
  title={Arquitectura de Telecomunicaciones Vehiculares de Resiliencia Extrema: Reflejo V16 C-ITS de 38 ms, Física de Aquaplaning Horne y Conectividad Multisoftware},
  author={Haddioui, Abraham and SENDA Engineering Corps},
  journal={SENDA Research Archive},
  volume={1},
  number={4},
  pages={1--16},
  year={2026},
  publisher={Civic Relay Open Science}
}`
    },
    {
      id: 'paper-wildfire-3d',
      category: 'PHYSICS',
      tag: 'Paper V · Física Atmosférica',
      trl: 'TRL 5',
      doi: 'SENDA-RESEARCH-3D-WIND-2026-V20',
      title: 'SENDA-3D: Sensores de Oportunidad, Viento 3D con Conservación de Masa y Asimilación de Cicatrices de Satélite',
      authors: 'Abraham Haddioui (SENDA) (2026)',
      abstract: 'Fusión offline en teléfono móvil de modelos numéricos de predicción (NOAA GFS), relieve Copernicus GLO-30, imágenes Sentinel-2 e instrumentación oportunista (barómetros de smartphones y anemometría vehicular por resistencia en rueda libre). Resuelve Poisson anisótropo 3D con aspiración de pluma y asimilación dNBR.',
      formula: '∂²λ/∂x² + ∂²λ/∂y² + (α₁/α₂)²·∂²λ/∂z² = -∇·u₀  [SOR ω=1.85]',
      url: '/senda/paper.html',
      bibtex: `@article{senda2026fire3d,
  title={SENDA-3D: Sensores de Oportunidad, Viento 3D con Conservación de Masa y Asimilación de Cicatrices de Satélite},
  author={Haddioui, Abraham},
  journal={SENDA Research Archive},
  volume={0},
  number={20},
  pages={1--24},
  year={2026},
  publisher={Civic Relay Open Science}
}`
    }
  ], []);

  const renders: RenderItem[] = useMemo(() => [
    {
      id: 'r1',
      title: 'Topología de Red Mesh Oportunista PAER',
      desc: 'Enrutamiento térmicamente consciente evitando bordes de peligro activo, con puentes aéreos sobre gradiente de Fiedler.',
      svgPath: '/media/renders/render-paer-mesh-topology.svg',
      formulaPreview: '∂λ₂/∂w_ij = (v₂[i] - v₂[j])²'
    },
    {
      id: 'r2',
      title: 'Curva de Atenuación por Lluvia ITU-R P.838-3',
      desc: 'Atenuación específica γ_R = k · R^α de 1 a 100 GHz bajo polarización horizontal y vertical (5, 25, 50 mm/h).',
      svgPath: '/media/renders/render-itu-p838-rain-curve.svg',
      formulaPreview: 'γ_R = k · R^α [dB/km]'
    },
    {
      id: 'r3',
      title: 'Árbol Merkle Criptográfico RFC 6962',
      desc: 'Separación estricta de dominio (prefijos 0x00 para hojas, 0x01 para nodos internos) y camino de auditoría O(log N).',
      svgPath: '/media/renders/render-merkle-rfc6962-proof.svg',
      formulaPreview: 'H(0x01 || Left || Right)'
    },
    {
      id: 'r4',
      title: 'Línea de Tiempo de Latencia V16: Directo vs Nube',
      desc: 'Comparativa de avance a 120 km/h: 38 ms directo (1,27 m) frente a 180 s en nube comercial (6.000 m a ciegas).',
      svgPath: '/media/renders/render-v16-reflex-latency.svg',
      formulaPreview: 'Δt_reflex = 38 ms (1.27 m @ 120 km/h)'
    },
    {
      id: 'r5',
      title: 'Esquema Electrónico Pasarela Centinela COTS <15€',
      desc: 'Arquitectura hardware abierta: ESP32-S3, módem LoRa SX1262 (SPI), matriz I2S INMP441 y cargador solar TP4056.',
      svgPath: '/media/renders/render-cots-gateway-hardware.svg',
      formulaPreview: 'BOM Cost: 13.80 EUR (COTS)'
    },
    {
      id: 'r6',
      title: 'Globo Táctico 4D con Órbitas Keplerianas SGP4 J₂',
      desc: 'Propagación orbital exacta con TLEs auténticos, conos de elevación azimutal y telemetría multi-fuente sin falsos positivos.',
      svgPath: '/media/renders/render-senda-4d-globe.svg',
      formulaPreview: 'r(t) = a·(1 - e²) / [1 + e·cos(ν)]'
    }
  ], []);

  const filteredPapers = useMemo(() => {
    if (selectedFilter === 'ALL') return papers;
    return papers.filter(p => p.category === selectedFilter);
  }, [papers, selectedFilter]);

  const handleCopyBibtex = () => {
    if (bibtexModal) {
      navigator.clipboard.writeText(bibtexModal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section className="spd-suite" id="papers-deck" aria-label="Scientific Papers Deck">
      <div className="spd-badge">
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
        {T.badge}
      </div>
      <h2 className="spd-title">{T.title}</h2>
      <p className="spd-lead">{T.lead}</p>

      {/* Filter Buttons */}
      <div className="spd-controls" role="group" aria-label="Paper filters">
        <button
          className={`spd-filter-btn ${selectedFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('ALL')}
        >
          {T.filterAll}
        </button>
        <button
          className={`spd-filter-btn ${selectedFilter === 'TELECOM' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('TELECOM')}
        >
          {T.filterTelecom}
        </button>
        <button
          className={`spd-filter-btn ${selectedFilter === 'MESH' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('MESH')}
        >
          {T.filterMesh}
        </button>
        <button
          className={`spd-filter-btn ${selectedFilter === 'CALIBRATION' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('CALIBRATION')}
        >
          {T.filterCalibration}
        </button>
        <button
          className={`spd-filter-btn ${selectedFilter === 'CITS' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('CITS')}
        >
          {T.filterCits}
        </button>
        <button
          className={`spd-filter-btn ${selectedFilter === 'PHYSICS' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('PHYSICS')}
        >
          {T.filterPhysics}
        </button>
      </div>

      {/* Papers List */}
      <div className="spd-papers-list">
        {filteredPapers.map(paper => (
          <article className="spd-paper-card" key={paper.id}>
            <div className="spd-paper-header">
              <div className="spd-paper-meta">
                <span className="spd-tag">{paper.tag}</span>
                <span className="spd-tag spd-tag-trl">{paper.trl}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{paper.doi}</span>
              </div>
            </div>

            <h3 className="spd-paper-h3">{paper.title}</h3>
            <div className="spd-paper-authors">{paper.authors}</div>
            <div className="spd-abstract-box">{paper.abstract}</div>

            <div className="spd-math-strip">
              <b>Formulación Clave:</b>
              <code>{paper.formula}</code>
            </div>

            <div className="spd-paper-actions">
              <a className="spd-btn" href={paper.url}>
                {T.readPaper}
              </a>
              <button
                className="spd-btn spd-btn-secondary"
                onClick={() => setBibtexModal(paper.bibtex)}
              >
                {T.viewBibtex}
              </button>
              <a
                className="spd-btn spd-btn-secondary"
                href="/senda/papers/"
              >
                Biblioteca General ↗
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Renders and High-Fidelity Diagrams Section */}
      <div className="spd-renders-section">
        <h3 className="spd-section-title">{T.rendersHeading}</h3>
        <p className="spd-section-lead">{T.rendersLead}</p>

        <div className="spd-renders-grid">
          {renders.map(r => (
            <div className="spd-render-card" key={r.id}>
              <div className="spd-render-preview">
                <img src={r.svgPath} alt={r.title} loading="lazy" />
              </div>
              <div className="spd-render-content">
                <h4 className="spd-render-title">{r.title}</h4>
                <p className="spd-render-desc">{r.desc}</p>
                <div className="spd-render-links">
                  <code style={{ fontSize: '11px', color: '#7dd3fc' }}>{r.formulaPreview}</code>
                  <a href={r.svgPath} target="_blank" rel="noopener noreferrer">
                    {T.openSvg}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* BibTeX Modal */}
      {bibtexModal && (
        <div className="spd-modal-backdrop" onClick={() => setBibtexModal(null)}>
          <div className="spd-modal-box" onClick={e => e.stopPropagation()}>
            <div className="spd-modal-header">
              <h3>{T.modalTitle}</h3>
              <button className="spd-modal-close" onClick={() => setBibtexModal(null)}>×</button>
            </div>
            <div className="spd-bibtex-block">{bibtexModal}</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="spd-btn" onClick={handleCopyBibtex}>
                {copied ? T.copiedBtn : T.copyBtn}
              </button>
              <button className="spd-btn spd-btn-secondary" onClick={() => setBibtexModal(null)}>
                {T.closeModal}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
