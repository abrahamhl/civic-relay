import { ArrowDown, ArrowRight, Database, Github, Radio, Shield, ShieldAlert } from 'lucide-react';
import { SatelliteVisualization } from './SatelliteVisualization';
import { StoryMode } from './StoryMode';
import { LanguageSwitcher } from './LanguageSwitcher';
import type { Locale } from '../i18n';
import { t } from '../i18n';

export function LandingPage({ onEnterApp, locale, onLocaleChange }: {
  onEnterApp: () => void;
  locale: Locale;
  onLocaleChange: (next: Locale) => void;
}) {
  return (
    <div className="min-h-screen bg-[#020617] text-white selection:bg-cyan-400/30">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#020617]/95 px-5 py-3 backdrop-blur-xl" aria-label="Main navigation">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <a href="#top" className="flex items-center gap-3 font-black tracking-[0.13em] text-slate-100"><Shield className="h-6 w-6 text-cyan-400" aria-hidden="true"/> CIVIC RELAY</a>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold md:gap-5">
            <a href="#story" className="hidden text-slate-300 hover:text-cyan-300 sm:block">{t(locale,'navStory')}</a>
            <a href="#product" className="hidden text-slate-300 hover:text-cyan-300 sm:block">{t(locale,'navProduct')}</a>
            <a href="#partners" className="hidden text-slate-300 hover:text-cyan-300 md:block">{t(locale,'navFunding')}</a>
            <LanguageSwitcher locale={locale} onChange={onLocaleChange} dark />
            <button type="button" onClick={onEnterApp} className="rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950 hover:bg-cyan-300">{t(locale,'openDemo')}</button>
          </div>
        </div>
      </nav>

      <main>
        <section id="top" className="relative isolate flex min-h-[78vh] items-center overflow-hidden px-5 py-24">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_80%_35%,rgba(14,116,144,.27),transparent_42%),radial-gradient(circle_at_10%_85%,rgba(251,146,60,.09),transparent_36%)]" />
          <div className="absolute right-[8%] top-[16%] -z-10 h-56 w-56 rounded-full border border-cyan-400/10 shadow-[0_0_130px_rgba(34,211,238,.08)] md:h-96 md:w-96" />
          <div className="mx-auto grid w-full max-w-7xl items-center gap-16 lg:grid-cols-[1.15fr_.85fr]">
            <div>
              <p className="mb-6 font-mono text-xs tracking-[0.19em] text-cyan-300">{t(locale,'heroEyebrow')}</p>
              <h1 className="max-w-4xl text-5xl font-black leading-[1.04] tracking-[-.05em] md:text-7xl">
                {t(locale,'heroTitle')} <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">{t(locale,'heroAccent')}</span>
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-8 text-slate-300">{t(locale,'heroBody')}</p>
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <a href="#story" className="inline-flex items-center gap-3 rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-white hover:border-cyan-400/70">{t(locale,'scroll')} <ArrowDown className="h-4 w-4" aria-hidden="true"/></a>
                <button type="button" onClick={onEnterApp} className="inline-flex items-center gap-3 rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300">{t(locale,'openDemo')} <ArrowRight className="h-4 w-4" aria-hidden="true"/></button>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-md rounded-[2rem] border border-cyan-300/20 bg-[#09172c] p-8 shadow-[0_0_80px_rgba(8,145,178,.09)]">
              <div className="mb-6 flex items-center justify-between gap-3 font-mono text-xs text-slate-400"><span>SIMULATION / #001</span><span className="text-orange-300">NO NETWORK</span></div>
              <Radio className="h-10 w-10 text-orange-300" aria-hidden="true"/>
              <div className="mt-5 h-3 w-3/4 rounded-full bg-white/30"/><div className="mt-3 h-3 w-1/2 rounded-full bg-white/10"/>
              <div className="mt-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-5 font-mono text-sm text-cyan-200">LOCAL QUEUE: 1 MESSAGE<br/>DELIVERED: 0<br/>RETRY: WAITING FOR ROUTE</div>
              <p className="mt-5 text-xs leading-5 text-slate-500">ILLUSTRATIVE UI / NO EMERGENCY DISPATCH</p>
            </div>
          </div>
        </section>

        <div className="relative z-10 border-y border-amber-400/20 bg-amber-400/5 px-5 py-4 text-center text-sm text-amber-100" role="note">
          <ShieldAlert className="mr-2 inline h-5 w-5" aria-hidden="true"/>{t(locale,'notice')}
        </div>

        <section id="context" className="bg-[#060c1a] px-5 py-20">
          <div className="mx-auto max-w-4xl">
            <p className="font-mono text-xs tracking-widest text-cyan-300">{t(locale,'contextKicker')}</p>
            <h2 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">{t(locale,'contextTitle')}</h2>
            <p className="mt-8 text-lg leading-9 text-slate-400">{t(locale,'contextBody')}</p>
          </div>
        </section>

        <StoryMode locale={locale} onEnterApp={onEnterApp} />

        <section id="product" className="relative z-10 bg-[#060d1c] px-5 py-24">
          <div className="mx-auto max-w-7xl">
            <p className="font-mono text-xs tracking-widest text-cyan-300">{t(locale,'productKicker')}</p>
            <h2 className="mt-5 max-w-4xl text-4xl font-bold tracking-tight md:text-5xl">{t(locale,'productTitle')}</h2>
            <p className="mt-7 max-w-4xl text-lg leading-8 text-slate-400">{t(locale,'productBody')}</p>
            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {(['capability1','capability2','capability3'] as const).map((key, i) => {
                const Icon = i === 0 ? Database : i === 1 ? Radio : Shield;
                return (
                  <article key={key} className="rounded-2xl border border-slate-700/70 bg-slate-900/60 p-7">
                    <Icon className="mb-6 h-8 w-8 text-cyan-300" aria-hidden="true"/>
                    <h3 className="text-xl font-bold">{t(locale,key)}</h3>
                    <p className="mt-4 leading-7 text-slate-400">{t(locale,key+'Body')}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-10 rounded-2xl border border-orange-500/20 bg-orange-500/5 p-7">
              <h3 className="text-xl font-bold text-orange-200">{t(locale,'pendingTitle')}</h3>
              <p className="mt-2 leading-7 text-slate-400">{t(locale,'pendingBody')}</p>
            </div>
            <div className="mt-12">
              <div className="mb-4 font-mono text-xs tracking-widest text-slate-400">CONCEPTUAL NETWORK TOPOLOGY · NOT LIVE TELEMETRY</div>
              <SatelliteVisualization />
            </div>
          </div>
        </section>

        <section id="partners" className="relative z-10 bg-[#020617] px-5 py-28 text-center">
          <div className="mx-auto max-w-3xl">
            <p className="font-mono text-xs tracking-widest text-cyan-300">{t(locale,'fundingKicker')}</p>
            <h2 className="mt-5 text-4xl font-bold tracking-tight md:text-6xl">{t(locale,'fundingTitle')}</h2>
            <p className="mt-7 text-lg leading-8 text-slate-400">{t(locale,'fundingBody')}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <button type="button" onClick={onEnterApp} className="rounded-xl bg-cyan-400 px-7 py-4 text-sm font-bold text-slate-950 hover:bg-cyan-300">{t(locale,'fundingCTA')}</button>
              <a href="https://github.com/abrahamhl/civic-relay" rel="noopener noreferrer" target="_blank" className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-7 py-4 text-sm font-bold hover:border-cyan-400"><Github className="h-4 w-4" aria-hidden="true"/>{t(locale,'fundingGithub')}</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-white/10 bg-black px-5 py-8 text-center font-mono text-xs text-slate-500">{t(locale,'footer')}</footer>
    </div>
  );
}
