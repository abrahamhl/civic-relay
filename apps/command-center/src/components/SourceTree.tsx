import type { SourceRecord } from '../types';
import { ProvenanceChip } from './ProvenanceChip';

function toneForAvailability(availability: string): string {
  if (availability === 'REQUIRE_AUTH') return 'warn';
  if (availability === 'REQUIRE_LICENSE') return 'bad';
  return 'info';
}

export function SourceTree({
  sources,
  selectedId,
  onSelectSource,
  layers,
  onToggleLayer,
  counts,
}: {
  sources: SourceRecord[];
  selectedId: string | null;
  onSelectSource: (source: SourceRecord) => void;
  layers: { tfl: boolean; caltrans: boolean };
  onToggleLayer: (layer: 'tfl' | 'caltrans') => void;
  counts: { tfl: number; caltrans: number };
}) {
  return (
    <>
      <div className="section-label">Capas de observación</div>
      <div className="source-group">
        <button
          type="button"
          className="layer-toggle"
          aria-pressed={layers.tfl}
          onClick={() => onToggleLayer('tfl')}
        >
          <span className="swatch" style={{ background: '#3fe0c4' }} aria-hidden="true" />
          TfL JamCams
          <span className="badge" style={{ marginLeft: 'auto' }}>
            {counts.tfl}
          </span>
        </button>
        <button
          type="button"
          className="layer-toggle"
          aria-pressed={layers.caltrans}
          onClick={() => onToggleLayer('caltrans')}
        >
          <span className="swatch" style={{ background: '#63a8ff' }} aria-hidden="true" />
          Caltrans CCTV
          <span className="badge" style={{ marginLeft: 'auto' }}>
            {counts.caltrans}
          </span>
        </button>
      </div>

      <div className="section-label">Fuentes oficiales (registro v0.21)</div>
      <div className="source-group" role="list">
        {sources.map((source) => (
          <button
            key={source.id}
            type="button"
            role="listitem"
            className={`source-row ${selectedId === `source:${source.id}` ? 'selected' : ''}`}
            onClick={() => onSelectSource(source)}
          >
            <span className={`dot ${toneForAvailability(source.availability)}`} aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <span className="name">{source.owner}</span>
              <span className="sub">
                {source.kind.replaceAll('_', ' ')} · {source.region}
              </span>
            </span>
            <span className="badge">{source.access}</span>
          </button>
        ))}
      </div>

      <div className="section-label">Leyenda de procedencia</div>
      <div className="legend">
        <div className="legend-row">
          <ProvenanceChip provenance="REAL_MEASUREMENT" /> instrumento físico / resultado real
        </div>
        <div className="legend-row">
          <ProvenanceChip provenance="MODEL_DERIVED_REAL_INPUT" /> modelo sobre material real
        </div>
        <div className="legend-row">
          <ProvenanceChip provenance="HINDSIGHT_REPLAY" /> histórico, no escena viva
        </div>
        <div className="legend-row">
          <ProvenanceChip provenance="SIMULATOR" /> sintético, aislado
        </div>
        <div className="legend-row">
          <ProvenanceChip provenance="MISSING_DATA" /> ausente, no inventado
        </div>
      </div>
    </>
  );
}
