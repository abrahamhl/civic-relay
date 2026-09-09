/**
 * Integración 112/CAD
 * Mejora #2: API REST para Computer-Aided Dispatch
 */

import type { MessageEnvelope } from '@civic-relay/schemas';

/**
 * CAD Ticket format (compatible con Integraph, Hexagon, etc.)
 */
export interface CADTicket {
  ticketId: string;
  incidentType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  reportedAt: string;
  source: 'CIVIC_RELAY' | '112_CALL' | 'MANUAL';
  callerInfo: {
    id: string;
    type: 'CITIZEN' | 'RESPONDER' | 'COORDINATOR';
  };
  status: 'PENDING' | 'DISPATCHED' | 'EN_ROUTE' | 'ON_SCENE' | 'RESOLVED';
  assignedUnits: string[];
  notes: string;
}

/**
 * Convert Civic Relay message to CAD ticket
 */
export function messageToCADTicket(message: MessageEnvelope): CADTicket {
  return {
    ticketId: `CR-${message.id.substring(0, 8)}`,
    incidentType: message.payloadType,
    priority: message.priority,
    location: {
      latitude: message.approximateLocation?.lat || 0,
      longitude: message.approximateLocation?.lon || 0,
      address: (message.payload as any).address || 'Unknown',
    },
    reportedAt: message.createdAt,
    source: 'CIVIC_RELAY',
    callerInfo: {
      id: message.origin,
      type: 'CITIZEN',
    },
    status: 'PENDING',
    assignedUnits: [],
    notes: JSON.stringify(message.payload),
  };
}

/**
 * Mock CAD system for demos
 */
export class MockCADSystem {
  private tickets: Map<string, CADTicket> = new Map();

  createTicket(message: MessageEnvelope): CADTicket {
    const ticket = messageToCADTicket(message);
    this.tickets.set(ticket.ticketId, ticket);

    console.log(`[Mock CAD] Ticket created: ${ticket.ticketId}`);
    console.log(`[Mock CAD] Type: ${ticket.incidentType}, Priority: ${ticket.priority}`);

    // Simulate automatic dispatch for CRITICAL
    if (ticket.priority === 'CRITICAL') {
      setTimeout(() => {
        this.dispatchTicket(ticket.ticketId, ['UNIT-001', 'UNIT-002']);
      }, 2000);
    }

    return ticket;
  }

  dispatchTicket(ticketId: string, units: string[]): void {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return;

    ticket.status = 'DISPATCHED';
    ticket.assignedUnits = units;

    console.log(`[Mock CAD] Ticket ${ticketId} dispatched to units: ${units.join(', ')}`);
  }

  getTicket(ticketId: string): CADTicket | undefined {
    return this.tickets.get(ticketId);
  }

  getAllTickets(): CADTicket[] {
    return Array.from(this.tickets.values());
  }

  updateStatus(ticketId: string, status: CADTicket['status']): void {
    const ticket = this.tickets.get(ticketId);
    if (ticket) {
      ticket.status = status;
      console.log(`[Mock CAD] Ticket ${ticketId} status: ${status}`);
    }
  }
}

/**
 * Real CAD integration (for production)
 * Implements vendor-specific protocols (Integraph, Hexagon, etc.)
 */
export interface CADIntegration {
  connect(): Promise<void>;
  sendTicket(ticket: CADTicket): Promise<string>;
  getStatus(ticketId: string): Promise<CADTicket['status']>;
  disconnect(): Promise<void>;
}

/**
 * Integraph CAD adapter (example)
 */
export class IntegraphCADAdapter implements CADIntegration {
  private apiEndpoint: string;
  private apiKey: string;

  constructor(endpoint: string, apiKey: string) {
    this.apiEndpoint = endpoint;
    this.apiKey = apiKey;
  }

  async connect(): Promise<void> {
    // Verify API key, establish connection
    console.log('[Integraph CAD] Connected');
  }

  async sendTicket(ticket: CADTicket): Promise<string> {
    // POST to Integraph API
    // In production: await fetch(this.apiEndpoint + '/tickets', { ... })
    console.log('[Integraph CAD] Ticket sent:', ticket.ticketId);
    return ticket.ticketId;
  }

  async getStatus(ticketId: string): Promise<CADTicket['status']> {
    // GET from Integraph API
    return 'PENDING';
  }

  async disconnect(): Promise<void> {
    console.log('[Integraph CAD] Disconnected');
  }
}
