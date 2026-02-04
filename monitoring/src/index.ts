/**
 * Monitoring Service - Main entry point
 * 
 * Connects to event bus, collects metrics, serves API, sends alerts
 */

import { MetricsService, type BaseEvent } from './services/metrics-service.js';
import { LatencyCollector } from './collectors/latency-collector.js';
import { CostCollector } from './collectors/cost-collector.js';
import { HealthCollector } from './collectors/health-collector.js';
import { AlertingService } from './services/alerting-service.js';
import { MetricsAPI } from './api/metrics-api.js';

export class MonitoringService {
  private metricsService: MetricsService;
  private latencyCollector: LatencyCollector;
  private costCollector: CostCollector;
  private healthCollector: HealthCollector;
  private alertingService: AlertingService;
  private metricsAPI: MetricsAPI;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    dbUrl: string,
    slackWebhookUrl?: string,
    apiPort: number = 3001
  ) {
    // Initialize services
    this.metricsService = new MetricsService(dbUrl);
    this.latencyCollector = new LatencyCollector(this.metricsService);
    this.costCollector = new CostCollector(this.metricsService);
    this.healthCollector = new HealthCollector(this.metricsService);
    this.alertingService = new AlertingService(dbUrl, slackWebhookUrl);
    this.metricsAPI = new MetricsAPI(
      apiPort,
      this.metricsService,
      this.latencyCollector,
      this.costCollector,
      this.healthCollector
    );

    // Start alert checking
    this.startAlertChecking();
  }

  /**
   * Process event from event bus
   */
  async processEvent(event: BaseEvent): Promise<void> {
    // Process with all collectors
    await Promise.all([
      this.metricsService.processEvent(event),
      this.latencyCollector.processEvent(event),
      this.costCollector.processEvent(event),
      this.healthCollector.processEvent(event),
    ]);
  }

  /**
   * Start periodic alert checking
   */
  private startAlertChecking(): void {
    this.checkInterval = setInterval(async () => {
      await this.checkAlerts();
    }, 60000); // Check every minute
  }

  /**
   * Check all alert conditions
   */
  private async checkAlerts(): Promise<void> {
    try {
      // Check latency alerts (would need tenant list)
      // For now, skip - would need to query active tenants

      // Check worker memory alerts
      const workers = this.healthCollector.getAllWorkerHealth();
      for (const worker of workers) {
        if (worker.memoryPercent > 80) {
          await this.alertingService.checkWorkerMemoryAlert(
            worker.workerId,
            worker.memoryPercent,
            80
          );
        }
      }

      // Check circuit breaker alerts
      const circuitBreakers = this.healthCollector.getAllCircuitBreakerStatuses();
      for (const cb of circuitBreakers) {
        if (cb.state === 'open' && cb.openedAt) {
          const openDuration = Date.now() - cb.openedAt.getTime();
          if (openDuration > 5 * 60 * 1000) {
            await this.alertingService.checkCircuitBreakerAlert(cb.provider, openDuration);
          }
        }
      }

      // Check provider downtime alerts
      const providers = this.healthCollector.getAllProviderHealth();
      for (const provider of providers) {
        if (provider.status === 'down') {
          // Would need to track when provider went down
          // For now, skip
        }
      }
    } catch (error) {
      console.error('Error checking alerts:', error);
    }
  }

  /**
   * Stop monitoring service
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.metricsService.stop();
    this.metricsAPI.close();
  }
}

// Main entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://spotfunnel:dev@localhost:5432/spotfunnel';
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const apiPort = parseInt(process.env.METRICS_API_PORT || '3001', 10);

  const monitoringService = new MonitoringService(dbUrl, slackWebhookUrl, apiPort);

  console.log('Monitoring service started');
  console.log(`Database: ${dbUrl}`);
  console.log(`API Port: ${apiPort}`);
  console.log(`Slack Webhook: ${slackWebhookUrl ? 'configured' : 'not configured'}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    monitoringService.stop();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    monitoringService.stop();
    process.exit(0);
  });
}
