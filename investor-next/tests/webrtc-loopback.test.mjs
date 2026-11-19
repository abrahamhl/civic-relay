import test from 'node:test';
import assert from 'node:assert/strict';
import { sendWebRtcLoopbackPacket } from '../lib/webrtc-loopback.mjs';

const packet = { protocol: 'OEP_REAL_EXECUTION_V1', messageId: 'test-1', signatureHex: 'deadbeef' };

test('unsupported WebRTC never claims successful delivery or fabricates latency', async () => {
  assert.deepEqual(await sendWebRtcLoopbackPacket(packet, { PeerConnection: false }), {
    delivered: false, rttMs: null, reason: 'API_UNAVAILABLE'
  });
});

test('failed negotiation never claims delivery', async () => {
  class BrokenPeer {
    createDataChannel() { return { onopen: null }; }
    createOffer() { return Promise.reject(new Error('ICE failure')); }
    close() {}
  }
  const result = await sendWebRtcLoopbackPacket(packet, { PeerConnection: BrokenPeer });
  assert.deepEqual(result, { delivered: false, rttMs: null, reason: 'NEGOTIATION_FAILED' });
});

test('timeout never claims delivery', async () => {
  class StalledPeer {
    createDataChannel() { return { onopen: null }; }
    createOffer() { return new Promise(() => {}); }
    close() {}
  }
  const result = await sendWebRtcLoopbackPacket(packet, { PeerConnection: StalledPeer, timeoutMs: 5 });
  assert.deepEqual(result, { delivered: false, rttMs: null, reason: 'TIMEOUT' });
});

test('only a matching packet received on a local data channel is marked loopback-delivered', async () => {
  const peers = [];
  class ConnectedPeer {
    constructor() { peers.push(this); }
    createDataChannel() {
      this.tx = { onopen: null, send: (data) => {
        const rx = { onmessage: null };
        peers[1].ondatachannel({ channel: rx });
        rx.onmessage({ data });
      } };
      return this.tx;
    }
    createOffer() { return Promise.resolve({ type: 'offer' }); }
    createAnswer() { return Promise.resolve({ type: 'answer' }); }
    setLocalDescription() { return Promise.resolve(); }
    setRemoteDescription(description) {
      if (this === peers[0] && description.type === 'answer') {
        queueMicrotask(() => this.tx.onopen());
      }
      return Promise.resolve();
    }
    close() {}
  }
  const result = await sendWebRtcLoopbackPacket(packet, { PeerConnection: ConnectedPeer });
  assert.equal(result.delivered, true);
  assert.equal(result.reason, 'RECEIVED_LOOPBACK');
  assert.ok(result.rttMs >= 0);
});
