"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "./copy";
import "./device-field-diagnostics.css";

/**
 * On-device evidence only. Browser feature detection is not a validated wireless
 * relay, radio scan, mobile node, satellite uplink or emergency service.
 * No snapshots, video, fingerprint or IP address is uploaded.
 */
type DeviceSnapshot = {
  observedAtUtc: string;
  secureContext: boolean;
  browserReportedOnline: boolean;
  cpuLogicalCores: number | null;
  memoryGbHint: number | null;
  networkEffectiveTypeHint: string | null;
  networkDownlinkHintMbps: number | null;
  networkRttHintMs: number | null;
  batteryPercent: number | null;
  batteryCharging: boolean | null;
  webCryptoApi: boolean;
  indexedDbApi: boolean;
  webRtcApi: boolean;
  webBluetoothApi: boolean;
  serviceWorkerApi: boolean;
  storageUsageBytes: number | null;
  storageQuotaBytes: number | null;
};
type CameraMeasurement = { width: number; height: number; luminance: number; samples: number };
type CameraStatus = "idle" | "requesting" | "active" | "unavailable" | "denied";

const dictionary: Record<Locale, {
  eyebrow: string; title: string; description: string; inspect: string;
  notMeasured: string; recorded: string; unavailable: string;
  cameraTitle: string; cameraStart: string; cameraStop: string;
  cameraDenied: string; cameraIdle: string; cameraActive: string;
  export: string; disclaimer: string; nodeTitle: string; nodeStatus: string;
}> = {
  es: {
    eyebrow: "LABORATORIO DE CAMPO / SOLO DATOS DEL DISPOSITIVO",
    title: "¿Podría mi móvil participar como nodo voluntario?",
    description: "Haz una inspección local con las APIs disponibles en este navegador. Las cifras muestran lo que permite medir el sistema; no prueban conexiones entre móviles. El vídeo, si lo autorizas, permanece en tu dispositivo.",
    inspect: "INSPECCIONAR MI DISPOSITIVO", notMeasured: "Sin medir", recorded: "Medido localmente", unavailable: "No disponible",
    cameraTitle: "Prueba de cámara real · análisis local de luz",
    cameraStart: "Activar cámara con permiso", cameraStop: "Detener cámara",
    cameraDenied: "Permiso denegado o cámara inaccesible", cameraIdle: "Desactivada · sin capturar", cameraActive: "Vídeo real local · no se envía",
    export: "Exportar evidencias JSON", disclaimer: "No detecta personas a través de paredes ni mide Wi-Fi CSI/RF. No contacta con emergencias ni confirma recepción en otro móvil.",
    nodeTitle: "Estado de nodo offline", nodeStatus: "NO VALIDADO: requiere dos teléfonos y ACK físico medido."
  },
  en: {
    eyebrow: "FIELD LAB / DEVICE-LOCAL EVIDENCE ONLY",
    title: "Could this phone participate as an opt-in node?",
    description: "Inspect browser-accessible hardware capabilities locally. Values describe actual API readings where available, not phone-to-phone delivery. Permission-based live video stays on your device.",
    inspect: "INSPECT MY DEVICE", notMeasured: "Not measured", recorded: "Measured locally", unavailable: "Unavailable",
    cameraTitle: "Real camera test · local light analysis",
    cameraStart: "Enable camera with permission", cameraStop: "Stop camera",
    cameraDenied: "Permission denied or camera inaccessible", cameraIdle: "Off · no capture", cameraActive: "Real local video · not uploaded",
    export: "Export JSON evidence", disclaimer: "Cannot detect people through walls or measure Wi-Fi CSI/RF. Does not contact emergency services or verify another phone's receipt.",
    nodeTitle: "Offline node status", nodeStatus: "NOT VERIFIED: two phones and measured physical ACK required."
  },
  nl: {
    eyebrow: "VELDLAB / ALLEEN LOKALE APPARAATMETINGEN",
    title: "Kan deze telefoon als vrijwillige node deelnemen?",
    description: "Onderzoek lokaal welke browserfuncties beschikbaar zijn. Werkelijke API-gegevens waar beschikbaar; geen bewijs voor verzending tussen telefoons. Toegestane livevideo blijft op dit toestel.",
    inspect: "CONTROLEER MIJN TOESTEL", notMeasured: "Niet gemeten", recorded: "Lokaal gemeten", unavailable: "Niet beschikbaar",
    cameraTitle: "Echte cameraproef · lokale lichtmeting",
    cameraStart: "Camera inschakelen met toestemming", cameraStop: "Camera stoppen",
    cameraDenied: "Toestemming geweigerd of camera ontoegankelijk", cameraIdle: "Uit · geen opname", cameraActive: "Echte lokale video · niet geüpload",
    export: "JSON-bewijs exporteren", disclaimer: "Geen detectie door muren of meting van Wi-Fi CSI/RF. Geen contact met hulpdiensten of ontvangstbevestiging op andere telefoon.",
    nodeTitle: "Offline-nodestatus", nodeStatus: "NIET GEVALIDEERD: twee telefoons en een echte, gemeten ACK nodig."
  }
};

function readable(value: number | string | boolean | null, unit = ""): string {
  if (value === null) return "N/A";
  if (typeof value === "boolean") return value ? "YES" : "NO";
  return String(value) + unit;
}

export default function DeviceFieldDiagnostics({ locale }: { locale: Locale }) {
  const copy = dictionary[locale];
  const [snapshot, setSnapshot] = useState<DeviceSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraMeasurement, setCameraMeasurement] = useState<CameraMeasurement | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sampleTimerRef = useRef<number | null>(null);
  const samplesRef = useRef(0);
  const mountedRef = useRef(false);
  const cameraEpochRef = useRef(0);

  const stopTracks = () => {
    if (sampleTimerRef.current !== null) window.clearInterval(sampleTimerRef.current);
    sampleTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cameraEpochRef.current += 1;
      if (sampleTimerRef.current !== null) window.clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []);

  const inspectDevice = async () => {
    if (pending) return;
    setPending(true);
    try {
      const nav = navigator as Navigator & {
        deviceMemory?: number;
        getBattery?: () => Promise<{ level: number; charging: boolean }>;
        bluetooth?: unknown;
        connection?: { effectiveType?: string; downlink?: number; rtt?: number };
      };
      let batteryPercent: number | null = null;
      let batteryCharging: boolean | null = null;
      try {
        if (nav.getBattery) {
          const battery = await nav.getBattery();
          if (Number.isFinite(battery.level)) batteryPercent = Math.round(battery.level * 100);
          batteryCharging = typeof battery.charging === "boolean" ? battery.charging : null;
        }
      } catch { /* Privacy protections may disable Battery API. */ }

      let storageUsageBytes: number | null = null;
      let storageQuotaBytes: number | null = null;
      try {
        if (nav.storage?.estimate) {
          const estimate = await nav.storage.estimate();
          storageUsageBytes = typeof estimate.usage === "number" ? estimate.usage : null;
          storageQuotaBytes = typeof estimate.quota === "number" ? estimate.quota : null;
        }
      } catch { /* Storage estimate can be restricted. */ }

      setSnapshot({
        observedAtUtc: new Date().toISOString(),
        secureContext: window.isSecureContext,
        browserReportedOnline: nav.onLine,
        cpuLogicalCores: typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null,
        memoryGbHint: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
        networkEffectiveTypeHint: nav.connection?.effectiveType ?? null,
        networkDownlinkHintMbps: nav.connection?.downlink ?? null,
        networkRttHintMs: nav.connection?.rtt ?? null,
        batteryPercent,
        batteryCharging,
        webCryptoApi: Boolean(window.crypto?.subtle),
        indexedDbApi: typeof window.indexedDB !== "undefined",
        webRtcApi: typeof window.RTCPeerConnection !== "undefined",
        webBluetoothApi: Boolean(nav.bluetooth),
        serviceWorkerApi: "serviceWorker" in nav,
        storageUsageBytes,
        storageQuotaBytes
      });
    } finally {
      setPending(false);
    }
  };

  const stopCamera = () => {
    // Invalidates pending camera permission requests; OS dialogs cannot be closed by web apps.
    cameraEpochRef.current += 1;
    stopTracks();
    setCameraStatus("idle");
    setCameraMeasurement(null);
  };

  const startCamera = async () => {
    if (cameraStatus === "requesting" || cameraStatus === "active") return;
    if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) {
      setCameraStatus("unavailable");
      return;
    }
    const requestEpoch = ++cameraEpochRef.current;
    setCameraStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
      if (requestEpoch !== cameraEpochRef.current || !mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      for (const track of stream.getVideoTracks()) {
        track.onended = () => {
          stopTracks();
          setCameraStatus("unavailable");
          setCameraMeasurement(null);
        };
      }
      const video = videoRef.current;
      if (!video) {
        stopTracks();
        setCameraStatus("unavailable");
        return;
      }
      video.srcObject = stream;
      await video.play();
      if (requestEpoch !== cameraEpochRef.current || !mountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      setCameraStatus("active");
      samplesRef.current = 0;
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 36;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      sampleTimerRef.current = window.setInterval(() => {
        if (!context || !videoRef.current || videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
        const live = videoRef.current;
        try {
          context.drawImage(live, 0, 0, 64, 36);
          const pixels = context.getImageData(0, 0, 64, 36).data;
          let light = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            light += 0.2126 * pixels[i] + 0.7152 * pixels[i + 1] + 0.0722 * pixels[i + 2];
          }
          samplesRef.current += 1;
          setCameraMeasurement({
            width: live.videoWidth,
            height: live.videoHeight,
            luminance: Math.round(light / (pixels.length / 4)),
            samples: samplesRef.current
          });
        } catch {
          // Camera measurement is optional; no synthetic fallback.
        }
      }, 600);
    } catch {
      stopTracks();
      setCameraStatus("denied");
      setCameraMeasurement(null);
    }
  };

  const exportReport = () => {
    if (!snapshot) return;
    const data = {
      schema: "oep-device-local-evidence/v1",
      evidenceClass: "BROWSER_API_OBSERVATION_NOT_PHYSICAL_RELAY_PROOF",
      observedAtUtc: snapshot.observedAtUtc,
      exportedAtUtc: new Date().toISOString(),
      snapshot,
      cameraMeasurement: cameraMeasurement ?? null,
      rawVideoIncluded: false,
      remoteTransferPerformedByAudit: false,
      physicalPeerAckVerified: false,
      satelliteRfCsiMeasured: false,
      emergencyServiceIntegrationVerified: false
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "civic-relay-local-device-evidence.json";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 500);
  };

  const rows: Array<[string, string]> = snapshot ? [
    ["HTTPS / secure context", readable(snapshot.secureContext)],
    ["Browser online flag (not a network test)", readable(snapshot.browserReportedOnline)],
    ["WebCrypto JavaScript API (not hardware proof)", readable(snapshot.webCryptoApi)],
    ["IndexedDB API presence", readable(snapshot.indexedDbApi)],
    ["WebRTC browser API (not D2D proof)", readable(snapshot.webRtcApi)],
    ["WebBluetooth API (not radio access proof)", readable(snapshot.webBluetoothApi)],
    ["Service Worker API presence", readable(snapshot.serviceWorkerApi)],
    ["Logical CPU threads", readable(snapshot.cpuLogicalCores)],
    ["Browser memory hint", readable(snapshot.memoryGbHint, " GB")],
    ["Network API effectiveType hint", readable(snapshot.networkEffectiveTypeHint)],
    ["Network API downlink estimate", readable(snapshot.networkDownlinkHintMbps, " Mbps")],
    ["Network API RTT estimate (not ping)", readable(snapshot.networkRttHintMs, " ms")],
    ["Battery API reading", readable(snapshot.batteryPercent, "%")],
    ["Battery charging (when available)", readable(snapshot.batteryCharging)],
    ["Origin storage usage estimate", readable(snapshot.storageUsageBytes, " bytes")],
    ["Origin storage quota estimate", readable(snapshot.storageQuotaBytes, " bytes")]
  ] : [];

  return (
    <section className="oep-field-audit" id="device-field-audit" data-testid="device-field-audit">
      <div className="oep-field-head">
        <div><p className="eyebrow">{copy.eyebrow}</p><h3>{copy.title}</h3><p>{copy.description}</p></div>
        <div className="oep-field-node-status">
          <span>{copy.nodeTitle}</span><strong>{copy.nodeStatus}</strong>
        </div>
      </div>
      <div className="oep-field-actions">
        <button className="oep-field-primary" type="button" data-testid="field-inspect" disabled={pending} onClick={() => void inspectDevice()}>{copy.inspect}</button>
        {snapshot && <button className="oep-field-secondary" type="button" data-testid="field-export" onClick={exportReport}>{copy.export} ↓</button>}
        <span role="status" data-testid="field-snapshot-status">{snapshot ? copy.recorded + " · " + snapshot.observedAtUtc : copy.notMeasured}</span>
      </div>
      {snapshot && (
        <dl className="oep-field-readings" data-testid="field-measurements">
          {rows.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}
        </dl>
      )}
      <div className="oep-field-camera-wrap">
        <div className="oep-field-camera-info">
          <h4>{copy.cameraTitle}</h4>
          <p role="status" data-testid="field-camera-state">
            {cameraStatus === "active" ? copy.cameraActive :
             cameraStatus === "idle" ? copy.cameraIdle :
             cameraStatus === "requesting" ? "REQUESTING OS PERMISSION…" :
             copy.cameraDenied}
          </p>
          {cameraMeasurement && <p data-testid="field-camera-measurement">
            {cameraMeasurement.width} × {cameraMeasurement.height} px · average luminance {cameraMeasurement.luminance}/255 · {cameraMeasurement.samples} local samples
          </p>}
          <button className="oep-field-secondary" type="button" data-testid="field-camera-toggle"
            disabled={cameraStatus === "requesting"} onClick={() => void (cameraStatus === "active" ? stopCamera() : startCamera())}>
            {cameraStatus === "active" ? copy.cameraStop : copy.cameraStart}
          </button>
        </div>
        <video ref={videoRef} className="oep-field-video" playsInline muted autoPlay aria-label={copy.cameraTitle}/>
      </div>
      <p className="oep-field-disclaimer">{copy.disclaimer}</p>
    </section>
  );
}
