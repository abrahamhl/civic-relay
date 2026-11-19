import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const require = createRequire(path.join(repoRoot, 'investor-next', 'package.json'));
const { chromium } = require('playwright');

const outDir = path.join(repoRoot, 'investor-next', 'public', 'media', 'm95');
fs.mkdirSync(outDir, { recursive: true });

const htmlBreakthrough = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1920px;
    height: 1080px;
    background: radial-gradient(circle at 75% 25%, #0f172a 0%, #030712 60%, #000000 100%);
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    overflow: hidden;
    position: relative;
    padding: 60px 80px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .grid-bg {
    position: absolute;
    top: 0; left: 0; width: 1920px; height: 1080px;
    background-image: linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
    background-size: 60px 60px;
    pointer-events: none;
  }
  .header {
    z-index: 2;
  }
  .badge {
    display: inline-block;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.6);
    color: #fca5a5;
    padding: 8px 18px;
    border-radius: 9999px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 18px;
  }
  .title {
    font-size: 54px;
    font-weight: 900;
    line-height: 1.1;
    color: #ffffff;
    letter-spacing: -0.02em;
    max-width: 1200px;
  }
  .subtitle {
    font-size: 24px;
    color: #94a3b8;
    margin-top: 14px;
    max-width: 1100px;
    line-height: 1.4;
  }
  .center-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    z-index: 2;
    margin: 30px 0;
  }
  .radar-card {
    width: 580px;
    height: 520px;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(56, 189, 248, 0.4);
    border-radius: 20px;
    padding: 30px;
    box-shadow: 0 0 50px rgba(56, 189, 248, 0.15);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .metrics-col {
    display: flex;
    flex-direction: column;
    gap: 18px;
    width: 620px;
  }
  .metric-box {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-left: 6px solid #38bdf8;
    border-radius: 12px;
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .metric-label {
    font-size: 18px;
    color: #94a3b8;
  }
  .metric-val {
    font-size: 26px;
    font-weight: 800;
    color: #38bdf8;
    font-family: monospace;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 24px;
    z-index: 2;
  }
  .footer-left {
    font-size: 18px;
    color: #cbd5e1;
    font-weight: 600;
  }
  .footer-right {
    font-size: 17px;
    color: #34d399;
    font-weight: 700;
    font-family: monospace;
  }
</style>
</head>
<body>
<div class="grid-bg"></div>
<div class="header">
  <div class="badge">🔴 SENDA · ESPECIAL DE INVESTIGACIÓN Y DEFENSA DUAL (2026)</div>
  <h1 class="title">El Fin de la Invisibilidad: Radar Civil y Kit de Supervivencia Antidrón</h1>
  <p class="subtitle">Triangulación acústica hiperbólica TDoA, detección de drones por fibra óptica sin radioeléctrica y centinelas COTS de 11,70 €.</p>
</div>

<div class="center-content">
  <div class="radar-card">
    <svg width="440" height="440" viewBox="-220 -220 440 440">
      <circle cx="0" cy="0" r="200" fill="none" stroke="#1e293b" stroke-width="2"/>
      <circle cx="0" cy="0" r="150" fill="none" stroke="#1e293b" stroke-width="2"/>
      <circle cx="0" cy="0" r="100" fill="none" stroke="#1e293b" stroke-width="2"/>
      <circle cx="0" cy="0" r="50" fill="none" stroke="#1e293b" stroke-width="2"/>
      <line x1="-210" y1="0" x2="210" y2="0" stroke="#1e293b" stroke-width="1.5"/>
      <line x1="0" y1="-210" x2="0" y2="210" stroke="#1e293b" stroke-width="1.5"/>
      
      <!-- Hyperbolic TDoA lines -->
      <path d="M -160 -180 Q -30 -30 90 70" fill="none" stroke="rgba(56, 189, 248, 0.6)" stroke-width="3" stroke-dasharray="6,4"/>
      <path d="M -180 140 Q -20 20 90 70" fill="none" stroke="rgba(56, 189, 248, 0.6)" stroke-width="3" stroke-dasharray="6,4"/>
      <path d="M 180 -120 Q 80 -10 90 70" fill="none" stroke="rgba(56, 189, 248, 0.6)" stroke-width="3" stroke-dasharray="6,4"/>
      
      <!-- Steered Beam Lobe -->
      <path d="M 0 0 Q 30 70 90 70 Q 70 30 0 0 Z" fill="rgba(56, 189, 248, 0.3)" stroke="#38bdf8" stroke-width="3"/>
      
      <!-- Drone Target Target Lock -->
      <circle cx="90" cy="70" r="22" fill="rgba(239, 68, 68, 0.4)" stroke="#ef4444" stroke-width="3"/>
      <circle cx="90" cy="70" r="6" fill="#ffffff"/>
      <text x="118" y="76" fill="#ef4444" font-size="16" font-family="monospace" font-weight="bold">TARGET LOCK: FPV FIBRA</text>
      
      <!-- Civilian Mobile Nodes -->
      <circle cx="-120" cy="-90" r="8" fill="#34d399"/>
      <text x="-145" y="-105" fill="#34d399" font-size="13" font-family="monospace">NODO 1 (Móvil)</text>
      <circle cx="-130" cy="110" r="8" fill="#34d399"/>
      <text x="-155" y="130" fill="#34d399" font-size="13" font-family="monospace">NODO 2 (Móvil)</text>
      <circle cx="110" cy="-120" r="8" fill="#34d399"/>
      <text x="75" y="-135" fill="#34d399" font-size="13" font-family="monospace">NODO 3 (Móvil)</text>
      <circle cx="130" cy="120" r="8" fill="#34d399"/>
      <text x="95" y="145" fill="#34d399" font-size="13" font-family="monospace">NODO 4 (Router)</text>
    </svg>
    <div style="font-size: 15px; color: #94a3b8; font-family: monospace; margin-top: 10px;">
      INTERSECCIÓN HIPERBÓLICA TDoA 3D · RMSE: 0.82 m
    </div>
  </div>

  <div class="metrics-col">
    <div class="metric-box">
      <span class="metric-label">Detección de Drones de Fibra Óptica</span>
      <span class="metric-val" style="color: #4ade80;">100% PASIVA (CSI + BPF)</span>
    </div>
    <div class="metric-box">
      <span class="metric-label">Cámara Acústica y Ganancia Beamforming</span>
      <span class="metric-val">+21.5 dB SNR</span>
    </div>
    <div class="metric-box">
      <span class="metric-label">Coste BOM Centinela COTS Completo</span>
      <span class="metric-val">11,70 € (ESP32-S3 + Radar 24GHz)</span>
    </div>
    <div class="metric-box">
      <span class="metric-label">Baliza de Rescate Ultrasónica Inaudible</span>
      <span class="metric-val">20.000 Hz · ECDSA P-256</span>
    </div>
    <div class="metric-box">
      <span class="metric-label">Modo Operativo Off-Grid y Resiliencia</span>
      <span class="metric-val" style="color: #fbbf24;">100% LOCAL (0 Servidores)</span>
    </div>
  </div>
</div>

<div class="footer">
  <div class="footer-left">SENDA · Plataforma Soberana de Telecomunicaciones, GIS 4D y Protección Civil · © 2026</div>
  <div class="footer-right">366/366 TESTS VERIFICADOS · TRL 6+</div>
</div>
</body>
</html>`;

const htmlSurvivalReel = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 1920px;
    background: radial-gradient(circle at 50% 20%, #0f172a 0%, #030712 60%, #000000 100%);
    color: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
    overflow: hidden;
    position: relative;
    padding: 80px 60px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .grid-bg {
    position: absolute;
    top: 0; left: 0; width: 1080px; height: 1920px;
    background-image: linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px);
    background-size: 50px 50px;
    pointer-events: none;
  }
  .badge {
    display: inline-block;
    background: rgba(14, 165, 233, 0.2);
    border: 1px solid rgba(56, 189, 248, 0.6);
    color: #38bdf8;
    padding: 12px 24px;
    border-radius: 9999px;
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 24px;
  }
  .title {
    font-size: 64px;
    font-weight: 900;
    line-height: 1.15;
    color: #ffffff;
    letter-spacing: -0.02em;
  }
  .title span {
    color: #38bdf8;
  }
  .lead {
    font-size: 28px;
    color: #94a3b8;
    margin-top: 20px;
    line-height: 1.45;
  }
  .center-box {
    background: rgba(15, 23, 42, 0.85);
    border: 2px solid rgba(56, 189, 248, 0.4);
    border-radius: 28px;
    padding: 40px;
    box-shadow: 0 0 60px rgba(56, 189, 248, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    z-index: 2;
    margin: 30px 0;
  }
  .compass-circle {
    width: 380px;
    height: 380px;
    border-radius: 50%;
    border: 4px dashed rgba(56, 189, 248, 0.5);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 30px 0;
  }
  .needle {
    width: 8px;
    height: 160px;
    background: #ef4444;
    position: absolute;
    top: 30px;
    transform-origin: 50% 100%;
    transform: rotate(225deg);
    border-radius: 4px;
    box-shadow: 0 0 20px #ef4444;
  }
  .compass-center {
    width: 24px;
    height: 24px;
    background: #38bdf8;
    border-radius: 50%;
    position: absolute;
  }
  .specs-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
    width: 100%;
    z-index: 2;
  }
  .spec-row {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 24px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .spec-label {
    font-size: 24px;
    color: #cbd5e1;
  }
  .spec-val {
    font-size: 30px;
    font-weight: 800;
    font-family: monospace;
    color: #34d399;
  }
  .footer {
    text-align: center;
    font-size: 22px;
    color: #64748b;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 30px;
    z-index: 2;
  }
</style>
</head>
<body>
<div class="grid-bg"></div>

<div>
  <div class="badge">🛡️ SENDA TACTICAL LAB · FORMATO 9:16</div>
  <h1 class="title">Tu Móvil es un <span>Radar Antidrón</span> y un Kit de Supervivencia</h1>
  <p class="lead">Tecnología civil descentralizada: detecta drones de fibra óptica, calcula rutas de escape seguras y emite balizas de rescate inaudibles.</p>
</div>

<div class="center-box">
  <div style="font-size: 22px; font-weight: 800; color: #ef4444; text-transform: uppercase; letter-spacing: 0.1em;">
    ⚠️ ALERTA ACÚSTICA: UAV A 85 METROS
  </div>
  <div class="compass-circle">
    <div class="needle"></div>
    <div class="compass-center"></div>
    <div style="position: absolute; top: 15px; color: #64748b; font-size: 18px; font-weight: bold;">0° NORTE</div>
    <div style="position: absolute; bottom: 15px; color: #38bdf8; font-size: 20px; font-weight: bold;">225° RUTA SEGURA</div>
  </div>
  <div style="font-size: 26px; font-weight: 800; color: #38bdf8; text-align: center;">
    VECTOR DE EVASIÓN SILENCIOSA: 225° SW
  </div>
  <div style="font-size: 20px; color: #94a3b8; margin-top: 8px;">
    Tiempo estimado de intercepción: 4.8 segundos
  </div>
</div>

<div class="specs-list">
  <div class="spec-row">
    <span class="spec-label">Hardware Centinela COTS</span>
    <span class="spec-val">11,70 € (AliExpress)</span>
  </div>
  <div class="spec-row">
    <span class="spec-label">Autonomía con Power Bank 10Ah</span>
    <span class="spec-val">90.9 Horas (~3.8 Días)</span>
  </div>
  <div class="spec-row">
    <span class="spec-label">Baliza de Socorro Inaudible</span>
    <span class="spec-val">20.000 Hz · ECDSA P-256</span>
  </div>
  <div class="spec-row">
    <span class="spec-label">Resiliencia ante Apagones</span>
    <span class="spec-val" style="color: #fbbf24;">100% OFF-GRID LOCAL</span>
  </div>
</div>

<div class="footer">
  SENDA · Red Soberana de Supervivencia Ciudadana · https://github.com/abrahamhl/civic-relay
</div>
</body>
</html>`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  
  // 1. Horizontal Poster (1920x1080)
  const pageH = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await pageH.setContent(htmlBreakthrough);
  const outH = path.join(outDir, 'senda-m95-session-breakthrough-poster.jpg');
  await pageH.screenshot({ path: outH, quality: 95, type: 'jpeg' });
  console.log(`Saved horizontal poster: ${outH}`);
  await pageH.close();

  // 2. Vertical Poster (1080x1920)
  const pageV = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await pageV.setContent(htmlSurvivalReel);
  const outV = path.join(outDir, 'senda-m95-reel-sentinel-survival-poster.jpg');
  await pageV.screenshot({ path: outV, quality: 95, type: 'jpeg' });
  console.log(`Saved vertical poster: ${outV}`);
  await pageV.close();

  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
