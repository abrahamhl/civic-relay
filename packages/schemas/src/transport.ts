import { z } from 'zod';

/**
 * Transport capability report
 * Each authorized transport reports what it can do
 */
export const TransportCapabilitySchema = z.object({
  transportId: z.string(),
  transportType: z.enum(['IP', 'LOCAL_MESH', 'CELLULAR', 'SATELLITE_GATEWAY', 'EMERGENCY_BROADCAST']),
  available: z.boolean(),
  estimatedReliability: z.number().min(0).max(1), // 0.0 to 1.0
  latency: z.number().nonnegative(), // milliseconds
  energyCost: z.enum(['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  monetaryCost: z.enum(['FREE', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']),
  bandwidth: z.number().nonnegative(), // bytes per second
  lastSeen: z.string(), // ISO 8601
});

export type TransportCapability = z.infer<typeof TransportCapabilitySchema>;

/** Receipt from the same-page demo receiver, not a network or authenticated ACK. */
export const ReceiverAcknowledgmentSchema = z.object({
  messageId: z.string().uuid(),
  transportId: z.string().trim().min(1),
  receiverId: z.string().trim().min(1),
  receivedAt: z.string().datetime({ offset: true }),
}).strict();

export type ReceiverAcknowledgment = z.infer<typeof ReceiverAcknowledgmentSchema>;

/**
 * Routing decision with explanation
 */
export const RoutingDecisionSchema = z.object({
  messageId: z.string().uuid(),
  selectedTransports: z.array(z.string()), // transportIds, ordered by preference
  explanation: z.string(),
  decidedAt: z.string(),
});

export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;
