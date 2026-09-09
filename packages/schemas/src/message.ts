import { z } from 'zod';

/**
 * Message types aligned with emergency response taxonomy
 */
export const MessageType = {
  SAFE: 'SAFE',
  SOS: 'SOS',
  MEDICAL: 'MEDICAL',
  FIRE: 'FIRE',
  MISSING_PERSON: 'MISSING_PERSON',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
  ROAD_BLOCKED: 'ROAD_BLOCKED',
  RESOURCE_REQUEST: 'RESOURCE_REQUEST',
  GENERAL_REPORT: 'GENERAL_REPORT',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

/**
 * Verification states - NEVER transform unverified into confirmed
 */
export const VerificationState = {
  UNVERIFIED: 'UNVERIFIED',
  CORROBORATED: 'CORROBORATED',
  OFFICIAL: 'OFFICIAL',
  DISPUTED: 'DISPUTED',
} as const;

export type VerificationState = typeof VerificationState[keyof typeof VerificationState];

/**
 * Message priority levels
 */
export const Priority = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type Priority = typeof Priority[keyof typeof Priority];

/**
 * Location with confidence level
 */
export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  source: z.enum(['GPS', 'CELL_TOWER', 'IP', 'MANUAL', 'ESTIMATED']),
});

export type Location = z.infer<typeof LocationSchema>;

/**
 * Delivery attempt record
 */
export const DeliveryAttemptSchema = z.object({
  transportId: z.string(),
  attemptedAt: z.string(), // ISO 8601
  status: z.enum(['QUEUED', 'IN_TRANSIT', 'DELIVERED', 'FAILED']),
  error: z.string().optional(),
});

export type DeliveryAttempt = z.infer<typeof DeliveryAttemptSchema>;

/**
 * Core message envelope
 *
 * A user creates a message once.
 * The system attempts delivery through whichever AUTHORIZED transports are available.
 */
export const MessageEnvelopeSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid().nullable(),
  createdAt: z.string(), // ISO 8601
  priority: z.nativeEnum(Priority),
  origin: z.string(), // userId or deviceId
  payloadType: z.nativeEnum(MessageType),
  payload: z.record(z.unknown()), // Type-specific payload
  approximateLocation: LocationSchema.nullable(),
  ttl: z.number().int().positive(), // seconds
  verificationState: z.nativeEnum(VerificationState),
  deliveryHistory: z.array(DeliveryAttemptSchema),
});

export type MessageEnvelope = z.infer<typeof MessageEnvelopeSchema>;
