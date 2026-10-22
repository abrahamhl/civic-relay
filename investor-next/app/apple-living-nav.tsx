"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "./copy";

interface LivingChapter {
  id: string;
  shortCode: string;
  label: Record<Locale, string>;
  contextHint: Record<Locale, string>;
  accent: string;
}

const CHAPTERS: LivingChapter[] = [
  {
    id: "hero-30s",
    shortCode: "01",
    label: { es: "Tesis 30s", en: "30s Thesis", nl: "30s-These" },
    contextHint: {
      es: "Observar · Decidir · Coordinar",
      en: "Observe · Decide · Coordinate",
      nl: "Observeren · Beslissen · Coördineren",
    },
    accent: "#ff7756",
  },
  {
    id: "hyperframes-cinema",
    shortCode: "02",
    label: { es: "Keynote Film", en: "Keynote Film", nl: "Keynote Film" },
    contextHint: {
      es: "HyperFrames 1920×1080 · 5 Actos",
      en: "HyperFrames 1920×1080 · 5 Acts",
      nl: "HyperFrames 1920×1080 · 5 Akten",
    },
    accent: "#91d7e8",
  },
  {
    id: "globe-mission-control",
    shortCode: "03",
    label: { es: "Globo 3D", en: "3D Globe", nl: "3D-Bol" },
    contextHint: {
      es: "Telemetría Orbital ES · NL",
      en: "Orbital Telemetry ES · NL",
      nl: "Orbitale Telemetrie ES · NL",
    },
    accent: "#ff7756",
  },
  {
    id: "sector-intelligence-console",
    shortCode: "04",
    label: { es: "Sector CCTV", en: "Sector CCTV", nl: "Sector-CCTV" },
    contextHint: {
      es: "Cámaras DGT / RWS + Cono FOV",
      en: "DGT / RWS Cameras + FOV Cone",
      nl: "DGT / RWS Camera's + FOV-kegel",
    },
    accent: "#91d7e8",
  },
  {
    id: "how-it-works",
    shortCode: "05",
    label: { es: "8 Escenas OEP", en: "8 OEP Scenes", nl: "8 OEP-Scènes" },
    contextHint: {
      es: "Secuencia viva fin a fin",
      en: "End-to-end live sequence",
      nl: "End-to-end live sequentie",
    },
    accent: "#34d399",
  },
  {
    id: "routing-lab",
    shortCode: "06",
    label: { es: "Lab & Fallos", en: "Routing Lab", nl: " Routeringslab" },
    contextHint: {
      es: "Multipath + Inyección de Fallos",
      en: "Multipath + Fault Injection",
      nl: "Multipath + Foutinjectie",
    },
    accent: "#fbbf24",
  },
  {
    id: "evidence",
    shortCode: "07",
    label: { es: "Evidencias", en: "Evidence", nl: "Bewijs" },
    contextHint: {
      es: "Real · Simulado · No-Claim",
      en: "Real · Simulated · No-Claim",
      nl: "Echt · Gesimuleerd · No-Claim",
    },
    accent: "#34d399",
  },
];

const DOCK_COPY = {
  es: {
    ariaLabel: "Navegación viva estilo Apple Keynote",
    liveTag: "NAVEGACIÓN VIVA",
    topLabel: "Subir",
  },
  en: {
    ariaLabel: "Apple Keynote Living Navigation Dock",
    liveTag: "LIVING NAV",
    topLabel: "Top",
  },
  nl: {
    ariaLabel: "Apple Keynote Levende Navigatiedock",
    liveTag: "LEVENDE NAV",
    topLabel: "Boven",
  },
} as const;

export function AppleLivingNav({ locale = "es" }: { locale?: Locale }) {
  const copy = DOCK_COPY[locale] ?? DOCK_COPY.es;
  const [activeId, setActiveId] = useState<string>("hero-30s");
  const [scrollPct, setScrollPct] = useState<number>(0);

  // Cached section offsets per frontend-abraham §7 (Single Cached-Offset Scroll Engine)
  const offsetsRef = useRef<Array<{ id: string; top: number }>>([]);
  const docHeightRef = useRef<number>(1);
  const tickingRef = useRef<boolean>(false);

  const measureOffsets = useCallback(() => {
    if (typeof window === "undefined") return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const measured: Array<{ id: string; top: number }> = [];
    for (const ch of CHAPTERS) {
      const el = document.getElementById(ch.id);
      if (el) {
        const rect = el.getBoundingClientRect();
        measured.push({ id: ch.id, top: rect.top + scrollY });
      }
    }
    offsetsRef.current = measured;
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    docHeightRef.current = maxScroll;
  }, []);

  const updateOnScroll = useCallback(() => {
    tickingRef.current = false;
    if (typeof window === "undefined") return;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight
    );
    const pct = Math.max(0, Math.min(100, Math.round((scrollY / maxScroll) * 100)));
    setScrollPct(pct);

    const probeY = scrollY + window.innerHeight * 0.34;
    let current = CHAPTERS[0].id;
    for (const item of offsetsRef.current) {
      if (probeY >= item.top - 80) {
        current = item.id;
      }
    }
    setActiveId(current);
  }, []);

  useEffect(() => {
    measureOffsets();
    updateOnScroll();

    const onScroll = () => {
      if (!tickingRef.current) {
        tickingRef.current = true;
        window.requestAnimationFrame(updateOnScroll);
      }
    };

    const onResize = () => {
      measureOffsets();
      updateOnScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });
    const delayedMeasure = window.setTimeout(() => {
      measureOffsets();
      updateOnScroll();
    }, 650);

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(delayedMeasure);
    };
  }, [measureOffsets, updateOnScroll]);

  const jumpToChapter = (id: string) => {
    measureOffsets();
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const activeChapter =
    CHAPTERS.find((c) => c.id === activeId) ?? CHAPTERS[0];

  const radius = 12;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (scrollPct / 100) * circumference;

  return (
    <aside
      className="apple-living-nav-wrap"
      data-testid="apple-living-nav"
      aria-label={copy.ariaLabel}
    >
      <div className="apple-living-dock">
        {/* Dynamic Island Status Pod */}
        <div className="apple-living-status" data-testid="apple-living-status">
          <div className="apple-progress-ring-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle
                cx="16"
                cy="16"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="2.5"
              />
              <circle
                cx="16"
                cy="16"
                r={radius}
                fill="none"
                stroke={activeChapter.accent}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 16 16)"
              />
            </svg>
            <span className="apple-progress-pct">{scrollPct}%</span>
          </div>
          <div className="apple-living-context">
            <span className="apple-living-kicker">
              <span
                className="apple-living-pulse"
                style={{ background: activeChapter.accent }}
              />
              {copy.liveTag} · {activeChapter.shortCode}
            </span>
            <strong className="apple-living-active-title">
              {activeChapter.contextHint[locale]}
            </strong>
          </div>
        </div>

        {/* Chapter Pill Strip */}
        <div className="apple-living-pills" role="navigation">
          {CHAPTERS.map((ch) => {
            const isActive = ch.id === activeId;
            return (
              <button
                key={ch.id}
                type="button"
                data-testid={`living-nav-pill-${ch.id}`}
                className={`apple-living-pill ${isActive ? "is-active" : ""}`}
                onClick={() => jumpToChapter(ch.id)}
                aria-current={isActive ? "location" : undefined}
              >
                <span
                  className="apple-pill-index"
                  style={{ color: isActive ? ch.accent : undefined }}
                >
                  {ch.shortCode}
                </span>
                <span className="apple-pill-text">{ch.label[locale]}</span>
              </button>
            );
          })}
        </div>

        {/* Quick Top Action */}
        <button
          type="button"
          className="apple-living-top-btn"
          data-testid="living-nav-top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title={copy.topLabel}
        >
          ↑ {copy.topLabel}
        </button>
      </div>
    </aside>
  );
}
