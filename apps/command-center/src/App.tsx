import { lazy, Suspense, useMemo, useState } from 'react';
import { evidence, snapshotManifest } from './data/bundle';
import type { CameraRecord, DatasetFilter, SourceRecord, TabId, TimelineEvent } from './types';
import { Header } from './components/Header';
import { SourceTree } from './components/SourceTree';
import { Map2D } from './components/Map2D';
const Scene3D = lazy(() =>
  import('./components/Scene3D').then((module) => ({ default: module.Scene3D })),
);
import { ContextPanel } from './components/ContextPanel';
import { TimelineBar } from './components/TimelineBar';
import { CameraIntelligence } from './components/CameraIntelligence';
import { RfLab } from './components/RfLab';
import { MeteorologyLab } from './components/MeteorologyLab';
import { AccessControlPanel } from './components/AccessControlPanel';
import { SecureLinkPanel } from './components/SecureLinkPanel';
import { SimulationPanel } from './components/SimulationPanel';
import { EvidenceView } from './components/EvidenceView';

const cameras = evidence.cameras as CameraRecord[];
const sources = evidence.registry.sources as SourceRecord[];
const timeline = evidence.timeline as TimelineEvent[];

const DATASET_LABEL: Record<DatasetFilter, string> = {
  all: 'Todos los conjuntos',
  tfl: 'TfL · Londres',
  caltrans: 'Caltrans · California',
};

function latestObservation(): string {
  const values = cameras
    .map((c) => c.observedAtUTC)
    .filter((v): v is string => Boolean(v))
    .sort();
  if (values.length === 0) return '—';
  const last = values[values.length - 1];
  return last.length > 16 ? `${last.slice(0, 16)}Z` : last;
}

export function App() {
  const [tab, setTab] = useState<TabId>('overview');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [layers, setLayers] = useState({ tfl: true, caltrans: true });
  const [dataset, setDataset] = useState<DatasetFilter>('all');
  const [mode, setMode] = useState<'2d' | '3d'>('2d');

  const filteredCameras = useMemo(
    () =>
      cameras.filter((camera) => {
        if (!layers[camera.dataset]) return false;
        if (dataset !== 'all' && camera.dataset !== dataset) return false;
        return true;
      }),
    [layers, dataset],
  );

  const selectedCamera = cameras.find((c) => c.id === selectedCameraId) ?? null;
  const selectedSource = sources.find((s) => s.id === selectedSourceId) ?? null;

  const selectCamera = (camera: CameraRecord) => {
    setSelectedCameraId(camera.id);
    setSelectedSourceId(null);
    setDataset(camera.dataset);
  };

  const selectSource = (source: SourceRecord) => {
    setSelectedSourceId(source.id);
    setSelectedCameraId(null);
  };

  const pickEvent = (event: TimelineEvent) => {
    if (event.kind === 'observation') {
      const datasetKey = event.id.endsWith('tfl') ? 'tfl' : 'caltrans';
      const camera = cameras.find((c) => c.dataset === datasetKey);
      if (camera) selectCamera(camera);
      setTab('cameras');
    } else {
      setTab('evidence');
    }
  };

  const tests = `${evidence.status.coreTests ?? '—'}/${evidence.status.coreTestsTotal ?? '—'} core`;

  return (
    <div className="app">
      <Header
        tab={tab}
        onTab={setTab}
        sourceCount={evidence.registry.counts.total as number}
        documentedCount={evidence.registry.counts.documented as number}
        cameraCount={cameras.length}
        tests={tests}
        lastObservation={latestObservation()}
      />

      <main className="shell">
        <aside className="panel left">
          <SourceTree
            sources={sources}
            selectedId={selectedSourceId ? `source:${selectedSourceId}` : null}
            onSelectSource={selectSource}
            layers={layers}
            onToggleLayer={(layer) => setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }))}
            counts={{
              tfl: cameras.filter((c) => c.dataset === 'tfl').length,
              caltrans: cameras.filter((c) => c.dataset === 'caltrans').length,
            }}
          />
        </aside>

        <section className="center">
          {tab === 'overview' && (
            <div className="view">
              <div className="stat-row">
                <div className="stat">
                  <div className="k">Fuentes documentadas</div>
                  <div className="v">
                    {evidence.registry.counts.documented as number}
                    <span className="muted" style={{ fontSize: 13 }}>
                      /{evidence.registry.counts.total as number}
                    </span>
                  </div>
                  <div className="h">registro oficial v0.21</div>
                </div>
                <div className="stat">
                  <div className="k">Cámaras reales</div>
                  <div className="v">{filteredCameras.length}</div>
                  <div className="h">clips grabados, no stream</div>
                </div>
                <div className="stat">
                  <div className="k">Cobertura de vídeo</div>
                  <div className="v" style={{ fontSize: 16, color: 'var(--bad)' }}>
                    0 permisos
                  </div>
                  <div className="h">ningún livestream autorizado</div>
                </div>
                <div className="stat">
                  <div className="k">Calibración</div>
                  <div className="v" style={{ fontSize: 16, color: 'var(--warn)' }}>
                    AUSENTE
                  </div>
                  <div className="h">sin pose ni homografía</div>
                </div>
              </div>

              <div className="view-toolbar">
                <div className="seg" role="group" aria-label="Modo de vista">
                  <button
                    type="button"
                    aria-pressed={mode === '2d'}
                    onClick={() => setMode('2d')}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === '3d'}
                    onClick={() => setMode('3d')}
                  >
                    3D
                  </button>
                </div>
                <select
                  className="select"
                  aria-label="Conjunto de datos"
                  value={dataset}
                  onChange={(event) => setDataset(event.target.value as DatasetFilter)}
                >
                  {(Object.keys(DATASET_LABEL) as DatasetFilter[]).map((key) => (
                    <option key={key} value={key}>
                      {DATASET_LABEL[key]}
                    </option>
                  ))}
                </select>
                <span className="spacer" />
                <span className="prov-chip">Snapshot offline · sin red</span>
              </div>

              {mode === '2d' ? (
                <Map2D
                  cameras={filteredCameras}
                  selectedId={selectedCameraId}
                  onSelect={selectCamera}
                  label={DATASET_LABEL[dataset]}
                />
              ) : (
                <Suspense
                  fallback={
                    <div className="map-frame">
                      <div className="map-empty">Cargando escena 3D bajo demanda…</div>
                    </div>
                  }
                >
                  <Scene3D
                    cameras={filteredCameras}
                    selectedId={selectedCameraId}
                    onSelect={selectCamera}
                  />
                </Suspense>
              )}
            </div>
          )}

          {tab === 'sources' && (
            <div className="view">
              <div>
                <h2>Live Sources</h2>
                <p className="lede">
                  Catálogo oficial comprobado por documentación, no por health-check autenticado.
                  «Documented» no significa «en vivo» ni «con permiso de vídeo».
                </p>
              </div>
              <div className="table-wrap" style={{ flex: 1 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Proveedor</th>
                      <th>Región</th>
                      <th>Tipo</th>
                      <th>Derechos</th>
                      <th>Acceso</th>
                      <th>Auth</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr
                        key={source.id}
                        onClick={() => selectSource(source)}
                        style={{
                          cursor: 'pointer',
                          background:
                            source.id === selectedSourceId ? 'rgba(63,224,196,0.07)' : undefined,
                        }}
                      >
                        <td>
                          <strong>{source.owner}</strong>
                          <div className="muted" style={{ fontSize: 10.5 }}>
                            {source.id}
                          </div>
                        </td>
                        <td className="mono">{source.region}</td>
                        <td>{source.kind.replaceAll('_', ' ')}</td>
                        <td className="mono" style={{ fontSize: 10.5 }}>
                          {source.rights}
                        </td>
                        <td className="mono" style={{ fontSize: 10.5 }}>
                          {source.access}
                        </td>
                        <td className="mono" style={{ fontSize: 10.5 }}>
                          {source.auth}
                        </td>
                        <td>
                          <span
                            className={`dot ${
                              source.availability === 'REQUIRE_AUTH'
                                ? 'warn'
                                : source.availability === 'REQUIRE_LICENSE'
                                  ? 'bad'
                                  : 'info'
                            }`}
                          />{' '}
                          {source.availability}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="notice warn">
                <strong>Regla del registro:</strong> {evidence.registry.rule}
              </div>
            </div>
          )}

          {tab === 'cameras' && (
            <CameraIntelligence
              cameras={filteredCameras}
              selectedId={selectedCameraId}
              onSelect={selectCamera}
            />
          )}

          {tab === 'twin' && (
            <div className="view">
              <div>
                <h2>3D Digital Twin</h2>
                <p className="lede">
                  Escena WebGL con marcadores georreferenciados de las cámaras reales. Sin DEM,
                  edificios ni conos FOV porque no hay datos de pose/calibración en este snapshot.
                </p>
              </div>
              <Suspense
                fallback={
                  <div className="map-frame">
                    <div className="map-empty">Cargando escena 3D bajo demanda…</div>
                  </div>
                }
              >
                <Scene3D
                  cameras={filteredCameras}
                  selectedId={selectedCameraId}
                  onSelect={selectCamera}
                />
              </Suspense>
            </div>
          )}

          {tab === 'rf' && <RfLab />}
          {tab === 'meteorology' && <MeteorologyLab />}
          {tab === 'access' && <AccessControlPanel />}
          {tab === 'secure' && <SecureLinkPanel />}
          {tab === 'simulation' && <SimulationPanel />}
          {tab === 'evidence' && (
            <EvidenceView
              manifest={snapshotManifest as never}
              sources={sources}
              status={evidence.status as never}
            />
          )}
        </section>

        <aside className="panel right">
          <ContextPanel
            camera={selectedCamera}
            source={selectedSource}
            onOpenCamera={() => setTab('cameras')}
          />
        </aside>
      </main>

      <TimelineBar events={timeline} onPick={pickEvent} />
    </div>
  );
}
