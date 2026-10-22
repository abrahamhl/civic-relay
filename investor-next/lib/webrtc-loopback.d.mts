export interface WebRtcLoopbackResult {
  delivered: boolean;
  rttMs: number | null;
  reason: string;
}
export function sendWebRtcLoopbackPacket(
  packet: { messageId: string; protocol: string; signatureHex: string },
  options?: {
    PeerConnection?: typeof RTCPeerConnection | false;
    timeoutMs?: number;
    now?: () => number;
    setTimer?: typeof setTimeout;
    clearTimer?: typeof clearTimeout;
  }
): Promise<WebRtcLoopbackResult>;
