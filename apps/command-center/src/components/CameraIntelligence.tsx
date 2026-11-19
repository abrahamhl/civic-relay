import type { CameraRecord } from '../types';
import { ProvenanceChip } from './ProvenanceChip';

export function CameraIntelligence({
  cameras,
  selectedId,
  onSelect,
}: {
  cameras: CameraRecord[];
  selectedId: string | null;
  onSelect: (camera: CameraRecord) => void;
}) {
  const inService = cameras.filter((c) => c.status === 'IN_SERVICE').length;
  const withSpeed = cameras.filter((c) => c.metrics.some((m) => m.key === 'velMedianaMovKmh' && m.value != null)).length;

  return (
    <div className="view">
      <div>
        <h2>Camera Intelligence</h2>
        <p className="lede">
          Recuentos derivados de clips reales con YOLOX-s + ByteTrack. No hay pose, homografía ni
          calibración radiométrica: por eso no se calculan temperaturas, velocidades certificadas ni
          triangulación multi-cámara.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="k">Cámaras</div>
          <div className="v">{cameras.length}</div>
          <div className="h">TfL + Caltrans</div>
        </div>
        <div className="stat">
          <div className="k">En servicio</div>
          <div className="v">{inService}</div>
          <div className="h">según el operador</div>
        </div>
        <div className="stat">
          <div className="k">Con velocidad</div>
          <div className="v">{withSpeed}</div>
          <div className="h">±30 % por escala</div>
        </div>
        <div className="stat">
          <div className="k">Calibración</div>
          <div className="v" style={{ fontSize: 15, color: 'var(--warn)' }}>
            NO DISPONIBLE
          </div>
          <div className="h">sin pose/homografía</div>
        </div>
      </div>

      <div className="table-wrap" style={{ flex: 1 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Cámara</th>
              <th>Conjunto</th>
              <th>Estado</th>
              <th>Cruces</th>
              <th>Media</th>
              <th>Vel. mediana</th>
              <th>Procedencia</th>
            </tr>
          </thead>
          <tbody>
            {cameras.map((camera) => {
              const crosses = camera.metrics.find((m) => m.key === 'cruces')?.value;
              const mean = camera.metrics.find((m) => m.key === 'mediaEnImagen')?.value;
              const speed = camera.metrics.find((m) => m.key === 'velMedianaMovKmh')?.value;
              return (
                <tr
                  key={camera.id}
                  onClick={() => onSelect(camera)}
                  style={{
                    cursor: 'pointer',
                    background: camera.id === selectedId ? 'rgba(63,224,196,0.07)' : undefined,
                  }}
                >
                  <td>
                    <strong>{camera.name}</strong>
                    <div className="muted" style={{ fontSize: 10.5 }}>
                      {camera.route ?? camera.zone ?? camera.operator}
                    </div>
                  </td>
                  <td className="mono">{camera.dataset}</td>
                  <td>
                    <span className={`dot ${camera.status === 'IN_SERVICE' ? 'ok' : 'bad'}`} />{' '}
                    {camera.status === 'IN_SERVICE' ? 'servicio' : 'fuera'}
                  </td>
                  <td className="mono">{crosses ?? '—'}</td>
                  <td className="mono">{mean ?? '—'}</td>
                  <td className="mono">{speed == null ? '—' : `${speed} km/h`}</td>
                  <td>
                    <ProvenanceChip provenance={camera.provenance} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="notice warn">
        <strong>FOV y triangulación:</strong> NOT_AVAILABLE_NO_CALIBRATION. Sin pose de cámara,
        distancia focal y puntos de control no se dibuja un cono de visión ni se cruzan rayos entre
        cámaras. La UI lo muestra deshabilitado en lugar de inventarlo.
      </div>
    </div>
  );
}
