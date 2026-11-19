/**
 * Escalera de intentos en el dispositivo: «¿hay Bluetooth? conecta y envía; ¿no?
 * prueba Wi-Fi Direct; ¿no? SMS; ¿pasa un satélite en 4 minutos? espera a esa ventana».
 *
 * La escalera se ordena por llegada esperada (no por un orden fijo) y respeta lo que
 * el sistema operativo permite: si una radio está apagada y el SO exige un toque del
 * usuario para encenderla, la acción es PROMPT_USER (un solo toque, preautorizado en
 * la instalación), nunca un encendido oculto.
 */
import { CHANNELS, transferSeconds } from './channels.mjs';

/**
 * @param {object} p
 * @param {Record<string,{enabled:boolean, permission:boolean, peersOrLink:boolean, rssi?:number, measuredRateBps?:number}>} p.radios estado sondeado de cada canal
 * @param {Array<{channel:string,start:number,end:number}>} [p.windows] ventanas futuras (satélite D2D)
 * @param {number} p.now
 * @param {number} p.sizeBytes
 * @param {{relayActive:boolean}} p.activation resultado de zones.relayActivation
 * @param {number} p.battery 0..100
 */
export function buildLadder({ radios, windows = [], now, sizeBytes = 512, activation, battery = 100 }) {
  const steps = [];
  for (const [channel, r] of Object.entries(radios)) {
    const spec = CHANNELS[channel];
    if (!spec || spec.kind === 'BACKBONE') continue;
    if (battery <= 10 && spec.energy >= 3) continue; // batería crítica: solo canales baratos
    if (!r.permission) { steps.push({ channel, action: 'REQUEST_PERMISSION', etaS: Infinity, reason: 'Permiso no concedido en la instalación' }); continue; }
    const tx = transferSeconds(channel, Math.min(sizeBytes, spec.maxBytes), r.measuredRateBps);
    if (!r.enabled) {
      const action = spec.userTapToEnable ? 'PROMPT_USER_ENABLE' : 'AUTO_ENABLE';
      if (action === 'AUTO_ENABLE' && !activation?.relayActive) continue;
      steps.push({ channel, action, etaS: 5 + tx, reason: spec.userTapToEnable ? 'El SO exige un toque para encender esta radio' : 'Activación automática preautorizada en zona de emergencia' });
      continue;
    }
    if (r.peersOrLink) steps.push({ channel, action: 'SEND_NOW', etaS: tx, rssi: r.rssi });
    else steps.push({ channel, action: 'SCAN', etaS: 15 + tx, reason: 'Radio activa, buscando pares/enlace' });
  }
  for (const w of windows) {
    if (w.end <= now) continue;
    const startIn = Math.max(0, w.start - now);
    steps.push({ channel: w.channel, action: startIn > 0 ? 'WAIT_WINDOW' : 'SEND_NOW', etaS: startIn + transferSeconds(w.channel, Math.min(sizeBytes, CHANNELS[w.channel].maxBytes)), windowStart: w.start, windowEnd: w.end });
  }
  const rank = { SEND_NOW: 0, SCAN: 1, WAIT_WINDOW: 2, AUTO_ENABLE: 2, PROMPT_USER_ENABLE: 3, REQUEST_PERMISSION: 9 };
  return steps.sort((a, b) => a.etaS - b.etaS || rank[a.action] - rank[b.action]);
}

/**
 * Ejecuta la escalera. `attempt(step)` lo implementa cada plataforma (Android: Nearby /
 * BluetoothGatt / WifiAwareManager / SmsManager). Se lanzan en paralelo los primeros
 * `parallel` pasos ejecutables; si todos fallan se baja al siguiente escalón.
 * @returns {Promise<{delivered:boolean, via?:string, log:Array}>}
 */
export async function runLadder(ladder, attempt, { parallel = 2 } = {}) {
  const log = [];
  const runnable = ladder.filter((s) => s.action !== 'REQUEST_PERMISSION');
  for (let i = 0; i < runnable.length; i += parallel) {
    const batch = runnable.slice(i, i + parallel);
    const results = await Promise.all(batch.map(async (s) => {
      try { const ok = await attempt(s); log.push({ ...s, ok }); return ok ? s : null; }
      catch (e) { log.push({ ...s, ok: false, error: String(e?.message ?? e) }); return null; }
    }));
    const win = results.find(Boolean);
    if (win) return { delivered: true, via: win.channel, log };
  }
  return { delivered: false, log };
}
