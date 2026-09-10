import { motion } from 'framer-motion';
import { Satellite, Radio, Shield, Globe, Users, ArrowRight, Check, Activity, Cpu } from 'lucide-react';
import { SatelliteVisualization } from './SatelliteVisualization';

const features = [
  {
    icon: Radio,
    title: "Malla Terrestre Descentralizada",
    description: "Operación continua 0-day ante colapso de infraestructura crítica. Enrutamiento dinámico Bluetooth/Wi-Fi Direct sin single-points-of-failure.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Satellite,
    title: "Uplink Satelital (LEO)",
    description: "Integración nativa con constelaciones LEO (Starlink, Iridium) para comandos estratégicos de alta prioridad. Cobertura global instantánea.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Shield,
    title: "Criptografía Grado Militar",
    description: "Curvas elípticas (Ed25519/X25519) con Perfect Forward Secrecy. Arquitectura Zero-Trust cumpliendo normativas ENS Alto.",
    color: "from-orange-500 to-red-500"
  },
  {
    icon: Cpu,
    title: "IA de Enrutamiento Predictivo",
    description: "Algoritmos genéticos que optimizan la propagación de mensajes en escenarios de topología de red severamente degradada.",
    color: "from-green-500 to-emerald-500"
  }
];

const stats = [
  { value: "0ms", label: "Latencia P2P Local" },
  { value: "100%", label: "Resiliencia ante Blackouts" },
  { value: "€0", label: "Costo de Hardware Dedicado" },
  { value: "10x", label: "ROI vs. Sistemas Legacy" },
];

const competitors = [
  { name: "SITRE / Legacy", offline: false, mesh: false, multiTransport: false, cost: "€2.5M+", highlight: false },
  { name: "Airbus / Motorola TETRA", offline: false, mesh: false, multiTransport: false, cost: "€5.0M+", highlight: false },
  { name: "Civic Relay", offline: true, mesh: true, multiTransport: true, cost: "€150k", highlight: true },
];

export function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden selection:bg-blue-500/30 font-sans">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LCAyNTUsIDI1NSwgMC4wNSkiLz48L3N2Zz4=')] opacity-50"></div>
      </div>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 z-10">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-3 px-5 py-2 bg-blue-900/30 border border-blue-500/30 rounded-full text-blue-300 text-sm mb-8 backdrop-blur-md">
              <Activity className="w-4 h-4 animate-pulse" />
              <span className="font-mono tracking-widest uppercase">Sistema Táctico de Siguiente Generación</span>
            </div>

            <h1 className="text-5xl md:text-8xl font-extrabold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Civic Relay
              </span>
            </h1>

            <p className="text-2xl md:text-4xl text-slate-300 mb-6 font-light max-w-4xl mx-auto">
              Infraestructura crítica que sobrevive al colapso.
            </p>
            <p className="text-lg md:text-xl text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              El único protocolo descentralizado capaz de reemplazar las redes Motorola y Airbus obsoletas. Comunicación militar civil con tecnología Multi-Transport y zero-hardware deployment.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
              <motion.button
                onClick={onEnterApp}
                className="group relative px-8 py-4 bg-blue-600 rounded-lg text-lg font-bold shadow-[0_0_40px_rgba(37,99,235,0.4)] hover:shadow-[0_0_60px_rgba(37,99,235,0.6)] transition-all overflow-hidden"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative flex items-center gap-2 text-white">
                  INICIAR SIMULACIÓN TÁCTICA
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
              
              <motion.a
                href="#pitch"
                className="px-8 py-4 bg-slate-900 border border-slate-700 rounded-lg text-lg font-semibold hover:bg-slate-800 hover:border-slate-600 transition-all text-slate-300"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Ver Informe Inversores
              </motion.a>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 + 0.8 }}
                  className="bg-slate-900/50 backdrop-blur-md border border-slate-800 rounded-xl p-6 text-left hover:border-blue-500/30 transition-colors"
                >
                  <div className="text-4xl font-black text-white mb-2">{stat.value}</div>
                  <div className="text-xs font-mono text-blue-400 uppercase tracking-widest">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3D Satellite Visualization Section */}
      <section className="relative py-32 px-4 z-10 border-t border-slate-800 bg-slate-950/50 backdrop-blur-3xl">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1 }}
          >
            <div className="mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-900/30 border border-blue-500/30 rounded text-blue-400 text-xs font-mono mb-6 uppercase tracking-widest">
                <Globe className="w-3 h-3" /> Visualización de Enrutamiento
              </div>
              <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                Telemetría en Tiempo Real
              </h2>
              <p className="text-xl text-slate-400 max-w-3xl leading-relaxed">
                Nuestra arquitectura híbrida enruta paquetes cifrados a través de la constelación LEO y la red mesh terrestre simultáneamente, garantizando la entrega incluso si el 90% de la infraestructura colapsa.
              </p>
            </div>

            <SatelliteVisualization />
          </motion.div>
        </div>
      </section>

      {/* Differentiation & Competitors */}
      <section id="pitch" className="relative py-32 px-4 z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
              Obsolescencia Programada
            </h2>
            <p className="text-xl text-slate-400 max-w-4xl mx-auto leading-relaxed">
              Airbus y Motorola dependen de torres centralizadas (TETRA) que fallan durante desastres naturales. SITRE demostró su vulnerabilidad en 2023. Civic Relay es la evolución necesaria.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl mb-32"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800 text-sm font-mono tracking-widest text-slate-400">
                    <th className="px-8 py-6 uppercase">Sistema</th>
                    <th className="px-8 py-6 text-center uppercase">Offline-First</th>
                    <th className="px-8 py-6 text-center uppercase">Mesh Dinámico</th>
                    <th className="px-8 py-6 text-center uppercase">Multi-Transport</th>
                    <th className="px-8 py-6 text-right uppercase">CAPEX Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {competitors.map((comp) => (
                    <tr
                      key={comp.name}
                      className={`transition-colors hover:bg-slate-800/50 ${comp.highlight ? 'bg-blue-900/10' : ''}`}
                    >
                      <td className="px-8 py-6 font-medium text-lg flex items-center gap-3">
                        {comp.name}
                        {comp.highlight && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded border border-blue-500/30 font-mono">NEXT-GEN</span>
                        )}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {comp.offline ? <Check className="w-6 h-6 text-blue-400 mx-auto" /> : <span className="text-slate-600 font-mono">FALLO</span>}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {comp.mesh ? <Check className="w-6 h-6 text-blue-400 mx-auto" /> : <span className="text-slate-600 font-mono">FALLO</span>}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {comp.multiTransport ? <Check className="w-6 h-6 text-blue-400 mx-auto" /> : <span className="text-slate-600 font-mono">FALLO</span>}
                      </td>
                      <td className="px-8 py-6 text-right font-mono text-lg">
                        <span className={comp.highlight ? 'text-blue-400 font-bold' : 'text-slate-500'}>{comp.cost}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-slate-900/50 backdrop-blur-md border border-slate-800 p-10 rounded-3xl hover:border-slate-700 transition-colors"
              >
                <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${feature.color} mb-6 shadow-lg`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-3xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-400 text-lg leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final Pitch CTA */}
      <section className="relative py-32 px-4 z-10 border-t border-slate-800 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-blue-900/20 via-slate-950 to-slate-950">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="bg-slate-900 border border-blue-500/30 rounded-[3rem] p-16 relative overflow-hidden"
          >
            {/* Tech grid overlay */}
            <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(59, 130, 246, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59, 130, 246, 0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            
            <Users className="w-20 h-20 mx-auto mb-8 text-blue-400 relative z-10" />
            <h2 className="text-5xl font-extrabold mb-6 relative z-10 tracking-tight">
              El Futuro de la Protección Civil
            </h2>
            <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto relative z-10 leading-relaxed">
              Buscamos €500k Seed para acelerar el despliegue de pilotos institucionales. 5 auditorías superadas. Mercado objetivo: €2.4B (Europa).
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 relative z-10">
              <motion.button
                onClick={onEnterApp}
                className="px-10 py-5 bg-white text-slate-950 rounded-xl text-lg font-bold shadow-2xl hover:shadow-white/20 transition-all flex items-center gap-2"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Evaluar Simulación Táctica
                <ArrowRight className="w-5 h-5" />
              </motion.button>
              <a
                href="mailto:inversores@civic-relay.com"
                className="px-10 py-5 bg-transparent border-2 border-slate-700 rounded-xl text-lg font-bold hover:bg-slate-800 hover:border-slate-600 transition-all text-white"
              >
                Solicitar Due Diligence
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-slate-900 py-12 px-4 z-10 bg-slate-950">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-600 font-mono">
          <div>
            © 2026 Civic Relay Systems. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-8">
            <a href="https://github.com/abrahamhl/civic-relay" className="hover:text-blue-400 transition-colors">Repositorio Confidencial</a>
            <a href="#" className="hover:text-blue-400 transition-colors">Auditoría ENS</a>
            <a href="mailto:security@civic-relay.com" className="hover:text-blue-400 transition-colors">VDP</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
