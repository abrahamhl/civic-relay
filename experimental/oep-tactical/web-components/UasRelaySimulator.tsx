import React, { useState, useEffect, useRef } from 'react';
import { Plane, Send, Sliders, Cpu } from 'lucide-react';

export const UasRelaySimulator: React.FC = () => {
  const [altitudeMeters, setAltitudeMeters] = useState<number>(120);
  const [isTethered, setIsTethered] = useState<boolean>(true);
  const [terrainType, setTerrainType] = useState<'urban' | 'mountain' | 'forest'>('urban');
  const [lastPackedMavlinkHex, setLastPackedMavlinkHex] = useState<string>('');
  const [txPacketCount, setTxPacketCount] = useState<number>(142);
  const [packetLossRate] = useState<number>(2.4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Terrain parameters for ITM / A2G path loss model
  const terrainParams = {
    urban: { a: 12.08, b: 0.11, losRadiusKm: 6.8, nlosLossDb: 22.0 },
    mountain: { a: 4.88, b: 0.43, losRadiusKm: 14.5, nlosLossDb: 15.0 },
    forest: { a: 7.20, b: 0.28, losRadiusKm: 8.2, nlosLossDb: 18.5 },
  }[terrainType];

  // Effective coverage radius calculated from altitude and terrain
  const effectiveRadiusKm = (terrainParams.losRadiusKm * Math.sqrt(altitudeMeters / 100)).toFixed(1);

  // Generate synthetic MAVLink v2 packet with Message ID 0xBF
  const packMavlinkPacket = () => {
    const seq = (txPacketCount % 255).toString(16).padStart(2, '0');
    const sysId = '01';
    const compId = '44'; // Radio
    const msgId = 'bf0000'; // 0x0000BF in Little Endian
    const samplePayload = '5e0000004f7a8b12270f00005a0b00000103'; // Fixed-point coords & OEP header
    const crc = 'c4d8';

    const fullPacket = `fd180000${seq}${sysId}${compId}${msgId}${samplePayload}${crc}`.toUpperCase();
    setLastPackedMavlinkHex(fullPacket);
    setTxPacketCount((c) => c + 1);
  };

  useEffect(() => {
    packMavlinkPacket();
  }, [altitudeMeters, terrainType]);

  // Canvas visualizer of UAS coverage cone and Ground Nodes
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

      ctx.fillStyle = '#050a0f';
      ctx.fillRect(0, 0, width, height);

      // Terrain profile line
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, height - 35);
      for (let x = 0; x < width; x += 20) {
        let elev = 0;
        if (terrainType === 'mountain') elev = Math.sin(x * 0.015) * 25 + Math.cos(x * 0.03) * 12;
        if (terrainType === 'urban') elev = (x % 60 < 25 ? -18 : 0);
        ctx.lineTo(x, height - 35 + elev);
      }
      ctx.stroke();

      // Tethered UAS anchor base
      const baseX = width / 2;
      const baseY = height - 35;
      const uasY = baseY - (altitudeMeters / 150) * 160;

      // Micro-cable power line
      if (isTethered) {
        ctx.strokeStyle = '#ff7857';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(baseX, uasY);
        ctx.stroke();

        ctx.fillStyle = '#ff7857';
        ctx.fillRect(baseX - 10, baseY - 6, 20, 6);
        ctx.font = '8px monospace';
        ctx.fillText('ESTACIÓN TIERRA (3 kW)', baseX - 45, baseY + 14);
      }

      // Coverage Cone
      const coneRadius = (altitudeMeters / 150) * 260;
      const coneGrad = ctx.createRadialGradient(baseX, uasY, 10, baseX, baseY, coneRadius);
      coneGrad.addColorStop(0, '#38bdf844');
      coneGrad.addColorStop(0.8, '#38bdf808');
      coneGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = coneGrad;
      ctx.beginPath();
      ctx.moveTo(baseX, uasY);
      ctx.lineTo(baseX - coneRadius, baseY);
      ctx.lineTo(baseX + coneRadius, baseY);
      ctx.closePath();
      ctx.fill();

      // Tethered Drone Unit
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(baseX, uasY, 7, 0, 2 * Math.PI);
      ctx.fill();

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`UAS RELAY PERSISTENTE (${altitudeMeters}m AGL)`, baseX - 95, uasY - 14);

      // Ground Isolated Nodes
      const nodes = [
        { x: baseX - 140, label: 'COTS-NODE-01' },
        { x: baseX - 60, label: 'COTS-NODE-02' },
        { x: baseX + 80, label: 'ATAK-TEAM-BRAVO' },
        { x: baseX + 190, label: 'COTS-NODE-03' },
      ];

      nodes.forEach((n, idx) => {
        const inCoverage = Math.abs(n.x - baseX) <= coneRadius;
        ctx.fillStyle = inCoverage ? '#10b981' : '#ef4444';
        ctx.beginPath();
        ctx.arc(n.x, baseY - 4, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.font = '9px monospace';
        ctx.fillStyle = inCoverage ? '#86efac' : '#fca5a5';
        ctx.fillText(n.label, n.x - 25, baseY + 18);

        // RF Micro-burst beam animation
        if (inCoverage) {
          const beamPhase = (t * 2 + idx) % 1;
          const beamX = baseX + (n.x - baseX) * beamPhase;
          const beamY = uasY + (baseY - 4 - uasY) * beamPhase;

          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(beamX, beamY, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [altitudeMeters, isTethered, terrainType]);

  return (
    <div className="border border-[#344b55] bg-[#070e14] rounded-lg p-5 lg:p-7 text-slate-100 shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#344b55] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#38bdf8]/20 border border-[#38bdf8] flex items-center justify-center text-[#38bdf8]">
            <Plane size={20} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              SIMULADOR DE RELAY AEROTRANSPORTADO UAS (MAVLINK V2)
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Modelo Propagación ITM / Longley-Rice · Custom Message 0x0000BF · Cono de Cobertura RF
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={packMavlinkPacket}
          className="px-4 py-2 bg-[#38bdf8] text-[#050b10] rounded font-bold text-xs flex items-center gap-2 hover:bg-[#7dd3fc]"
        >
          <Send size={14} /> INYECTAR RÁFAGA MAVLINK
        </button>
      </div>

      <div className="grid lg:grid-cols-[300px_1fr] gap-6 mt-6">
        {/* Controls */}
        <div className="space-y-5 bg-[#0b1620] border border-[#273a44] p-5 rounded">
          <h3 className="text-xs font-mono font-bold text-[#38bdf8] tracking-widest flex items-center gap-2">
            <Sliders size={14} /> DINÁMICA DE VUELO Y OROGRAFÍA
          </h3>

          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>ALTITUD DEL DRON (AGL)</span>
              <span className="text-[#38bdf8] font-bold">{altitudeMeters} m</span>
            </div>
            <input
              type="range"
              min="30"
              max="150"
              value={altitudeMeters}
              onChange={(e) => setAltitudeMeters(Number(e.target.value))}
              className="w-full accent-[#38bdf8] cursor-pointer"
            />
            <span className="text-[9px] font-mono text-slate-500">
              Radio LoS Calculado: {effectiveRadiusKm} km de cobertura horizontal
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-2">TIPO DE PLATAFORMA</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsTethered(true)}
                className={`p-2 rounded text-[10px] font-mono border ${
                  isTethered ? 'border-[#ff7857] bg-[#ff7857]/20 text-[#ffb09c] font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                Cautivo (24h Continua)
              </button>
              <button
                type="button"
                onClick={() => setIsTethered(false)}
                className={`p-2 rounded text-[10px] font-mono border ${
                  !isTethered ? 'border-[#ff7857] bg-[#ff7857]/20 text-[#ffb09c] font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                Libre (Batería 45m)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-2">MODELO DE TERRENO (ITM)</label>
            <div className="space-y-1.5">
              {[
                { id: 'urban', label: 'Urbano Denso (Pérdidas NLoS 22 dB)' },
                { id: 'mountain', label: 'Montaña / Cañones Ciegos' },
                { id: 'forest', label: 'Vegetación Densa' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTerrainType(t.id as any)}
                  className={`w-full p-2 text-left rounded text-[10px] font-mono border ${
                    terrainType === t.id ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-white font-bold' : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[#273a44] text-[10px] font-mono space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">PAQUETES EMITIDOS:</span>
              <strong className="text-white">{txPacketCount}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">PÉRDIDA DE PAQUETES:</span>
              <strong className="text-[#10b981]">{packetLossRate}%</strong>
            </div>
          </div>
        </div>

        {/* Canvas & MAVLink Hex Inspector */}
        <div className="space-y-4 min-w-0">
          <div className="border border-[#273a44] bg-[#04080c] rounded overflow-hidden">
            <canvas ref={canvasRef} width={760} height={260} className="w-full h-auto block" />
          </div>

          {/* MAVLink Packet Raw Hex Inspector */}
          <div className="bg-[#0b151f] border border-[#273a44] p-4 rounded">
            <div className="flex justify-between items-center text-xs font-mono mb-2">
              <span className="text-[#ff9476] font-bold flex items-center gap-1.5">
                <Cpu size={14} /> INSPECTOR DE TRAMA MAVLINK V2 (MSG ID 0xBF / 191)
              </span>
              <span className="text-[10px] text-slate-500">BYTE ALIGNMENT PACKED</span>
            </div>
            <div className="bg-[#04080c] p-3 rounded font-mono text-[11px] text-[#38bdf8] break-all border border-slate-800 leading-relaxed">
              {lastPackedMavlinkHex}
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3 text-[9px] font-mono text-slate-400">
              <div>
                <span className="text-slate-500 block">MAGIC / STX:</span>
                <span className="text-white">0xFD (MAVLink v2)</span>
              </div>
              <div>
                <span className="text-slate-500 block">MSG ID:</span>
                <span className="text-white">0x0000BF (OEP)</span>
              </div>
              <div>
                <span className="text-slate-500 block">ENCRIPTACIÓN:</span>
                <span className="text-[#10b981]">ChaCha20-Poly1305</span>
              </div>
              <div>
                <span className="text-slate-500 block">INTEGRIDAD:</span>
                <span className="text-amber-400">CRC-16 MCRF4XX</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
