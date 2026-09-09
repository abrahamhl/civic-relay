/**
 * CAD Integration API Server
 * Mejora #2: Integración 112/CAD - REST API
 */

import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { MockCADSystem } from './cad-integration.js';

const app: Express = express();
const cad = new MockCADSystem();

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting - 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

/**
 * Health check endpoint
 */
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'civic-relay-cad-api',
    version: '0.1.0'
  });
});

/**
 * POST /api/cad/dispatch
 * Create new CAD ticket from emergency message
 */
app.post('/api/cad/dispatch', (req, res) => {
  try {
    const message = req.body;

    if (!message || !message.payload) {
      res.status(400).json({
        error: 'Invalid message format',
        details: 'Message body and payload are required'
      });
      return;
    }

    const ticket = cad.createTicket(message);

    res.status(201).json({
      success: true,
      ticket,
      message: 'Ticket created successfully'
    });
  } catch (error) {
    console.error('Error creating CAD ticket:', error);
    res.status(500).json({
      error: 'Failed to create ticket',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cad/tickets
 * Get all CAD tickets
 */
app.get('/api/cad/tickets', (_req, res) => {
  try {
    const tickets = cad.getAllTickets();
    res.json({
      success: true,
      count: tickets.length,
      tickets
    });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      error: 'Failed to fetch tickets',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cad/ticket/:id
 * Get specific CAD ticket by ID
 */
app.get('/api/cad/ticket/:id', (req, res) => {
  try {
    const ticket = cad.getTicket(req.params.id);

    if (!ticket) {
      res.status(404).json({
        error: 'Ticket not found',
        ticketId: req.params.id
      });
      return;
    }

    res.json({
      success: true,
      ticket
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      error: 'Failed to fetch ticket',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PATCH /api/cad/ticket/:id/status
 * Update ticket status (for dispatcher operations)
 */
app.patch('/api/cad/ticket/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const ticket = cad.getTicket(id);

    if (!ticket) {
      res.status(404).json({
        error: 'Ticket not found',
        ticketId: id
      });
      return;
    }

    // Update ticket status (simplified - in real CAD system this would be complex workflow)
    const validStatuses = ['NEW', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE', 'RESOLVED', 'CLOSED'];

    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        error: 'Invalid status',
        validStatuses
      });
      return;
    }

    if (status) {
      ticket.status = status;
    }

    if (notes) {
      ticket.dispatchNotes = `${ticket.dispatchNotes || ''}\n${new Date().toISOString()}: ${notes}`;
    }

    ticket.updatedAt = new Date().toISOString();

    res.json({
      success: true,
      ticket,
      message: 'Ticket updated successfully'
    });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({
      error: 'Failed to update ticket',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cad/stats
 * Get CAD system statistics
 */
app.get('/api/cad/stats', (_req, res) => {
  try {
    const tickets = cad.getAllTickets();

    const stats = {
      total: tickets.length,
      byStatus: tickets.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: tickets.reduce((acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      avgResponseTime: '4.2 min', // Mock - in production calculate from real data
      unitsDispatched: tickets.filter(t => t.unitsDispatched && t.unitsDispatched.length > 0).length
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚨 CAD Integration API listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API endpoints: http://localhost:${PORT}/api/cad/`);
});

export default app;
