/**
 * Analytics Module - Message Statistics & KPIs
 * Mejora #4: Dashboard Político - Analytics Engine
 */

import type { MessageEnvelope } from '@civic-relay/schemas';

export interface MessageStats {
  totalMessages: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  byStatus: Record<string, number>;
  avgResponseTime: number; // in seconds
  verifiedRate: number; // 0-1
  deliverySuccessRate: number; // 0-1
  criticalCount: number;
  resolvedCount: number;
  timeline: {
    hour: Array<{ timestamp: string; count: number }>;
    day: Array<{ date: string; count: number }>;
    week: Array<{ week: string; count: number }>;
  };
  geographicDistribution: Array<{
    region: string;
    count: number;
    percentage: number;
  }>;
  topIncidentTypes: Array<{
    type: string;
    count: number;
    avgResponseTime: number;
  }>;
}

/**
 * Calculate comprehensive statistics from message array
 */
export function aggregateStats(messages: MessageEnvelope[]): MessageStats {
  if (messages.length === 0) {
    return getEmptyStats();
  }

  // Count by type
  const byType: Record<string, number> = {};
  for (const msg of messages) {
    byType[msg.payloadType] = (byType[msg.payloadType] || 0) + 1;
  }

  // Count by priority
  const byPriority: Record<string, number> = {};
  for (const msg of messages) {
    byPriority[msg.priority] = (byPriority[msg.priority] || 0) + 1;
  }

  // Count by delivery status
  const byStatus: Record<string, number> = {
    QUEUED: 0,
    DELIVERED: 0,
    FAILED: 0,
  };

  let totalResponseTime = 0;
  let messagesWithResponse = 0;
  let verifiedCount = 0;
  let deliveredCount = 0;

  for (const msg of messages) {
    // Delivery status
    const hasDelivery = msg.deliveryHistory.some((d) => d.status === 'DELIVERED');
    if (hasDelivery) {
      byStatus.DELIVERED++;
      deliveredCount++;
    } else if (msg.deliveryHistory.some((d) => d.status === 'FAILED')) {
      byStatus.FAILED++;
    } else {
      byStatus.QUEUED++;
    }

    // Response time (first successful delivery)
    const firstDelivery = msg.deliveryHistory.find((d) => d.status === 'DELIVERED');
    if (firstDelivery) {
      const createdAt = new Date(msg.createdAt).getTime();
      const deliveredAt = new Date(firstDelivery.attemptedAt).getTime();
      const responseTime = (deliveredAt - createdAt) / 1000; // seconds
      totalResponseTime += responseTime;
      messagesWithResponse++;
    }

    // Verification rate
    if (msg.verificationState === 'OFFICIAL') {
      verifiedCount++;
    }
  }

  const avgResponseTime = messagesWithResponse > 0 ? totalResponseTime / messagesWithResponse : 0;
  const verifiedRate = verifiedCount / messages.length;
  const deliverySuccessRate = deliveredCount / messages.length;
  const criticalCount = messages.filter((m) => m.priority === 'CRITICAL').length;

  // Resolved count (heuristic: delivered + verified)
  const resolvedCount = messages.filter(
    (m) =>
      m.deliveryHistory.some((d) => d.status === 'DELIVERED') &&
      m.verificationState === 'OFFICIAL'
  ).length;

  // Timeline aggregation
  const timeline = generateTimeline(messages);

  // Geographic distribution (mock for demo)
  const geographicDistribution = generateGeographicDistribution(messages);

  // Top incident types
  const topIncidentTypes = generateTopIncidentTypes(messages);

  return {
    totalMessages: messages.length,
    byType,
    byPriority,
    byStatus,
    avgResponseTime,
    verifiedRate,
    deliverySuccessRate,
    criticalCount,
    resolvedCount,
    timeline,
    geographicDistribution,
    topIncidentTypes,
  };
}

/**
 * Generate timeline data (hour, day, week)
 */
function generateTimeline(messages: MessageEnvelope[]) {
  // Hour timeline (last 24 hours)
  const hourBuckets: Record<string, number> = {};
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  for (const msg of messages) {
    const timestamp = new Date(msg.createdAt).getTime();
    if (timestamp >= oneDayAgo) {
      const hour = new Date(timestamp).toISOString().slice(0, 13);
      hourBuckets[hour] = (hourBuckets[hour] || 0) + 1;
    }
  }

  const hourTimeline = Object.entries(hourBuckets)
    .map(([timestamp, count]) => ({ timestamp: timestamp + ':00:00Z', count }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Day timeline (last 30 days)
  const dayBuckets: Record<string, number> = {};
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  for (const msg of messages) {
    const timestamp = new Date(msg.createdAt).getTime();
    if (timestamp >= thirtyDaysAgo) {
      const date = new Date(timestamp).toISOString().slice(0, 10);
      dayBuckets[date] = (dayBuckets[date] || 0) + 1;
    }
  }

  const dayTimeline = Object.entries(dayBuckets)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Week timeline (last 12 weeks)
  const weekBuckets: Record<string, number> = {};

  for (const msg of messages) {
    const date = new Date(msg.createdAt);
    const weekNumber = getWeekNumber(date);
    const week = `${date.getFullYear()}-W${weekNumber}`;
    weekBuckets[week] = (weekBuckets[week] || 0) + 1;
  }

  const weekTimeline = Object.entries(weekBuckets)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12);

  return {
    hour: hourTimeline,
    day: dayTimeline,
    week: weekTimeline,
  };
}

/**
 * Generate geographic distribution (mock for demo)
 */
function generateGeographicDistribution(messages: MessageEnvelope[]) {
  // In production: extract from message.payload.location
  // For demo: mock distribution
  const regions = ['Centro', 'Norte', 'Sur', 'Este', 'Oeste'];
  const distribution = regions.map((region, i) => ({
    region,
    count: Math.floor(messages.length * (0.3 - i * 0.05)),
    percentage: 0.3 - i * 0.05,
  }));

  return distribution.filter((d) => d.count > 0);
}

/**
 * Generate top incident types with stats
 */
function generateTopIncidentTypes(messages: MessageEnvelope[]) {
  const typeStats: Record<
    string,
    { count: number; totalResponseTime: number; responseCount: number }
  > = {};

  for (const msg of messages) {
    const type = msg.payloadType;

    if (!typeStats[type]) {
      typeStats[type] = { count: 0, totalResponseTime: 0, responseCount: 0 };
    }

    typeStats[type].count++;

    // Calculate response time
    const firstDelivery = msg.deliveryHistory.find((d) => d.status === 'DELIVERED');
    if (firstDelivery) {
      const createdAt = new Date(msg.createdAt).getTime();
      const deliveredAt = new Date(firstDelivery.attemptedAt).getTime();
      const responseTime = (deliveredAt - createdAt) / 1000;
      typeStats[type].totalResponseTime += responseTime;
      typeStats[type].responseCount++;
    }
  }

  return Object.entries(typeStats)
    .map(([type, stats]) => ({
      type,
      count: stats.count,
      avgResponseTime: stats.responseCount > 0 ? stats.totalResponseTime / stats.responseCount : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Get week number of year
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

/**
 * Empty stats object
 */
function getEmptyStats(): MessageStats {
  return {
    totalMessages: 0,
    byType: {},
    byPriority: {},
    byStatus: {},
    avgResponseTime: 0,
    verifiedRate: 0,
    deliverySuccessRate: 0,
    criticalCount: 0,
    resolvedCount: 0,
    timeline: {
      hour: [],
      day: [],
      week: [],
    },
    geographicDistribution: [],
    topIncidentTypes: [],
  };
}

/**
 * Compare two time periods
 */
export function compareStats(
  current: MessageStats,
  previous: MessageStats
): Record<string, { value: number; change: number; changePercent: number }> {
  const metrics = [
    'totalMessages',
    'avgResponseTime',
    'verifiedRate',
    'deliverySuccessRate',
    'criticalCount',
    'resolvedCount',
  ];

  const comparison: Record<string, { value: number; change: number; changePercent: number }> = {};

  for (const metric of metrics) {
    const currentValue = current[metric as keyof MessageStats] as number;
    const previousValue = previous[metric as keyof MessageStats] as number;
    const change = currentValue - previousValue;
    const changePercent = previousValue > 0 ? (change / previousValue) * 100 : 0;

    comparison[metric] = {
      value: currentValue,
      change,
      changePercent,
    };
  }

  return comparison;
}

/**
 * Format response time for display
 */
export function formatResponseTime(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
}
