'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, Layers, Search, Smartphone } from 'lucide-react';
import { ALL_CAPABILITIES, type CapCategory } from '../data/all-capabilities';
import MediaVideo from './MediaVideo';
import type { Locale } from '../data/types';

export default function FullCapabilityMatrix({ locale }: { locale: Locale }) {
  const [cat, setCat] = useState<'all' | CapCategory>('all');
  const [q, setQ] = useState('');

  const copy = {
    es: {
      eyebrow: 'LAS 38 FUNCIONALIDADES REALES DE SENDA · TODAS ENLAZADAS Y EN FUNCIONAMIENTO',
      title: 'Todo lo que SENDA ya hace hoy, clasificado y listo para abrir en un clic.',
      lead: 'Desde mensajería en modo avión, llamadas por sonido y batería de Internet hasta satélites Iridium/Galileo, drones, trenes, riadas, incendios 3D y sentidos ampliados.',
      search: 'Buscar función (ej. satélite, dron, DANA, tren, Wi-Fi, 112)...',
      cats: {
        all: `Todas (${ALL_CAPABILITIES.length})`,
        offline: 'Sin Red y Radio',
        'sat-osint': 'Satélites y OSINT',
        mobility: 'Trenes y Carretera',
        'hazard-rescue': 'Fuego, Riada y Rescate',
        'drone-science': 'Drones, Sentidos y 4D'
      },
      reelsEyebrow: 'REELS VERTICALES 9:16 ADAPTADOS PARA MÓVIL · AUDIO AUTO + SUBTÍTULOS ES/EN/NL',
      reelsTitle: 'Vídeos en formato móvil (9:16) y biblioteca audiovisual completa.',
      reelsLead: 'Todos los vídeos detectan automáticamente el idioma de tu navegador y permiten cambiar subtítulos en Español, Inglés y Neerlandés en 1 toque.'
    },
    en: {
      eyebrow: 'ALL 38 WORKING SENDA CAPABILITIES · LAUNCH DIRECTLY IN YOUR BROWSER',
      title: 'Everything SENDA already does today, organized cleanly in one matrix.',
      lead: 'From airplane-mode messaging, acoustic calls, and local Internet batteries to Iridium/Galileo satellites, drones, rail safety, floods, 3D wildfires, and extended senses.',
      search: 'Filter capability (e.g. satellite, drone, flood, rail, Wi-Fi, 112)...',
      cats: {
        all: `All (${ALL_CAPABILITIES.length})`,
        offline: 'Offline & Radio',
        'sat-osint': 'Satellites & OSINT',
        mobility: 'Rail & Roads',
        'hazard-rescue': 'Fire, Flood & Rescue',
        'drone-science': 'Drones, Senses & 4D'
      },
      reelsEyebrow: 'MOBILE-NATIVE 9:16 VERTICAL REELS · AUTO BROWSER LANGUAGE + ES/EN/NL SUBTITLES',
      reelsTitle: 'Vertical 9:16 mobile reels & complete cinema suite.',
      reelsLead: 'Every film auto-matches your browser language with one-tap Spanish, English, and Dutch subtitles.'
    },
    nl: {
      eyebrow: 'ALLE 38 WERKENDE SENDA-FUNCTIES · DIRECT TE OPENEN IN UW BROWSER',
      title: 'Alles wat SENDA vandaag al doet, overzichtelijk gecategoriseerd.',
      lead: 'Van offline berichten, bellen via geluid en lokale internetbatterijen tot Iridium/Galileo-satellieten, drones, spoor, overstromingen en 3D-branden.',
      search: 'Zoek functie (bijv. satelliet, drone, water, trein, Wi-Fi, 112)...',
      cats: {
        all: `Alle (${ALL_CAPABILITIES.length})`,
        offline: 'Offline & Radio',
        'sat-osint': 'Satellieten & OSINT',
        mobility: 'Spoor & Wegen',
        'hazard-rescue': 'Brand, Water & Redding',
        'drone-science': 'Drones, Zintuigen & 4D'
      },
      reelsEyebrow: '9:16 VERTICALE MOBIELE REELS · AUTOMATISCHE TAAL + ES/EN/NL ONDERTITELS',
      reelsTitle: 'Verticale 9:16 mobiele reels & volledige videobibliotheek.',
      reelsLead: 'Elke video herkent automatisch uw browsertaal en biedt ES-, EN- en NL-ondertitels.'
    }
  }[locale];

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ALL_CAPABILITIES.filter((item) => {
      if (cat !== 'all' && item.cat !== cat) return false;
      if (!query) return true;
      return (
        item.title[locale].toLowerCase().includes(query) ||
        item.desc[locale].toLowerCase().includes(query) ||
        item.href.toLowerCase().includes(query)
      );
    });
  }, [cat, locale, q]);

  return (
    <section className="s-section" data-testid="full-capability-matrix">
      <div className="s-container s-stack-lg">
        <div className="s-read">
          <p className="s-eyebrow">
            <Layers size={15} aria-hidden="true" />
            <span>{copy.eyebrow}</span>
          </p>
          <h2 className="s-h2">{copy.title}</h2>
          <p className="s-lead">{copy.lead}</p>
        </div>

        {/* Category filter + search */}
        <div className="s-between" style={{ gap: 14 }}>
          <div className="s-tabs-scroller" role="tablist" aria-label={copy.title} style={{ flex: '1 1 560px', borderBottom: 0 }}>
            {(['all', 'offline', 'sat-osint', 'mobility', 'hazard-rescue', 'drone-science'] as Array<'all' | CapCategory>).map((cKey) => (
              <button
                key={cKey}
                type="button"
                role="tab"
                aria-selected={cat === cKey}
                className="s-tab-btn"
                onClick={() => setCat(cKey)}
              >
                {copy.cats[cKey]}
              </button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: '0 1 300px', minWidth: 'min(260px, 100%)' }}>
            <Search
              size={15}
              aria-hidden="true"
              style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--s-text-3)', pointerEvents: 'none' }}
            />
            <input
              type="search"
              className="s-input"
              style={{ paddingLeft: 38, minHeight: 42 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
            />
          </div>
        </div>

        <div className="s-grid s-grid-3">
          {filtered.map((item) => {
            const isExt = item.href.startsWith('http');
            return (
              <a
                key={item.id}
                href={item.href}
                target={isExt ? '_blank' : undefined}
                rel={isExt ? 'noopener noreferrer' : undefined}
                className="s-card s-card-lift"
                style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 20 }}
              >
                <div className="s-between">
                  <strong style={{ fontSize: 15.5, color: 'var(--s-text)' }}>{item.title[locale]}</strong>
                  <ExternalLink size={14} style={{ color: 'var(--s-accent)', flex: 'none' }} aria-hidden="true" />
                </div>
                <p style={{ margin: 0, fontSize: 14, flex: 1 }}>{item.desc[locale]}</p>
                <code className="s-mono s-faint" style={{ fontSize: 11.5 }}>{isExt ? 'github.com/abrahamhl/civic-relay' : item.href}</code>
              </a>
            );
          })}
        </div>

        {/* Mobile-Optimized 9:16 Reels + Role Demos + Master Films */}
        <div className="s-stack-lg" style={{ marginTop: 40, paddingTop: 40, borderTop: '1px solid var(--s-line)' }}>
          <div className="s-read">
            <p className="s-eyebrow">
              <Smartphone size={15} aria-hidden="true" />
              <span>{copy.reelsEyebrow}</span>
            </p>
            <h2 className="s-h2">{copy.reelsTitle}</h2>
            <p className="s-lead">{copy.reelsLead}</p>
          </div>

          {/* 9:16 Vertical Mobile Reels */}
          <div className="s-reels-grid">
            <MediaVideo
              locale={locale}
              aspect="9/16"
              src="/media/m95/senda-m95-reel-blacksky-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-reel-blacksky-es.mp4',
                en: '/media/m95/senda-m95-reel-blacksky-en.mp4'
              }}
              poster="/media/m95/senda-m95-reel-blacksky-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-reel-blacksky-es.vtt',
                en: '/media/m95/senda-m95-reel-blacksky-en.vtt',
                nl: '/media/m95/senda-m95-reel-blacksky-nl.vtt'
              }}
              title={locale === 'es' ? 'Reel 9:16 · Apagón Black-Sky' : locale === 'nl' ? '9:16 Reel · Black-Sky Uitval' : '9:16 Reel · Black-Sky Grid Failure'}
              caption={locale === 'es' ? 'Formato vertical móvil: qué pasa cuando cae toda la red eléctrica y cómo SENDA sigue enrutando.' : locale === 'nl' ? 'Verticaal mobiel formaat: hoe SENDA blijft routeren bij totale stroomuitval.' : 'Vertical mobile reel: how SENDA routes through total power-grid blackouts.'}
              evidenceId="EV-S01-ROUTE"
            />
            <MediaVideo
              locale={locale}
              aspect="9/16"
              src="/media/m95/senda-m95-reel-math-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-reel-math-es.mp4',
                en: '/media/m95/senda-m95-reel-math-en.mp4'
              }}
              poster="/media/m95/senda-m95-reel-math-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-reel-math-es.vtt',
                en: '/media/m95/senda-m95-reel-math-en.vtt',
                nl: '/media/m95/senda-m95-reel-math-nl.vtt'
              }}
              title={locale === 'es' ? 'Reel 9:16 · Matemáticas que Salvan Vidas' : locale === 'nl' ? '9:16 Reel · Wiskunde die Levens Redt' : '9:16 Reel · Mathematics Saving Lives'}
              caption={locale === 'es' ? 'Atenuación por lluvia ITU-R P.838, difracción y códigos Reed-Solomon en simulación real.' : locale === 'nl' ? 'Regendemping ITU-R P.838, diffractie en Reed-Solomon in live simulatie.' : 'ITU-R P.838 rain attenuation, diffraction, and Reed-Solomon codes in live simulation.'}
              evidenceId="EV-CORE-506"
            />
          </div>

          {/* Widescreen Broadcast, Technical Film, Protective Route & Role Demos */}
          <div className="s-grid s-grid-2">
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-broadcast-special-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-broadcast-special-es.mp4',
                en: '/media/m95/senda-m95-broadcast-special-en.mp4'
              }}
              poster="/media/m95/senda-m95-broadcast-special-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-broadcast-special-es.vtt',
                en: '/media/m95/senda-m95-broadcast-special-en.vtt',
                nl: '/media/m95/senda-m95-broadcast-special-nl.vtt'
              }}
              title={locale === 'es' ? 'Especial Informativo 20:11 · DANA, Bejís y A-12' : locale === 'nl' ? 'Nieuwsspecial 20:11 · Valencia, Bejís & A-12' : '20:11 Broadcast Special · Valencia, Bejís & A-12'}
              caption={locale === 'es' ? 'Formato telediario bilingüe con subtítulos en Español, Inglés y Neerlandés.' : locale === 'nl' ? 'Tweetalige nieuwsspecial met ES-, EN- en NL-ondertitels.' : 'Bilingual broadcast news format with ES, EN, and NL subtitles.'}
              evidenceId="EV-FLOOD-DANA"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-film-es.mp4"
              sources={{
                es: '/media/senda-film-es.mp4',
                en: '/media/senda-film-en.mp4'
              }}
              posters={{
                es: '/media/senda-film-poster-es.jpg',
                en: '/media/senda-film-poster-en.jpg'
              }}
              subtitles={{
                es: '/media/senda-film-es.vtt',
                en: '/media/senda-film-en.vtt',
                nl: '/media/senda-film-nl.vtt'
              }}
              title={locale === 'es' ? 'Documental técnico SENDA · Del apagón al rescate' : locale === 'nl' ? 'Technische film SENDA · Van uitval tot redding' : 'SENDA Technical Film · From blackout to rescue'}
              caption={locale === 'es' ? 'Recorrido integral por mensajería sin red, incendios 3D y fusión de sensores.' : locale === 'nl' ? 'Volledige rondleiding door offline routering, 3D-branden en sensorfusie.' : 'Complete walkthrough of offline routing, 3D wildfire physics, and sensor fusion.'}
              evidenceId="EV-OFFLINE-49"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-ruta-es.mp4"
              sources={{
                es: '/media/senda-ruta-es.mp4',
                en: '/media/senda-ruta-en.mp4'
              }}
              posters={{
                es: '/media/senda-ruta-poster-es.jpg',
                en: '/media/senda-ruta-poster-en.jpg'
              }}
              subtitles={{
                es: '/media/senda-ruta-es.vtt',
                en: '/media/senda-ruta-en.vtt',
                nl: '/media/senda-ruta-nl.vtt'
              }}
              title={locale === 'es' ? 'En la carretera · Ruta protectora, DGT y Países Bajos' : locale === 'nl' ? 'Op de weg · Beschermende route, NDW & DGT' : 'On the Road · Protective route, DGT & Netherlands'}
              caption={locale === 'es' ? 'Modelos físicos de tráfico, visibilidad Koschmieder y coordinación DATEX II.' : locale === 'nl' ? 'Fysieke verkeersmodellen, zichtbaarheid en DATEX II-coördinatie.' : 'Physical traffic models, Koschmieder visibility, and DATEX II coordination.'}
              evidenceId="EV-CONSOLE-16K"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-role-citizen-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-role-citizen-es.mp4',
                en: '/media/m95/senda-m95-role-citizen-en.mp4'
              }}
              poster="/media/m95/senda-m95-role-citizen-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-role-citizen-es.vtt',
                en: '/media/m95/senda-m95-role-citizen-en.vtt',
                nl: '/media/m95/senda-m95-role-citizen-nl.vtt'
              }}
              title={locale === 'es' ? 'Modo Ciudadano y Evacuación (60 s)' : locale === 'nl' ? 'Burgermodus & Evacuatie (60 s)' : 'Citizen & Evacuation Mode (60 s)'}
              caption={locale === 'es' ? 'Explicado para cualquier persona: 3 botones claros y envío cifrado sin cobertura.' : locale === 'nl' ? 'Helder voor iedereen: 3 duidelijke knoppen zonder bereik.' : 'Plain human flow: 3 clear buttons and encrypted continuity without coverage.'}
              evidenceId="EV-OFFLINE-49"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-role-developer-es.mp4"
              sources={{
                es: '/media/m95/senda-m95-role-developer-es.mp4',
                en: '/media/m95/senda-m95-role-developer-en.mp4'
              }}
              poster="/media/m95/senda-m95-role-developer-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-role-developer-es.vtt',
                en: '/media/m95/senda-m95-role-developer-en.vtt',
                nl: '/media/m95/senda-m95-role-developer-nl.vtt'
              }}
              title={locale === 'es' ? 'Modo Desarrollador e Ingeniería (60 s)' : locale === 'nl' ? 'Ontwikkelaars- & Engineeringmodus (60 s)' : 'Developer & Engineering Mode (60 s)'}
              caption={locale === 'es' ? 'Física ITU-R, códigos Reed-Solomon, WebCrypto y pruebas automáticas MIT.' : locale === 'nl' ? 'ITU-R fysica, Reed-Solomon, WebCrypto en open-source tests.' : 'ITU-R propagation, Reed-Solomon shards, WebCrypto, and MIT open tests.'}
              evidenceId="EV-CORE-506"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-60s-en.mp4"
              poster="/media/m95/senda-m95-film-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-60s-es.vtt',
                en: '/media/m95/senda-m95-60s-en.vtt',
                nl: '/media/m95/senda-m95-60s-nl.vtt'
              }}
              title={locale === 'es' ? 'Corte Ejecutivo 60 s (Subtítulos ES / EN / NL)' : locale === 'nl' ? 'Executive Cut 60 s (ES / EN / NL)' : '60-Second Executive Cut (ES / EN / NL Subtitles)'}
              caption={locale === 'es' ? 'Resumen de un minuto con simulaciones en vivo para compartir en reuniones.' : locale === 'nl' ? 'Samenvatting van één minuut voor snelle briefings.' : 'One-minute executive briefing with live core simulations.'}
              evidenceId="EV-CORE-506"
            />
            <MediaVideo
              locale={locale}
              src="/media/m95/senda-m95-30s-en.mp4"
              poster="/media/m95/senda-m95-film-poster.jpg"
              subtitles={{
                es: '/media/m95/senda-m95-30s-es.vtt',
                en: '/media/m95/senda-m95-30s-en.vtt',
                nl: '/media/m95/senda-m95-30s-nl.vtt'
              }}
              title={locale === 'es' ? 'Spot Ejecutivo 30 s (Subtítulos ES / EN / NL)' : locale === 'nl' ? 'Executive Spot 30 s (ES / EN / NL)' : '30-Second Executive Spot (ES / EN / NL Subtitles)'}
              caption={locale === 'es' ? 'Píldora rápida de 30 segundos sobre qué resuelve SENDA.' : locale === 'nl' ? 'Korte 30-seconden pitch over de kernwaarde van SENDA.' : '30-second high-impact overview of what SENDA solves.'}
              evidenceId="EV-CORE-506"
            />
            <MediaVideo
              locale={locale}
              src="/media/senda-capacidades-es.mp4"
              poster="/media/m96/senda-m96-promo-poster.jpg"
              title={locale === 'es' ? 'Demostración Integral de Capacidades SENDA' : locale === 'nl' ? 'Volledige SENDA Capaciteitendemo' : 'Full SENDA Capabilities Demonstration'}
              caption={locale === 'es' ? 'Recorrido completo por los módulos civiles en funcionamiento.' : locale === 'nl' ? 'Volledige rondleiding langs alle werkende civiele modules.' : 'Complete walkthrough across working civil capabilities.'}
              evidenceId="EV-CONSOLE-16K"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
