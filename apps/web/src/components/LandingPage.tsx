import { ArrowRight, ExternalLink, Radio, Satellite, ShieldCheck, WifiOff } from 'lucide-react';

const features = [
  { title: 'Store & forward', detail: 'Cola y reintentos de mensajes demostrados en un simulador local.', icon: WifiOff },
  { title: 'Multipath + ACK', detail: 'Motor de rutas simuladas, deduplicación y recibos del receptor.', icon: Radio },
  { title: 'Gobernanza de confianza', detail: 'Los mensajes de la demo no pueden declararse oficiales sin verificación.', icon: ShieldCheck },
  { title: 'Puente satelital', detail: 'Línea de investigación pendiente de acuerdos, terminales y conectividad.', icon: Satellite },
];

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <main className="min-h-screen bg-[#07111e] text-slate-100">
      <header className="border-b border-white/10">
        <nav className="mx-auto max-w-7xl px-6 py-5 flex items-center justify-between gap-4" aria-label="Navegación principal">
          <a href="#inicio" className="font-extrabold tracking-[0.19em] text-sm">CIVIC <span className="text-cyan-400">RELAY</span></a>
          <div className="flex items-center gap-4 text-sm">
            <a className="hidden sm:inline text-slate-300 hover:text-white" href="#arquitectura">Tecnología</a>
            <a className="hidden sm:inline text-slate-300 hover:text-white" href="#investigacion">Hoja de ruta</a>
            <button onClick={onEnterApp} className="rounded-lg bg-cyan-400 px-4 py-2 text-slate-950 font-semibold hover:bg-cyan-300">Abrir demo</button>
          </div>
        </nav>
      </header>
      <section id="inicio" className="mx-auto max-w-7xl px-6 pt-24 pb-24 lg:pt-36 lg:pb-36 grid lg:grid-cols-[1.35fr_1fr] gap-14 items-center">
        <div>
          <div className="inline-block text-xs font-mono uppercase tracking-widest px-4 py-2 rounded-full border border-cyan-700 text-cyan-300 mb-8">Prototype / civil security / offline-first</div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl leading-[1.05] font-black tracking-tight">When networks fail,<br/><span className="text-cyan-400">messages should endure.</span></h1>
          <p className="mt-8 max-w-2xl text-lg text-slate-300 leading-relaxed">Civic Relay explora mensajería resiliente para crisis: mensajes almacenados localmente, rutas múltiples y confirmación de recepción. El MVP actual demuestra estos mecanismos en un simulador, no en una red de emergencias operativa.</p>
          <div className="mt-10 flex gap-4 flex-wrap">
            <button onClick={onEnterApp} className="rounded-lg bg-cyan-400 text-slate-950 px-7 py-4 font-bold flex items-center gap-2 hover:bg-cyan-300">Explorar el motor <ArrowRight size={18}/></button>
            <a href="https://github.com/abrahamhl/civic-relay" target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-600 px-7 py-4 font-semibold flex items-center gap-2 hover:bg-white/10">Código y evidencias <ExternalLink size={17}/></a>
          </div>
        </div>
        <div role="img" aria-label="Esquema de entrega simulada: almacenar, enrutar, verificar recibo" className="rounded-3xl border border-cyan-800/50 bg-slate-900/70 p-8 shadow-2xl">
          <div className="text-xs font-mono tracking-widest text-cyan-400 mb-7">RESILIENCE ENGINE / LOCAL DEMO</div>
          {['01  CAPTURE · mensaje sin verificar', '02  STORE · cola local', '03  ROUTE · canales simulados', '04  ACK · recibo del receptor', '05  DEDUP · un mensaje lógico'].map((step, i) =>
            <div key={step} className="flex items-center gap-4 mb-3 last:mb-0 rounded-xl border border-white/10 bg-white/5 p-4"><div className="text-cyan-400 text-sm font-mono">{String(i+1).padStart(2,'0')}</div><span className="text-sm text-slate-200">{step.substring(4)}</span></div>
          )}
          <p className="mt-7 text-xs text-amber-300">Todas las rutas actuales están simuladas. Sin comunicación satelital ni conexiones entre teléfonos.</p>
        </div>
      </section>
      <section id="arquitectura" className="bg-slate-900/80 border-y border-white/10 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="uppercase text-cyan-400 text-xs tracking-widest font-mono">Propuesta tecnológica</p>
          <h2 className="mt-3 mb-10 text-4xl font-bold max-w-3xl">Un motor verificable antes de conectarlo al mundo físico.</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
            {features.map(({ title, detail, icon: Icon }) => <article key={title} className="rounded-2xl border border-white/10 bg-slate-950 p-7"><Icon className="text-cyan-400 mb-6" size={30}/><h3 className="text-xl font-bold mb-3">{title}</h3><p className="text-sm text-slate-400 leading-relaxed">{detail}</p></article>)}
          </div>
        </div>
      </section>
      <section id="investigacion" className="mx-auto max-w-7xl px-6 py-24">
        <p className="uppercase text-cyan-400 text-xs tracking-widest font-mono">Europa · investigación e interoperabilidad</p>
        <h2 className="mt-3 mb-5 text-4xl font-bold">Diseñado para validación pública, no para sustituir al 112.</h2>
        <p className="text-slate-300 max-w-3xl leading-relaxed">El siguiente tramo requiere pruebas entre dispositivos físicos, autenticación institucional, interoperabilidad con estándares de comunicaciones críticas, cifrado extremo a extremo auditado, accesibilidad y evaluación jurídica. Los enlaces satelitales son una investigación sujeta a operadores y equipos compatibles.</p>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          <div className="border-l-2 border-cyan-400 pl-5"><strong>Fase A · reproducible</strong><p className="text-sm text-slate-400 mt-2">Pruebas de cola, ACK, deduplicación y fallos.</p></div>
          <div className="border-l-2 border-slate-500 pl-5"><strong>Fase B · validación</strong><p className="text-sm text-slate-400 mt-2">Hardware físico, seguridad y ensayos con entidades de respuesta.</p></div>
          <div className="border-l-2 border-slate-500 pl-5"><strong>Fase C · institucional</strong><p className="text-sm text-slate-400 mt-2">Consorcio, estándares EUCCS/MCX y pilotos autorizados.</p></div>
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <a href="https://github.com/abrahamhl/civic-relay/blob/master/docs/PRODUCT_EU_2026.md" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">Ficha técnica para entidades colaboradoras ↗</a>
          <a href="https://github.com/abrahamhl/civic-relay/blob/master/docs/FUNDING_LEADS_2026.md" target="_blank" rel="noopener noreferrer" className="text-cyan-300 hover:underline">Oportunidades europeas verificadas ↗</a>
        </div>
      </section>
      <footer className="border-t border-white/10 px-6 py-10 text-center text-sm text-slate-400">© 2026 Civic Relay · Investigación independiente, software abierto · No es un servicio operativo de emergencias.</footer>
    </main>
  );
}
