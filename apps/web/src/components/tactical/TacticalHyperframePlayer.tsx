import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, ChevronRight, ChevronLeft, Layers, Activity } from 'lucide-react';

interface HyperframeChapter {
  id: number;
  timeLabel: string;
  title: string;
  subtitle: string;
  technicalDescription: string;
  activeLayers: string[];
  metrics: {
    latencyMs: number;
    throughputKbps: number;
    packetDeliveryRatio: number;
    emconLevel: string;
  };
}

const CHAPTERS: HyperframeChapter[] = [
  {
    id: 1,
    timeLabel: 'T+00:00 - T+02:15',
    title: 'COLAPSO DE REDES Y DENSIFICACIÓN EW',
    subtitle: 'Interrupción cinética y guerra electrónica hostil en bandas celulares',
    technicalDescription:
      'Las torres celulares comerciales 4G/5G y los enlaces de fibra óptica caen tras sabotaje físico e interferencia de barrido (Barrage Jamming) en 800-2600 MHz. El piso de ruido térmico asciende de -110 dBm a -68 dBm, provocando una pérdida de paquetes >98% en terminales convencionales. Civic Relay entra en modo de supervivencia local.',
    activeLayers: ['Jamming Activo', 'Red Celular Caída', 'Aislamiento Civil'],
    metrics: {
      latencyMs: 9999,
      throughputKbps: 0,
      packetDeliveryRatio: 2.1,
      emconLevel: 'EMCON 0 (DEGRADADO)',
    },
  },
  {
    id: 2,
    timeLabel: 'T+02:16 - T+08:45',
    title: 'DESPLIEGUE AÉREO UAS & RELAY PERSISTENTE',
    subtitle: 'Ascenso de dron cautivo a 120m AGL y enjambre autónomo MAVLink v2',
    technicalDescription:
      'Un dron cautivo conectado por micro-cable de alimentación continua asciende a 120 metros de cota, superando el apantallamiento orográfico. El autopiloto PX4 encapsula micro-ráfagas canónicas OEP dentro del Message ID 0x0000BF de MAVLink v2 a 868 MHz. Se establece una malla Air-to-Air con drones libres que cubren valles aislados sin satélite.',
    activeLayers: ['Dron Cautivo 24h', 'Enlace A2A Mesh', 'MAVLink Micro-Burst'],
    metrics: {
      latencyMs: 145,
      throughputKbps: 64,
      packetDeliveryRatio: 89.4,
      emconLevel: 'EMCON 1 (RESTRICTED)',
    },
  },
  {
    id: 3,
    timeLabel: 'T+08:46 - T+18:30',
    title: 'RADAR UWB & SONDEO MULTIESPECTRAL TRAS PAREDES',
    subtitle: 'Detección de supervivientes mediante micro-Doppler respiratorio y cardiaco',
    technicalDescription:
      'Equipos de rescate en vanguardia despliegan el transceptor de radar UWB 3.1–10.6 GHz. La onda penetra 35 cm de hormigón armado compensando la permitividad dieléctrica (εr=6.0). Los algoritmos de filtrado aíslan la frecuencia respiratoria (16 RPM) y el latido cardiaco (76 BPM), extrayendo vectores tácticos compactos de 48 bytes transmitidos a la malla aérea.',
    activeLayers: ['Radar UWB Penetración', 'Signos Vitales Doppler', 'Carga Útil 48B'],
    metrics: {
      latencyMs: 320,
      throughputKbps: 18,
      packetDeliveryRatio: 96.2,
      emconLevel: 'EMCON 1 (BURST)',
    },
  },
  {
    id: 4,
    timeLabel: 'T+18:31 - T+29:00',
    title: 'CLUSTERIZACIÓN AD-HOC DE SMARTPHONES COTS',
    subtitle: 'Mallas Wi-Fi Aware (NAN) y balizamiento de largo alcance BLE 5.4 Coded PHY',
    technicalDescription:
      'Los teléfonos comerciales de los ciudadanos atrapados activan protocolos de bajo consumo en segundo plano. Mediante Wi-Fi Aware (NAN) forman grupos locales de intercambio a 4 Mbps sin punto de acceso, mientras balizas BLE Coded PHY (S=8) extienden el radio de aviso hasta 750 metros para enlaces Store-and-Forward hacia los rescatistas.',
    activeLayers: ['Wi-Fi Aware NAN', 'BLE Coded PHY (S=8)', 'Scheduled Rendezvous'],
    metrics: {
      latencyMs: 180,
      throughputKbps: 4200,
      packetDeliveryRatio: 91.8,
      emconLevel: 'EMCON 0 (LOCAL MESH)',
    },
  },
  {
    id: 5,
    timeLabel: 'T+29:01 - T+45:00',
    title: 'CONVERGENCIA TÁCTICA ATAK & DESPACHO 112 / CAD',
    subtitle: 'Inyección Cursor-on-Target y sincronización con Puestos de Mando y PSAP',
    technicalDescription:
      'Las fichas de emergencia y vectores de rescate son convertidos automáticamente al estándar Cursor-on-Target (CoT XML b-m-p-s-m) e inyectados en los terminales ATAK de los equipos de rescate. Al alcanzar el Puesto de Mando Móvil con backhaul seguro, se generan alertas OASIS CAP v1.2 y paquetes PEMEA para los centros 112/CAD.',
    activeLayers: ['ATAK CoT Markers', 'OASIS CAP v1.2', 'Centro 112 / CAD'],
    metrics: {
      latencyMs: 85,
      throughputKbps: 128,
      packetDeliveryRatio: 99.1,
      emconLevel: 'EMCON 0 (VERIFICADO)',
    },
  },
];

export const TacticalHyperframePlayer: React.FC = () => {
  const [currentChapterIdx, setCurrentChapterIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0); // 0 to 100 within current chapter
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const chapter = CHAPTERS[currentChapterIdx];

  // Animation and progress timer
  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            // Next chapter
            setCurrentChapterIdx((curr) => (curr + 1) % CHAPTERS.length);
            return 0;
          }
          return prev + 1.2 * playbackSpeed;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  // Canvas visual rendering for Hyperframes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.03 * playbackSpeed;
      const width = canvas.width;
      const height = canvas.height;

      // Dark tactical space background
      ctx.fillStyle = '#03070b';
      ctx.fillRect(0, 0, width, height);

      // Cyber terrain grid
      ctx.strokeStyle = '#0e2330';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 35) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw Multi-Domain Tactical Actors depending on chapter
      const centerX = width / 2;

      // 1. Hostile EW Jamming cloud (Active in Chapter 1 & 2)
      if (chapter.id === 1 || chapter.id === 2) {
        const jamGrad = ctx.createRadialGradient(centerX - 150, 100, 20, centerX - 150, 100, 220);
        jamGrad.addColorStop(0, '#ef444455');
        jamGrad.addColorStop(0.5, '#ef444415');
        jamGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = jamGrad;
        ctx.beginPath();
        ctx.arc(centerX - 150, 100, 220, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#f87171';
        ctx.font = '10px monospace';
        ctx.fillText('⚡ BARRAGE JAMMING HOSTIL (800-2600 MHz)', centerX - 260, 40);
      }

      // 2. Tethered Drones & Airborne Mesh (Chapters 2, 3, 4, 5)
      if (chapter.id >= 2) {
        // Tethered Drone
        const droneX = centerX;
        const droneY = 90 + Math.sin(t * 2) * 5;

        // Micro-cable line from ground
        ctx.strokeStyle = '#38bdf888';
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(centerX, height - 40);
        ctx.lineTo(droneX, droneY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Drone Icon & RF Coverage Cone
        const coneGrad = ctx.createRadialGradient(droneX, droneY, 10, droneX, height - 40, 280);
        coneGrad.addColorStop(0, '#38bdf844');
        coneGrad.addColorStop(0.8, '#38bdf811');
        coneGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        ctx.moveTo(droneX, droneY);
        ctx.lineTo(droneX - 240, height - 40);
        ctx.lineTo(droneX + 240, height - 40);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(droneX, droneY, 7, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#e0f2fe';
        ctx.fillText('DRON CAUTIVO (120m AGL · COFDM / 868MHz)', droneX - 110, droneY - 14);

        // Subordinate UAS in mesh
        const swarmX = droneX + 180 + Math.cos(t) * 20;
        const swarmY = 120 + Math.sin(t) * 15;

        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(droneX, droneY);
        ctx.lineTo(swarmX, swarmY);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(swarmX, swarmY, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillText('UAS ALPHA (Air-to-Air Mesh)', swarmX + 12, swarmY + 4);
      }

      // 3. Ground Victims & Wall Radar (Chapters 3, 4, 5)
      const victimX = centerX - 120;
      const victimY = height - 70;

      if (chapter.id >= 3) {
        // Wall representation
        ctx.fillStyle = '#64748b44';
        ctx.fillRect(victimX - 40, victimY - 50, 80, 20);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(victimX - 40, victimY - 50, 80, 20);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '8px monospace';
        ctx.fillText('MURO HORMIGÓN', victimX - 35, victimY - 36);

        // UWB Radar Pulse penetrating wall
        const pulseR = (t * 80) % 120;
        ctx.strokeStyle = '#ff7857';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(victimX, victimY - 65, pulseR, 0, Math.PI);
        ctx.stroke();

        // Victim Dot with pulsing heart rate
        const heartPulse = Math.sin(t * 12) * 3;
        ctx.fillStyle = '#ff7857';
        ctx.beginPath();
        ctx.arc(victimX, victimY + 10, 6 + Math.max(0, heartPulse), 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#fecdd3';
        ctx.fillText('CIVIL ATRAPADO (16 RPM | 76 BPM)', victimX - 90, victimY + 30);
      }

      // 4. Mobile First Responder / ATAK Unit (Chapters 4 & 5)
      const atakX = centerX + 120;
      const atakY = height - 70;

      if (chapter.id >= 4) {
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(atakX, atakY, 8, 0, 2 * Math.PI);
        ctx.fill();

        // Uplink pulse from victim to responder
        ctx.strokeStyle = '#38bdf8';
        ctx.setLineDash([2, 5]);
        ctx.beginPath();
        ctx.moveTo(victimX, victimY + 10);
        ctx.lineTo(atakX, atakY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#fef08a';
        ctx.fillText('EQUIPO RESCATE (ATAK / SDR HAT)', atakX - 90, atakY + 25);
      }

      // 5. C2 Command Center Uplink (Chapter 5)
      if (chapter.id === 5) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(atakX, atakY);
        ctx.lineTo(centerX, 90);
        ctx.stroke();

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px monospace';
        ctx.fillText('COHERENCIA COT DISPATCH -> PSAP / 112 CAD [100% CONFIRMADO]', centerX - 180, height - 12);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [chapter, playbackSpeed]);

  return (
    <div className="border border-[#344b55] bg-[#050a0f] rounded-lg p-5 lg:p-7 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#344b55] pb-5">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-[#ff9476] flex items-center gap-2">
            <Activity size={13} /> SECUENCIA EXPLICATIVA TÁCTICA MULTI-CAPA
          </span>
          <h2 className="text-xl lg:text-2xl font-black tracking-tight mt-1">
            REPRODUCTOR DE HYPERFRAMES: MISIÓN OEP-TACTICAL
          </h2>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2 bg-[#0d1822] border border-slate-700 p-1.5 rounded">
          <button
            type="button"
            onClick={() => {
              setCurrentChapterIdx((curr) => (curr > 0 ? curr - 1 : CHAPTERS.length - 1));
              setProgress(0);
            }}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Capítulo anterior"
          >
            <ChevronLeft size={16} />
          </button>

          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="px-3 py-1 bg-[#ff7857] text-[#04080c] rounded font-bold text-xs flex items-center gap-1.5 hover:bg-[#ff967b]"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            {isPlaying ? 'PAUSA' : 'PLAY'}
          </button>

          <button
            type="button"
            onClick={() => {
              setCurrentChapterIdx((curr) => (curr + 1) % CHAPTERS.length);
              setProgress(0);
            }}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
            title="Capítulo siguiente"
          >
            <ChevronRight size={16} />
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          {/* Speed selectors */}
          {[0.5, 1, 2].map((sp) => (
            <button
              key={sp}
              type="button"
              onClick={() => setPlaybackSpeed(sp)}
              className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                playbackSpeed === sp ? 'bg-[#38bdf8] text-[#03070b] font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              {sp}x
            </button>
          ))}
        </div>
      </div>

      {/* Chapter Steps Timeline Scrub Bar */}
      <div className="grid grid-cols-5 gap-2 my-5">
        {CHAPTERS.map((ch, idx) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => {
              setCurrentChapterIdx(idx);
              setProgress(0);
            }}
            className={`text-left p-2.5 rounded border transition-all ${
              idx === currentChapterIdx
                ? 'border-[#ff7857] bg-[#ff7857]/15 text-white'
                : 'border-slate-800 bg-[#0a131b] text-slate-400 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex justify-between items-center text-[9px] font-mono mb-1">
              <span>FASE 0{ch.id}</span>
              <span className="text-[#ff9476]">{ch.timeLabel}</span>
            </div>
            <strong className="block text-[11px] leading-tight font-sans truncate">{ch.title}</strong>
            {/* Progress bar inside active chapter */}
            <div className="w-full bg-slate-800 h-1 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-[#ff7857] h-full transition-all duration-100"
                style={{
                  width: idx === currentChapterIdx ? `${progress}%` : idx < currentChapterIdx ? '100%' : '0%',
                }}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Main Visualizer Canvas */}
      <div className="relative border border-[#273a44] bg-[#020508] rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={880} height={420} className="w-full h-auto block" />

        {/* Telemetry HUD on Top */}
        <div className="absolute top-4 left-4 right-4 flex flex-wrap justify-between items-start pointer-events-none gap-2">
          <div className="bg-[#07111a]/85 border border-[#344b55] backdrop-blur-md p-3 rounded text-left">
            <span className="text-[9px] font-mono text-[#ff9476] block">CAPÍTULO ACTIVO</span>
            <strong className="text-sm font-bold block">{chapter.title}</strong>
            <span className="text-[10px] text-slate-300 font-mono block">{chapter.subtitle}</span>
          </div>

          <div className="bg-[#07111a]/85 border border-[#344b55] backdrop-blur-md p-3 rounded flex gap-4 font-mono text-[10px]">
            <div>
              <span className="text-slate-500 block">LATENCIA</span>
              <strong className="text-[#38bdf8] text-sm">{chapter.metrics.latencyMs} ms</strong>
            </div>
            <div>
              <span className="text-slate-500 block">THROUGHPUT</span>
              <strong className="text-[#10b981] text-sm">{chapter.metrics.throughputKbps} kbps</strong>
            </div>
            <div>
              <span className="text-slate-500 block">PDR ENLACE</span>
              <strong className="text-[#fbbf24] text-sm">{chapter.metrics.packetDeliveryRatio}%</strong>
            </div>
            <div>
              <span className="text-slate-500 block">NIVEL EMCON</span>
              <strong className="text-[#f43f5e] text-sm">{chapter.metrics.emconLevel}</strong>
            </div>
          </div>
        </div>

        {/* Active Layer Badges on Bottom */}
        <div className="absolute bottom-3 left-4 flex gap-2 pointer-events-none flex-wrap">
          {chapter.activeLayers.map((layer) => (
            <span
              key={layer}
              className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/60 border border-[#38bdf8]/50 text-[#38bdf8] backdrop-blur-sm"
            >
              ● {layer}
            </span>
          ))}
        </div>
      </div>

      {/* Deep Dive Explanatory Box */}
      <div className="mt-5 p-4 rounded bg-[#0a141d] border border-[#273a44]">
        <h4 className="text-xs font-mono font-bold text-[#ff9476] mb-2 flex items-center gap-2">
          <Layers size={14} /> EXPLICACIÓN MAESTRA DEL ENLACE Y PROCESO FÍSICO
        </h4>
        <p className="text-xs leading-6 text-slate-300 font-sans">{chapter.technicalDescription}</p>
      </div>
    </div>
  );
};
