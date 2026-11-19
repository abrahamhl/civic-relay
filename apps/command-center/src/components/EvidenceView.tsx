import type { SourceRecord } from '../types';

interface ManifestFile {
  id: string;
  role: string;
  repositoryPath: string;
  snapshotPath: string;
  bytes: number;
  sha256: string;
}

interface Manifest {
  schema: string;
  generatedAtUTC: string;
  note: string;
  files: ManifestFile[];
}

export function EvidenceView({
  manifest,
  sources,
  status,
}: {
  manifest: Manifest;
  sources: SourceRecord[];
  status: {
    coreTests: number | null;
    coreTestsTotal: number | null;
    e2eTests: number | null;
    e2eTestsTotal: number | null;
    relayTests: number | null;
    recordedSha: string | null;
    generatedAtUTC: string | null;
  };
}) {
  return (
    <div className="view">
      <div>
        <h2>Forensic Evidence</h2>
        <p className="lede">
          El Command Center consume una copia byte a byte de la evidencia del repositorio. El
          manifiesto SHA-256 permite verificar que lo que ves no fue generado por la UI.
        </p>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="k">Core tests</div>
          <div className="v">
            {status.coreTests ?? '—'}
            <span className="muted" style={{ fontSize: 13 }}>
              /{status.coreTestsTotal ?? '—'}
            </span>
          </div>
          <div className="h">último estado registrado</div>
        </div>
        <div className="stat">
          <div className="k">E2E tests</div>
          <div className="v">
            {status.e2eTests ?? '—'}
            <span className="muted" style={{ fontSize: 13 }}>
              /{status.e2eTestsTotal ?? '—'}
            </span>
          </div>
          <div className="h">navegador real</div>
        </div>
        <div className="stat">
          <div className="k">Relay tests</div>
          <div className="v">{status.relayTests ?? '—'}</div>
          <div className="h">sin dependencias</div>
        </div>
        <div className="stat">
          <div className="k">SHA registrado</div>
          <div className="v mono" style={{ fontSize: 15 }}>
            {status.recordedSha ?? '—'}
          </div>
          <div className="h">{status.generatedAtUTC ?? 'sin fecha'}</div>
        </div>
      </div>

      <div className="notice">
        <strong>{manifest.note}</strong>
        <div className="muted" style={{ marginTop: 4 }}>
          Generado: {manifest.generatedAtUTC} · esquema {manifest.schema}
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Artefacto</th>
              <th>Ruta en repo</th>
              <th>Bytes</th>
              <th>SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {manifest.files.map((file) => (
              <tr key={file.id}>
                <td>
                  <strong>{file.id}</strong>
                  <div className="muted" style={{ fontSize: 10.5 }}>
                    {file.role}
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 10.5 }}>
                  {file.repositoryPath}
                </td>
                <td className="mono">{file.bytes.toLocaleString('es-ES')}</td>
                <td className="mono" style={{ fontSize: 10.5 }}>
                  {file.sha256}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fuente</th>
              <th>Derechos</th>
              <th>Acceso</th>
              <th>Estado</th>
              <th>Vídeo producción</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr key={source.id}>
                <td>
                  <strong>{source.owner}</strong>
                  <div className="muted" style={{ fontSize: 10.5 }}>
                    {source.id}
                  </div>
                </td>
                <td className="mono" style={{ fontSize: 10.5 }}>
                  {source.rights}
                </td>
                <td className="mono" style={{ fontSize: 10.5 }}>
                  {source.access}
                </td>
                <td>{source.availability}</td>
                <td style={{ color: source.videoPermission ? 'var(--ok)' : 'var(--bad)' }}>
                  {source.videoPermission === true ? 'sí' : 'no'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice bad">
        <strong>No implementado en este vertical slice:</strong> ingesta en vivo, WebSocket/SSE,
        autenticación de operador, Tauri empaquetado firmado y datos calibrados de incendio. Se
        muestran como pendientes, no como capacidades activas.
      </div>
    </div>
  );
}
