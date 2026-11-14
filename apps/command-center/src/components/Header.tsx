import type { TabId } from '../types';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'sources', label: 'Live Sources' },
  { id: 'cameras', label: 'Camera Intelligence' },
  { id: 'twin', label: '3D Digital Twin' },
  { id: 'rf', label: 'RF & Rescue Lab' },
  { id: 'meteorology', label: 'Meteorology & Forecast' },
  { id: 'access', label: 'Access & Entities' },
  { id: 'secure', label: 'Secure Link' },
  { id: 'simulation', label: 'Simulation Lab' },
  { id: 'evidence', label: 'Forensic Evidence' },
];

export function Header({
  tab,
  onTab,
  sourceCount,
  documentedCount,
  cameraCount,
  tests,
  lastObservation,
}: {
  tab: TabId;
  onTab: (tab: TabId) => void;
  sourceCount: number;
  documentedCount: number;
  cameraCount: number;
  tests: string;
  lastObservation: string;
}) {
  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          SN
        </div>
        <div>
          <h1>SENDA Command Center</h1>
          <small>Consola local · snapshot sin red</small>
        </div>
      </div>

      <div className="header-chips" role="status" aria-live="polite">
        <span className="chip">
          <span className="dot ok" aria-hidden="true" />
          OFFLINE SNAPSHOT
        </span>
        <span className="chip">
          Fuentes <strong>{documentedCount}/{sourceCount}</strong> documentadas
        </span>
        <span className="chip">
          Cámaras reales <strong>{cameraCount}</strong>
        </span>
        <span className="chip">
          Tests <strong>{tests}</strong>
        </span>
        <span className="chip">
          Último dato <strong>{lastObservation}</strong>
        </span>
      </div>

      <nav className="tabs" aria-label="Secciones del Command Center">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
