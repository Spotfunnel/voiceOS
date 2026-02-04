"""
Alerting Service - Alert rules with Slack, PagerDuty, email integrations

Features:
- Alert rules (P95 latency >800ms, cost >$0.20/min, circuit breaker open)
- Integrations: Slack, PagerDuty, email
- Alert throttling (max 1 per 5 minutes per rule)
- Escalation (critical alerts page on-call)
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List
from enum import Enum
import aiohttp
import asyncpg

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class AlertRule:
    """Alert rule definition"""
    
    def __init__(
        self,
        rule_id: str,
        name: str,
        alert_type: str,
        severity: AlertSeverity,
        threshold: float,
        component: Optional[str] = None,
        tenant_id: Optional[str] = None,
        enabled: bool = True
    ):
        self.rule_id = rule_id
        self.name = name
        self.alert_type = alert_type
        self.severity = severity
        self.threshold = threshold
        self.component = component
        self.tenant_id = tenant_id
        self.enabled = enabled


class Alert:
    """Alert instance"""
    
    def __init__(
        self,
        alert_id: str,
        alert_type: str,
        severity: AlertSeverity,
        message: str,
        metric_value: float,
        threshold: float,
        component: Optional[str] = None,
        tenant_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        timestamp: Optional[datetime] = None
    ):
        self.alert_id = alert_id
        self.alert_type = alert_type
        self.severity = severity
        self.message = message
        self.metric_value = metric_value
        self.threshold = threshold
        self.component = component
        self.tenant_id = tenant_id
        self.trace_id = trace_id
        self.timestamp = timestamp or datetime.now(timezone.utc)


class AlertingService:
    """
    Alerting service with multiple integrations
    
    Features:
    - Alert rules with thresholds
    - Slack webhook integration
    - PagerDuty integration (optional)
    - Email integration (optional)
    - Alert throttling (5-minute deduplication window)
    - Escalation for critical alerts
    """
    
    def __init__(
        self,
        database_url: str,
        slack_webhook_url: Optional[str] = None,
        pagerduty_integration_key: Optional[str] = None,
        email_config: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize alerting service.
        
        Args:
            database_url: PostgreSQL connection string
            slack_webhook_url: Slack webhook URL for alerts
            pagerduty_integration_key: PagerDuty integration key (optional)
            email_config: Email config dict with smtp_server, smtp_port, from_email, etc.
        """
        self.database_url = database_url
        self.slack_webhook_url = slack_webhook_url
        self.pagerduty_integration_key = pagerduty_integration_key
        self.email_config = email_config
        
        self.pool: Optional[asyncpg.Pool] = None
        self.alert_rules: Dict[str, AlertRule] = {}
        self.active_alerts: Dict[str, datetime] = {}  # alert_key -> fired_at
        self.deduplication_window_seconds = 5 * 60  # 5 minutes
        
        # Initialize default rules
        self._initialize_default_rules()
    
    async def connect(self):
        """Create connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                self.database_url,
                min_size=2,
                max_size=10
            )
            logger.info("AlertingService connected to PostgreSQL")
        except Exception as e:
            logger.error(f"Error connecting to PostgreSQL: {e}")
            raise
    
    async def close(self):
        """Close connection pool"""
        if self.pool:
            await self.pool.close()
            logger.info("AlertingService disconnected")
    
    def _initialize_default_rules(self):
        """Initialize default alert rules"""
        default_rules = [
            AlertRule(
                rule_id='latency_p95_turn_e2e',
                name='P95 Turn Latency > 800ms',
                alert_type='latency_p95',
                severity=AlertSeverity.CRITICAL,
                threshold=800.0,
                component='turn_e2e',
                enabled=True
            ),
            AlertRule(
                rule_id='cost_per_call',
                name='Cost per Call > $0.20',
                alert_type='cost_threshold',
                severity=AlertSeverity.WARNING,
                threshold=0.20,
                enabled=True
            ),
            AlertRule(
                rule_id='circuit_breaker_open',
                name='Circuit Breaker Open > 5 minutes',
                alert_type='circuit_breaker_open',
                severity=AlertSeverity.CRITICAL,
                threshold=5 * 60,  # 5 minutes in seconds
                enabled=True
            ),
            AlertRule(
                rule_id='worker_memory',
                name='Worker Memory > 80%',
                alert_type='worker_memory',
                severity=AlertSeverity.WARNING,
                threshold=80.0,
                enabled=True
            ),
            AlertRule(
                rule_id='provider_downtime',
                name='Provider Downtime > 2 minutes',
                alert_type='provider_downtime',
                severity=AlertSeverity.CRITICAL,
                threshold=2 * 60,  # 2 minutes in seconds
                enabled=True
            ),
        ]
        
        for rule in default_rules:
            self.alert_rules[rule.rule_id] = rule
    
    async def check_latency_alert(
        self,
        tenant_id: str,
        component: str,
        p95_latency: float,
        threshold: Optional[float] = None
    ):
        """Check latency alert rule"""
        rule = self.alert_rules.get('latency_p95_turn_e2e')
        if not rule or not rule.enabled:
            return
        
        threshold = threshold or rule.threshold
        
        if p95_latency <= threshold:
            return
        
        alert_key = f"latency_{tenant_id}_{component}"
        if self._is_deduplicated(alert_key):
            return
        
        alert = Alert(
            alert_id=str(uuid.uuid4()),
            alert_type=rule.alert_type,
            severity=rule.severity,
            message=f"P95 latency for {component} exceeded threshold: {p95_latency:.1f}ms > {threshold:.1f}ms",
            metric_value=p95_latency,
            threshold=threshold,
            component=component,
            tenant_id=tenant_id,
            timestamp=datetime.now(timezone.utc)
        )
        
        await self._fire_alert(alert)
        self.active_alerts[alert_key] = datetime.now(timezone.utc)
    
    async def check_cost_alert(
        self,
        trace_id: str,
        tenant_id: str,
        cost_per_minute: float,
        threshold: Optional[float] = None
    ):
        """Check cost alert rule"""
        rule = self.alert_rules.get('cost_per_call')
        if not rule or not rule.enabled:
            return
        
        threshold = threshold or rule.threshold
        
        if cost_per_minute <= threshold:
            return
        
        alert_key = f"cost_{trace_id}"
        if self._is_deduplicated(alert_key):
            return
        
        alert = Alert(
            alert_id=str(uuid.uuid4()),
            alert_type=rule.alert_type,
            severity=rule.severity,
            message=f"Cost per minute exceeded threshold: ${cost_per_minute:.4f} > ${threshold:.2f}",
            metric_value=cost_per_minute,
            threshold=threshold,
            tenant_id=tenant_id,
            trace_id=trace_id,
            timestamp=datetime.now(timezone.utc)
        )
        
        await self._fire_alert(alert)
        self.active_alerts[alert_key] = datetime.now(timezone.utc)
    
    async def check_circuit_breaker_alert(
        self,
        provider: str,
        open_duration_seconds: float,
        threshold: Optional[float] = None
    ):
        """Check circuit breaker alert rule"""
        rule = self.alert_rules.get('circuit_breaker_open')
        if not rule or not rule.enabled:
            return
        
        threshold = threshold or rule.threshold
        
        if open_duration_seconds <= threshold:
            return
        
        alert_key = f"circuit_breaker_{provider}"
        if self._is_deduplicated(alert_key):
            return
        
        alert = Alert(
            alert_id=str(uuid.uuid4()),
            alert_type=rule.alert_type,
            severity=rule.severity,
            message=f"Circuit breaker for {provider} has been open for {open_duration_seconds:.0f}s (threshold: {threshold:.0f}s)",
            metric_value=open_duration_seconds,
            threshold=threshold,
            component=provider,
            timestamp=datetime.now(timezone.utc)
        )
        
        await self._fire_alert(alert)
        self.active_alerts[alert_key] = datetime.now(timezone.utc)
    
    async def check_worker_memory_alert(
        self,
        worker_id: str,
        memory_percent: float,
        threshold: Optional[float] = None
    ):
        """Check worker memory alert rule"""
        rule = self.alert_rules.get('worker_memory')
        if not rule or not rule.enabled:
            return
        
        threshold = threshold or rule.threshold
        
        if memory_percent <= threshold:
            return
        
        alert_key = f"worker_memory_{worker_id}"
        if self._is_deduplicated(alert_key):
            return
        
        alert = Alert(
            alert_id=str(uuid.uuid4()),
            alert_type=rule.alert_type,
            severity=rule.severity,
            message=f"Worker {worker_id} memory usage: {memory_percent:.1f}% > {threshold:.1f}%",
            metric_value=memory_percent,
            threshold=threshold,
            component=worker_id,
            timestamp=datetime.now(timezone.utc)
        )
        
        await self._fire_alert(alert)
        self.active_alerts[alert_key] = datetime.now(timezone.utc)
    
    async def check_provider_downtime_alert(
        self,
        provider: str,
        downtime_seconds: float,
        threshold: Optional[float] = None
    ):
        """Check provider downtime alert rule"""
        rule = self.alert_rules.get('provider_downtime')
        if not rule or not rule.enabled:
            return
        
        threshold = threshold or rule.threshold
        
        if downtime_seconds <= threshold:
            return
        
        alert_key = f"provider_downtime_{provider}"
        if self._is_deduplicated(alert_key):
            return
        
        alert = Alert(
            alert_id=str(uuid.uuid4()),
            alert_type=rule.alert_type,
            severity=rule.severity,
            message=f"Provider {provider} has been down for {downtime_seconds:.0f}s (threshold: {threshold:.0f}s)",
            metric_value=downtime_seconds,
            threshold=threshold,
            component=provider,
            timestamp=datetime.now(timezone.utc)
        )
        
        await self._fire_alert(alert)
        self.active_alerts[alert_key] = datetime.now(timezone.utc)
    
    async def _fire_alert(self, alert: Alert):
        """Fire alert (store in DB, send notifications)"""
        # Store in database
        if self.pool:
            try:
                async with self.pool.acquire() as conn:
                    await conn.execute(
                        """
                        INSERT INTO alert_history (
                            alert_id, alert_type, alert_severity,
                            component, tenant_id, trace_id,
                            message, metric_value, threshold,
                            status, fired_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                        """,
                        alert.alert_id,
                        alert.alert_type,
                        alert.severity.value,
                        alert.component,
                        alert.tenant_id,
                        alert.trace_id,
                        alert.message,
                        alert.metric_value,
                        alert.threshold,
                        'firing',
                        alert.timestamp
                    )
            except Exception as e:
                logger.error(f"Error storing alert in database: {e}")
        
        # Send notifications (fire-and-forget)
        asyncio.create_task(self._send_notifications(alert))
    
    async def _send_notifications(self, alert: Alert):
        """Send alert notifications via all configured channels"""
        tasks = []
        
        if self.slack_webhook_url:
            tasks.append(self._send_slack_alert(alert))
        
        if self.pagerduty_integration_key and alert.severity == AlertSeverity.CRITICAL:
            tasks.append(self._send_pagerduty_alert(alert))
        
        if self.email_config and alert.severity in [AlertSeverity.CRITICAL, AlertSeverity.WARNING]:
            tasks.append(self._send_email_alert(alert))
        
        # Run all notifications in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Log any failures
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error sending notification {i}: {result}")
    
    async def _send_slack_alert(self, alert: Alert):
        """Send alert to Slack via webhook"""
        if not self.slack_webhook_url:
            return
        
        color_map = {
            AlertSeverity.CRITICAL: 'danger',
            AlertSeverity.WARNING: 'warning',
            AlertSeverity.INFO: 'good'
        }
        
        payload = {
            'text': f'🚨 Alert: {alert.alert_type}',
            'attachments': [
                {
                    'color': color_map.get(alert.severity, 'warning'),
                    'title': alert.message,
                    'fields': [
                        {
                            'title': 'Severity',
                            'value': alert.severity.value,
                            'short': True
                        },
                        {
                            'title': 'Component',
                            'value': alert.component or 'N/A',
                            'short': True
                        },
                        {
                            'title': 'Metric Value',
                            'value': str(alert.metric_value),
                            'short': True
                        },
                        {
                            'title': 'Threshold',
                            'value': str(alert.threshold),
                            'short': True
                        },
                        {
                            'title': 'Timestamp',
                            'value': alert.timestamp.isoformat(),
                            'short': False
                        }
                    ]
                }
            ]
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.slack_webhook_url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status != 200:
                        logger.warning(f"Slack webhook returned status {response.status}")
        except Exception as e:
            logger.error(f"Error sending Slack alert: {e}")
    
    async def _send_pagerduty_alert(self, alert: Alert):
        """Send alert to PagerDuty"""
        if not self.pagerduty_integration_key:
            return
        
        payload = {
            'routing_key': self.pagerduty_integration_key,
            'event_action': 'trigger',
            'payload': {
                'summary': alert.message,
                'severity': alert.severity.value,
                'source': alert.component or 'voice-ai-platform',
                'custom_details': {
                    'alert_type': alert.alert_type,
                    'metric_value': alert.metric_value,
                    'threshold': alert.threshold,
                    'tenant_id': alert.tenant_id,
                    'trace_id': alert.trace_id,
                }
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'https://events.pagerduty.com/v2/enqueue',
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status != 202:
                        logger.warning(f"PagerDuty API returned status {response.status}")
        except Exception as e:
            logger.error(f"Error sending PagerDuty alert: {e}")
    
    async def _send_email_alert(self, alert: Alert):
        """Send alert via email (SMTP)"""
        if not self.email_config:
            return
        
        # Email implementation would go here
        # For now, just log (requires smtplib/aiosmtplib)
        logger.info(f"Email alert would be sent: {alert.message}")
    
    def _is_deduplicated(self, alert_key: str) -> bool:
        """Check if alert is deduplicated (already fired recently)"""
        last_fired = self.active_alerts.get(alert_key)
        if not last_fired:
            return False
        
        time_since_last_fired = (datetime.now(timezone.utc) - last_fired).total_seconds()
        if time_since_last_fired > self.deduplication_window_seconds:
            # Window expired, allow alert again
            del self.active_alerts[alert_key]
            return False
        
        return True
    
    async def get_active_alerts(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get active (firing) alerts"""
        if not self.pool:
            return []
        
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT * FROM alert_history
                    WHERE status = 'firing'
                    ORDER BY fired_at DESC
                    LIMIT $1
                    """,
                    limit
                )
                
                return [
                    {
                        'alert_id': row['alert_id'],
                        'alert_type': row['alert_type'],
                        'severity': row['alert_severity'],
                        'component': row['component'],
                        'tenant_id': row['tenant_id'],
                        'trace_id': row['trace_id'],
                        'message': row['message'],
                        'metric_value': float(row['metric_value']) if row['metric_value'] else 0.0,
                        'threshold': float(row['threshold']) if row['threshold'] else 0.0,
                        'fired_at': row['fired_at'].isoformat() if row['fired_at'] else None,
                    }
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"Error getting active alerts: {e}")
            return []
    
    async def resolve_alert(self, alert_id: str):
        """Resolve an alert"""
        if not self.pool:
            return
        
        try:
            async with self.pool.acquire() as conn:
                await conn.execute(
                    """
                    UPDATE alert_history
                    SET status = 'resolved', resolved_at = NOW()
                    WHERE alert_id = $1
                    """,
                    alert_id
                )
        except Exception as e:
            logger.error(f"Error resolving alert: {e}")
