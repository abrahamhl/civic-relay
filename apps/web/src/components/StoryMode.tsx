import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCheck, Flame, MapPin, RadioTower, Route, ShieldCheck, Smartphone } from 'lucide-react';
import type { Locale } from '../i18n';
import { t } from '../i18n';

const STAGES = [
  { title:'step1Title', body:'step1Body', label:'scene1', symbol: Smartphone },
  { title:'step2Title', body:'step2Body', label:'scene2', symbol: Flame },
  { title:'step3Title', body:'step3Body', label:'scene3', symbol: AlertTriangle },
  { title:'step4Title', body:'step4Body', label:'scene4', symbol: ShieldCheck },
  { title:'step5Title', body:'step5Body', label:'scene5', symbol: Route },
  { title:'step6Title', body:'step6Body', label:'scene6', symbol: CheckCheck },
  { title:'step7Title', body:'step7Body', label:'scene7', symbol: MapPin },
] as const;

export function StoryMode({ locale, onEnterApp }: { locale: Locale; onEnterApp: () => void }) {
  const [active, setActive] = useState(0);
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const stage = STAGES[active];
  const Icon = stage.symbol;

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort(
        (a, b) => b.intersectionRatio - a.intersectionRatio
      );
      if (visible[0]) setActive(Number((visible[0].target as HTMLElement).dataset.stage));
    }, { rootMargin: '-15% 0px -40% 0px', threshold: [0, 0.2, 0.6] });
    buttons.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const jump = (index: number) => {
    const bounded = Math.max(0, Math.min(STAGES.length - 1, index));
    setActive(bounded);
    buttons.current[bounded]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <section id="story" className="relative z-20 bg-[#030916] py-20 md:py-28 text-white" aria-labelledby="story-heading">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <p className="font-mono text-xs tracking-[0.23em] text-orange-300">{t(locale, 'storyKicker')}</p>
        <h2 id="story-heading" className="mt-4 text-4xl font-extrabold tracking-tight md:text-6xl">{t(locale, 'storyTitle')}</h2>
        <p className="mt-5 max-w-3xl text-lg text-slate-400">{t(locale, 'storyIntro')}</p>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-16">
          <div className="sticky top-24 h-[470px] overflow-hidden rounded-3xl border border-slate-700/70 bg-[#091628] shadow-2xl shadow-cyan-900/10 md:h-[560px]" aria-live="polite" aria-atomic="true">
            <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'linear-gradient(#16324d 1px, transparent 1px),linear-gradient(90deg,#16324d 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 border-b border-white/10 bg-slate-950/75 px-5 py-4 font-mono text-xs">
              <span className="text-cyan-300">CIVIC RELAY / EXERCISE</span>
              <span className="text-slate-400">{String(active + 1).padStart(2, '0')} / 07</span>
            </div>
            <div className="absolute left-[12%] top-[32%] h-48 w-48 rounded-full bg-orange-600/20 blur-[70px] transition-opacity duration-700" style={{ opacity: active >= 1 && active <= 2 ? 1 : 0 }} />
            <div className="absolute right-[9%] top-[18%] h-44 w-44 rounded-full bg-cyan-500/10 blur-[65px]" />
            <div className="relative flex h-full flex-col items-center justify-center px-7 pt-14 text-center">
              <div className={`mb-7 flex h-20 w-20 items-center justify-center rounded-2xl border shadow-[0_0_50px_rgba(20,184,166,.13)] transition-colors duration-500 ${active >= 1 && active <= 2 ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'}`}>
                <Icon className="h-10 w-10" aria-hidden="true" />
              </div>
              <div className="mb-4 flex items-center gap-3 text-xs text-slate-400">
                <RadioTower className={`h-5 w-5 ${active >= 1 && active <= 3 ? 'text-orange-400' : 'text-cyan-400'}`} aria-hidden="true"/>
                <div className="flex gap-1" aria-label={active === 0 ? '4 bars' : '0 bars'}>
                  {[0,1,2,3].map(i => <span key={i} className={`w-2 rounded-sm ${active === 0 || active >= 4 ? 'bg-cyan-400' : 'bg-slate-700'}`} style={{ height: 8 + i * 5 }}/>)}
                </div>
                <span>{active === 0 || active >= 4 ? 'SIMULATED ROUTE' : 'NO ROUTE'}</span>
              </div>
              <p className="max-w-sm font-mono text-xs tracking-[0.16em] text-slate-300">{t(locale, stage.label)}</p>
              <div className="relative mt-7 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-600/70 bg-[#071121] p-5 text-left shadow-2xl">
                <div className="mb-4 flex justify-between font-mono text-xs text-slate-400"><span>LOCAL MESSAGE #001</span><span>DEMO</span></div>
                <div className="mb-3 h-2 w-4/5 rounded-full bg-slate-600" />
                <div className="mb-6 h-2 w-2/3 rounded-full bg-slate-700" />
                <div className="flex items-center gap-2 border-t border-slate-700 pt-4 text-xs font-mono">
                  <span className={`h-2 w-2 rounded-full ${active === 5 ? 'bg-emerald-400' : active === 3 || active === 4 ? 'bg-cyan-400' : active === 1 || active === 2 ? 'bg-orange-400' : 'bg-slate-500'}`} />
                  <span className="text-slate-300">{t(locale, stage.label)}</span>
                </div>
              </div>
              {active === 5 && <p className="mt-5 text-xs font-mono text-emerald-300">ACK = SAME-PAGE SIMULATION · NOT REAL DELIVERY</p>}
            </div>
            <div className="absolute bottom-4 left-4 right-4 flex justify-between gap-3">
              <button type="button" className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400" onClick={() => jump(active - 1)} disabled={active === 0}>{t(locale,'previous')}</button>
              <button type="button" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => jump(active === 6 ? 0 : active + 1)}>{t(locale,active === 6 ? 'replay' : 'next')}</button>
            </div>
          </div>
          <div className="flex flex-col gap-4 pb-16">
            {STAGES.map((item, index) => (
              <button
                type="button"
                data-stage={index}
                ref={(node) => { buttons.current[index] = node; }}
                onClick={() => setActive(index)}
                key={item.title}
                aria-current={index === active ? 'step' : undefined}
                className={`min-h-[210px] rounded-2xl border p-7 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 md:min-h-[250px] ${index === active ? 'border-cyan-400/70 bg-cyan-900/20' : 'border-slate-800 bg-slate-950/50 hover:border-slate-600'}`}
              >
                <span className="font-mono text-xs text-cyan-300">{t(locale,'storyStatus')} {index + 1} / 7</span>
                <h3 className="mt-4 text-2xl font-bold">{t(locale,item.title)}</h3>
                <p className="mt-4 leading-7 text-slate-400">{t(locale,item.body)}</p>
              </button>
            ))}
            <button type="button" onClick={onEnterApp} className="rounded-xl bg-cyan-400 px-8 py-4 font-bold text-slate-950 hover:bg-cyan-300">{t(locale,'openDemo')} →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
