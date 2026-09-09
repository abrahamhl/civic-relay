import type { MessageEnvelope, RoutingDecision, Priority } from '@civic-relay/schemas';
import type { ITransport } from '@civic-relay/transports';

/**
 * Router - Makes explainable transport selection decisions
 *
 * Ranking criteria:
 * 1. Availability (binary gate)
 * 2. Reliability (higher is better)
 * 3. Energy cost (lower is better for non-critical)
 * 4. Latency (lower is better)
 * 5. Monetary cost (lower is better)
 */
export class Router {
  private transports: Map<string, ITransport> = new Map();

  registerTransport(transport: ITransport): void {
    this.transports.set(transport.id, transport);
  }

  async route(message: MessageEnvelope): Promise<RoutingDecision> {
    const capabilities = await Promise.all(
      Array.from(this.transports.values()).map(async (t) => ({
        transport: t,
        capability: await t.getCapabilities(),
      }))
    );

    // Filter to available transports only
    const available = capabilities.filter((c) => c.capability.available);

    if (available.length === 0) {
      return {
        messageId: message.id,
        selectedTransports: [],
        explanation: 'No transports available - message will be queued',
        decidedAt: new Date().toISOString(),
      };
    }

    // Score each transport
    const scored = available.map((c) => ({
      transportId: c.capability.transportId,
      score: this.scoreTransport(c.capability, message.priority),
      capability: c.capability,
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // For multipath: select top N transports based on priority
    const multipathCount = this.getMultipathCount(message.priority);
    const selected = scored.slice(0, multipathCount);

    const explanation = this.explainDecision(selected, message.priority);

    return {
      messageId: message.id,
      selectedTransports: selected.map((s) => s.transportId),
      explanation,
      decidedAt: new Date().toISOString(),
    };
  }

  private scoreTransport(capability: any, priority: Priority): number {
    let score = 0;

    // Reliability is most important
    score += capability.estimatedReliability * 1000;

    // Latency matters for high priority
    if (priority === 'CRITICAL' || priority === 'HIGH') {
      score -= capability.latency / 10;
    }

    // Energy cost penalty
    const energyPenalty: Record<string, number> = {
      VERY_LOW: 0,
      LOW: 50,
      MEDIUM: 100,
      HIGH: 200,
      VERY_HIGH: 400,
    };
    score -= energyPenalty[capability.energyCost] || 0;

    // Monetary cost penalty
    const costPenalty: Record<string, number> = {
      FREE: 0,
      LOW: 10,
      MEDIUM: 50,
      HIGH: 100,
      VERY_HIGH: 200,
    };
    score -= costPenalty[capability.monetaryCost] || 0;

    return score;
  }

  private getMultipathCount(priority: Priority): number {
    switch (priority) {
      case 'CRITICAL':
        return 3; // Use up to 3 transports for critical messages
      case 'HIGH':
        return 2;
      case 'MEDIUM':
        return 1;
      case 'LOW':
        return 1;
    }
  }

  private explainDecision(selected: any[], priority: Priority): string {
    if (selected.length === 0) {
      return 'No transports available';
    }

    const primary = selected[0];
    const transportType = primary.capability.transportType;
    const reliability = (primary.capability.estimatedReliability * 100).toFixed(0);

    if (selected.length === 1) {
      return `Selected ${transportType} (${reliability}% reliability, ${primary.capability.energyCost} energy)`;
    }

    const others = selected.slice(1).map((s) => s.capability.transportType).join(', ');
    return `Multipath routing (priority: ${priority}): ${transportType} + ${others} for redundancy`;
  }
}
