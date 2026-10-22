"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "./copy";

interface ActDefinition {
  id: number;
  code: string;
  startSec: number;
  endSec: number;
  jumpSec: number;
  seamBadge: string;
  accent: string;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  metric: string;
}

const HYPERFRAMES_DURATION = 25;

const ACTS: ActDefinition[] = [
  {
    id: 1,
    code: "ACT 01 · 00.0s–05.0s",
    startSec: 0,
    endSec: 5,
    jumpSec: 0.6,
    seamBadge: "WATERFALL + ORBITAL PULSE",
    accent: "#ff7756",
    title: {
      es: "Fallo de Red Convencional",
      en: "Conventional Network Collapse",
      nl: "Uitval van Conventioneel Netwerk",
    },
    subtitle: {
      es: "Colapso de torres 4G/5G y reintentos ciegos que pierden el contexto del incidente.",
      en: "4G/5G tower saturation and blind retries that drop incident context.",
      nl: "4G/5G-mastverzadiging en blinde herhaalpogingen die incidentcontext verliezen.",
    },
    metric: "CAÍDA 4G/5G · 0% ACK",
  },
  {
    id: 2,
    code: "ACT 02 · 05.0s–10.0s",
    startSec: 5,
    endSec: 10,
    jumpSec: 5.4,
    seamBadge: "CUT-THE-CURVE · LEFT 230px",
    accent: "#91d7e8",
    title: {
      es: "Observación Sectorial CCTV",
      en: "Sectoral CCTV Observation",
      nl: "Sectorale CCTV-observatie",
    },
    subtitle: {
      es: "Geometría proyectiva haversiana y cono FOV sobre flujos públicos autorizados (DGT / RWS).",
      en: "Projective haversine geometry and FOV cone over authorized public feeds (DGT / RWS).",
      nl: "Projectieve haversine-geometrie en FOV-kegel over geautoriseerde publieke feeds.",
    },
    metric: "DGT / RWS · CONO FOV",
  },
  {
    id: 3,
    code: "ACT 03 · 10.0s–15.0s",
    startSec: 10,
    endSec: 15,
    jumpSec: 10.4,
    seamBadge: "CUT-THE-CURVE · LEFT 230px",
    accent: "#ff7756",
    title: {
      es: "Cola Store-and-Forward",
      en: "Store-and-Forward Queue",
      nl: "Store-and-Forward-wachtrij",
    },
    subtitle: {
      es: "Sellado en el borde con prioridad P0, TTL explícito y firma criptográfica Ed25519.",
      en: "Edge-sealed envelope with P0 priority, explicit TTL, and Ed25519 signature.",
      nl: "Edge-verzegelde envelop met P0-prioriteit, expliciete TTL en Ed25519-handtekening.",
    },
    metric: "P0 · TTL 1800s · ED25519",
  },
  {
    id: 4,
    code: "ACT 04 · 15.0s–20.0s",
    startSec: 15,
    endSec: 20,
    jumpSec: 15.4,
    seamBadge: "CUT-THE-CURVE · LEFT 230px",
    accent: "#91d7e8",
    title: {
      es: "Enrutamiento Multipath + Dedup",
      en: "Multipath Routing + Dedup",
      nl: "Multipath-routering + Dedup",
    },
    subtitle: {
      es: "Salto oportunista BLE / Wi-Fi / LoRa / Satélite con deduplicación SHA-256.",
      en: "Opportunistic BLE / Wi-Fi / LoRa / Satellite relay with SHA-256 deduplication.",
      nl: "Opportunistische BLE / Wi-Fi / LoRa / Satelliet-relay met SHA-256-deduplicatie.",
    },
    metric: "3 VÍAS → 1 CANÓNICO",
  },
  {
    id: 5,
    code: "ACT 05 · 20.0s–25.0s",
    startSec: 20,
    endSec: 25,
    jumpSec: 20.4,
    seamBadge: "INVERSE ZOOM-THROUGH 1.22→1.0",
    accent: "#34d399",
    title: {
      es: "ACK Explícito y Matriz de Verdad",
      en: "Explicit ACK & Truth Matrix",
      nl: "Expliciete ACK & Waarheidsmatrix",
    },
    subtitle: {
      es: "Confirmación criptográfica de extremo a extremo y separación Real / Simulado / No-Claim.",
      en: "End-to-end cryptographic receipt and strict Real / Simulated / No-Claim separation.",
      nl: "End-to-end cryptografische bevestiging en strikte Echte / Gesimuleerde / No-Claim scheiding.",
    },
    metric: "84/84 TESTS · 10/10 E2E",
  },
];

const COPY = {
  es: {
    eyebrow: "HYPERFRAMES DETERMINISTIC HTML VIDEO · APPLE KEYNOTE CINEMA",
    title: "Película técnica interactiva en 5 actos (1920×1080 · 60fps)",
    lead: "Composición HTML animada generada con la doctrina HyperFrames (cut-the-curve, igualación de velocidad en el corte y zoom inverso). Recorre el ciclo completo Observar → Decidir → Coordinar o salta a cualquier acto con precisión de milisegundos.",
    play: "Reproducir",
    pause: "Pausar",
    restart: "Reiniciar 0.0s",
    openRaw: "Abrir lienzo 1920×1080",
    seamLabel: "Costura vectorial activa",
    timecodeLabel: "Código de tiempo GSAP",
    engineBadge: "window.__timelines['main'] · Determinista",
  },
  en: {
    eyebrow: "HYPERFRAMES DETERMINISTIC HTML VIDEO · APPLE KEYNOTE CINEMA",
    title: "Interactive 5-Act Technical Keynote Film (1920×1080 · 60fps)",
    lead: "Deterministic animated HTML composition authored with HyperFrames motion doctrine (cut-the-curve, velocity-matched seams, and inverse zoom-through). Scrub the full Observe → Decide → Coordinate cycle or jump to any act with millisecond precision.",
    play: "Play",
    pause: "Pause",
    restart: "Restart 0.0s",
    openRaw: "Open 1920×1080 canvas",
    seamLabel: "Active vector seam",
    timecodeLabel: "GSAP Timecode",
    engineBadge: "window.__timelines['main'] · Deterministic",
  },
  nl: {
    eyebrow: "HYPERFRAMES DETERMINISTISCHE HTML-VIDEO · APPLE KEYNOTE CINEMA",
    title: "Interactieve technische film in 5 akten (1920×1080 · 60fps)",
    lead: "Deterministische geanimeerde HTML-compositie gebouwd volgens de HyperFrames-bewegingsdoctrine (cut-the-curve, snelheidsgekoppelde overgangen en inverse zoom-through). Spoel door de volledige cyclus Observeren → Beslissen → Coördineren.",
    play: "Afspelen",
    pause: "Pauzeren",
    restart: "Herstart 0.0s",
    openRaw: "Open 1920×1080-canvas",
    seamLabel: "Actieve vectorovergang",
    timecodeLabel: "GSAP-tijdcode",
    engineBadge: "window.__timelines['main'] · Deterministisch",
  },
} as const;

export function HyperFramesCinemaDeck({ locale = "es" }: { locale?: Locale }) {
  const t = COPY[locale] ?? COPY.es;
  const stageMeasureRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Per frontend-abraham skill §2: Hero/Keynote video plays by default even when OS prefers-reduced-motion is enabled,
  // paired with an explicit visible Pause/Play button for user control.
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0.4);
  const [speed, setSpeed] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.55);

  const timeRef = useRef<number>(0.4);
  const lastFrameRef = useRef<number | null>(null);

  const syncIframeTime = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(HYPERFRAMES_DURATION, sec));
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const win = iframe.contentWindow as
        | (Window & {
            __civicRelayHyperFrames?: { seek: (timeSec: number) => void };
            __timelines?: Record<string, { seek: (timeSec: number, suppressEvents?: boolean) => void }>;
          })
        | null;
      if (win?.__civicRelayHyperFrames?.seek) {
        win.__civicRelayHyperFrames.seek(clamped);
        return;
      }
      if (win?.__timelines?.main?.seek) {
        win.__timelines.main.seek(clamped, false);
        return;
      }
      win?.postMessage({ type: "hyperframes:seek", time: clamped }, "*");
    } catch {
      // Fallback to postMessage if cross-context access is restricted
      iframe.contentWindow?.postMessage({ type: "hyperframes:seek", time: clamped }, "*");
    }
  }, []);

  // Measure responsive stage width once and via ResizeObserver to scale 1920x1080 cleanly
  useEffect(() => {
    const el = stageMeasureRef.current;
    if (!el) return;
    const updateScale = () => {
      const width = el.clientWidth || 1056;
      setScale(Math.max(0.18, Math.min(1, width / 1920)));
    };
    updateScale();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(updateScale);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  // Deterministic requestAnimationFrame playback loop driving the HyperFrames GSAP timeline
  useEffect(() => {
    if (!isPlaying) {
      lastFrameRef.current = null;
      return;
    }
    let rafId = 0;
    const tick = (now: number) => {
      if (lastFrameRef.current === null) {
        lastFrameRef.current = now;
      }
      const deltaSec = ((now - lastFrameRef.current) / 1000) * speed;
      lastFrameRef.current = now;

      let nextTime = timeRef.current + deltaSec;
      if (nextTime >= HYPERFRAMES_DURATION) {
        nextTime = nextTime % HYPERFRAMES_DURATION;
      }
      timeRef.current = nextTime;
      setCurrentTime(nextTime);
      syncIframeTime(nextTime);
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [isPlaying, speed, syncIframeTime]);

  const handleSeek = (nextSec: number) => {
    const clamped = Math.max(0, Math.min(HYPERFRAMES_DURATION, nextSec));
    timeRef.current = clamped;
    setCurrentTime(clamped);
    syncIframeTime(clamped);
  };

  const activeAct =
    ACTS.find((act) => currentTime >= act.startSec && currentTime < act.endSec) ??
    ACTS[ACTS.length - 1];

  return (
    <section
      id="hyperframes-cinema"
      data-testid="hyperframes-cinema-deck"
      className="hf-cinema-section"
      aria-label={t.title}
    >
      <div className="hf-cinema-header">
        <div>
          <span className="eyebrow">{t.eyebrow}</span>
          <h2 className="hf-cinema-title">{t.title}</h2>
          <p className="hf-cinema-lead">{t.lead}</p>
        </div>
        <div className="hf-cinema-meta-badges">
          <span className="hf-meta-pill">
            <span className="hf-live-dot" />
            {t.engineBadge}
          </span>
          <a
            href="/hyperframes/index.html"
            target="_blank"
            rel="noreferrer"
            className="hf-raw-link"
            data-testid="hf-open-raw"
          >
            {t.openRaw} ↗
          </a>
        </div>
      </div>

      {/* Apple Keynote Pro Display XDR Frame */}
      <div className="hf-display-shell">
        <div className="hf-display-topbar">
          <div className="hf-traffic-lights" aria-hidden="true">
            <span className="hf-dot hf-dot-coral" />
            <span className="hf-dot hf-dot-amber" />
            <span className="hf-dot hf-dot-emerald" />
          </div>
          <div className="hf-active-act-banner" data-testid="hf-active-act-banner">
            <span className="hf-act-badge" style={{ color: activeAct.accent }}>
              {activeAct.code}
            </span>
            <span className="hf-act-divider">·</span>
            <strong>{activeAct.title[locale]}</strong>
          </div>
          <div className="hf-seam-readout">
            <span className="hf-seam-label">{t.seamLabel}:</span>
            <code className="hf-seam-code">{activeAct.seamBadge}</code>
          </div>
        </div>

        {/* Responsive 16:9 Stage Wrapper scaling native 1920x1080 HyperFrames composition */}
        <div ref={stageMeasureRef} className="hf-stage-viewport">
          <div
            className="hf-stage-scaler"
            style={{
              width: 1920,
              height: 1080,
              transform: `scale(${scale.toFixed(4)})`,
              transformOrigin: "top left",
            }}
          >
            <iframe
              ref={iframeRef}
              src="/hyperframes/index.html"
              title={t.title}
              className="hf-stage-iframe"
              data-testid="hf-stage-iframe"
              onLoad={() => syncIframeTime(timeRef.current)}
            />
          </div>
        </div>

        {/* Apple Liquid-Glass Transport & Timeline Bar */}
        <div className="hf-transport-bar">
          <div className="hf-transport-controls">
            <button
              type="button"
              className="hf-play-btn"
              data-testid="hf-play-pause"
              onClick={() => setIsPlaying((prev) => !prev)}
              aria-pressed={isPlaying}
            >
              <span className="hf-play-icon" aria-hidden="true">
                {isPlaying ? "❚❚" : "▶"}
              </span>
              <span>{isPlaying ? t.pause : t.play}</span>
            </button>

            <button
              type="button"
              className="hf-secondary-btn"
              data-testid="hf-restart"
              onClick={() => handleSeek(0.2)}
            >
              ↺ {t.restart}
            </button>
          </div>

          <div className="hf-scrubber-wrap">
            <div className="hf-scrubber-labels">
              <span>{t.timecodeLabel}</span>
              <code data-testid="hf-timecode">
                {currentTime.toFixed(2)}s / {HYPERFRAMES_DURATION.toFixed(2)}s
              </code>
            </div>
            <input
              type="range"
              min={0}
              max={HYPERFRAMES_DURATION}
              step={0.05}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="hf-scrubber-input"
              data-testid="hf-scrubber"
              aria-label={t.timecodeLabel}
            />
            <div className="hf-scrubber-ticks" aria-hidden="true">
              {ACTS.map((act) => (
                <span key={act.id} className="hf-tick">
                  {act.startSec}s · Acto 0{act.id}
                </span>
              ))}
            </div>
          </div>

          <div className="hf-speed-group" role="group" aria-label="Speed">
            {[0.5, 1, 1.5].map((rate) => (
              <button
                key={rate}
                type="button"
                className={`hf-speed-btn ${speed === rate ? "is-active" : ""}`}
                onClick={() => setSpeed(rate)}
                data-testid={`hf-speed-${rate}`}
              >
                {rate}×
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5-Act Interactive Bento Strip */}
      <div className="hf-act-grid" role="tablist" aria-label="HyperFrames Acts">
        {ACTS.map((act) => {
          const isActive = activeAct.id === act.id;
          return (
            <button
              key={act.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`hf-act-${act.id}`}
              className={`hf-act-card ${isActive ? "is-active" : ""}`}
              onClick={() => {
                handleSeek(act.jumpSec);
              }}
            >
              <div className="hf-act-card-top">
                <span className="hf-act-index" style={{ color: act.accent }}>
                  0{act.id}
                </span>
                <span className="hf-act-metric">{act.metric}</span>
              </div>
              <strong className="hf-act-card-title">{act.title[locale]}</strong>
              <p className="hf-act-card-desc">{act.subtitle[locale]}</p>
              <div className="hf-act-card-seam">
                <span>{act.seamBadge}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
