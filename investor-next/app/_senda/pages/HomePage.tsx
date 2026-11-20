'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import PageShell from '../components/PageShell';
import EvidenceBadge from '../components/EvidenceBadge';
import MediaVideo from '../components/MediaVideo';
import LazySection from '../components/LazySection';
import { AUDIENCES, MEASURED_TESTS, PRO, type Audience } from '../data/home-pro';
import { REPO_URL, localeHref, type Locale } from '../data/types';

// El simulador solo se carga al llegar a su sección.
const LivePacketRaceSim = dynamic(() => import('../components/LivePacketRaceSim'), { ssr: false });

/**
 * Portada: una sola lectura lineal.
 * 1 qué es · 2 cifras medidas · 3 cómo funciona · 4 demostración · 5 centro de control
 * 6 datos reales · 7 investigación · 8 hoja de ruta y acuerdos · 9 contacto.
 */
export default function HomePage({ locale }: { locale: Locale }) {
  const [audience, setAudience] = useState<Audience>('citizen');
  const hero = PRO.hero;
  const fig = PRO.figures;

  return (
    <PageShell locale={locale} active="home">
      {/* 1 · Qué es */}
      <section className="p-hero" id="inicio">
        <div className="p-wrap">
          <p className="p-kicker">{hero.kicker[locale]}</p>
          <h1 className="p-h1">{hero.title[locale]}</h1>
          <p className="p-lead" aria-live="polite">{hero.lead[locale][audience]}</p>

          <div className="p-lens" role="group" aria-label={locale === 'es' ? 'Ver como' : locale === 'nl' ? 'Bekijk als' : 'View as'}>
            {AUDIENCES.map((a) => (
              <button key={a} type="button" aria-pressed={audience === a} onClick={() => setAudience(a)}>
                {hero.lens[locale][a]}
              </button>
            ))}
          </div>

          <div className="p-hero-actions">
            <a className="s-btn s-btn-primary" href="#demo">{hero.ctaDemo[locale]}</a>
            <a className="s-btn s-btn-secondary" href={localeHref(locale, 'platform')}>{hero.ctaPlatform[locale]}</a>
          </div>

          {/* 2 · Cifras medidas */}
          <p className="p-kicker" style={{ marginTop: 56 }}>{fig.kicker[locale]}</p>
          <div className="p-figures">
            <div className="p-fig">
              <div className="p-fig-v">{MEASURED_TESTS.value}</div>
              <div className="p-fig-l">{fig.tests[locale]}</div>
              <div className="p-fig-s">{fig.testsSrc[locale]}</div>
            </div>
            {[fig.offline, fig.sweep, fig.fusion].map((f) => (
              <div className="p-fig" key={f.evidenceId}>
                <div className="p-fig-v">{f.value}</div>
                <div className="p-fig-l">{f.label[locale]}</div>
                <div className="p-fig-s">
                  <EvidenceBadge locale={locale} evidenceId={f.evidenceId} compact />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 · Cómo funciona */}
      <section className="p-section" id="como-funciona">
        <div className="p-wrap">
          <p className="p-kicker"><b>01</b>{PRO.how.kicker[locale]}</p>
          <h2 className="p-h2">{PRO.how.title[locale]}</h2>
          <p className="p-lead">{PRO.how.lead[locale]}</p>
          <ol className="p-steps">
            {PRO.how.steps[locale].map(([t, b]) => (
              <li className="p-step" key={t}>
                <h3>{t}</h3>
                <p>{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4 · Demostración (simulación rotulada) */}
      <section className="p-section is-sunk" id="demo">
        <div className="p-wrap">
          <p className="p-kicker"><b>02</b>{PRO.demo.kicker[locale]}</p>
          <h2 className="p-h2">{PRO.demo.title[locale]}</h2>
          <p className="p-sim-tag" style={{ marginTop: 22 }}>{PRO.demo.simTag[locale]}</p>
          <LazySection id="simulador-vivo" placeholderHeight={640} rootMargin="200px 0px">
            <LivePacketRaceSim locale={locale} />
          </LazySection>
          <p className="p-note">{PRO.demo.simNote[locale]}</p>

          <h3 className="p-kicker" style={{ marginTop: 56 }}>{PRO.demo.film[locale]}</h3>
          <MediaVideo
            locale={locale}
            variant="cinema"
            src="/media/m96/senda-m96-promo-es.mp4"
            sources={{
              es: '/media/m96/senda-m96-promo-es.mp4',
              en: '/media/m96/senda-m96-promo-en.mp4'
            }}
            poster="/media/m96/senda-m96-promo-poster.jpg"
            subtitles={{
              es: '/media/m96/senda-m96-promo-es.vtt',
              en: '/media/m96/senda-m96-promo-en.vtt',
              nl: '/media/m96/senda-m96-promo-nl.vtt'
            }}
            title={PRO.demo.film[locale]}
            caption=""
            evidenceId="EV-CONSOLE-16K"
          />
        </div>
      </section>

      {/* 5 · Centro de control */}
      <section className="p-section" id="centro-de-control">
        <div className="p-wrap">
          <p className="p-kicker"><b>03</b>{PRO.platform.kicker[locale]}</p>
          <h2 className="p-h2">{PRO.platform.title[locale]}</h2>
          <p className="p-lead">{PRO.platform.lead[locale]}</p>
          <div className="p-grid">
            {PRO.platform.points[locale].map(([t, b]) => (
              <article className="p-card" key={t}>
                <h3>{t}</h3>
                <p>{b}</p>
              </article>
            ))}
          </div>
          <div className="p-cta">
            <a className="s-btn s-btn-primary" href={localeHref(locale, 'platform')}>{PRO.platform.cta[locale]}</a>
          </div>
        </div>
      </section>

      {/* 6 · Datos reales */}
      <section className="p-section is-sunk" id="datos-reales">
        <div className="p-wrap">
          <p className="p-kicker"><b>04</b>{PRO.real.kicker[locale]}</p>
          <h2 className="p-h2">{PRO.real.title[locale]}</h2>
          <p className="p-lead">{PRO.real.lead[locale]}</p>
          <div className="p-grid">
            {PRO.real.items.map((it) => (
              <article className="p-card" key={it.id}>
                <EvidenceBadge locale={locale} evidenceId={it.id} compact />
                <h3>{it.title[locale]}</h3>
                <p>{it.body[locale]}</p>
                <div className="p-src">{it.src}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · Investigación y desarrollo */}
      <section className="p-section" id="investigacion">
        <div className="p-wrap">
          <p className="p-kicker"><b>05</b>{PRO.rnd.kicker[locale]}</p>
          <h2 className="p-h2">{PRO.rnd.title[locale]}</h2>
          <p className="p-lead">{PRO.rnd.lead[locale]}</p>
          <div className="p-grid is-2">
            {PRO.rnd.items.map((it) => (
              <article className="p-card" key={it.id}>
                <EvidenceBadge locale={locale} evidenceId={it.id} compact />
                <h3>{it.title[locale]}</h3>
                <p>{it.body[locale]}</p>
              </article>
            ))}
          </div>
          <div className="p-cta">
            <a className="s-btn s-btn-secondary" href={localeHref(locale, 'science')}>
              {locale === 'es' ? 'Ver ciencia y papers' : locale === 'nl' ? 'Bekijk wetenschap' : 'See science and papers'}
            </a>
          </div>
        </div>
      </section>

      {/* 8 · Hoja de ruta y acuerdos */}
      <section className="p-section is-sunk" id="hoja-de-ruta">
        <div className="p-wrap">
          <p className="p-kicker"><b>06</b>{PRO.roadmap.kicker[locale]}</p>
          <h2 className="p-h2">{PRO.roadmap.title[locale]}</h2>
          <p className="p-lead">{PRO.roadmap.lead[locale]}</p>
          <div className="p-table-scroll">
            <table className="p-table">
              <thead>
                <tr>{PRO.roadmap.cols[locale].map((c) => <th key={c} scope="col">{c}</th>)}</tr>
              </thead>
              <tbody>
                {PRO.roadmap.rows[locale].map((r) => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="p-kicker" style={{ marginTop: 56 }}>{PRO.roadmap.fundingTitle[locale]}</p>
          <div className="p-table-scroll">
            <table className="p-table">
              <thead>
                <tr>{PRO.roadmap.fundingCols[locale].map((c) => <th key={c} scope="col">{c}</th>)}</tr>
              </thead>
              <tbody>
                {PRO.roadmap.funding[locale].map((r) => (
                  <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="p-note">{PRO.roadmap.fundingNote[locale]}</p>
        </div>
      </section>

      {/* 9 · Contacto */}
      <section className="p-section" id="contacto">
        <div className="p-wrap">
          <h2 className="p-h2">{PRO.close.title[locale]}</h2>
          <p className="p-lead">{PRO.close.body[locale]}</p>
          <div className="p-cta">
            <a className="s-btn s-btn-primary" href={localeHref(locale, 'investors')}>{PRO.close.ctaInvestors[locale]}</a>
            <a className="s-btn s-btn-secondary" href={localeHref(locale, 'evidence')}>{PRO.close.ctaEvidence[locale]}</a>
            <a className="s-btn s-btn-secondary" href={REPO_URL} rel="noopener">{PRO.close.ctaCode[locale]}</a>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
