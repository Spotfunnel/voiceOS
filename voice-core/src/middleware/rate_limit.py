"""
Rate limiting middleware to prevent abuse.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from typing import Dict, List

from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter.
    For production multi-server deployments, consider Redis-based rate limiting.
    """

    def __init__(self, app, requests_per_period: int = 100, period_seconds: int = 60):
        super().__init__(app)
        self.requests_per_period = requests_per_period
        self.period_seconds = period_seconds
        self.requests: Dict[str, List[float]] = defaultdict(list)

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _clean_old_requests(self, client_ip: str, current_time: float) -> None:
        cutoff_time = current_time - self.period_seconds
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip] if req_time > cutoff_time
        ]

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        current_time = time.time()

        self._clean_old_requests(client_ip, current_time)

        request_count = len(self.requests[client_ip])
        if request_count >= self.requests_per_period:
            logger.warning(
                "Rate limit exceeded for %s: %s requests in %ss",
                client_ip,
                request_count,
                self.period_seconds,
            )
            raise HTTPException(
                status_code=429,
                detail=(
                    "Rate limit exceeded. "
                    f"Max {self.requests_per_period} requests per {self.period_seconds}s."
                ),
            )

        self.requests[client_ip].append(current_time)

        response = await call_next(request)

        remaining = self.requests_per_period - len(self.requests[client_ip])
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_period)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(current_time + self.period_seconds))

        return response
