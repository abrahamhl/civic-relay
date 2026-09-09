import { Dispatcher } from './dispatcher.js';
import { Deduplicator } from './deduplication.js';
import { IPTransport, LocalMeshTransport, CellularTransport } from '@civic-relay/transports';
import type { MessageEnvelope, ReceiverAcknowledgment } from '@civic-relay/schemas';

export interface DemoSession {
  dispatcher: Dispatcher;
  receiver: Deduplicator;
  transports: {
    ip: IPTransport;
    mesh: LocalMeshTransport;
    cellular: CellularTransport;
  };
}

/**
 * Same-page simulation: the "receiver" is a second, independent session in memory.
 * It is the real Deduplicator codepath; a page reload loses everything.
 */
export function createDemoSession(): DemoSession {
  const receiver = new Deduplicator();
  const acknowledge = (message: unknown, transportId: string): ReceiverAcknowledgment =>
    receiver.deduplicate(message, transportId).acknowledgment;

  const ip = new IPTransport();
  const mesh = new LocalMeshTransport();
  const cellular = new CellularTransport();
  ip.setReceiver(acknowledge);
  mesh.setReceiver(acknowledge);
  cellular.setReceiver(acknowledge);

  const dispatcher = new Dispatcher();
  dispatcher.registerTransport(ip);
  dispatcher.registerTransport(mesh);
  dispatcher.registerTransport(cellular);

  return { dispatcher, receiver, transports: { ip, mesh, cellular } };
}

export interface GoldenResult {
  messageId: string;
  receiverCount: number;
  receiverPaths: number;
  senderHistory: Array<{ transportId: string; status: string }>;
}

/**
 * Golden vertical slice: message -> offline queue -> mesh ack -> later IP ack ->
 * receiver deduplicates to one logical message retaining both observed paths.
 * Enabled paths are always simulated; no transport performs real networking.
 */
export async function runGoldenScenario(
  message: MessageEnvelope,
  enabledAt: Array<'mesh' | 'ip' | 'cellular'>
): Promise<GoldenResult> {
  const session = createDemoSession();
  const s = session.transports;

  s.ip.setSimulatedState(false);
  s.mesh.setSimulatedState(false);
  s.cellular.setSimulatedState(false);

  await session.dispatcher.dispatch(message);
  const initiallyQueued = session.dispatcher.getStore().getQueued().length;
  if (initiallyQueued < 1) throw new Error('Message was not queued with all transports unavailable');

  for (const name of enabledAt) {
    if (name === 'mesh') s.mesh.setSimulatedState(true, 3);
    if (name === 'ip') s.ip.setSimulatedState(true);
    if (name === 'cellular') s.cellular.setSimulatedState(true, 4);
    await session.dispatcher.retryQueued();
  }

  const received = session.receiver.getAll();
  if (received.length !== 1) throw new Error(`Expected one logical message, got ${received.length}`);

  const stored = session.dispatcher.getStore().get(message.id);
  if (!stored) throw new Error('Message missing from sender store');

  return {
    messageId: message.id,
    receiverCount: received.length,
    receiverPaths: received[0].deliveryHistory.length,
    senderHistory: stored.deliveryHistory.map((a) => ({ transportId: a.transportId, status: a.status })),
  };
}
