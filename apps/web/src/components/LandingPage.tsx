import { motion, useTransform, useScroll } from 'framer-motion';
import { Satellite, Radio, Shield, ChevronRight, Cpu, Menu, Smartphone, Bluetooth, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { SatelliteVisualization } from './SatelliteVisualization';

const SmoothScrollLink = ({ href, children, className }: any) => {
  const handleClick = (e: any) => {
    e.preventDefault();
    const target = document.getElementById(href.replace('#', ''));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  return <a href={href} onClick={handleClick} className={className}>{children}</a>;
};

// SIMULATORS

const MeshNetworkSimulator = () => {
  const [nodes, setNodes] = useState<{id: number, active: boolean}[]>([
    {id: 1, active: true}, {id: 2, active: false}, {id: 3, active: true}, {id: 4, active: true}
  ]);
  useEffect(() => {
    const interval = setInterval(() => {
      setNodes(prev => prev.map(n => ({ ...n, active: Math.random() > 0.3 })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black/50 border border-blue-500/30 rounded-2xl p-6 relative overflow-hidden font-mono shadow-inner">
      <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2">
        <Radio className="w-4 h-4 text-blue-500" />
        <span className="text-slate-400 text-xs">MESH-ROUTING.SIMULATOR</span>
      </div>
      <div className="flex justify-between items-center px-4 h-24">
        {nodes.map(n => (
          <div key={n.id} className={`flex flex-col items-center gap-2 ${n.active ? 'text-blue-400 opacity-100' : 'text-slate-600 opacity-50'}`}>
            <Smartphone className="w-6 h-6" />
            <span className="text-[10px]">P{n.id}</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-blue-500/5 mix-blend-overlay" />
    </div>
  );
};

const SatelliteUplinkSimulator = () => {
  const [log, setLog] = useState("");
  useEffect(() => {
    const states = [
      "SEARCHING LEO CONSTELLATION...",
      "LOCK: SAT-49B (AZ 45°, EL 72°)",
      "UPLINK ESTABLISHED. 12KB/s",
      "SENDING BATCH #992...",
      "ACK RECEIVED."
    ];
    let i = 0;
    const interval = setInterval(() => {
      setLog(states[i]);
      i = (i + 1) % states.length;
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-black/50 border border-blue-500/30 rounded-2xl p-6 relative overflow-hidden font-mono text-xs shadow-inner flex flex-col justify-between">
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <Satellite className="w-4 h-4 text-emerald-500" />
        <span className="text-slate-400">SAT-COM-LINK</span>
      </div>
      <div className="h-16 flex items-center justify-center">
        <span className="text-emerald-400 animate-pulse text-center">{log}</span>
      </div>
    </div>
  );
};

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  const { scrollY } = useScroll();
  const yHero = useTransform(scrollY, [0, 800], [0, 150]);
  const opacityHero = useTransform(scrollY, [0, 400], [1, 0]);

  const [scrolled, setScrolled] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans selection:bg-blue-500/30 overflow-hidden relative">
      
      {/* Premium Fixed Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 border-b ${scrolled ? 'bg-[#020617]/90 backdrop-blur-xl border-white/5 py-4 shadow-2xl' : 'bg-transparent border-transparent py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.scrollTo(0,0)}>
            <Shield className="w-6 h-6 text-blue-500 group-hover:text-blue-400 transition-colors" />
            <span className="font-bold tracking-[0.2em] text-sm text-slate-200">CIVIC RELAY</span>
          </div>
          <div className="hidden md:flex items-center gap-10 text-[11px] font-mono tracking-widest text-slate-400">
            <SmoothScrollLink href="#context" className="hover:text-blue-400 transition-colors">01. EL FALLO</SmoothScrollLink>
            <SmoothScrollLink href="#mvp" className="hover:text-blue-400 transition-colors">02. EL MVP</SmoothScrollLink>
            <SmoothScrollLink href="#pitch" className="hover:text-blue-400 transition-colors">03. INVERSIÓN</SmoothScrollLink>
            <button onClick={onEnterApp} className="px-6 py-2.5 bg-white text-black hover:bg-blue-500 hover:text-white rounded-none font-bold transition-all">
              SIMULADOR TÁCTICO
            </button>
          </div>
          <div className="md:hidden">
            <Menu className="w-6 h-6 text-slate-300" />
          </div>
        </div>
      </nav>

      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0">
        <SatelliteVisualization />
      </div>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center pt-20">
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-[#020617]/50 to-[#020617]" />
        
        <motion.div 
          style={{ y: yHero, opacity: opacityHero }}
          className="relative z-20 text-center max-w-5xl mx-auto px-4 mt-32"
        >
          <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-black/50 border border-white/10 rounded-full text-slate-300 text-xs font-mono mb-8 backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            OFFLINE-FIRST RESILIENCE PROTOCOL
          </div>
          
          <h1 className="text-5xl md:text-8xl font-black mb-6 leading-[0.9] tracking-tighter">
            Las Torres <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-500">
              Han Caído.
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Plataforma de comunicación de emergencias peer-to-peer. Cuando las redes celulares colapsan, los ciudadanos se convierten en la red de rescate.
          </p>

          <SmoothScrollLink href="#context" className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-white/20 hover:bg-white/10 transition-colors">
            <ChevronRight className="w-6 h-6 rotate-90 text-slate-400" />
          </SmoothScrollLink>
        </motion.div>
      </section>

      {/* Context & Storytelling */}
      <section id="context" className="relative py-32 px-4 z-20 bg-[#020617]">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-blue-500/50" />
            <span className="font-mono text-xs tracking-[0.2em] text-blue-400">01. EL FALLO SISTÉMICO</span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-blue-500/50" />
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-10 tracking-tight leading-tight">
            Nuestros sistemas de emergencia dependen de antenas que se rompen con el viento.
          </h2>
          
          <div className="space-y-8 text-xl text-slate-400 font-light leading-relaxed">
            <p>
              TETRA (Motorola/Airbus) cuesta cientos de millones, pero cuando hay un huracán, inundación o terremoto, las torres celulares y de radio <strong className="text-white font-medium">se quedan sin energía o son destruidas</strong>. Y en el peor momento, nadie puede pedir ayuda.
            </p>
            <p>
              Cada ciudadano tiene en su bolsillo un ordenador hiper-potente con antenas de Bluetooth, Wi-Fi Direct y acceso a satélites LEO (Low Earth Orbit). <strong className="text-white font-medium">¿Por qué seguimos dependiendo de una torre?</strong>
            </p>
            <div className="p-8 border-l-4 border-blue-500 bg-white/5 rounded-r-2xl">
              <p className="text-white italic">
                "Civic Relay es la evolución natural de la protección civil. Transforma los teléfonos móviles en una red neuronal local (Mesh) que se auto-repara y enruta señales de SOS saltando de móvil en móvil hasta encontrar una salida satelital o IP."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The MVP Explained (Simulators) */}
      <section id="mvp" className="relative py-32 px-4 z-20 border-t border-white/5 bg-slate-950/50">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none" />
        
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <span className="font-mono text-xs tracking-[0.2em] text-cyan-400">02. EL PRODUCTO MÍNIMO VIABLE (MVP)</span>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent" />
          </div>

          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6 tracking-tight">La v1.0 está viva.</h2>
              <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                Hemos desarrollado el SDK Core que unifica las vías de transporte (BLE, Wi-Fi Aware, Satélite LEO, IP). Funciona al 100% como un enrutador inteligente (Store & Forward).
              </p>
              <ul className="space-y-6">
                <li className="flex gap-4 items-start">
                  <div className="mt-1 p-2 rounded bg-blue-500/20"><Bluetooth className="w-5 h-5 text-blue-400" /></div>
                  <div>
                    <strong className="block text-white mb-1">1. Mesh Routing Asíncrono</strong>
                    <span className="text-slate-400 text-sm">Si no hay cobertura, tu SOS se guarda. Si pasas cerca de alguien, se transmite por Bluetooth automáticamente en segundo plano.</span>
                  </div>
                </li>
                <li className="flex gap-4 items-start">
                  <div className="mt-1 p-2 rounded bg-emerald-500/20"><Satellite className="w-5 h-5 text-emerald-400" /></div>
                  <div>
                    <strong className="block text-white mb-1">2. Salto Satelital (LEO)</strong>
                    <span className="text-slate-400 text-sm">Cuando el paquete salta de teléfono en teléfono y encuentra a un usuario con visión satelital (ej. iPhone 14+), expulsa los SOS acumulados al exterior.</span>
                  </div>
                </li>
                <li className="flex gap-4 items-start">
                  <div className="mt-1 p-2 rounded bg-purple-500/20"><Lock className="w-5 h-5 text-purple-400" /></div>
                  <div>
                    <strong className="block text-white mb-1">3. Deduplicación Criptográfica</strong>
                    <span className="text-slate-400 text-sm">Mil teléfonos enviando la misma alerta no saturan el ancho de banda; el hash del paquete se colapsa en uno solo en la capa Mesh.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* Bento Box Simulators */}
            <div className="grid gap-4">
              <MeshNetworkSimulator />
              <div className="grid grid-cols-2 gap-4">
                <SatelliteUplinkSimulator />
                <div className="bg-black/50 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                   <h3 className="text-sm font-mono text-slate-400 mb-4 flex items-center gap-2"><Cpu className="w-4 h-4"/> CARGA</h3>
                   <div className="text-3xl font-light text-white mb-1">12 KB/s</div>
                   <div className="text-xs text-blue-400 font-mono">Coste Reducido (Deduplicación)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pitch CTA */}
      <section id="pitch" className="relative py-32 px-4 z-20 bg-[#020617] border-t border-white/10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] rotate-3">
             <Shield className="w-12 h-12 text-white -rotate-3" />
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
            El Fin de la Obsolescencia TETRA.
          </h2>
          <p className="text-xl text-slate-400 mb-12 leading-relaxed font-light">
            Buscamos €500k de capital pre-seed para empaquetar el SDK en un API para gobiernos y entidades de rescate. Mercado objetivo: €2.4B (Europa).
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <button 
              onClick={onEnterApp}
              className="px-10 py-5 bg-white text-black rounded-sm text-sm font-bold tracking-widest uppercase hover:bg-blue-500 hover:text-white transition-all w-full sm:w-auto shadow-2xl shadow-blue-500/20"
            >
              PROBAR SIMULACIÓN TÁCTICA
            </button>
            <a
              href="mailto:inversores@civic-relay.com"
              className="px-10 py-5 bg-transparent border border-slate-700 hover:border-slate-400 text-white rounded-sm text-sm font-bold tracking-widest uppercase transition-all w-full sm:w-auto"
            >
              SOLICITAR DUE DILIGENCE
            </a>
          </div>
        </div>
      </section>
      
      <footer className="py-8 text-center text-xs font-mono text-slate-600 bg-black">
        © 2026 CIVIC RELAY (RESILIENCE PROTOCOL). PROTECCIÓN CIVIL DISTRIBUIDA.
      </footer>
    </div>
  );
}
