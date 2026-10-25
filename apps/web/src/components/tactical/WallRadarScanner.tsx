import React, { useState, useEffect, useRef } from 'react';
import { Radio, Sliders, Volume2, VolumeX, RefreshCw, Zap } from 'lucide-react';

interface TargetDetection {
  id: string;
  depthMeters: number;
  lateralMeters: number;
  confidence: number;
  respirationRateBpm: number;
  heartRateBpm: number;
  type: 'HUMAN_TRAPPED' | 'STRUCTURAL_VOID' | 'METALLIC_CONDUIT';
  signalToNoiseRatioDb: number;
}

export const WallRadarScanner: React.FC = () => {
  // Radar parameters
  const [wallMaterial, setWallMaterial] = useState<'concrete' | 'brick' | 'drywall' | 'rubble'>('concrete');
  const [wallThicknessCm, setWallThicknessCm] = useState<number>(30);
  const [frequencyBand, setFrequencyBand] = useState<'uwb' | 'sub_ghz' | 'fmcw_24g'>('uwb');
  const [sensitivityGain, setSensitivityGain] = useState<number>(78);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(false);
  const [scanAngle, setScanAngle] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'b_scan' | 'vital_signs' | 'a_scan'>('b_scan');

  // Audio synthesis context
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Targets in room behind wall
  const [detections] = useState<TargetDetection[]>([
    {
      id: 'VICTIM-ALPHA-01',
      depthMeters: 2.85,
      lateralMeters: -0.8,
      confidence: 94,
      respirationRateBpm: 16.2,
      heartRateBpm: 76.5,
      type: 'HUMAN_TRAPPED',
      signalToNoiseRatioDb: 18.4,
    },
    {
      id: 'VICTIM-BRAVO-02',
      depthMeters: 4.20,
      lateralMeters: 1.4,
      confidence: 88,
      respirationRateBpm: 13.8,
      heartRateBpm: 82.0,
      type: 'HUMAN_TRAPPED',
      signalToNoiseRatioDb: 12.1,
    },
    {
      id: 'VOID-STRUCTURE-03',
      depthMeters: 1.60,
      lateralMeters: 0.3,
      confidence: 91,
      respirationRateBpm: 0,
      heartRateBpm: 0,
      type: 'STRUCTURAL_VOID',
      signalToNoiseRatioDb: 22.0,
    },
  ]);

  // Selected detection
  const [selectedTarget, setSelectedTarget] = useState<TargetDetection>(detections[0]);

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vitalsCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Material dielectric permittivity & attenuation constants
  const materialProps = {
    concrete: { er: 6.0, name: 'Hormigón Armado', attenuation: 14.5, color: '#94a3b8' },
    brick: { er: 4.0, name: 'Ladrillo Macizo', attenuation: 8.2, color: '#f97316' },
    drywall: { er: 2.5, name: 'Tabiquería / Madera', attenuation: 3.1, color: '#e2e8f0' },
    rubble: { er: 9.0, name: 'Escombros Mixtos / Colapso', attenuation: 24.0, color: '#78716c' },
  }[wallMaterial];

  // Radar acoustic beep synthesis
  const triggerRadarBeep = (freq: number) => {
    if (!audioFeedback) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Main B-Scan Radar Canvas animation
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

      // Dark tactical grid background
      ctx.fillStyle = '#04080c';
      ctx.fillRect(0, 0, width, height);

      // Range grid circles
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const centerX = width / 2;
      const originY = height - 20;

      for (let r = 50; r < height; r += 60) {
        ctx.beginPath();
        ctx.arc(centerX, originY, r, Math.PI, 2 * Math.PI);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '9px monospace';
        const meters = ((r / (height - 40)) * 6).toFixed(1);
        ctx.fillText(`${meters}m`, centerX + r - 25, originY - 5);
      }

      // Azimuth guide lines (-45 deg to +45 deg)
      [-0.6, -0.3, 0, 0.3, 0.6].forEach((angle) => {
        ctx.beginPath();
        ctx.moveTo(centerX, originY);
        ctx.lineTo(centerX + Math.sin(angle) * (height - 30), originY - Math.cos(angle) * (height - 30));
        ctx.stroke();
      });

      // Wall physical boundary
      const wallY = originY - (wallThicknessCm * 1.5 + 40);
      const wallHeight = wallThicknessCm * 1.5;

      ctx.fillStyle = `${materialProps.color}22`;
      ctx.fillRect(40, wallY - wallHeight, width - 80, wallHeight);
      ctx.strokeStyle = materialProps.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(40, wallY - wallHeight, width - 80, wallHeight);

      ctx.fillStyle = materialProps.color;
      ctx.font = '10px monospace';
      ctx.fillText(
        `MURO: ${materialProps.name} (${wallThicknessCm}cm | εr=${materialProps.er})`,
        50,
        wallY - wallHeight + 14
      );

      // Rebar grid reflections in concrete
      if (wallMaterial === 'concrete' || wallMaterial === 'rubble') {
        ctx.strokeStyle = '#64748b66';
        ctx.setLineDash([2, 4]);
        for (let rebarX = 60; rebarX < width - 60; rebarX += 30) {
          ctx.beginPath();
          ctx.arc(rebarX, wallY - wallHeight / 2, 4, 0, 2 * Math.PI);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // Radar sweep cone
      if (isScanning) {
        const sweepAngle = Math.sin(frame * 0.04) * 0.75;
        setScanAngle(sweepAngle);

        const sweepGrad = ctx.createRadialGradient(centerX, originY, 10, centerX, originY, height - 30);
        sweepGrad.addColorStop(0, '#ff785788');
        sweepGrad.addColorStop(0.5, '#ff785722');
        sweepGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = sweepGrad;
        ctx.beginPath();
        ctx.moveTo(centerX, originY);
        ctx.arc(centerX, originY, height - 30, Math.PI * 1.5 + sweepAngle - 0.25, Math.PI * 1.5 + sweepAngle + 0.25);
        ctx.closePath();
        ctx.fill();

        // Audio pulse when sweep passes center
        if (frame % 80 === 0) {
          triggerRadarBeep(880);
        }
      }

      // Render Detected Targets behind wall
      detections.forEach((det) => {
        // Map meters to canvas coords
        const rangeRatio = det.depthMeters / 6.0;
        const targetRadius = rangeRatio * (height - 40);
        const targetAngle = (det.lateralMeters / 3.0) * 0.6;

        const tx = centerX + Math.sin(targetAngle) * targetRadius;
        const ty = originY - Math.cos(targetAngle) * targetRadius;

        const isSelected = selectedTarget.id === det.id;

        // Micro-Doppler pulse wave
        const pulse = Math.sin(frame * 0.15 + (det.heartRateBpm / 60) * frame * 0.05) * 6;

        if (det.type === 'HUMAN_TRAPPED') {
          // Heat / Vital Sign Beacon
          ctx.fillStyle = isSelected ? '#ff7857' : '#f97316';
          ctx.beginPath();
          ctx.arc(tx, ty, 8 + Math.max(0, pulse), 0, 2 * Math.PI);
          ctx.fill();

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();

          // Target callout label
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`${det.id} [${det.confidence}%]`, tx + 14, ty - 6);

          ctx.fillStyle = '#38bdf8';
          ctx.font = '9px monospace';
          ctx.fillText(`Vitals: ${det.respirationRateBpm}rpm | ${det.heartRateBpm}bpm`, tx + 14, ty + 8);
          ctx.fillText(`Distancia: ${det.depthMeters.toFixed(2)}m (SNR: ${det.signalToNoiseRatioDb}dB)`, tx + 14, ty + 20);
        } else {
          // Structural void / conduit
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx - 8, ty - 8, 16, 16);
          ctx.fillStyle = '#c084fc';
          ctx.font = '9px monospace';
          ctx.fillText(`HUECO ESTRUCTURAL (${det.depthMeters}m)`, tx + 12, ty);
        }
      });

      // Radar Antennas on Bottom
      ctx.fillStyle = '#ff7857';
      ctx.beginPath();
      ctx.arc(centerX, originY, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.font = '9px monospace';
      ctx.fillText('ARRAY TRANSCEPTOR UWB 3.1–10.6 GHz', centerX - 95, originY + 16);

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [wallMaterial, wallThicknessCm, sensitivityGain, isScanning, selectedTarget, audioFeedback]);

  // Micro-Doppler Vital Signs Waveform Canvas
  useEffect(() => {
    const canvas = vitalsCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const renderVitals = () => {
      t += 0.05;
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#091118';
      ctx.fillRect(0, 0, width, height);

      // Grid
      ctx.strokeStyle = '#1e293b';
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

      // Respiration Signal (Cyan wave ~0.25 Hz)
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const timeVal = t + (x / width) * 8;
        const respFreq = selectedTarget.respirationRateBpm / 60;
        const yVal = height / 3 + Math.sin(timeVal * respFreq * 2 * Math.PI) * 22;
        if (x === 0) ctx.moveTo(x, yVal);
        else ctx.lineTo(x, yVal);
      }
      ctx.stroke();

      // Cardiac Micro-Doppler (Amber sharp pulses ~1.2 Hz)
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const timeVal = t + (x / width) * 8;
        const heartFreq = selectedTarget.heartRateBpm / 60;
        // Periodic ECG-like pulse shape
        const phase = (timeVal * heartFreq) % 1;
        let pulseHeight = 0;
        if (phase > 0.1 && phase < 0.18) {
          pulseHeight = Math.sin((phase - 0.1) * (Math.PI / 0.08)) * 32;
        }
        const yVal = (height * 2) / 3 - pulseHeight + (Math.random() - 0.5) * 2;
        if (x === 0) ctx.moveTo(x, yVal);
        else ctx.lineTo(x, yVal);
      }
      ctx.stroke();

      // Overlay text
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(
        `ONDAS RESPIRATORIAS: ${selectedTarget.respirationRateBpm} RPM (Desplazamiento Torácico ~3.2 mm)`,
        15,
        24
      );

      ctx.fillStyle = '#fbbf24';
      ctx.fillText(
        `MICRO-DOPPLER CARDIACO: ${selectedTarget.heartRateBpm} BPM (Fase RF Δφ = 0.44 rad)`,
        15,
        height / 2 + 18
      );

      animId = requestAnimationFrame(renderVitals);
    };

    renderVitals();
    return () => cancelAnimationFrame(animId);
  }, [selectedTarget]);

  return (
    <div className="border border-[#344b55] bg-[#070e14] rounded-lg p-5 lg:p-7 text-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#344b55] pb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#ff7857]/20 border border-[#ff7857] flex items-center justify-center text-[#ff7857]">
            <Radio size={20} className={isScanning ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              ESCÁNER MULTIESPECTRO RADAR UWB TRAS PAREDES
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                ACTIVO & OPERATIVO
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              FMCW / UWB SAR · Micro-Doppler Vital Signs · Dielectric Wall Permittivity Compensation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setAudioFeedback(!audioFeedback)}
            className={`px-3 py-2 text-xs font-mono border rounded flex items-center gap-2 transition-colors ${
              audioFeedback ? 'border-[#ff7857] bg-[#ff7857]/20 text-[#ff7857]' : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
            title="Audio feedback"
          >
            {audioFeedback ? <Volume2 size={15} /> : <VolumeX size={15} />}
            SONAR AUDIO
          </button>

          <button
            type="button"
            onClick={() => setIsScanning(!isScanning)}
            className={`px-4 py-2 text-xs font-mono font-bold tracking-wider rounded border flex items-center gap-2 transition-colors ${
              isScanning
                ? 'border-[#ff7857] bg-[#ff7857] text-[#050b10] hover:bg-[#ff967b]'
                : 'border-slate-600 bg-slate-800 text-slate-300'
            }`}
          >
            {isScanning ? <Zap size={14} /> : <RefreshCw size={14} />}
            {isScanning ? 'PAUSAR BARRIDO' : 'REANUDAR BARRIDO'}
          </button>
        </div>
      </div>

      {/* Main Grid: Controls + Visualizer */}
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 mt-6">
        {/* Left Column: Physical Radar Controls */}
        <div className="space-y-5 bg-[#0b1620] border border-[#273a44] p-5 rounded">
          <h3 className="text-xs font-mono font-bold text-[#ff9476] tracking-widest flex items-center gap-2">
            <Sliders size={14} /> PARÁMETROS DIELÉCTRICOS Y RF
          </h3>

          {/* Wall Material */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-2">MATERIAL DEL MURO / BARRERA</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'concrete', label: 'Hormigón (εr=6)' },
                { id: 'brick', label: 'Ladrillo (εr=4)' },
                { id: 'drywall', label: 'Tabique (εr=2.5)' },
                { id: 'rubble', label: 'Escombros (εr=9)' },
              ].map((mat) => (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setWallMaterial(mat.id as any)}
                  className={`px-3 py-2 text-[10px] font-mono rounded border text-left transition-colors ${
                    wallMaterial === mat.id
                      ? 'border-[#ff7857] bg-[#ff7857]/20 text-[#ffb09c] font-bold'
                      : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {mat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Wall Thickness */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>ESPESOR DEL MURO</span>
              <span className="text-[#ff9476] font-bold">{wallThicknessCm} cm</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={wallThicknessCm}
              onChange={(e) => setWallThicknessCm(Number(e.target.value))}
              className="w-full accent-[#ff7857] cursor-pointer"
            />
            <span className="text-[9px] font-mono text-slate-500">
              Atenuación: {(materialProps.attenuation * (wallThicknessCm / 100)).toFixed(1)} dB de pérdida extra
            </span>
          </div>

          {/* Frequency Band */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-2">BANDA Y MODULACIÓN</label>
            <div className="space-y-2">
              {[
                { id: 'uwb', title: 'UWB 3.1–10.6 GHz (Pulsed SAR)', desc: 'Máxima resolución espacial (~2 cm)' },
                { id: 'sub_ghz', title: 'Sub-GHz 915 MHz (Deep Penetration)', desc: 'Penetra hormigón denso y tierras húmedas' },
                { id: 'fmcw_24g', title: '24 GHz FMCW (Micro-Doppler)', desc: 'Sensibilidad sub-milimétrica a signos vitales' },
              ].map((band) => (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => setFrequencyBand(band.id as any)}
                  className={`w-full p-2.5 text-left rounded border transition-colors ${
                    frequencyBand === band.id
                      ? 'border-[#38bdf8] bg-[#38bdf8]/15 text-white'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <strong className="block text-[11px] font-mono">{band.title}</strong>
                  <span className="text-[9px] text-slate-500">{band.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sensitivity Gain */}
          <div>
            <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
              <span>GANANCIA LNA / SENSIBILIDAD</span>
              <span className="text-[#38bdf8] font-bold">{sensitivityGain} dB</span>
            </div>
            <input
              type="range"
              min="40"
              max="95"
              value={sensitivityGain}
              onChange={(e) => setSensitivityGain(Number(e.target.value))}
              className="w-full accent-[#38bdf8] cursor-pointer"
            />
          </div>

          {/* Target List */}
          <div className="pt-2 border-t border-[#273a44]">
            <h4 className="text-[10px] font-mono text-slate-400 mb-2">OBJETIVOS DETECTADOS</h4>
            <div className="space-y-1.5">
              {detections.map((det) => (
                <button
                  key={det.id}
                  type="button"
                  onClick={() => setSelectedTarget(det)}
                  className={`w-full p-2 rounded text-left text-[10px] font-mono flex items-center justify-between border ${
                    selectedTarget.id === det.id
                      ? 'border-[#ff7857] bg-[#ff7857]/20 text-white font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <span>{det.id}</span>
                  <span className="text-[#38bdf8]">{det.depthMeters}m</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Radar Visualizers */}
        <div className="flex flex-col gap-4 min-w-0">
          {/* Navigation Tabs */}
          <div className="flex gap-2 border-b border-[#273a44] pb-2 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveTab('b_scan')}
              className={`px-4 py-2 rounded-t font-bold transition-colors ${
                activeTab === 'b_scan'
                  ? 'border-b-2 border-[#ff7857] text-[#ff7857] bg-white/5'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              VISOR SAR 2D (B-SCAN COBERTURA)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vital_signs')}
              className={`px-4 py-2 rounded-t font-bold transition-colors ${
                activeTab === 'vital_signs'
                  ? 'border-b-2 border-[#38bdf8] text-[#38bdf8] bg-white/5'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ONDAS MICRO-DOPPLER VITALES (RESPIRACIÓN / PULSO)
            </button>
          </div>

          {/* Active Visualizer View */}
          {activeTab === 'b_scan' ? (
            <div className="relative border border-[#273a44] bg-[#04080c] rounded overflow-hidden">
              <canvas ref={canvasRef} width={760} height={460} className="w-full h-auto block" />
              <div className="absolute top-3 left-3 bg-[#0a141d]/80 border border-slate-700 px-3 py-1.5 rounded text-[10px] font-mono text-slate-300">
                ÁNGULO AZIMUT: {(scanAngle * 57.3).toFixed(1)}° | PENETRACIÓN MÁXIMA: 6.0m
              </div>
            </div>
          ) : (
            <div className="border border-[#273a44] bg-[#04080c] rounded overflow-hidden p-4 space-y-4">
              <div className="flex justify-between items-center text-xs font-mono">
                <span className="text-slate-300">ANÁLISIS DE TELEMETRÍA BIOMÉTRICA TRAS MURO</span>
                <span className="text-[#38bdf8] font-bold">OBJETIVO: {selectedTarget.id}</span>
              </div>
              <canvas ref={vitalsCanvasRef} width={760} height={280} className="w-full h-auto block rounded" />
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-[11px] font-mono">
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-slate-500 block">FRECUENCIA RESPIRATORIA</span>
                  <strong className="text-lg text-[#38bdf8]">{selectedTarget.respirationRateBpm} RPM</strong>
                  <span className="text-[9px] text-slate-400 block mt-1">Normal / Regular</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-slate-500 block">PULSO CARDIACO DOPPLER</span>
                  <strong className="text-lg text-[#fbbf24]">{selectedTarget.heartRateBpm} BPM</strong>
                  <span className="text-[9px] text-slate-400 block mt-1">Ritmo sinusal detectado</span>
                </div>
                <div className="bg-slate-900/60 p-3 rounded border border-slate-800">
                  <span className="text-slate-500 block">CERTEZA BIOMÉTRICA</span>
                  <strong className="text-lg text-[#10b981]">{selectedTarget.confidence}%</strong>
                  <span className="text-[9px] text-slate-400 block mt-1">SNR: {selectedTarget.signalToNoiseRatioDb} dB</span>
                </div>
              </div>
            </div>
          )}

          {/* Telemetry Footer */}
          <div className="bg-[#0e1a24] border border-[#273a44] p-3 rounded flex flex-wrap justify-between items-center text-[10px] font-mono text-slate-400">
            <span>VELOCIDAD DE ONDA EN MURO: {(3e8 / Math.sqrt(materialProps.er) / 1e8).toFixed(2)} × 10⁸ m/s</span>
            <span className="text-[#ff9476]">
              DESPLAZAMIENTO TORÁCICO DETECTABLE: ~0.8 mm a 4.5 metros de profundidad
            </span>
            <span className="text-emerald-400">FILTRADO DE RUIDO ESPECULAR ACTIVO</span>
          </div>
        </div>
      </div>
    </div>
  );
};
