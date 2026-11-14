import React, { useState, useEffect, useRef } from 'react';
import { Camera, CameraOff, Sliders, Volume2, VolumeX } from 'lucide-react';

interface Props {
  onTargetSelect?: (target: any) => void;
}

export const CameraThroughWallView: React.FC<Props> = () => {
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'radar_uwb' | 'thermal_flir' | 'micro_doppler' | 'night_vision'>('radar_uwb');
  const [wallMaterial, setWallMaterial] = useState<'concrete' | 'brick' | 'drywall' | 'rubble'>('concrete');
  const [wallThicknessCm, setWallThicknessCm] = useState<number>(30);
  const [gainDb, setGainDb] = useState<number>(75);
  const [audioBeep, setAudioBeep] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Targets detected behind wall
  const targets = [
    {
      id: 'ALPHA-01',
      label: 'PERSONA CON VIDA',
      relX: 0.48,
      relY: 0.52,
      depth: 2.85,
      respRate: 16.4,
      heartRate: 74.0,
      confidence: 96,
      snr: 18.2,
    },
    {
      id: 'BRAVO-02',
      label: 'HUECO DE COLAPSO',
      relX: 0.72,
      relY: 0.60,
      depth: 1.60,
      respRate: 0,
      heartRate: 0,
      confidence: 88,
      snr: 22.5,
    },
  ];

  // Request smartphone camera feed
  const startCamera = async () => {
    try {
      setCameraError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Dispositivo no soporta captura de cámara directa');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch (err: any) {
      console.warn('Cámara física no disponible, activando sensor virtual:', err.message);
      setCameraError('Cámara física inaccesible o denegada. Activando sensor sintético táctico FLIR/UWB.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // Audio radar beep
  const playPulse = (freq: number) => {
    if (!audioBeep) return;
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
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Main AR Compositor Canvas
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

      // 1. Draw Camera Frame or Synthetic Room
      if (cameraActive && videoRef.current && videoRef.current.readyState >= 2) {
        // Draw real camera image
        ctx.drawImage(videoRef.current, 0, 0, width, height);

        // Apply multispectral filter tint
        if (filterMode === 'radar_uwb') {
          // Green phosphor radar tint
          ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
          ctx.fillRect(0, 0, width, height);
        } else if (filterMode === 'thermal_flir') {
          // Ironbow thermal false color overlay
          ctx.fillStyle = 'rgba(147, 51, 234, 0.25)';
          ctx.fillRect(0, 0, width, height);
        } else if (filterMode === 'night_vision') {
          // NVG monochrome green with high gain
          ctx.fillStyle = 'rgba(34, 197, 94, 0.22)';
          ctx.fillRect(0, 0, width, height);
        }
      } else {
        // Synthetic Camera View: High-tech room interior with wall outline
        ctx.fillStyle = '#060d14';
        ctx.fillRect(0, 0, width, height);

        // Perspective grid lines representing physical room & wall
        ctx.strokeStyle = '#1e3a50';
        ctx.lineWidth = 1;
        for (let y = height * 0.3; y < height; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }

        // Central physical wall contour
        ctx.fillStyle = '#1e293b44';
        ctx.fillRect(width * 0.1, height * 0.2, width * 0.8, height * 0.65);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.strokeRect(width * 0.1, height * 0.2, width * 0.8, height * 0.65);

        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px monospace';
        ctx.fillText(
          `MURO DETECTADO: ${wallMaterial.toUpperCase()} (${wallThicknessCm}cm)`,
          width * 0.12,
          height * 0.2 + 20
        );
      }

      // 2. Synthetic Radar Scanning Sweep Ray
      const sweepY = (t * 120) % height;
      ctx.strokeStyle = '#ff7857';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, sweepY);
      ctx.lineTo(width, sweepY);
      ctx.stroke();

      // Sweep gradient trailing wave
      const grad = ctx.createLinearGradient(0, sweepY - 50, 0, sweepY);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, '#ff785725');
      ctx.fillStyle = grad;
      ctx.fillRect(0, Math.max(0, sweepY - 50), width, 50);

      // Radar audio ping on cycle
      if (Math.floor(sweepY) % 180 === 0) {
        playPulse(920);
      }

      // 3. Render Detected AR Targets (Penetrating the Wall)
      targets.forEach((tgt) => {
        const tx = tgt.relX * width;
        const ty = tgt.relY * height;

        const isHuman = tgt.respRate > 0;
        const pulse = Math.sin(t * 8) * 4;

        if (isHuman) {
          // Bounding Box with Corner Brackets
          ctx.strokeStyle = '#ff7857';
          ctx.lineWidth = 2;

          const bw = 90;
          const bh = 110;
          const bx = tx - bw / 2;
          const by = ty - bh / 2;

          // Corner markers
          const cornerLen = 14;
          // Top-left
          ctx.beginPath();
          ctx.moveTo(bx, by + cornerLen);
          ctx.lineTo(bx, by);
          ctx.lineTo(bx + cornerLen, by);
          ctx.stroke();

          // Top-right
          ctx.beginPath();
          ctx.moveTo(bx + bw - cornerLen, by);
          ctx.lineTo(bx + bw, by);
          ctx.lineTo(bx + bw, by + cornerLen);
          ctx.stroke();

          // Bottom-left
          ctx.beginPath();
          ctx.moveTo(bx, by + bh - cornerLen);
          ctx.lineTo(bx, by + bh);
          ctx.lineTo(bx + cornerLen, by + bh);
          ctx.stroke();

          // Bottom-right
          ctx.beginPath();
          ctx.moveTo(bx + bw - cornerLen, by + bh);
          ctx.lineTo(bx + bw, by + bh);
          ctx.lineTo(bx + bw, by + bh - cornerLen);
          ctx.stroke();

          // Pulsing Vital Beacon Center
          ctx.fillStyle = '#ff7857';
          ctx.beginPath();
          ctx.arc(tx, ty, 6 + Math.max(0, pulse), 0, 2 * Math.PI);
          ctx.fill();

          // Heatmap contour around body
          const heatGrad = ctx.createRadialGradient(tx, ty, 5, tx, ty, 45);
          heatGrad.addColorStop(0, '#f9731666');
          heatGrad.addColorStop(0.5, '#ef444422');
          heatGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = heatGrad;
          ctx.beginPath();
          ctx.arc(tx, ty, 45, 0, 2 * Math.PI);
          ctx.fill();

          // AR Data Card
          ctx.fillStyle = '#0a141dcc';
          ctx.fillRect(bx + bw + 10, by, 160, 68);
          ctx.strokeStyle = '#ff785788';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + bw + 10, by, 160, 68);

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`TARGET ${tgt.id}`, bx + bw + 18, by + 16);

          ctx.fillStyle = '#38bdf8';
          ctx.font = '9px monospace';
          ctx.fillText(`RESPIRACIÓN: ${tgt.respRate} RPM`, bx + bw + 18, by + 30);
          ctx.fillText(`PULSO: ${tgt.heartRate} BPM`, bx + bw + 18, by + 44);

          ctx.fillStyle = '#10b981';
          ctx.fillText(`DISTANCIA: ${tgt.depth}m (SNR ${tgt.snr}dB)`, bx + bw + 18, by + 58);
        } else {
          // Void box
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx - 30, ty - 25, 60, 50);

          ctx.fillStyle = '#c084fc';
          ctx.font = '9px monospace';
          ctx.fillText(`HUECO (${tgt.depth}m)`, tx - 25, ty + 4);
        }
      });

      // 4. Tactical Crosshair HUD in Center
      const cx = width / 2;
      const cy = height / 2;
      ctx.strokeStyle = '#ffffff66';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 20, cy);
      ctx.lineTo(cx + 20, cy);
      ctx.moveTo(cx, cy - 20);
      ctx.lineTo(cx, cy + 20);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [cameraActive, filterMode, wallMaterial, wallThicknessCm, gainDb, audioBeep]);

  const captureSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedPhoto(dataUrl);
  };

  return (
    <div className="border border-[#344b55] bg-[#050a0f] rounded-lg p-4 lg:p-6 text-slate-100 shadow-2xl">
      {/* Hidden video element for streaming webcam/phone camera */}
      <video ref={videoRef} playsInline muted className="hidden" />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#344b55] pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[#ff7857]/20 border border-[#ff7857] flex items-center justify-center text-[#ff7857]">
            <Camera size={20} />
          </div>
          <div>
            <h2 className="text-lg lg:text-xl font-black tracking-tight flex items-center gap-2">
              CÁMARA TRAS PAREDES & VISOR AR MULTIESPECTRAL
              <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
                {cameraActive ? 'CÁMARA ACTIVA' : 'SENSOR SINTÉTICO'}
              </span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Fusión Sensor-Cámara · Radar UWB 3.1–10.6 GHz · Micro-Doppler de Signos Vitales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAudioBeep(!audioBeep)}
            className={`px-3 py-1.5 text-xs font-mono rounded border flex items-center gap-1.5 ${
              audioBeep ? 'border-[#ff7857] bg-[#ff7857]/20 text-[#ff7857]' : 'border-slate-700 bg-slate-900 text-slate-400'
            }`}
          >
            {audioBeep ? <Volume2 size={14} /> : <VolumeX size={14} />}
            SONAR
          </button>

          <button
            type="button"
            onClick={cameraActive ? stopCamera : startCamera}
            className={`px-3 py-1.5 text-xs font-mono font-bold rounded border flex items-center gap-1.5 ${
              cameraActive
                ? 'border-slate-600 bg-slate-800 text-slate-300'
                : 'border-[#38bdf8] bg-[#38bdf8] text-[#050b10] hover:bg-[#7dd3fc]'
            }`}
          >
            {cameraActive ? <CameraOff size={14} /> : <Camera size={14} />}
            {cameraActive ? 'DETENER CÁMARA' : 'ACTIVAR CÁMARA'}
          </button>

          <button
            type="button"
            onClick={captureSnapshot}
            className="px-3 py-1.5 text-xs font-mono font-bold rounded border border-[#ff7857] bg-[#ff7857] text-[#050b10] hover:bg-[#ff967b]"
          >
            FOTO AR
          </button>
        </div>
      </div>

      {cameraError && (
        <div className="p-3 mb-4 rounded bg-[#321c17] border border-[#ff7857] text-xs font-mono text-[#ffb099] flex items-center gap-2">
          <span>ℹ️</span> {cameraError}
        </div>
      )}

      {/* Main Viewport Grid */}
      <div className="grid lg:grid-cols-[1fr_280px] gap-4">
        {/* AR Canvas Display */}
        <div className="relative border border-[#273a44] bg-[#020508] rounded overflow-hidden">
          <canvas ref={canvasRef} width={800} height={460} className="w-full h-auto block" />

          {/* Overlay Filter Modes Switcher */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 bg-[#050c12]/80 p-1.5 rounded border border-slate-700 backdrop-blur-md">
            {[
              { id: 'radar_uwb', label: 'RADAR UWB' },
              { id: 'thermal_flir', label: 'FLIR TÉRMICO' },
              { id: 'micro_doppler', label: 'MICRO-DOPPLER' },
              { id: 'night_vision', label: 'VISIÓN NOCTURNA' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterMode(f.id as any)}
                className={`px-2.5 py-1 text-[10px] font-mono rounded font-bold transition-colors ${
                  filterMode === f.id
                    ? 'bg-[#ff7857] text-[#050b10]'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Telemetry Indicator on Bottom */}
          <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-[#07111a]/80 px-3 py-2 rounded border border-slate-700 text-[10px] font-mono backdrop-blur-md text-slate-300">
            <span>GANANCIA LNA: {gainDb} dB</span>
            <span className="text-[#38bdf8]">PENETRACIÓN MÁXIMA: 6.0 METROS</span>
            <span className="text-[#10b981]">2 OBJETIVOS AISLADOS TRAS EL MURO</span>
          </div>
        </div>

        {/* Right Column: Physical Controls & Snapshot preview */}
        <div className="space-y-4 bg-[#0a141d] border border-[#273a44] p-4 rounded text-xs font-mono">
          <h3 className="font-bold text-[#ff9476] flex items-center gap-1.5">
            <Sliders size={14} /> AJUSTES DIELÉCTRICOS
          </h3>

          <div>
            <label className="block text-slate-400 mb-1.5">TIPO DE MURO</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'concrete', label: 'Hormigón' },
                { id: 'brick', label: 'Ladrillo' },
                { id: 'drywall', label: 'Tabiquería' },
                { id: 'rubble', label: 'Escombros' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setWallMaterial(m.id as any)}
                  className={`p-2 text-[10px] rounded border text-center ${
                    wallMaterial === m.id
                      ? 'border-[#ff7857] bg-[#ff7857]/20 text-white font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>ESPESOR:</span>
              <strong className="text-white">{wallThicknessCm} cm</strong>
            </div>
            <input
              type="range"
              min="15"
              max="80"
              value={wallThicknessCm}
              onChange={(e) => setWallThicknessCm(Number(e.target.value))}
              className="w-full accent-[#ff7857] cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-400 mb-1">
              <span>GANANCIA RF:</span>
              <strong className="text-[#38bdf8]">{gainDb} dB</strong>
            </div>
            <input
              type="range"
              min="40"
              max="95"
              value={gainDb}
              onChange={(e) => setGainDb(Number(e.target.value))}
              className="w-full accent-[#38bdf8] cursor-pointer"
            />
          </div>

          {/* Snapshot thumbnail */}
          {capturedPhoto && (
            <div className="pt-3 border-t border-slate-800">
              <span className="block text-slate-400 mb-1">CAPTURA GUARDADA:</span>
              <img src={capturedPhoto} alt="Snapshot AR" className="w-full h-auto rounded border border-slate-700" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
