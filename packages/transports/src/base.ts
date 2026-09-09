import type {
  MessageEnvelope, ReceiverAcknowledgment, TransportCapability,
} from '@civic-relay/schemas';

export interface SendResult {
  accepted: boolean;
  acknowledgment?: ReceiverAcknowledgment;
  error?: string;
}

export interface ITransport {
  readonly id: string;
  readonly type: TransportCapability['transportType'];
  getCapabilities(): Promise<TransportCapability>;
  /** Acceptance alone is never proof of delivery. */
  send(message: MessageEnvelope): Promise<SendResult>;
  isAvailable(): Promise<boolean>;
}

export type SimulatedReceiver = (
  message: unknown,
  transportId: string,
) => ReceiverAcknowledgment | Promise<ReceiverAcknowledgment>;

/** In-process simulation only. No sockets, radios, timers, or network probes. */
export abstract class SimulatedTransport implements ITransport {
  abstract readonly id: string;
  abstract readonly type: TransportCapability['transportType'];
  protected available = false;

  private receiver?: SimulatedReceiver;

  constructor(receiver?: SimulatedReceiver) {
    this.receiver = receiver;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }

  /** Bind the same-page demo receiver that returns the acknowledgment. */
  setReceiver(receiver: SimulatedReceiver): void {
    this.receiver = receiver;
  }

  abstract getCapabilities(): Promise<TransportCapability>;

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async send(message: MessageEnvelope): Promise<SendResult> {
    if (!await this.isAvailable()) return { accepted: false, error: 'Simulator unavailable' };
    if (!this.receiver) return { accepted: true };
    const acknowledgment = await this.receiver(structuredClone(message), this.id);
    return { accepted: true, acknowledgment };
  }
}
