"""
Error monitoring integration (Sentry).
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)


def init_error_monitoring() -> None:
    """Initialize Sentry for error tracking."""
    sentry_dsn = os.getenv("SENTRY_DSN")

    if not sentry_dsn:
        logger.info("Sentry not configured (SENTRY_DSN not set)")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        sentry_sdk.init(
            dsn=sentry_dsn,
            environment=os.getenv("ENVIRONMENT", "production"),
            integrations=[
                FastApiIntegration(),
                LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.1,
            profiles_sample_rate=0.1,
        )
        logger.info("Sentry error monitoring initialized")
    except ImportError:
        logger.warning("sentry-sdk not installed. Install with: pip install sentry-sdk")
    except Exception as exc:
        logger.error("Failed to initialize Sentry: %s", exc)


def capture_exception(exception: Exception, context: dict | None = None) -> None:
    """Capture exception to Sentry."""
    try:
        import sentry_sdk

        if context:
            sentry_sdk.set_context("custom", context)

        sentry_sdk.capture_exception(exception)
    except ImportError:
        pass
    except Exception as exc:
        logger.error("Failed to capture exception to Sentry: %s", exc)
