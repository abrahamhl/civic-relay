'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Map as MapIcon,
  Share2,
  ShieldAlert,
  Radio,
  Users,
  Download,
  HelpCircle,
  Sparkles,
  CheckCircle2,
  X,
  AlertCircle,
  Loader2,
  History
} from 'lucide-react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import type { Locale } from '../data/types';
import {
  GUIDED_TOUR_STEPS,
  LAYER_META,
  PLATFORM_SCENARIOS,
  type LayerId,
  type Priority
} from './platform-data';
import TacticalMap, { type SnapshotPoint } from './TacticalMap';
import CorrelationGraph from './CorrelationGraph';
import './platform.css';

interface AuditEntry {
  id: string;
  at: string;
  action: string;
  target: string;
  mode: 'SIMULATION';
}

type PendingAction = 'declare-zone' | 'activate-relay' | 'assign-team' | null;
type MobileTab = 'map' | 'queue' | 'inspector' | 'graph';

const PRIO_RANK: Record<Priority, number> = { critical: 0, high: 1, medium: 2, info: 3 };

function useDialogLightDismiss(ref: React.RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;
    const onClick = (e: MouseEvent) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) {
        dialog.close();
      }
    };
    dialog.addEventListener('click', onClick);
    return () => dialog.removeEventListener('click', onClick);
  }, [ref]);
}

export default function ControlCenter({ locale }: { locale: Locale }) {
  const [scenarioId, setScenarioId] = useState(PLATFORM_SCENARIOS[0].id);
  const scenario = useMemo(
    () => PLATFORM_SCENARIOS.find((s) => s.id === scenarioId) ?? PLATFORM_SCENARIOS[0],
    [scenarioId]
  );

  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    incidents: true,
    routes: true,
    relays: true,
    coverage: true,
    infrastructure: true,
    hazard: true,
    transport: false
  });
  const [selectedId, setSelectedId] = useState<string>(PLATFORM_SCENARIOS[0].entities[0].id);
  const [stageMode, setStageMode] = useState<'map' | 'graph'>('map');
  const [mobileTab, setMobileTab] = useState<MobileTab>('map');
  const [queueFilter, setQueueFilter] = useState<'all' | Priority>('all');
  const [queueSearch, setQueueSearch] = useState('');

  // Timeline state (0..90 min)
  const [currentMinute, setCurrentMinute] = useState(6);
  const [playing, setPlaying] = useState(false);

  // Simulated control state + two-step confirmation + visible audit log
  const [zoneDeclared, setZoneDeclared] = useState(false);
  const [relayActive, setRelayActive] = useState(false);
  const [teamAssigned, setTeamAssigned] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([
    {
      id: 'init',
      at: 'T+00m',
      action: locale === 'es' ? 'Sesión de simulación inicializada' : locale === 'nl' ? 'Simulatiesessie gestart' : 'Simulation session initialized',
      target: 'S01',
      mode: 'SIMULATION'
    }
  ]);

  // Real bundled public snapshot loader (GDACS, DGT, NDW, USGS) with loading/error states
  const [snapshotPoints, setSnapshotPoints] = useState<SnapshotPoint[]>([]);
  const [snapshotState, setSnapshotState] = useState<'loading' | 'ready' | 'error'>('loading');

  // Guided tour (60-90s, 6 steps)
  const [tourIndex, setTourIndex] = useState<number | null>(null);

  // Command palette (⌘K) & Shortcuts (?)
  const cmdDialogRef = useRef<HTMLDialogElement>(null);
  const helpDialogRef = useRef<HTMLDialogElement>(null);
  const [cmdQuery, setCmdQuery] = useState('');
  useDialogLightDismiss(cmdDialogRef);
  useDialogLightDismiss(helpDialogRef);

  const ui = {
    en: {
      simBadge: 'SIMULATION WORKSPACE',
      cmdLabel: 'Command palette...',
      tourStart: 'Play guided demo',
      tourNext: 'Next',
      tourPrev: 'Back',
      tourExit: 'End tour',
      mapView: 'Map',
      graphView: 'Correlation',
      layersTitle: 'Layers & Sources',
      queueTitle: 'Priority Event Queue',
      inspectorTitle: 'Object Inspector',
      controlsTitle: 'Simulated Controls (2-Step)',
      controlsDisclaimer: 'SIMULATION ONLY — No live 112 dispatch, radio transmission, or real alerts.',
      actZone: 'Declare emergency zone',
      actRelay: 'Activate pre-auth relay mode',
      actTeam: 'Assign response unit',
      confirmPrompt: 'Confirm simulated action? This logs to the local audit trail only.',
      confirmBtn: 'Confirm simulation',
      cancelBtn: 'Cancel',
      auditTitle: 'Audit Trail (Simulation)',
      relationsTitle: 'Correlated Objects',
      exportReport: 'Export JSON report',
      shortcutsTitle: 'Keyboard shortcuts',
      emptyQueue: 'No events match your current layer or priority filter.',
      loadingSnap: 'Loading dated public snapshots (GDACS, DGT, NDW, USGS)...',
      errorSnap: 'Public snapshots unavailable offline; running with deterministic scenario model.',
      baselineCompare: 'Compare baseline'
    },
    es: {
      simBadge: 'ENTORNO DE SIMULACIÓN',
      cmdLabel: 'Barra de comandos...',
      tourStart: 'Reproducir demo guiada',
      tourNext: 'Siguiente',
      tourPrev: 'Anterior',
      tourExit: 'Cerrar guía',
      mapView: 'Mapa',
      graphView: 'Correlación',
      layersTitle: 'Capas y fuentes',
      queueTitle: 'Cola de eventos por prioridad',
      inspectorTitle: 'Ficha de objeto',
      controlsTitle: 'Acciones de control (Simulación · 2 pasos)',
      controlsDisclaimer: 'SOLO SIMULACIÓN — Sin despacho 112 real, sin emisión de radio ni alertas reales.',
      actZone: 'Declarar zona de emergencia',
      actRelay: 'Activar modo relé preautorizado',
      actTeam: 'Asignar equipo de respuesta',
      confirmPrompt: '¿Confirmar acción simulada? Solo se registra en el historial local de auditoría.',
      confirmBtn: 'Confirmar simulación',
      cancelBtn: 'Cancelar',
      auditTitle: 'Registro de auditoría (Simulación)',
      relationsTitle: 'Relaciones (grafo mini)',
      exportReport: 'Exportar informe JSON',
      shortcutsTitle: 'Atajos de teclado',
      emptyQueue: 'No hay eventos visibles con las capas o filtros actuales.',
      loadingSnap: 'Cargando capturas públicas reales (GDACS, DGT, NDW, USGS)...',
      errorSnap: 'Capturas públicas no disponibles; operando con el modelo determinista.',
      baselineCompare: 'Comparativa'
    },
    nl: {
      simBadge: 'SIMULATIE-OMGEVING',
      cmdLabel: 'Commandobalk...',
      tourStart: 'Start begeleide demo',
      tourNext: 'Volgende',
      tourPrev: 'Vorige',
      tourExit: 'Sluit tour',
      mapView: 'Kaart',
      graphView: 'Correlatie',
      layersTitle: 'Lagen & bronnen',
      queueTitle: 'Gebeurtenissen op prioriteit',
      inspectorTitle: 'Objectinspector',
      controlsTitle: 'Gesimuleerde acties (2 stappen)',
      controlsDisclaimer: 'ALLEEN SIMULATIE — Geen echte 112-inzet, radio-uitzending of echte alarmen.',
      actZone: 'Noodzone verklaren',
      actRelay: 'Relay-modus activeren',
      actTeam: 'Eenheid toewijzen',
      confirmPrompt: 'Gesimuleerde actie bevestigen? Wordt alleen in het lokale auditlogboek opgeslagen.',
      confirmBtn: 'Bevestig simulatie',
      cancelBtn: 'Annuleren',
      auditTitle: 'Auditlogboek (Simulatie)',
      relationsTitle: 'Gecorreleerde objecten',
      exportReport: 'Exporteer JSON-rapport',
      shortcutsTitle: 'Sneltoetsen',
      emptyQueue: 'Geen gebeurtenissen komen overeen met uw lagen of filter.',
      loadingSnap: 'Gedateerde openbare snapshots laden (GDACS, DGT, NDW, USGS)...',
      errorSnap: 'Openbare snapshots offline niet beschikbaar; deterministisch model actief.',
      baselineCompare: 'Vergelijking'
    }
  }[locale];

  // Fetch real bundled snapshots from /senda/data/referencias/
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setSnapshotState('loading');
      try {
        const pts: SnapshotPoint[] = [];
        const fetchJson = async (url: string) => {
          const r = await fetch(url);
          return r.ok ? r.json() : null;
        };

        const [gdacs, usgs, dgt, ndw] = await Promise.all([
          fetchJson('/senda/data/referencias/gdacs_eventos.json'),
          fetchJson('/senda/data/referencias/usgs_sismos.json'),
          fetchJson('/senda/data/referencias/dgt_incidencias.json'),
          fetchJson('/senda/data/referencias/ndw_situaciones.json')
        ]);

        const gdacsList = Array.isArray(gdacs?.features) ? gdacs.features : Array.isArray(gdacs) ? gdacs : [];
        for (const item of gdacsList.slice(0, 60)) {
          const lon = item?.geometry?.coordinates?.[0] ?? item?.lon;
          const lat = item?.geometry?.coordinates?.[1] ?? item?.lat;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            pts.push({
              id: `gdacs-${pts.length}`,
              source: 'GDACS',
              lat,
              lon,
              title: String(item?.properties?.name || item?.title || 'GDACS Event')
            });
          }
        }

        const usgsList = Array.isArray(usgs?.features) ? usgs.features : Array.isArray(usgs) ? usgs : [];
        for (const item of usgsList.slice(0, 60)) {
          const lon = item?.geometry?.coordinates?.[0] ?? item?.lon;
          const lat = item?.geometry?.coordinates?.[1] ?? item?.lat;
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            pts.push({
              id: `usgs-${pts.length}`,
              source: 'USGS',
              lat,
              lon,
              title: String(item?.properties?.place || item?.place || 'USGS Quake')
            });
          }
        }

        const dgtList = Array.isArray(dgt?.incidencias) ? dgt.incidencias : Array.isArray(dgt) ? dgt : [];
        for (const item of dgtList.slice(0, 60)) {
          const lat = Number(item?.lat ?? item?.latitude);
          const lon = Number(item?.lon ?? item?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            pts.push({
              id: `dgt-${pts.length}`,
              source: 'DGT',
              lat,
              lon,
              title: String(item?.causa || item?.carretera || 'DGT Incident')
            });
          }
        }

        const ndwList = Array.isArray(ndw?.situaciones) ? ndw.situaciones : Array.isArray(ndw) ? ndw : [];
        for (const item of ndwList.slice(0, 60)) {
          const lat = Number(item?.lat ?? item?.latitude);
          const lon = Number(item?.lon ?? item?.longitude);
          if (Number.isFinite(lat) && Number.isFinite(lon)) {
            pts.push({
              id: `ndw-${pts.length}`,
              source: 'NDW',
              lat,
              lon,
              title: String(item?.tipo || item?.road || 'NDW Situation')
            });
          }
        }

        if (!alive) return;
        setSnapshotPoints(pts);
        setSnapshotState(pts.length > 0 ? 'ready' : 'error');
      } catch {
        if (alive) setSnapshotState('error');
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  // Reset selected entity when scenario switches
  const switchScenario = useCallback((nextId: string) => {
    const found = PLATFORM_SCENARIOS.find((s) => s.id === nextId);
    if (!found) return;
    setScenarioId(found.id);
    setSelectedId(found.entities[0].id);
    setZoneDeclared(false);
    setRelayActive(false);
    setTeamAssigned(false);
    setPendingAction(null);
    setCurrentMinute(Math.min(found.sendaEtaMin + 2, 15));
  }, []);

  // Priority-sorted & filtered queue
  const queueItems = useMemo(() => {
    const q = queueSearch.trim().toLowerCase();
    return [...scenario.entities]
      .filter((e) => layers[e.layer])
      .filter((e) => (queueFilter === 'all' ? true : e.priority === queueFilter))
      .filter((e) => (!q ? true : e.title[locale].toLowerCase().includes(q) || e.summary[locale].toLowerCase().includes(q)))
      .sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority] || a.timeOffsetMin - b.timeOffsetMin);
  }, [layers, locale, queueFilter, queueSearch, scenario.entities]);

  const selectedEntity = useMemo(
    () => scenario.entities.find((e) => e.id === selectedId) ?? scenario.entities[0],
    [scenario.entities, selectedId]
  );

  const relatedLinks = useMemo(
    () => scenario.links.filter((l) => l.fromId === selectedEntity.id || l.toId === selectedEntity.id),
    [scenario.links, selectedEntity.id]
  );

  // Timeline playback loop
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setCurrentMinute((m) => (m >= 90 ? 0 : m + 2));
    }, 650);
    return () => window.clearInterval(id);
  }, [playing]);

  // Guided demo tour auto-advance (6 steps x 12s = 72s)
  useEffect(() => {
    if (tourIndex === null) return;
    const step = GUIDED_TOUR_STEPS[tourIndex];
    if (step.target === 'graph') setStageMode('graph');
    if (step.target === 'map') setStageMode('map');

    const timer = window.setTimeout(() => {
      setTourIndex((idx) => {
        if (idx === null) return null;
        return idx + 1 < GUIDED_TOUR_STEPS.length ? idx + 1 : null;
      });
    }, 12000);
    return () => window.clearTimeout(timer);
  }, [tourIndex]);

  // Export deterministic JSON report
  const exportReport = useCallback(() => {
    const payload = {
      schema: 'senda-control-center-report/v1',
      mode: 'SIMULATION_ONLY_NOT_AN_EMERGENCY_SERVICE',
      exportedAt: new Date().toISOString(),
      scenario: {
        id: scenario.id,
        code: scenario.code,
        name: scenario.name[locale],
        sendaEtaMin: scenario.sendaEtaMin,
        baselineEtaMin: scenario.baselineEtaMin
      },
      timelineMinute: currentMinute,
      simulatedState: { zoneDeclared, relayActive, teamAssigned },
      realSnapshotsLoaded: snapshotPoints.length,
      auditLog
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senda-simulation-${scenario.code.toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [auditLog, currentMinute, locale, relayActive, scenario, snapshotPoints.length, teamAssigned, zoneDeclared]);

  // Global keyboard shortcuts (⌘K, ?, Space, G, J/K, T)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        cmdDialogRef.current?.showModal();
        return;
      }
      if (inInput) return;

      if (e.key === '?') {
        e.preventDefault();
        helpDialogRef.current?.showModal();
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key.toLowerCase() === 'g') {
        setStageMode((m) => (m === 'map' ? 'graph' : 'map'));
      } else if (e.key.toLowerCase() === 't') {
        setTourIndex((i) => (i === null ? 0 : null));
      } else if (e.key.toLowerCase() === 'j' || e.key === 'ArrowDown') {
        if (queueItems.length === 0) return;
        const idx = queueItems.findIndex((x) => x.id === selectedId);
        const next = queueItems[(idx + 1) % queueItems.length];
        if (next) setSelectedId(next.id);
      } else if (e.key.toLowerCase() === 'k' || e.key === 'ArrowUp') {
        if (queueItems.length === 0) return;
        const idx = queueItems.findIndex((x) => x.id === selectedId);
        const prev = queueItems[(idx - 1 + queueItems.length) % queueItems.length];
        if (prev) setSelectedId(prev.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [queueItems, selectedId]);

  const confirmSimulatedAction = () => {
    if (!pendingAction) return;
    let label = '';
    if (pendingAction === 'declare-zone') {
      setZoneDeclared(true);
      label = ui.actZone;
    } else if (pendingAction === 'activate-relay') {
      setRelayActive(true);
      label = ui.actRelay;
    } else if (pendingAction === 'assign-team') {
      setTeamAssigned(true);
      label = ui.actTeam;
    }
    setAuditLog((prev) => [
      {
        id: `${Date.now()}`,
        at: `T+${String(currentMinute).padStart(2, '0')}m`,
        action: `${label} (SIMULATION)`,
        target: selectedEntity.id,
        mode: 'SIMULATION'
      },
      ...prev
    ]);
    setPendingAction(null);
  };

  // Command palette entries
  const commands = useMemo(() => {
    const items: Array<{ id: string; group: string; label: string; run: () => void }> = [];
    for (const sc of PLATFORM_SCENARIOS) {
      items.push({
        id: `sc-${sc.id}`,
        group: locale === 'es' ? 'Cambiar escenario' : locale === 'nl' ? 'Wissel scenario' : 'Switch scenario',
        label: sc.name[locale],
        run: () => switchScenario(sc.id)
      });
    }
    for (const ent of scenario.entities) {
      items.push({
        id: `ent-${ent.id}`,
        group: locale === 'es' ? 'Ir a objeto' : locale === 'nl' ? 'Ga naar object' : 'Jump to object',
        label: `${ent.title[locale]} (${ent.id})`,
        run: () => {
          setSelectedId(ent.id);
          setMobileTab('inspector');
        }
      });
    }
    items.push({
      id: 'act-graph',
      group: 'View',
      label: `${ui.mapView} / ${ui.graphView}`,
      run: () => setStageMode((m) => (m === 'map' ? 'graph' : 'map'))
    });
    items.push({
      id: 'act-tour',
      group: 'Demo',
      label: ui.tourStart,
      run: () => setTourIndex(0)
    });
    items.push({
      id: 'act-export',
      group: 'Export',
      label: ui.exportReport,
      run: exportReport
    });

    const q = cmdQuery.trim().toLowerCase();
    return q ? items.filter((i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)) : items;
  }, [cmdQuery, exportReport, locale, scenario.entities, switchScenario, ui]);

  const activeTourStep = tourIndex !== null ? GUIDED_TOUR_STEPS[tourIndex] : null;

  return (
    <PageShell locale={locale} active="platform" hideFooter>
      <div className="cc-root" data-testid="control-center">
        {/* Top Command Bar */}
        <div className={`cc-topbar ${activeTourStep?.target === 'topbar' ? 'cc-tour-ring' : ''}`}>
          <label className="s-sr" htmlFor="cc-scenario-select">
            Scenario
          </label>
          <select
            id="cc-scenario-select"
            className="cc-select"
            value={scenarioId}
            onChange={(e) => switchScenario(e.target.value)}
            data-testid="cc-scenario-select"
          >
            {PLATFORM_SCENARIOS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name[locale]}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="cc-cmd-btn"
            onClick={() => cmdDialogRef.current?.showModal()}
            data-testid="cc-cmd-trigger"
          >
            <Search size={14} aria-hidden="true" />
            <span>{ui.cmdLabel}</span>
            <kbd className="cc-kbd">⌘K</kbd>
          </button>

          <div className="cc-seg" role="group" aria-label="View mode">
            <button
              type="button"
              aria-pressed={stageMode === 'map'}
              onClick={() => {
                setStageMode('map');
                setMobileTab('map');
              }}
            >
              <MapIcon size={14} aria-hidden="true" />
              <span>{ui.mapView}</span>
            </button>
            <button
              type="button"
              aria-pressed={stageMode === 'graph'}
              onClick={() => {
                setStageMode('graph');
                setMobileTab('graph');
              }}
              data-testid="cc-graph-toggle"
            >
              <Share2 size={14} aria-hidden="true" />
              <span>{ui.graphView}</span>
            </button>
          </div>

          <button
            type="button"
            className="s-btn s-btn-primary s-btn-sm"
            style={{ minHeight: 36 }}
            onClick={() => setTourIndex(0)}
            data-testid="cc-tour-start"
          >
            <Sparkles size={14} aria-hidden="true" />
            <span>{ui.tourStart}</span>
          </button>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <EvidenceBadge locale={locale} evidenceId={scenario.evidenceId} statusOverride="simulated" labelOverride={ui.simBadge} />
            <button
              type="button"
              className="cc-cmd-btn"
              onClick={exportReport}
              title={ui.exportReport}
              aria-label={ui.exportReport}
            >
              <Download size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cc-cmd-btn"
              onClick={() => helpDialogRef.current?.showModal()}
              aria-label={ui.shortcutsTitle}
              title={ui.shortcutsTitle}
              data-testid="cc-shortcuts-btn"
            >
              <HelpCircle size={14} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mobile Segmented Tabs (< 768px) */}
        <div className="cc-mobile-tabs" role="tablist" aria-label="Control center panels">
          {(
            [
              ['map', ui.mapView],
              ['queue', ui.queueTitle.split(' ')[0]],
              ['inspector', ui.inspectorTitle],
              ['graph', ui.graphView]
            ] as Array<[MobileTab, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mobileTab === id}
              onClick={() => {
                setMobileTab(id);
                if (id === 'map') setStageMode('map');
                if (id === 'graph') setStageMode('graph');
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 3-Column Operational Body */}
        <div className="cc-body">
          {/* LEFT PANEL: Layers & Priority Event Queue */}
          <aside
            className={`cc-panel cc-panel-left ${activeTourStep?.target === 'left' ? 'cc-tour-ring' : ''}`}
            data-mobile-hidden={mobileTab !== 'queue'}
            aria-label={ui.layersTitle}
          >
            <div className="cc-panel-head">
              <span>{ui.layersTitle}</span>
              <span className="s-mono s-num">7</span>
            </div>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--s-line)' }}>
              {(Object.keys(LAYER_META) as LayerId[]).map((layerId) => {
                const count = scenario.entities.filter((e) => e.layer === layerId).length;
                return (
                  <label key={layerId} className="cc-layer-item">
                    <span className="s-row" style={{ gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={layers[layerId]}
                        onChange={(e) => setLayers((prev) => ({ ...prev, [layerId]: e.target.checked }))}
                      />
                      <span>{LAYER_META[layerId].label[locale]}</span>
                    </span>
                    <span className="s-micro s-faint s-num">{count}</span>
                  </label>
                );
              })}

              {/* Real snapshot loader status */}
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--s-line)', fontSize: 11.5, color: 'var(--s-text-3)' }}>
                {snapshotState === 'loading' && (
                  <span className="s-row" style={{ gap: 6 }}>
                    <Loader2 size={12} aria-hidden="true" />
                    <span>{ui.loadingSnap}</span>
                  </span>
                )}
                {snapshotState === 'ready' && (
                  <span className="s-row" style={{ gap: 6, color: 'var(--s-obs)' }}>
                    <CheckCircle2 size={12} aria-hidden="true" />
                    <span>GDACS · DGT · NDW · USGS ({snapshotPoints.length})</span>
                  </span>
                )}
                {snapshotState === 'error' && (
                  <span className="s-row" style={{ gap: 6 }}>
                    <AlertCircle size={12} aria-hidden="true" />
                    <span>{ui.errorSnap}</span>
                  </span>
                )}
              </div>
            </div>

            <div className="cc-panel-head">
              <span>{ui.queueTitle}</span>
              <span className="s-mono s-num">{queueItems.length}</span>
            </div>

            <div style={{ padding: '8px 12px 4px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <input
                type="search"
                className="s-input"
                style={{ minHeight: 34, fontSize: 13 }}
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder={ui.cmdLabel}
                aria-label={ui.queueTitle}
              />
              <div className="s-row" style={{ gap: 4 }}>
                {(['all', 'critical', 'high', 'medium'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className="s-chip"
                    style={{ minHeight: 28, padding: '0 9px', fontSize: 11.5 }}
                    aria-pressed={queueFilter === p}
                    onClick={() => setQueueFilter(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="cc-scroll" role="listbox" aria-label={ui.queueTitle}>
              {queueItems.length === 0 ? (
                <div className="s-small s-faint" style={{ padding: 16, textAlign: 'center' }}>
                  {ui.emptyQueue}
                </div>
              ) : (
                queueItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="option"
                    aria-selected={selectedEntity.id === item.id}
                    className="cc-queue-item"
                    onClick={() => {
                      setSelectedId(item.id);
                      setMobileTab('inspector');
                    }}
                  >
                    <div className="s-between">
                      <span className="s-row" style={{ gap: 7 }}>
                        <span className="cc-prio-dot" data-prio={item.priority} />
                        <strong style={{ fontSize: 13 }}>{item.title[locale]}</strong>
                      </span>
                      <span className="s-mono s-faint s-num" style={{ fontSize: 11 }}>
                        T+{String(item.timeOffsetMin).padStart(2, '0')}m
                      </span>
                    </div>
                    <span className="s-micro s-muted" style={{ lineHeight: 1.4 }}>
                      {item.summary[locale]}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* CENTER STAGE: Map or Correlation Graph */}
          <section
            className={`cc-stage ${
              activeTourStep?.target === 'map' || activeTourStep?.target === 'graph' ? 'cc-tour-ring' : ''
            }`}
            data-mobile-hidden={mobileTab !== 'map' && mobileTab !== 'graph'}
            aria-label={stageMode === 'map' ? ui.mapView : ui.graphView}
          >
            {activeTourStep && (
              <div className="cc-tour-card" role="dialog" aria-label={activeTourStep.title[locale]} data-testid="cc-tour-card">
                <div className="s-between" style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 14, color: 'var(--s-accent)' }}>
                    {activeTourStep.title[locale]}
                  </strong>
                  <button
                    type="button"
                    className="s-icon-btn"
                    style={{ width: 32, height: 32 }}
                    onClick={() => setTourIndex(null)}
                    aria-label={ui.tourExit}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
                <p className="s-small" style={{ margin: '0 0 12px', color: 'var(--s-text)' }}>
                  {activeTourStep.body[locale]}
                </p>
                <div className="s-between">
                  <button
                    type="button"
                    className="s-btn s-btn-secondary s-btn-sm"
                    disabled={tourIndex === 0}
                    onClick={() => setTourIndex((i) => (i !== null && i > 0 ? i - 1 : 0))}
                  >
                    {ui.tourPrev}
                  </button>
                  <button
                    type="button"
                    className="s-btn s-btn-primary s-btn-sm"
                    onClick={() =>
                      setTourIndex((i) =>
                        i !== null && i + 1 < GUIDED_TOUR_STEPS.length ? i + 1 : null
                      )
                    }
                  >
                    {tourIndex !== null && tourIndex + 1 < GUIDED_TOUR_STEPS.length ? ui.tourNext : ui.tourExit}
                  </button>
                </div>
              </div>
            )}

            {stageMode === 'map' ? (
              <TacticalMap
                locale={locale}
                scenario={scenario}
                layers={layers}
                selectedId={selectedEntity.id}
                onSelect={(id) => setSelectedId(id)}
                currentMinute={currentMinute}
                zoneDeclared={zoneDeclared}
                relayActive={relayActive}
                snapshotPoints={snapshotPoints}
              />
            ) : (
              <CorrelationGraph
                locale={locale}
                scenario={scenario}
                selectedId={selectedEntity.id}
                onSelect={(id) => setSelectedId(id)}
              />
            )}
          </section>

          {/* RIGHT PANEL: Object Inspector + Two-Step Simulated Controls + Audit Log */}
          <aside
            className={`cc-panel cc-panel-right ${activeTourStep?.target === 'inspector' ? 'cc-tour-ring' : ''}`}
            data-mobile-hidden={mobileTab !== 'inspector'}
            aria-label={ui.inspectorTitle}
          >
            <div className="cc-panel-head">
              <span>{ui.inspectorTitle}</span>
              <code className="s-mono">{selectedEntity.id}</code>
            </div>

            <div className="cc-scroll s-stack">
              <div>
                <div className="s-between" style={{ marginBottom: 8 }}>
                  <span className="s-pill">{selectedEntity.kind.toUpperCase()}</span>
                  <EvidenceBadge locale={locale} evidenceId={selectedEntity.evidenceId} statusOverride={selectedEntity.status} />
                </div>
                <h2 style={{ fontSize: 18, margin: '6px 0 6px', letterSpacing: '-0.02em' }}>
                  {selectedEntity.title[locale]}
                </h2>
                <p className="s-small s-muted" style={{ margin: 0 }}>
                  {selectedEntity.summary[locale]}
                </p>
              </div>

              {/* Coordinates & Telemetry */}
              <div className="s-card" style={{ padding: 12 }}>
                <dl className="s-dl" style={{ gridTemplateColumns: '110px 1fr', fontSize: 12.5, gap: '6px 10px' }}>
                  <dt>Lat / Lon</dt>
                  <dd className="s-mono s-num">
                    {selectedEntity.lat.toFixed(3)}, {selectedEntity.lon.toFixed(3)}
                  </dd>
                  <dt>Source</dt>
                  <dd className="s-mono">{selectedEntity.sourceTag}</dd>
                  {selectedEntity.metrics.map((m) => (
                    <div key={m.label.en} style={{ display: 'contents' }}>
                      <dt>{m.label[locale]}</dt>
                      <dd className="s-num" style={{ fontWeight: 600 }}>{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Mini Relationship Graph */}
              <div>
                <div className="s-micro s-faint" style={{ fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
                  {ui.relationsTitle}
                </div>
                <div className="s-stack" style={{ gap: 6 }}>
                  {relatedLinks.map((lnk) => {
                    const otherId = lnk.fromId === selectedEntity.id ? lnk.toId : lnk.fromId;
                    const other = scenario.entities.find((e) => e.id === otherId);
                    if (!other) return null;
                    return (
                      <button
                        key={`${lnk.fromId}-${lnk.toId}`}
                        type="button"
                        className="cc-queue-item"
                        style={{ marginBottom: 0, padding: '8px 10px' }}
                        onClick={() => setSelectedId(other.id)}
                      >
                        <span className="s-micro" style={{ color: 'var(--s-accent)', fontWeight: 600 }}>
                          {lnk.relation[locale]}
                        </span>
                        <span className="s-small" style={{ fontWeight: 500 }}>
                          {other.title[locale]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Simulated Control Actions (Two-Step Confirmation) */}
              <div className="cc-action-box">
                <div className="s-between">
                  <strong style={{ fontSize: 12.5 }}>{ui.controlsTitle}</strong>
                  <span className="s-badge" data-status="simulated" style={{ minHeight: 22, fontSize: 11 }}>
                    SIMULACIÓN
                  </span>
                </div>
                <p className="s-micro s-faint" style={{ margin: 0 }}>
                  {ui.controlsDisclaimer}
                </p>

                <button
                  type="button"
                  className="s-btn s-btn-secondary s-btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  disabled={zoneDeclared}
                  onClick={() => setPendingAction('declare-zone')}
                  data-testid="cc-act-zone"
                >
                  <ShieldAlert size={15} aria-hidden="true" />
                  <span>{zoneDeclared ? `✓ ${ui.actZone}` : ui.actZone}</span>
                </button>

                <button
                  type="button"
                  className="s-btn s-btn-secondary s-btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  disabled={relayActive}
                  onClick={() => setPendingAction('activate-relay')}
                  data-testid="cc-act-relay"
                >
                  <Radio size={15} aria-hidden="true" />
                  <span>{relayActive ? `✓ ${ui.actRelay}` : ui.actRelay}</span>
                </button>

                <button
                  type="button"
                  className="s-btn s-btn-secondary s-btn-sm"
                  style={{ width: '100%', justifyContent: 'flex-start' }}
                  disabled={teamAssigned}
                  onClick={() => setPendingAction('assign-team')}
                  data-testid="cc-act-team"
                >
                  <Users size={15} aria-hidden="true" />
                  <span>{teamAssigned ? `✓ ${ui.actTeam}` : ui.actTeam}</span>
                </button>

                {pendingAction && (
                  <div
                    role="alertdialog"
                    aria-label={ui.confirmPrompt}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      background: 'var(--s-bg-elev)',
                      border: '1px solid var(--s-accent)'
                    }}
                    data-testid="cc-confirm-box"
                  >
                    <p className="s-micro" style={{ margin: '0 0 8px', color: 'var(--s-text)' }}>
                      {ui.confirmPrompt}
                    </p>
                    <div className="s-row">
                      <button
                        type="button"
                        className="s-btn s-btn-primary s-btn-sm"
                        onClick={confirmSimulatedAction}
                        data-testid="cc-confirm-yes"
                      >
                        {ui.confirmBtn}
                      </button>
                      <button
                        type="button"
                        className="s-btn s-btn-secondary s-btn-sm"
                        onClick={() => setPendingAction(null)}
                      >
                        {ui.cancelBtn}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Visible Audit Log */}
              <div>
                <div className="s-row s-micro s-faint" style={{ fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>
                  <History size={13} aria-hidden="true" />
                  <span>{ui.auditTitle}</span>
                </div>
                <ul className="cc-audit-log" data-testid="cc-audit-log">
                  {auditLog.map((entry) => (
                    <li key={entry.id}>
                      <div className="s-between">
                        <strong style={{ color: 'var(--s-text)' }}>{entry.action}</strong>
                        <span className="s-mono s-faint s-num">{entry.at}</span>
                      </div>
                      <span className="s-mono s-faint">{entry.target}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>

        {/* Bottom Timeline Scrubber */}
        <div className={`cc-timeline ${activeTourStep?.target === 'timeline' ? 'cc-tour-ring' : ''}`}>
          <div className="s-row" style={{ gap: 6 }}>
            <button
              type="button"
              className="cc-cmd-btn"
              aria-label="Step back"
              onClick={() => setCurrentMinute((m) => Math.max(0, m - 5))}
            >
              <SkipBack size={14} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="s-btn s-btn-primary s-btn-sm"
              style={{ minHeight: 36 }}
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? 'Pause timeline' : 'Play timeline'}
              data-testid="cc-play-btn"
            >
              {playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
              <span className="s-mono s-num">T+{String(currentMinute).padStart(2, '0')}m</span>
            </button>
            <button
              type="button"
              className="cc-cmd-btn"
              aria-label="Step forward"
              onClick={() => setCurrentMinute((m) => Math.min(90, m + 5))}
            >
              <SkipForward size={14} aria-hidden="true" />
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={90}
            value={currentMinute}
            onChange={(e) => setCurrentMinute(Number(e.target.value))}
            className="cc-scrubber"
            aria-label="Scenario timeline minutes"
            data-testid="cc-timeline-slider"
          />

          <div className="s-row s-small s-num" style={{ gap: 14 }}>
            <span>
              <strong style={{ color: currentMinute >= scenario.sendaEtaMin ? 'var(--s-ok)' : 'var(--s-accent)' }}>
                SENDA: ~{scenario.sendaEtaMin}m
              </strong>
            </span>
            <span className="s-faint">
              {ui.baselineCompare}: {scenario.baselineEtaMin}m
            </span>
          </div>
        </div>

        {/* ⌘K Command Palette Modal (<dialog closedby="any">) */}
        <dialog
          ref={cmdDialogRef}
          className="s-dialog"
          aria-label="Command palette"
          {...({ closedby: 'any' } as Record<string, string>)}
          data-testid="cc-cmd-dialog"
        >
          <div className="s-sheet" style={{ padding: 18 }}>
            <div className="s-row" style={{ marginBottom: 12 }}>
              <Search size={16} aria-hidden="true" style={{ color: 'var(--s-text-3)' }} />
              <input
                type="search"
                className="s-input"
                style={{ border: 0, background: 'transparent', padding: '0 4px', minHeight: 36 }}
                value={cmdQuery}
                onChange={(e) => setCmdQuery(e.target.value)}
                placeholder={ui.cmdLabel}
                autoFocus
              />
              <button
                type="button"
                className="s-icon-btn"
                style={{ width: 34, height: 34 }}
                onClick={() => cmdDialogRef.current?.close()}
                aria-label="Close command palette"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {commands.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="cc-queue-item"
                  style={{ marginBottom: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  onClick={() => {
                    c.run();
                    cmdDialogRef.current?.close();
                    setCmdQuery('');
                  }}
                >
                  <span className="s-small" style={{ fontWeight: 500 }}>{c.label}</span>
                  <span className="s-micro s-faint">{c.group}</span>
                </button>
              ))}
            </div>
          </div>
        </dialog>

        {/* ? Keyboard Shortcuts Modal (<dialog closedby="any">) */}
        <dialog
          ref={helpDialogRef}
          className="s-dialog"
          aria-label={ui.shortcutsTitle}
          {...({ closedby: 'any' } as Record<string, string>)}
        >
          <div className="s-sheet">
            <div className="s-sheet-head">
              <h2 style={{ margin: 0 }}>{ui.shortcutsTitle}</h2>
              <button
                type="button"
                className="s-icon-btn"
                onClick={() => helpDialogRef.current?.close()}
                aria-label="Close"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <dl className="s-dl">
              <dt><kbd className="cc-kbd">⌘K</kbd> / <kbd className="cc-kbd">Ctrl+K</kbd></dt>
              <dd>{ui.cmdLabel}</dd>
              <dt><kbd className="cc-kbd">Space</kbd></dt>
              <dd>Play / Pause timeline</dd>
              <dt><kbd className="cc-kbd">J</kbd> / <kbd className="cc-kbd">K</kbd></dt>
              <dd>Next / previous event in queue</dd>
              <dt><kbd className="cc-kbd">G</kbd></dt>
              <dd>{ui.mapView} / {ui.graphView}</dd>
              <dt><kbd className="cc-kbd">T</kbd></dt>
              <dd>{ui.tourStart}</dd>
              <dt><kbd className="cc-kbd">?</kbd></dt>
              <dd>{ui.shortcutsTitle}</dd>
              <dt><kbd className="cc-kbd">Esc</kbd></dt>
              <dd>Close dialog</dd>
            </dl>
          </div>
        </dialog>
      </div>
    </PageShell>
  );
}
