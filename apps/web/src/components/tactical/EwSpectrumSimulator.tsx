import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert, Zap, Radio, Lock } from 'lucide-react';

export const EwSpectrumSimulator: React.FC = () => {
  const [jammingActive, setJammingActive] = useState<boolean>(false);
  const [emconLevel, setEmconLevel] = useState<0 | 1 | 2>(0);
  const [activeChannelMhz, setActiveChannelMhz] = useState<number>(868.1);
  const [noiseFloorDbm, setNoiseFloorDbm] = useState<number>(-112);
  const [packetLossPercent, setPacketLossPercent] = useState<number>(1.2);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Frequency channels available for agile hopping
  const channels = [868.1, 868.3, 868.5, 869.525, 915.0, 916.5];

  // Frequency agility auto-hop when jamming detected
  useEffect(() => {
    let timer: any;
    if (jammingActive && emconLevel !== 2) {
      setNoiseFloorDbm(-68);
      setPacketLossPercent(94.5);

      // Auto-hop to clearer channel
      timer = setInterval(() => {
        setActiveChannelMhz((curr) => {
          const nextIdx = (channels.indexOf(curr) + 1) % channels.length;
          return channels[nextIdx];
        });
      }, 1200);
    } else {
      setNoiseFloorDbm(-112);
      setPacketLossPercent(emconLevel === 2 ? 0 : 1.2);
    }
    return () => clearInterval(timer);
  }, [jammingActive, emconLevel]);

  // Waterfall FFT Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      // Dark tactical background
      ctx.fillStyle = '#03080d';
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = '#0f202d';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // FFT Spectrum Line (Noise floor + Signal spikes)
      ctx.beginPath();
      ctx.strokeStyle = jammingActive ? '#f43f5e' : '#38bdf8';
      ctx.lineWidth = 1.8;

      const baseLevel = jammingActive ? height * 0.4 : height * 0.85;

      for (let x = 0; x < width; x++) {
        // Base noise floor fluctuation
        const noise = (Math.random() - 0.5) * (jammingActive ? 40 : 12);
        let y = baseLevel + noise;

        // Active transmitter carrier spike (if not in EMCON 2 Blackout)
        if (emconLevel !== 2) {
          const chanNormX = ((activeChannelMhz - 860) / 60) * width;
          const dist = Math.abs(x - chanNormX);
          if (dist < 15) {
            // Signal carrier peak
            const peak = Math.cos((dist / 15) * (Math.PI / 2)) * 140;
            y -= peak;
          }
        }

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Channel markers on top
      channels.forEach((ch) => {
        const markerX = ((ch - 860) / 60) * width;
        const isActive = ch === activeChannelMhz;

        ctx.strokeStyle = isActive ? '#ff7857' : '#334155';
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(markerX, 0);
        ctx.lineTo(markerX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isActive ? '#ff7857' : '#64748b';
        ctx.font = '8px monospace';
        ctx.fillText(`${ch}MHz`, markerX - 16, 15);
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [jammingActive, emconLevel, activeChannelMhz]);

  return (
    <div className="border border-[#344b55] bg-[#070e14] rounded-lg p-5 lg:p-7 text-slate-100 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#344b55] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#f43f5e]/20 border border-[#f43f5e] flex items-center justify-center text-[#f43f5e]">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              ESPECTRO EW & CONTROL DE EMISIÓN TÁCTICO (EMCON)
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Mitigación de Jamming · LPI/LPD Micro-Burst (&lt;8.2ms) · Conmutación Agilidad RF
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setJammingActive(!jammingActive)}
          className={`px-4 py-2 text-xs font-mono font-bold rounded border flex items-center gap-2 transition-colors ${
            jammingActive
              ? 'border-[#f43f5e] bg-[#f43f5e] text-white animate-pulse'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Zap size={14} />
          {jammingActive ? 'PERTURBACIÓN EW ACTIVA (DESACTIVAR)' : 'SIMULAR BARRAGE JAMMING HOSTIL'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 mt-6">
        {/* EMCON Level Selector */}
        <div className="space-y-4 bg-[#0b1620] border border-[#273a44] p-5 rounded">
          <h3 className="text-xs font-mono font-bold text-[#ff9476] tracking-widest flex items-center gap-2">
            <Lock size={14} /> PERFILES DETERMINISTAS EMCON
          </h3>

          {[
            {
              level: 0,
              name: 'EMCON 0: OPERACIÓN NORMAL',
              desc: 'Multi-radio activa (Wi-Fi, BLE, Sub-GHz). Balizamiento periódico.',
              color: 'emerald',
            },
            {
              level: 1,
              name: 'EMCON 1: RESTRINGIDO / RECEPCIÓN',
              desc: 'Cero balizas de reposo. Transmisión exclusiva por ráfaga autorizada.',
              color: 'amber',
            },
            {
              level: 2,
              name: 'EMCON 2: SILENCIO DE RADIO (BLACKOUT)',
              desc: 'Transceptores apagados. Cero radiación RF. Retención en cola local.',
              color: 'rose',
            },
          ].map((profile) => (
            <button
              key={profile.level}
              type="button"
              onClick={() => setEmconLevel(profile.level as any)}
              className={`w-full p-3 text-left rounded border transition-colors ${
                emconLevel === profile.level
                  ? 'border-[#ff7857] bg-[#ff7857]/20 text-white font-bold'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
            >
              <strong className="block text-xs font-mono">{profile.name}</strong>
              <span className="text-[10px] text-slate-400 block mt-1 leading-normal font-sans">{profile.desc}</span>
            </button>
          ))}

          <div className="pt-3 border-t border-[#273a44] text-[10px] font-mono space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">PISO DE RUIDO TÉRMICO:</span>
              <strong className={jammingActive ? 'text-[#f43f5e]' : 'text-[#38bdf8]'}>{noiseFloorDbm} dBm</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">CANAL ACTIVO EN SALTO:</span>
              <strong className="text-white">{activeChannelMhz} MHz</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">TASA DE PÉRDIDA:</span>
              <strong className={packetLossPercent > 50 ? 'text-[#f43f5e]' : 'text-[#10b981]'}>
                {packetLossPercent}%
              </strong>
            </div>
          </div>
        </div>

        {/* Real-time Spectrum Analyzer View */}
        <div className="border border-[#273a44] bg-[#020508] rounded overflow-hidden p-3 space-y-3 min-w-0">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Radio size={14} className="text-[#38bdf8]" /> ANALIZADOR DE ESPECTRO SDR (860 - 920 MHz)
            </span>
            <span className="text-[10px] text-slate-500">ANCHO DE BANDA: 125 kHz / SF=10</span>
          </div>

          <canvas ref={canvasRef} width={760} height={250} className="w-full h-auto block rounded" />

          <div className="bg-[#0b1620] p-2.5 rounded border border-slate-800 flex justify-between text-[10px] font-mono text-slate-400">
            <span>FIRMA LPI/LPD: RÁFAGAS &lt;8.2 ms (Inmune a goniómetros convencionales)</span>
            <span className="text-emerald-400">AGILIDAD PSEUDOALEATORIA ACTIVA</span>
          </div>
        </div>
      </div>
    </div>
  );
};
