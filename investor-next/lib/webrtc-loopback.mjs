/** Same-browser WebRTC DataChannel exercise. Never evidence of a remote device. */
export async function sendWebRtcLoopbackPacket(packet, options = {}) {
  const PeerConnection = options.PeerConnection ?? globalThis.RTCPeerConnection;
  if (typeof PeerConnection !== 'function') {
    return { delivered: false, rttMs: null, reason: 'API_UNAVAILABLE' };
  }
  const now = options.now ?? (() => performance.now());
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer = options.clearTimer ?? clearTimeout;
  const timeoutMs = options.timeoutMs ?? 5000;

  return new Promise((resolve) => {
    const started = now();
    let pc1;
    let pc2;
    let timer;
    let settled = false;
    const finish = (reason) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimer(timer);
      try { pc1?.close(); } catch {}
      try { pc2?.close(); } catch {}
      const delivered = reason === 'RECEIVED_LOOPBACK';
      resolve({
        delivered,
        rttMs: delivered ? Number((now() - started).toFixed(2)) : null,
        reason
      });
    };

    try {
      pc1 = new PeerConnection();
      pc2 = new PeerConnection();
      timer = setTimer(() => finish('TIMEOUT'), timeoutMs);
      pc1.onicecandidate = (event) => {
        if (event.candidate) pc2.addIceCandidate(event.candidate).catch(() => {});
      };
      pc2.onicecandidate = (event) => {
        if (event.candidate) pc1.addIceCandidate(event.candidate).catch(() => {});
      };
      pc2.ondatachannel = (event) => {
        event.channel.onmessage = (message) => {
          try {
            const received = JSON.parse(String(message.data));
            if (received?.messageId === packet.messageId &&
                received?.protocol === packet.protocol &&
                received?.signatureHex === packet.signatureHex) {
              finish('RECEIVED_LOOPBACK');
            }
          } catch { /* Malformed data is not a receipt. */ }
        };
      };
      const tx = pc1.createDataChannel('oep-browser-loopback');
      tx.onopen = () => {
        try { tx.send(JSON.stringify(packet)); }
        catch { finish('SEND_FAILED'); }
      };
      pc1.createOffer()
        .then((offer) => pc1.setLocalDescription(offer).then(() => pc2.setRemoteDescription(offer)))
        .then(() => pc2.createAnswer())
        .then((answer) => pc2.setLocalDescription(answer).then(() => pc1.setRemoteDescription(answer)))
        .catch(() => finish('NEGOTIATION_FAILED'));
    } catch {
      finish('SETUP_FAILED');
    }
  });
}
