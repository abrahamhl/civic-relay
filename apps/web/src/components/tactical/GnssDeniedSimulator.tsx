import React, { useState, useEffect, useRef } from 'react';
import { Compass, ShieldAlert, Crosshair, Cpu } from 'lucide-react';

export const GnssDeniedSimulator: React.FC = () => {
  const [gpsSpoofed, setGpsSpoofed] = useState<boolean>(false);
  const [wifiRttEnabled, setWifiRttEnabled] = useState<boolean>(true);
  const [confidenceLabel, setConfidenceLabel] = useState<string>('GNSS_VERIFIED');
  const [covarianceErrorMeters, setCovarianceErrorMeters] = useState<number>(3.2);
  const [confidenceScore, setConfidenceScore] = useState<number>(96);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // EKF State Transition logic
  useEffect(() => {
    if (gpsSpoofed) {
      if (wifiRttEnabled) {
        setConfidenceLabel('ANCHORED_TO_AIRBORNE_RELAY');
        setCovarianceErrorMeters(1.85);
        setConfidenceScore(89);
      } else {
        setConfidenceLabel('COOPERATIVE_DEAD_RECKONING (IMU DRIFT)');
        setCovarianceErrorMeters(48.5);
        setConfidenceScore(34);
      }
    } else {
      setConfidenceLabel('GNSS_VERIFIED (GALILEO OS-NMA)');
      setCovarianceErrorMeters(2.4);
      setConfidenceScore(98);
    }
  }, [gpsSpoofed, wifiRttEnabled]);

  // 2D Tactical Multilateration Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const render = () => {
      t += 0.04;
      const width = canvas.width;
      const height = canvas.height;

      // Dark tactical coordinate grid
      ctx.fillStyle = '#03080c';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = '#0f202d';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
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

      const centerX = width / 2;
      const centerY = height / 2;

      // Airborne Anchor Drones (Known positions)
      const anchors = [
        { x: centerX - 180, y: centerY - 90, label: 'DRON ANCLA A (RTK)' },
        { x: centerX + 180, y: centerY - 90, label: 'DRON ANCLA B (RTK)' },
        { x: centerX, y: centerY + 110, label: 'DRON ANCLA C (RTK)' },
      ];

      anchors.forEach((a) => {
        // Drone icon
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(a.x, a.y, 6, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(a.label, a.x - 45, a.y - 12);

        // Wi-Fi RTT 802.11mc ToF Distance Range Rings
        if (wifiRttEnabled) {
          const distToUser = Math.hypot(centerX - a.x, centerY - a.y);
          ctx.strokeStyle = '#38bdf822';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(a.x, a.y, distToUser, 0, 2 * Math.PI);
          ctx.stroke();

          // RTT ToF Beam
          const beamPhase = (t * 3 + a.x * 0.01) % 1;
          const bx = a.x + (centerX - a.x) * beamPhase;
          const by = a.y + (centerY - a.y) * beamPhase;
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(bx, by, 2, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Target Node (Center)
      // Covariance Ellipse (Shrinks or Expands based on error)
      const ellipseR = covarianceErrorMeters * 2.2;
      ctx.fillStyle = gpsSpoofed && !wifiRttEnabled ? '#f43f5e22' : '#10b98122';
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, ellipseR, ellipseR * 0.8, 0, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = gpsSpoofed && !wifiRttEnabled ? '#f43f5e' : '#10b981';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Node point
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
      ctx.fill();

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText('NODO MÓVIL (EKF FUSION)', centerX - 65, centerY - 14);

      // Raw Spoofed GPS Ghost Marker (if spoofed)
      if (gpsSpoofed) {
        const ghostX = centerX + 120 + Math.sin(t) * 15;
        const ghostY = centerY - 60 + Math.cos(t) * 15;

        ctx.strokeStyle = '#f43f5e';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(ghostX, ghostY, 12, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#f87171';
        ctx.font = '9px monospace';
        ctx.fillText('⚠️ SEÑAL GNSS FALSIFICADA (DESECHADA)', ghostX - 80, ghostY + 22);
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [gpsSpoofed, wifiRttEnabled, covarianceErrorMeters]);

  return (
    <div className="border border-[#344b55] bg-[#070e14] rounded-lg p-5 lg:p-7 text-slate-100 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#344b55] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#10b981]/20 border border-[#10b981] flex items-center justify-center text-[#10b981]">
            <Compass size={20} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              NAVEGACIÓN COOPERATIVA EN ENTORNOS GNSS-DENIED
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Filtro Kalman Extendido (EKF) · Wi-Fi RTT IEEE 802.11mc/az ToF · Detección de Suplantación
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setGpsSpoofed(!gpsSpoofed)}
          className={`px-4 py-2 text-xs font-mono font-bold rounded border flex items-center gap-2 transition-colors ${
            gpsSpoofed
              ? 'border-[#f43f5e] bg-[#f43f5e] text-white animate-pulse'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <ShieldAlert size={14} />
          {gpsSpoofed ? 'SUPLANTACIÓN GNSS ACTIVA (RESTAURAR)' : 'SIMULAR SPOOFING GNSS HOSTIL'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 mt-6">
        <div className="space-y-4 bg-[#0b1620] border border-[#273a44] p-5 rounded">
          <h3 className="text-xs font-mono font-bold text-[#10b981] tracking-widest flex items-center gap-2">
            <Cpu size={14} /> FUSIÓN SENSORIAL EKF
          </h3>

          <div className="space-y-2">
            <label className="block text-[11px] font-mono text-slate-400">ANCLAS WI-FI RTT AEROTRANSPORTADAS</label>
            <button
              type="button"
              onClick={() => setWifiRttEnabled(!wifiRttEnabled)}
              className={`w-full p-2.5 rounded border text-left text-xs font-mono transition-colors ${
                wifiRttEnabled
                  ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-white font-bold'
                  : 'border-slate-800 bg-slate-900 text-slate-400'
              }`}
            >
              {wifiRttEnabled ? '✓ Anclas RTT 802.11mc Activas' : '✗ Desactivar Anclas RTT'}
            </button>
          </div>

          <div className="pt-3 border-t border-[#273a44] space-y-3 text-[11px] font-mono">
            <div>
              <span className="text-slate-500 block text-[9px]">ETIQUETA DE CONFIANZA:</span>
              <strong className={gpsSpoofed && !wifiRttEnabled ? 'text-[#f43f5e]' : 'text-[#10b981]'}>
                {confidenceLabel}
              </strong>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px]">INCERTIDUMBRE COVARIANZA (1-SIGMA):</span>
              <strong className="text-white text-base">±{covarianceErrorMeters} m</strong>
            </div>

            <div>
              <span className="text-slate-500 block text-[9px]">ÍNDICE DE CONFIANZA (C_pos):</span>
              <strong className="text-[#38bdf8] text-base">{confidenceScore}%</strong>
            </div>
          </div>
        </div>

        <div className="border border-[#273a44] bg-[#020508] rounded overflow-hidden p-3 min-w-0">
          <div className="flex justify-between items-center text-xs font-mono mb-2">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Crosshair size={14} className="text-[#10b981]" /> MAPA DE MULTILATERACIÓN HIPERBÓLICA
            </span>
            <span className="text-[10px] text-slate-500">RESOLUCIÓN SUB-MÉTRICA ToF</span>
          </div>

          <canvas ref={canvasRef} width={760} height={260} className="w-full h-auto block rounded" />
        </div>
      </div>
    </div>
  );
};
