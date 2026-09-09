import { z } from 'zod';
import { MessageType, VerificationState, LocationSchema } from './message';

/**
 * Incident status lifecycle
 */
export const IncidentStatus = {
  ACTIVE: 'ACTIVE',
  MONITORING: 'MONITORING',
  RESOLVED: 'RESOLVED',
  FALSE_ALARM: 'FALSE_ALARM',
} as const;

export type IncidentStatus = typeof IncidentStatus[keyof typeof IncidentStatus];

/**
 * Incident schema - aggregates related messages
 */
export const IncidentSchema = z.object({
  id: z.string().uuid(),
  type: z.nativeEnum(MessageType),
  status: z.nativeEnum(IncidentStatus),
  createdAt: z.string(),
  updatedAt: z.string(),
  location: LocationSchema,
  verificationState: z.nativeEnum(VerificationState),
  messageCount: z.number().int().nonnegative(),
  affectedCount: z.number().int().nonnegative(),
  description: z.string(),
  officialSource: z.string().nullable(),
});

export type Incident = z.infer<typeof IncidentSchema>;
