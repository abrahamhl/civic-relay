import { ArrowUpRight, ArrowRight, Radio, Layers3, ShieldCheck, Activity, Eye, Camera, Orbit } from 'lucide-react';
import { SatelliteVisualization } from './SatelliteVisualization';

const steps = [
  { n: '01', icon: Layers3, kicker: 'PERSISTENCE', title: 'STORE', text: 'Messages remain queued locally during complete network failure.' },
  { n: '02', icon: Radio, kicker: 'RELIABILITY', title: 'ROUTE', text: 'Multipath retry and airborne relay acknowledgements in ad-hoc MANET/DTN.' },
  { n: '03', icon: ShieldCheck, kicker: 'TRUST MODEL', title: 'VERIFY', text: 'Cryptographic Ed25519 signatures and sovereign trust anchors for institutional CAD.' },
];

export function LandingPage({
  onEnterApp,
  onEnterTactical,
  onEnterMobileHub,
}: {
  onEnterApp: () => void;
  onEnterTactical?: () => void;
  onEnterMobileHub?: () => void;
}) {
  const handleTactical = onEnterTactical || onEnterApp;
  const handleMobileHub = onEnterMobileHub || handleTactical;

  return (
    <main id="top" className="relative min-h-screen bg-[#04080c] text-[#f3f5f5] overflow-hidden font-[Inter,system-ui,sans-serif]">
      <div
        className="absolute inset-x-0 top-0 h-[890px] pointer-events-none opacity-50"
        style={{
          backgroundImage:
            'linear-gradient(#7dabba10 1px, transparent 1px),linear-gradient(90deg,#7dabba10 1px, transparent 1px)',
          backgroundSize: '68px 68px',
          maskImage: 'linear-gradient(to bottom,black,transparent)',
        }}
      />
      <header className="relative z-30 border-b border-[#56677140] backdrop-blur-xl bg-[#05090dcf]">
        <nav className="max-w-[1540px] mx-auto px-6 lg:px-14 h-[78px] flex items-center justify-between gap-5" aria-label="Main navigation">
          <a href="#top" className="flex items-center gap-3 text-lg font-black tracking-[-0.06em] whitespace-nowrap">
            <span className="w-[21px] h-[25px] flex items-center gap-[3px] -rotate-[27deg]">
              <span className="w-[4px] h-[16px] bg-[#ff7857]" />
              <span className="w-[4px] h-[25px] bg-[#ff7857]" />
              <span className="w-[4px] h-[12px] bg-[#ff7857]" />
            </span>
            CIVIC<span className="text-slate-400 font-medium">/RELAY</span>
          </a>
          <span className="hidden lg:flex gap-3 items-center text-[10px] font-mono tracking-[0.14em] text-slate-400">
            <span className="w-1.5 h-1.5 bg-[#7dccb2] rounded-full" />
            CIVIC RELAY & OEP-TACTICAL <span className="text-slate-600">/ 2026</span>
          </span>
          <div className="flex items-center gap-3 text-[10px] font-mono font-bold tracking-[0.11em]">
            <button
              type="button"
              onClick={handleMobileHub}
              className="px-3.5 py-2.5 border border-[#ff7857] bg-[#ff7857] text-[#03070b] hover:bg-[#ff967b] transition-colors font-bold flex items-center gap-1.5 shadow-md shadow-[#ff7857]/20"
            >
              <Camera size={13} /> MODO MÓVIL SENCILLO (CÁMARA & SATÉLITES) ↗
            </button>
            <button
              type="button"
              onClick={handleTactical}
              className="hidden sm:flex px-3.5 py-2.5 border border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8] hover:bg-[#38bdf8]/25 transition-colors font-bold items-center gap-1.5"
            >
              <Eye size={13} /> SUITE TÁCTICA ↗
            </button>
            <button
              type="button"
              onClick={onEnterApp}
              className="hidden md:block px-3 py-2.5 border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
            >
              BENCH PROTOCOLO
            </button>
          </div>
        </nav>
      </header>

      <section className="relative z-10 max-w-[1540px] mx-auto px-6 lg:px-14 pt-16 lg:pt-24 pb-20 lg:pb-32 grid lg:grid-cols-[.9fr_1.1fr] gap-12 lg:gap-14 items-center">
        <div>
          <p className="flex items-center gap-3 text-[#ff9277] text-[10px] font-mono font-bold tracking-[0.18em]">
            <span className="h-px w-8 bg-[#ff9277]" /> TELECOMUNICACIONES DE EMERGENCIA Y DEFENSA / OEP-TACTICAL
          </p>
          <h1 className="mt-8 text-[clamp(58px,6.6vw,105px)] leading-[.94] tracking-[-.085em] font-[850]">
            CUANDO<br />
            <span className="text-slate-500">LAS REDES</span><br />
            CAEN<span className="text-[#ff7857]">.</span>
          </h1>
          <div className="max-w-lg mt-8 pt-4 border-t border-slate-600/50">
            <span className="text-[9px] tracking-[.16em] font-mono text-slate-400">
              LA COMUNICACIÓN Y EL RESCATE DEBEN PERDURAR
            </span>
            <p className="text-slate-300 text-base lg:text-lg leading-[1.8] mt-5">
              Infraestructura soberana offline-first y multi-dominio: Enjambres UAS, escáner radar UWB tras paredes,
              cálculos de pases satelitales en tiempo real y adaptadores ATAK/112.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-9">
            <button
              type="button"
              onClick={handleMobileHub}
              className="px-6 py-4 bg-[#ff7857] text-[#03070b] text-[11px] font-bold tracking-[0.1em] flex items-center gap-3 hover:bg-[#ff967b] transition-colors shadow-lg shadow-[#ff7857]/20"
            >
              <Camera size={17} /> PROBAR EN EL MÓVIL: CÁMARA RADAR TRAS PAREDES
            </button>
            <button
              type="button"
              onClick={handleTactical}
              className="px-6 py-4 border border-[#38bdf8] bg-[#38bdf8]/15 text-[#38bdf8] text-[11px] font-bold tracking-[0.1em] flex items-center gap-3 hover:bg-[#38bdf8]/25 transition-colors"
            >
              <Orbit size={17} /> CÁLCULOS SATÉLITES Y SUITE TÁCTICA
            </button>
          </div>
          <div className="mt-12 flex flex-col gap-3 text-[10px] text-slate-400 font-mono tracking-[.08em]">
            <span>
              <span className="inline-block w-2 h-2 bg-[#7dc9b1] rounded-full mr-3" />
              CÁMARA TRAS PAREDES / FUSIÓN AR MULTIESPECTRAL TOTALMENTE OPERATIVA
            </span>
            <span>
              <span className="inline-block w-2 h-2 bg-[#38bdf8] rounded-full mr-3" />
              CÁLCULOS ORBITALES SGP4 / GALILEO SAR, IRIDIUM & STARLINK EN TIEMPO REAL
            </span>
          </div>
        </div>

        <div className="relative min-w-0">
          <div className="flex justify-between items-center gap-3 px-4 lg:px-6 h-[45px] border border-b-0 border-[#425763] bg-[#0e1921] text-[10px] font-mono tracking-[.12em] text-slate-300">
            <span className="flex items-center gap-2">
              <Activity size={13} className="text-[#ff7857]" /> CONTROL DE MISIÓN / MODELO ORBITAL Y TÁCTICO
            </span>
            <span className="text-[#10b981]">MOTOR ACTIVO</span>
          </div>
          <SatelliteVisualization />
          <div className="border-x border-b border-[#425763] bg-[#101920] flex flex-wrap justify-between gap-3 px-5 py-4 items-center text-[10px] font-mono">
            <span className="text-slate-400">TOPOLOGÍA MULTI-DOMINIO / SIMULACIÓN MATEMÁTICA REAL</span>
            <span className="text-[#38bdf8]">ORBITAL SGP4 + ENJAMBRE UAS</span>
          </div>
        </div>
      </section>

      <div className="relative z-10 border-y border-slate-700/50 bg-[#0e1820]">
        <div className="max-w-[1540px] mx-auto px-6 lg:px-14 min-h-[75px] flex items-center justify-between gap-4 font-mono text-[10px] lg:text-[11px] tracking-[0.1em]">
          <span className="hidden lg:block text-slate-500">MISIÓN / CIVIC RELAY OEP-TACTICAL</span>
          <strong className="text-slate-200 tracking-[0.15em]">
            MENSAJERÍA CRÍTICA · ENLACES RESILIENTES · RADAR MULTIESPECTRO
          </strong>
          <span className="hidden lg:block text-slate-500">VERSIÓN / SOBERANÍA EUROPEA</span>
        </div>
      </div>

      <section id="system" className="relative max-w-[1540px] mx-auto px-6 lg:px-14 py-24 lg:py-36">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div>
            <p className="font-mono text-[11px] text-[#ff9277] tracking-[.15em]">01 / EL MOTOR MULTI-DOMINIO</p>
            <h2 className="mt-6 text-5xl lg:text-7xl font-extrabold tracking-[-.07em] leading-[1.02]">
              DISEÑADO PARA<br />
              <span className="text-slate-500">SOBREVIVIR.</span>
            </h2>
          </div>
          <p className="max-w-[355px] text-sm text-slate-400 leading-7">
            El motor de Civic Relay y OEP-Tactical garantiza la custodia y entrega de información crítica en condiciones
            hostiles y sin infraestructura externa.
          </p>
        </div>
        <div className="mt-14 grid lg:grid-cols-3 border border-slate-700/70">
          {steps.map(({ n, icon: Icon, kicker, title, text }) => (
            <article
              key={n}
              className="border-b lg:border-b-0 lg:border-r last:border-0 border-slate-700/70 p-7 lg:p-9 bg-[#0c141b] hover:bg-[#14212b] transition-colors"
            >
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-500">
                <span>{n} / 03</span>
                <ArrowUpRight size={17} />
              </div>
              <Icon size={32} className="text-[#8dcadd] mt-10 mb-8" strokeWidth={1.3} />
              <p className="font-mono text-[10px] tracking-[.15em] text-slate-400">{kicker}</p>
              <h3 className="text-3xl tracking-[-.06em] font-bold mt-2">{title}</h3>
              <p className="text-sm leading-7 text-slate-400 mt-3">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="program" className="border-y border-slate-700/50 bg-[#0d1921]">
        <div className="max-w-[1540px] mx-auto px-6 lg:px-14 py-24 lg:py-32 grid lg:grid-cols-2 gap-14 lg:gap-28">
          <div>
            <p className="font-mono text-[11px] text-[#ff9277] tracking-[.15em]">
              02 / PROGRAMA DE DESPLIEGUE Y HOMOLOGACIÓN
            </p>
            <h2 className="mt-6 text-5xl lg:text-7xl leading-[1.02] tracking-[-.07em] font-extrabold">
              DE LA ESPECIFICACIÓN<br />
              A LA <span className="text-slate-500">DEFENSA.</span>
            </h2>
            <p className="mt-7 text-slate-400 text-sm leading-7 max-w-md">
              Solución orientada a los fondos EDF, rescEU, Horizon Europe y NATO DIANA para dotar a la UE de autonomía
              estratégica en telecomunicaciones de crisis.
            </p>
          </div>
          <div className="border-t border-slate-600/70">
            {[
              ['01', 'LABORATORIO DE CÁMARA & RADAR', 'Cámara AR tras paredes, radar UWB micro-Doppler, MAVLink v2 y SGP4', 'OPERATIVO & DEMOSTRADO'],
              ['02', 'PILOTO FÍSICO Y GATEWAYS', 'Pruebas de campo con SDR Hat (ESP32-S3/SX1262), Wi-Fi Aware y drones cautivos', 'PILOTO DE CAMPO EN CURSO'],
              ['03', 'INTEGRACIÓN INSTITUCIONAL OTAN / UE', 'Pasarelas ATAK CoT, OASIS CAP v1.2, PEMEA y despliegue interoperable con PSAP/112', 'ALINEADO CON FONDOS EDF/DIANA'],
            ].map(([n, t, d, state]) => (
              <div key={n} className="flex gap-6 py-7 border-b border-slate-600/70">
                <span className="text-xl font-mono text-[#ff9277]">{n}</span>
                <div className="flex-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="text-lg">{t}</strong>
                    <span className="text-[9px] font-mono text-[#38bdf8] font-bold">{state}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-2">{d}</p>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleMobileHub}
              className="inline-flex mt-9 gap-3 items-center text-[11px] font-mono border-b border-white/50 pb-3 hover:text-[#38bdf8] transition-colors"
            >
              ACCEDER A LA INTERFAZ MÓVIL SENCILLA <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

      <footer className="max-w-[1540px] mx-auto px-6 lg:px-14 py-10 flex flex-col md:flex-row gap-5 justify-between items-center text-[10px] font-mono text-slate-500">
        <span className="text-white font-bold">CIVIC/RELAY & OEP-TACTICAL</span>
        <span>SOBERANÍA Y RESILIENCIA EUROPEA · 2026</span>
        <span>SISTEMA TÁCTICO Y CÍVICO OPERATIVO</span>
      </footer>
    </main>
  );
}
