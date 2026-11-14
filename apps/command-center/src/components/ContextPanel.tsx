import type { CameraRecord, SourceRecord } from '../types';
import { ProvenanceChip } from './ProvenanceChip';

function formatUTC(value: string | null): string {
  if (!value) return 'no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toISOString().replace('T', ' ').replace('.000Z', 'Z')}`;
}

export function ContextPanel({
  camera,
  source,
  onOpenCamera,
}: {
  camera: CameraRecord | null;
  source: SourceRecord | null;
  onOpenCamera: () => void;
}) {
  if (camera) {
    return (
      <>
        <div className="context-head">
          <div>
            <div className="section-label" style={{ margin: 0 }}>
              {camera.dataset.toUpperCase()} · {camera.status === 'IN_SERVICE' ? 'en servicio' : 'fuera de servicio'}
            </div>
            <h2>{camera.name}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {camera.provider}
            </div>
          </div>
          <ProvenanceChip provenance={camera.provenance} />
        </div>

        <div className="kv">
          <span className="k">Captura</span>
          <span className="v mono">{formatUTC(camera.observedAtUTC)}</span>
          <span className="k">Base temporal</span>
          <span className="v">{camera.timezoneNote}</span>
          <span className="k">Licencia</span>
          <span className="v">{camera.license}</span>
          <span className="k">Permiso vídeo</span>
          <span className="v" style={{ color: 'var(--bad)' }}>
            {camera.videoPermission === 'NOT_GRANTED' ? 'NO concedido para producción' : camera.videoPermission}
          </span>
          {camera.zone && (
            <>
              <span className="k">Zona</span>
              <span className="v">{camera.zone}</span>
            </>
          )}
          {camera.route && (
            <>
              <span className="k">Ruta</span>
              <span className="v">{camera.route}</span>
            </>
          )}
        </div>

        <div className="section-label">Métricas del clip</div>
        <div className="metric-list">
          {camera.metrics.map((metric) => (
            <div className="metric" key={metric.key}>
              <span className="label">{metric.label}</span>
              <span className="value">
                {metric.value == null ? 'MISSING_DATA' : `${metric.value} ${metric.unit}`.trim()}
              </span>
              {metric.uncertainty && <span className="uncertainty">{metric.uncertainty}</span>}
            </div>
          ))}
        </div>

        <div className="notice warn">
          <strong>Calibración no disponible.</strong> {camera.calibration.note}
        </div>

        <div className="notice">
          <strong>Base de evidencia.</strong> {camera.evidenceBasis}. Los recuentos son derivados de
          material real, no una medición certificada de tráfico.
        </div>

        {camera.fireHistory.length > 0 && (
          <div className="notice sim">
            <strong>Replay histórico separado.</strong> Hay referencias de incendio a distinta fecha
            que la cámara ({formatUTC(camera.fireHistory[0].eventAtUTC)}). No se presentan como la
            misma escena.
          </div>
        )}

        <div className="hstack" style={{ marginTop: 12 }}>
          <button type="button" onClick={onOpenCamera}>
            Abrir ficha completa
          </button>
        </div>
      </>
    );
  }

  if (source) {
    return (
      <>
        <div className="context-head">
          <div>
            <div className="section-label" style={{ margin: 0 }}>
              Fuente del registro
            </div>
            <h2>{source.owner}</h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {source.id}
            </div>
          </div>
          <span className={`dot ${source.availability === 'REQUIRE_AUTH' ? 'warn' : 'info'}`} />
        </div>
        <div className="kv">
          <span className="k">Tipo</span>
          <span className="v">{source.kind.replaceAll('_', ' ')}</span>
          <span className="k">Modalidad</span>
          <span className="v">{source.modality.replaceAll('_', ' ')}</span>
          <span className="k">Región</span>
          <span className="v">{source.region}</span>
          <span className="k">Derechos</span>
          <span className="v">{source.rights.replaceAll('_', ' ')}</span>
          <span className="k">Acceso</span>
          <span className="v">{source.access}</span>
          <span className="k">Auth</span>
          <span className="v">{source.auth}</span>
          <span className="k">Estado</span>
          <span className="v">{source.availability}</span>
          <span className="k">Precisión</span>
          <span className="v">{source.spatialAccuracy}</span>
          <span className="k">Tiempo</span>
          <span className="v">{source.timing}</span>
        </div>
        <div className="notice">
          <strong>Uso previsto.</strong> {source.use}
        </div>
        <div className="notice bad">
          <strong>Límite.</strong> {source.gap}
        </div>
        <div className="notice warn">
          <strong>Vídeo de producción.</strong>{' '}
          {source.videoPermission === true
            ? 'Permiso documentado.'
            : 'No hay permiso de vídeo en producción; el catálogo público no concede derechos de livestream.'}
        </div>
        <div className="hstack" style={{ marginTop: 12 }}>
          <a href={source.homepage} target="_blank" rel="noreferrer noopener">
            <button type="button">Ver documentación oficial</button>
          </a>
        </div>
      </>
    );
  }

  return (
    <div className="empty-state">
      Selecciona una fuente o una cámara en el mapa para ver su procedencia, permisos y
      limitaciones.
    </div>
  );
}
