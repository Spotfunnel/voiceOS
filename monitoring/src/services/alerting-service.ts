/**
 * Alerting Service - Sends alerts via Slack webhook, PagerDuty
 * 
 * Features:
 * - Slack webhook integration (HTTP POST)
 * - PagerDuty integration (optional)
 * - Alert rules:
 *   - P95 latency > 800ms
 *   - Cost per call > $0.20
 *   - Circuit breaker open > 5 minutes
 *   - Worker memory > 80%
 *   - Provider downtime > 2 minutes
 * - Alert deduplication (don't spam)
 */

import { Pool } from 'pg';

export interface AlertRule {
  id: string;
  name: string;
  type: 'latency' | 'cost' | 'circuit_breaker' | 'worker_memory' | 'provider_downtime';
  severity: 'critical' | 'warning' | 'info';
  threshold: number;
  component?: string;
  tenantId?: string;
  enabled: boolean;
}

export interface Alert {
  alertId: string;
  alertType: string;
  severity: 'critical' | 'warning' | 'info';
  component?: string;
  tenantId?: string;
  traceId?: string;
  message: string;
  metricValue: number;
  threshold: number;
  timestamp: Date;
}

export class AlertingService {
  private slackWebhookUrl: string | null = null;
  private pool: Pool;
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Date> = new Map(); // alertKey -> firedAt
  private readonly deduplicationWindowMs = 5 * 60 * 1000; // 5 minutes

  constructor(dbUrl: string, slackWebhookUrl?: string) {
    this.pool = new Pool({
      connectionString: dbUrl,
      max: 10,
    });

    this.slackWebhookUrl = slackWebhookUrl || null;

    // Initialize default alert rules
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'latency_p95_turn_e2e',
        name: 'P95 Turn Latency > 800ms',
        type: 'latency',
        severity: 'critical',
        threshold: 800,
        component: 'turn_e2e',
        enabled: true,
      },
      {
        id: 'cost_per_call',
        name: 'Cost per Call > $0.20',
        type: 'cost',
        severity: 'warning',
        threshold: 0.20,
        enabled: true,
      },
      {
        id: 'circuit_breaker_open',
        name: 'Circuit Breaker Open > 5 minutes',
        type: 'circuit_breaker',
        severity: 'critical',
        threshold: 5 * 60 * 1000, // 5 minutes in ms
        enabled: true,
      },
      {
        id: 'worker_memory',
        name: 'Worker Memory > 80%',
        type: 'worker_memory',
        severity: 'warning',
        threshold: 80,
        enabled: true,
      },
      {
        id: 'provider_downtime',
        name: 'Provider Downtime > 2 minutes',
        type: 'provider_downtime',
        severity: 'critical',
        threshold: 2 * 60 * 1000, // 2 minutes in ms
        enabled: true,
      },
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }
  }

  /**
   * Check latency alert
   */
  async checkLatencyAlert(
    tenantId: string,
    component: string,
    p95Latency: number,
    threshold: number = 800
  ): Promise<void> {
    if (p95Latency <= threshold) {
      return;
    }

    const alertKey = `latency_${tenantId}_${component}`;
    if (this.isDeduplicated(alertKey)) {
      return;
    }

    await this.fireAlert({
      alertId: this.generateAlertId(),
      alertType: 'latency_p95',
      severity: 'critical',
      component,
      tenantId,
      message: `P95 latency for ${component} exceeded threshold: ${p95Latency}ms > ${threshold}ms`,
      metricValue: p95Latency,
      threshold,
      timestamp: new Date(),
    });

    this.activeAlerts.set(alertKey, new Date());
  }

  /**
   * Check cost alert
   */
  async checkCostAlert(
    traceId: string,
    tenantId: string,
    costPerMinute: number,
    threshold: number = 0.20
  ): Promise<void> {
    if (costPerMinute <= threshold) {
      return;
    }

    const alertKey = `cost_${traceId}`;
    if (this.isDeduplicated(alertKey)) {
      return;
    }

    await this.fireAlert({
      alertId: this.generateAlertId(),
      alertType: 'cost_threshold',
      severity: 'warning',
      tenantId,
      traceId,
      message: `Cost per minute exceeded threshold: $${costPerMinute.toFixed(4)} > $${threshold}`,
      metricValue: costPerMinute,
      threshold,
      timestamp: new Date(),
    });

    this.activeAlerts.set(alertKey, new Date());
  }

  /**
   * Check circuit breaker alert
   */
  async checkCircuitBreakerAlert(
    provider: string,
    openDurationMs: number,
    thresholdMs: number = 5 * 60 * 1000
  ): Promise<void> {
    if (openDurationMs <= thresholdMs) {
      return;
    }

    const alertKey = `circuit_breaker_${provider}`;
    if (this.isDeduplicated(alertKey)) {
      return;
    }

    await this.fireAlert({
      alertId: this.generateAlertId(),
      alertType: 'circuit_breaker_open',
      severity: 'critical',
      component: provider,
      message: `Circuit breaker for ${provider} has been open for ${Math.round(openDurationMs / 1000)}s (threshold: ${Math.round(thresholdMs / 1000)}s)`,
      metricValue: openDurationMs,
      threshold: thresholdMs,
      timestamp: new Date(),
    });

    this.activeAlerts.set(alertKey, new Date());
  }

  /**
   * Check worker memory alert
   */
  async checkWorkerMemoryAlert(
    workerId: string,
    memoryPercent: number,
    threshold: number = 80
  ): Promise<void> {
    if (memoryPercent <= threshold) {
      return;
    }

    const alertKey = `worker_memory_${workerId}`;
    if (this.isDeduplicated(alertKey)) {
      return;
    }

    await this.fireAlert({
      alertId: this.generateAlertId(),
      alertType: 'worker_memory',
      severity: 'warning',
      component: workerId,
      message: `Worker ${workerId} memory usage: ${memoryPercent.toFixed(1)}% > ${threshold}%`,
      metricValue: memoryPercent,
      threshold,
      timestamp: new Date(),
    });

    this.activeAlerts.set(alertKey, new Date());
  }

  /**
   * Check provider downtime alert
   */
  async checkProviderDowntimeAlert(
    provider: string,
    downtimeMs: number,
    thresholdMs: number = 2 * 60 * 1000
  ): Promise<void> {
    if (downtimeMs <= thresholdMs) {
      return;
    }

    const alertKey = `provider_downtime_${provider}`;
    if (this.isDeduplicated(alertKey)) {
      return;
    }

    await this.fireAlert({
      alertId: this.generateAlertId(),
      alertType: 'provider_downtime',
      severity: 'critical',
      component: provider,
      message: `Provider ${provider} has been down for ${Math.round(downtimeMs / 1000)}s (threshold: ${Math.round(thresholdMs / 1000)}s)`,
      metricValue: downtimeMs,
      threshold: thresholdMs,
      timestamp: new Date(),
    });

    this.activeAlerts.set(alertKey, new Date());
  }

  /**
   * Fire alert (send to Slack, store in database)
   */
  private async fireAlert(alert: Alert): Promise<void> {
    // Store in database
    const client = await this.pool.connect();
    try {
      await client.query(
        `
        INSERT INTO alert_history (
          alert_id, alert_type, alert_severity,
          component, tenant_id, trace_id,
          message, metric_value, threshold,
          status, fired_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `,
        [
          alert.alertId,
          alert.alertType,
          alert.severity,
          alert.component || null,
          alert.tenantId || null,
          alert.traceId || null,
          alert.message,
          alert.metricValue,
          alert.threshold,
          'firing',
          alert.timestamp,
        ]
      );
    } finally {
      client.release();
    }

    // Send to Slack via HTTP POST
    if (this.slackWebhookUrl) {
      try {
        const color = alert.severity === 'critical' ? 'danger' : alert.severity === 'warning' ? 'warning' : 'good';
        const payload = {
          text: `🚨 Alert: ${alert.alertType}`,
          attachments: [
            {
              color,
              title: alert.message,
              fields: [
                {
                  title: 'Severity',
                  value: alert.severity,
                  short: true,
                },
                {
                  title: 'Component',
                  value: alert.component || 'N/A',
                  short: true,
                },
                {
                  title: 'Metric Value',
                  value: String(alert.metricValue),
                  short: true,
                },
                {
                  title: 'Threshold',
                  value: String(alert.threshold),
                  short: true,
                },
                {
                  title: 'Timestamp',
                  value: alert.timestamp.toISOString(),
                  short: false,
                },
              ],
            },
          ],
        };

        await fetch(this.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error('Error sending Slack alert:', error);
      }
    }
  }

  /**
   * Check if alert is deduplicated (already fired recently)
   */
  private isDeduplicated(alertKey: string): boolean {
    const lastFired = this.activeAlerts.get(alertKey);
    if (!lastFired) {
      return false;
    }

    const timeSinceLastFired = Date.now() - lastFired.getTime();
    if (timeSinceLastFired > this.deduplicationWindowMs) {
      // Window expired, allow alert again
      this.activeAlerts.delete(alertKey);
      return false;
    }

    return true;
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Resolve alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `
        UPDATE alert_history
        SET status = 'resolved', resolved_at = NOW()
        WHERE alert_id = $1
        `,
        [alertId]
      );
    } finally {
      client.release();
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(): Promise<Alert[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(
        `
        SELECT * FROM alert_history
        WHERE status = 'firing'
        ORDER BY fired_at DESC
        LIMIT 100
        `
      );

      return result.rows.map((row) => ({
        alertId: row.alert_id,
        alertType: row.alert_type,
        severity: row.alert_severity,
        component: row.component,
        tenantId: row.tenant_id,
        traceId: row.trace_id,
        message: row.message,
        metricValue: Number(row.metric_value),
        threshold: Number(row.threshold),
        timestamp: row.fired_at,
      }));
    } finally {
      client.release();
    }
  }
}
