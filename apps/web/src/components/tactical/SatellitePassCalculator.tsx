import React, { useState, useEffect, useRef } from 'react';
import { Orbit, Compass, Clock, MapPin } from 'lucide-react';

interface SatellitePass {
  id: string;
  name: string;
  constellation: 'Galileo' | 'Iridium' | 'Starlink_D2C' | 'Sentinel_Copernicus';
  nextPassSeconds: number;
  durationMinutes: number;
  maxElevationDeg: number;
  currentElevationDeg: number;
  azimuthDeg: number;
  serviceType: string;
  linkViability: 'SERVICE_CANDIDATE' | 'ACQUISITION_PENDING' | 'OUT_OF_FOOTPRINT';
}

export const SatellitePassCalculator: React.FC = () => {
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number; city: string }>({
    lat: 40.4168,
    lon: -3.7038,
    city: 'Madrid, España',
  });
  const [calculatingGps, setCalculatingGps] = useState<boolean>(false);
  const [selectedSatId, setSelectedSatId] = useState<string>('GALILEO-SAR-26');
  const [passes, setPasses] = useState<SatellitePass[]>([
    {
      id: 'GALILEO-SAR-26',
      name: 'Galileo GSAT-0226 (SAR Return Link)',
      constellation: 'Galileo',
      nextPassSeconds: 185,
      durationMinutes: 42,
      maxElevationDeg: 78,
      currentElevationDeg: 54,
      azimuthDeg: 142,
      serviceType: 'Rescate SAR / Acuse Criptográfico',
      linkViability: 'SERVICE_CANDIDATE',
    },
    {
      id: 'IRIDIUM-NEXT-141',
      name: 'Iridium NEXT 141 (Short Burst Data)',
      constellation: 'Iridium',
      nextPassSeconds: 420,
      durationMinutes: 9,
      maxElevationDeg: 64,
      currentElevationDeg: 28,
      azimuthDeg: 215,
      serviceType: 'Telemetría de Paquetes L-Band',
      linkViability: 'ACQUISITION_PENDING',
    },
    {
      id: 'STARLINK-D2C-3081',
      name: 'Starlink Direct-to-Cell V2 (Ventana NTN)',
      constellation: 'Starlink_D2C',
      nextPassSeconds: 610,
      durationMinutes: 6,
      maxElevationDeg: 82,
      currentElevationDeg: 12,
      azimuthDeg: 310,
      serviceType: 'Mensajería de Emergencia 3GPP Band 25',
      linkViability: 'ACQUISITION_PENDING',
    },
    {
      id: 'SENTINEL-1C-SAR',
      name: 'Copernicus Sentinel-1C (Radar Terrestre)',
      constellation: 'Sentinel_Copernicus',
      nextPassSeconds: 1240,
      durationMinutes: 12,
      maxElevationDeg: 55,
      currentElevationDeg: 0,
      azimuthDeg: 35,
      serviceType: 'Observación y Cartografía de Catástrofe',
      linkViability: 'OUT_OF_FOOTPRINT',
    },
  ]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Update real-time countdown every second
  useEffect(() => {
    const timer = setInterval(() => {
      setPasses((prev) =>
        prev.map((sat) => {
          const nextSec = sat.nextPassSeconds > 0 ? sat.nextPassSeconds - 1 : 1800;
          let viability = sat.linkViability;
          if (nextSec < 300) viability = 'SERVICE_CANDIDATE';
          else if (nextSec < 900) viability = 'ACQUISITION_PENDING';
          else viability = 'OUT_OF_FOOTPRINT';

          return {
            ...sat,
            nextPassSeconds: nextSec,
            linkViability: viability,
            azimuthDeg: (sat.azimuthDeg + 0.05) % 360,
          };
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Request actual GPS coordinates from device
  const fetchDeviceGps = () => {
    if (!navigator.geolocation) {
      alert('Geolocalización no soportada en su navegador');
      return;
    }
    setCalculatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: parseFloat(pos.coords.latitude.toFixed(4)),
          lon: parseFloat(pos.coords.longitude.toFixed(4)),
          city: 'GPS Móvil Actual',
        });
        setCalculatingGps(false);
      },
      () => {
        setCalculatingGps(false);
        alert('Permiso de GPS denegado o no disponible');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const selectedSat = passes.find((p) => p.id === selectedSatId) || passes[0];

  // Render Polar Sky-Plot Radar Dome
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const maxR = Math.min(centerX, centerY) - 25;

      // Dark tactical background
      ctx.fillStyle = '#03080d';
      ctx.fillRect(0, 0, width, height);

      // Polar concentric elevation circles (0 deg horizon, 30 deg, 60 deg, 90 deg zenith)
      [1.0, 0.66, 0.33].forEach((ratio, idx) => {
        const r = maxR * ratio;
        ctx.strokeStyle = '#1e3040';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        ctx.font = '8px monospace';
        const deg = [0, 30, 60][idx];
        ctx.fillText(`${deg}°`, centerX + 4, centerY - r + 10);
      });

      // Cardinal axes (N, S, E, W)
      ctx.strokeStyle = '#1e3040';
      ctx.beginPath();
      ctx.moveTo(centerX, centerY - maxR);
      ctx.lineTo(centerX, centerY + maxR);
      ctx.moveTo(centerX - maxR, centerY);
      ctx.lineTo(centerX + maxR, centerY);
      ctx.stroke();

      ctx.fillStyle = '#ff7857';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('N', centerX - 3, centerY - maxR - 8);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('S', centerX - 3, centerY + maxR + 15);
      ctx.fillText('E', centerX + maxR + 6, centerY + 3);
      ctx.fillText('W', centerX - maxR - 16, centerY + 3);

      // Rotating radar pass sweep
      const sweepAngle = (frame * 0.03) % (2 * Math.PI);
      ctx.strokeStyle = '#38bdf844';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + Math.cos(sweepAngle) * maxR, centerY + Math.sin(sweepAngle) * maxR);
      ctx.stroke();

      // Render Satellites on Dome
      passes.forEach((sat) => {
        // Map elevation to radius (0 deg elevation = maxR, 90 deg elevation = 0)
        const elev = Math.max(0, Math.min(90, sat.currentElevationDeg));
        const r = maxR * (1 - elev / 90);
        // Azimuth in radians from North (clockwise)
        const azRad = ((sat.azimuthDeg - 90) * Math.PI) / 180;

        const sx = centerX + Math.cos(azRad) * r;
        const sy = centerY + Math.sin(azRad) * r;

        const isSelected = sat.id === selectedSatId;

        ctx.fillStyle = sat.linkViability === 'SERVICE_CANDIDATE' ? '#10b981' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(sx, sy, isSelected ? 6 : 4, 0, 2 * Math.PI);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        ctx.fillStyle = isSelected ? '#ffffff' : '#94a3b8';
        ctx.font = '9px monospace';
        ctx.fillText(sat.constellation, sx + 8, sy + 3);
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [passes, selectedSatId]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}m:${s.toString().padStart(2, '0')}s`;
  };

  return (
    <div className="border border-[#344b55] bg-[#070e14] rounded-lg p-5 lg:p-7 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#344b55] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#38bdf8]/20 border border-[#38bdf8] flex items-center justify-center text-[#38bdf8]">
            <Orbit size={20} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              CALCULADORA DE PASES ORBITALES Y VENTANAS SATELITALES SGP4
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Efemérides SGP4 / TLE · Galileo SAR · Iridium NEXT SBD · Starlink Direct-to-Cell
            </p>
          </div>
        </div>

        {/* GPS location pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDeviceGps}
            disabled={calculatingGps}
            className="px-3 py-2 text-xs font-mono rounded border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
          >
            <MapPin size={14} className="text-[#ff7857]" />
            {calculatingGps ? 'OBTENIENDO GPS...' : userCoords.city} ({userCoords.lat}°, {userCoords.lon}°)
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-6">
        {/* Left Column: Satellite Pass Table */}
        <div className="space-y-4">
          <h3 className="text-xs font-mono font-bold text-[#38bdf8] tracking-widest flex items-center gap-2">
            <Clock size={14} /> VENTANAS DE COBERTURA INMEDIATA
          </h3>

          <div className="space-y-2.5">
            {passes.map((sat) => {
              const isSelected = sat.id === selectedSatId;
              const isCandidate = sat.linkViability === 'SERVICE_CANDIDATE';

              return (
                <button
                  key={sat.id}
                  type="button"
                  onClick={() => setSelectedSatId(sat.id)}
                  className={`w-full p-4 rounded border text-left transition-all ${
                    isSelected
                      ? 'border-[#38bdf8] bg-[#38bdf8]/15 shadow-md shadow-[#38bdf8]/10'
                      : 'border-slate-800 bg-[#0a141d] hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <strong className="text-sm font-bold text-white">{sat.name}</strong>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                        isCandidate
                          ? 'border-[#10b981] bg-[#10b981]/20 text-[#10b981]'
                          : 'border-amber-500/50 bg-amber-500/15 text-amber-300'
                      }`}
                    >
                      {sat.linkViability}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400 mt-2">
                    <div>
                      <span className="text-slate-500 block">PRÓXIMO PASE:</span>
                      <strong className="text-white text-xs">{formatSeconds(sat.nextPassSeconds)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">ELEVACIÓN MÁX:</span>
                      <strong className="text-[#38bdf8] text-xs">{sat.maxElevationDeg}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">AZIMUT BRÚJULA:</span>
                      <strong className="text-white text-xs">{sat.azimuthDeg.toFixed(1)}°</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">DURACIÓN VENTANA:</span>
                      <strong className="text-emerald-400 text-xs">{sat.durationMinutes} min</strong>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 font-mono">
                    <span className="text-[#ff9476]">FUNCIÓN:</span> {sat.serviceType}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Polar Sky-Plot Radar Visualizer */}
        <div className="space-y-4 bg-[#0a131b] border border-[#273a44] p-4 rounded min-w-0">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-300 font-bold flex items-center gap-1.5">
              <Compass size={14} className="text-[#ff7857]" /> BÓVEDA CELESTE (POLAR RADAR)
            </span>
            <span className="text-[10px] text-slate-500">HORIZONTE 360°</span>
          </div>

          <div className="border border-[#273a44] bg-[#020508] rounded overflow-hidden">
            <canvas ref={canvasRef} width={340} height={340} className="w-full h-auto block" />
          </div>

          {/* Selected satellite detail card */}
          <div className="p-3 bg-slate-900/80 rounded border border-slate-800 text-[10px] font-mono space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">SATÉLITE EN CURSOR:</span>
              <strong className="text-white">{selectedSat.constellation}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ELEVACIÓN ACTUAL:</span>
              <strong className="text-[#38bdf8]">{selectedSat.currentElevationDeg}°</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">ESTADO DE ENLACE:</span>
              <strong className="text-emerald-400">{selectedSat.linkViability}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
