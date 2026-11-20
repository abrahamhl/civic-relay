'use client';

import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import type { Locale } from '../data/types';

interface ChapterLink {
  id: string;
  num: string;
  label: Record<Locale, string>;
}

const CHAPTERS: ChapterLink[] = [
  { id: 'hero-cinema', num: '01', label: { es: 'Cinema', en: 'Cinema', nl: 'Cinema' } },
  { id: 'construccion-viva', num: '02', label: { es: 'Blueprint', en: 'Blueprint', nl: 'Blueprint' } },
  { id: 'simulador-vivo', num: '03', label: { es: 'Simulador', en: 'Simulator', nl: 'Simulator' } },
  { id: 'innovacion', num: '04', label: { es: 'Innovación', en: 'Innovation', nl: 'Innovatie' } },
  { id: 'simuladores-3d', num: '05', label: { es: '3D / Renders', en: '3D / Renders', nl: '3D / Renders' } },
  { id: 'mission-3d', num: '06', label: { es: 'Globo 3D', en: '3D Globe', nl: '3D Globe' } },
  { id: 'osint-cctv', num: '07', label: { es: 'OSINT CCTV', en: 'OSINT CCTV', nl: 'OSINT CCTV' } },
  { id: 'ojo-satelites', num: '08', label: { es: 'Satélites', en: 'Satellites', nl: 'Satellieten' } },
  { id: 'labs', num: '09', label: { es: '7 Labs', en: '7 Labs', nl: '7 Labs' } },
  { id: 'all-capabilities', num: '10', label: { es: '38 Módulos', en: '38 Modules', nl: '38 Modules' } }
];

export default function LivingScrollDock({ locale }: { locale: Locale }) {
  const [pct, setPct] = useState(0);
  const [activeId, setActiveId] = useState('hero-cinema');

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      setPct(Math.min(100, Math.max(0, Math.round((window.scrollY / max) * 100))));

      let current = CHAPTERS[0].id;
      for (const ch of CHAPTERS) {
        const el = document.getElementById(ch.id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= window.innerHeight * 0.42) current = ch.id;
        }
      }
      setActiveId(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className="s-living-dock"
      aria-label={locale === 'es' ? 'Navegación viva del simulador' : locale === 'nl' ? 'Live simulatornavigatie' : 'Live simulator navigation'}
      data-testid="living-scroll-dock"
    >
      <span className="s-living-pct s-mono" aria-hidden="true">{pct}%</span>
      <div className="s-living-track">
        {CHAPTERS.map((ch) => (
          <button
            key={ch.id}
            type="button"
            className={`s-living-pill${activeId === ch.id ? ' is-active' : ''}`}
            onClick={() => jump(ch.id)}
          >
            <span className="s-mono" style={{ opacity: 0.65 }}>{ch.num}</span>
            <span>{ch.label[locale]}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="s-living-top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label={locale === 'es' ? 'Subir al inicio' : locale === 'nl' ? 'Naar boven' : 'Back to top'}
      >
        <ArrowUp size={15} aria-hidden="true" />
      </button>
    </nav>
  );
}
