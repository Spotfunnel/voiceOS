"""
Australia Post API Client

Validates Australian addresses using Australia Post Validate Suburb API.
Handles suburb conflicts (e.g., Richmond exists in 4 states).

Critical Rules:
- Mandatory for address validation (suburb conflicts require API)
- Rate limiting: Respect API limits
- Fallback validation if API is down (format-only validation)
- Error handling: Graceful degradation

API Documentation:
- https://developers.auspost.com.au/apis/pacpcs
"""

import os
import json
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from dataclasses_json import dataclass_json
import httpx
import logging
from datetime import datetime, timedelta

from ..validation.australian_validators import normalize_state

logger = logging.getLogger(__name__)

# Try to import Redis (optional dependency)
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False
    logger.debug("Redis not available - using in-memory cache only")


@dataclass
class AddressValidationResult:
    """Result of address validation"""
    is_valid: bool
    suburb: str
    state: str
    postcode: str
    localities: List[Dict[str, Any]] = None
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for caching"""
        return {
            "is_valid": self.is_valid,
            "suburb": self.suburb,
            "state": self.state,
            "postcode": self.postcode,
            "localities": self.localities or [],
            "error": self.error
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "AddressValidationResult":
        """Create from dictionary"""
        return cls(
            is_valid=data["is_valid"],
            suburb=data["suburb"],
            state=data["state"],
            postcode=data["postcode"],
            localities=data.get("localities"),
            error=data.get("error")
        )


@dataclass
class SuburbLookupResult:
    """Result of suburb lookup by postcode"""
    postcode: str
    localities: List[Dict[str, Any]]
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for caching"""
        return {
            "postcode": self.postcode,
            "localities": self.localities or [],
            "error": self.error
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SuburbLookupResult":
        """Create from dictionary"""
        return cls(
            postcode=data["postcode"],
            localities=data.get("localities", []),
            error=data.get("error")
        )


class AustraliaPostClient:
    """
    Australia Post API client for address validation.
    
    Features:
    - Validate suburb+state+postcode combinations
    - Lookup suburbs by postcode
    - Rate limiting (respect API limits)
    - Error handling with fallback validation
    - Caching (optional) to reduce API calls
    
    Usage:
        client = AustraliaPostClient(api_key="your-api-key")
        result = await client.validate_address(
            suburb="Richmond",
            state="NSW",
            postcode="2753"
        )
        if result.is_valid:
            print("Address is valid")
    """
    
    BASE_URL = "https://digitalapi.auspost.com.au"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout: float = 5.0,
        enable_caching: bool = True,
        cache_ttl_seconds: int = 3600,
        redis_client: Optional[Any] = None,
        redis_url: Optional[str] = None
    ):
        """
        Initialize Australia Post API client.
        
        Args:
            api_key: Australia Post API key (or from env AUSTRALIA_POST_API_KEY)
            timeout: Request timeout in seconds (default: 5.0)
            enable_caching: Enable response caching (default: True)
            cache_ttl_seconds: Cache TTL in seconds (default: 3600 = 1 hour)
            redis_client: Optional Redis client instance
            redis_url: Optional Redis URL (e.g., "redis://localhost:6379")
        """
        self.api_key = api_key or os.getenv("AUSTRALIA_POST_API_KEY")
        self.timeout = timeout
        self.enable_caching = enable_caching
        self.cache_ttl_seconds = cache_ttl_seconds
        
        # Redis cache (if available)
        self.redis_client: Optional[Any] = redis_client
        self.use_redis = False
        
        if REDIS_AVAILABLE and (redis_client or redis_url):
            try:
                if redis_client:
                    self.redis_client = redis_client
                elif redis_url:
                    self.redis_client = redis.from_url(redis_url)
                self.use_redis = True
                logger.info("Using Redis cache for Australia Post API")
            except Exception as e:
                logger.warning(f"Failed to initialize Redis cache: {e}. Using in-memory cache.")
                self.use_redis = False
        
        # Fallback in-memory cache
        self._cache: Dict[str, tuple[Any, datetime]] = {}
        
        if not self.api_key:
            logger.warning(
                "Australia Post API key not provided. "
                "Address validation will use format-only validation."
            )
    
    async def validate_address(
        self,
        suburb: str,
        state: str,
        postcode: str
    ) -> AddressValidationResult:
        """
        Validate suburb+state+postcode combination.
        
        Uses Australia Post Validate Suburb API to check if combination is valid.
        Handles suburb conflicts (e.g., Richmond exists in 4 states).
        
        Args:
            suburb: Suburb name
            state: State name or code
            postcode: Postcode (4 digits)
            
        Returns:
            AddressValidationResult with validation status
            
        Examples:
            >>> result = await client.validate_address("Richmond", "NSW", "2753")
            >>> result.is_valid
            True
        """
        # Normalize state
        state_code = normalize_state(state)
        
        # Check cache
        cache_key = f"auspost:validate:{suburb}:{state_code}:{postcode}"
        if self.enable_caching:
            cached_result = await self._get_from_cache(cache_key)
            if cached_result:
                return cached_result
        
        # If no API key, fallback to format-only validation
        if not self.api_key:
            logger.debug("No API key - using format-only validation")
            from ..validation.australian_validators import validate_address_au
            is_valid = validate_address_au(suburb, state_code, postcode)
            return AddressValidationResult(
                is_valid=is_valid,
                suburb=suburb,
                state=state_code,
                postcode=postcode,
                error="API key not configured - format-only validation"
            )
        
        try:
            # Call Australia Post API
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.BASE_URL}/postcode/search.json",
                    params={
                        "q": suburb,
                        "state": state_code,
                    },
                    headers={
                        "AUTH-KEY": self.api_key,
                        "Accept": "application/json"
                    }
                )
                
                response.raise_for_status()
                data = response.json()
                
                # Parse response
                localities = data.get("localities", {}).get("locality", [])
                if not isinstance(localities, list):
                    localities = [localities] if localities else []
                
                # Check if suburb+state+postcode combination exists
                is_valid = False
                matching_localities = []
                
                for locality in localities:
                    locality_suburb = locality.get("location", "").lower()
                    locality_state = locality.get("state", "")
                    locality_postcode = locality.get("postcode", "")
                    
                    if (locality_suburb == suburb.lower() and
                        locality_state == state_code and
                        locality_postcode == postcode):
                        is_valid = True
                        matching_localities.append(locality)
                
                result = AddressValidationResult(
                    is_valid=is_valid,
                    suburb=suburb,
                    state=state_code,
                    postcode=postcode,
                    localities=matching_localities
                )
                
                # Cache result
                if self.enable_caching:
                    self._set_cache(cache_key, result)
                
                return result
                
        except httpx.TimeoutException:
            logger.warning("Australia Post API timeout - using format-only validation")
            from ..validation.australian_validators import validate_address_au
            is_valid = validate_address_au(suburb, state_code, postcode)
            return AddressValidationResult(
                is_valid=is_valid,
                suburb=suburb,
                state=state_code,
                postcode=postcode,
                error="API timeout - format-only validation"
            )
            
        except httpx.HTTPStatusError as e:
            logger.error(f"Australia Post API error: {e.response.status_code}")
            from ..validation.australian_validators import validate_address_au
            is_valid = validate_address_au(suburb, state_code, postcode)
            return AddressValidationResult(
                is_valid=is_valid,
                suburb=suburb,
                state=state_code,
                postcode=postcode,
                error=f"API error {e.response.status_code} - format-only validation"
            )
            
        except Exception as e:
            logger.error(f"Australia Post API error: {e}")
            from ..validation.australian_validators import validate_address_au
            is_valid = validate_address_au(suburb, state_code, postcode)
            return AddressValidationResult(
                is_valid=is_valid,
                suburb=suburb,
                state=state_code,
                postcode=postcode,
                error=f"API error: {str(e)} - format-only validation"
            )
    
    async def lookup_suburbs_by_postcode(
        self,
        postcode: str
    ) -> SuburbLookupResult:
        """
        Lookup suburbs by postcode.
        
        Args:
            postcode: Postcode (4 digits)
            
        Returns:
            SuburbLookupResult with list of suburbs
        """
        # Check cache
        cache_key = f"auspost:lookup:{postcode}"
        if self.enable_caching:
            cached_result = await self._get_from_cache(cache_key)
            if cached_result:
                return cached_result
        
        if not self.api_key:
            return SuburbLookupResult(
                postcode=postcode,
                localities=[],
                error="API key not configured"
            )
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.BASE_URL}/postcode/search.json",
                    params={"q": postcode},
                    headers={
                        "AUTH-KEY": self.api_key,
                        "Accept": "application/json"
                    }
                )
                
                response.raise_for_status()
                data = response.json()
                
                localities = data.get("localities", {}).get("locality", [])
                if not isinstance(localities, list):
                    localities = [localities] if localities else []
                
                result = SuburbLookupResult(
                    postcode=postcode,
                    localities=localities
                )
                
                # Cache result
                if self.enable_caching:
                    self._set_cache(cache_key, result)
                
                return result
                
        except Exception as e:
            logger.error(f"Australia Post API error: {e}")
            return SuburbLookupResult(
                postcode=postcode,
                localities=[],
                error=str(e)
            )
    
    async def _get_from_cache(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        # Try Redis first
        if self.use_redis and self.redis_client:
            try:
                cached_data = await self.redis_client.get(key)
                if cached_data:
                    data = json.loads(cached_data)
                    # Determine result type based on key prefix
                    if key.startswith("auspost:validate:"):
                        return AddressValidationResult.from_dict(data)
                    elif key.startswith("auspost:lookup:"):
                        return SuburbLookupResult.from_dict(data)
            except Exception as e:
                logger.warning(f"Redis cache get error: {e}. Falling back to in-memory cache.")
        
        # Fallback to in-memory cache
        if key not in self._cache:
            return None
        
        value, cached_at = self._cache[key]
        if datetime.now() - cached_at > timedelta(seconds=self.cache_ttl_seconds):
            del self._cache[key]
            return None
        
        return value
    
    async def _set_cache(self, key: str, value: Any) -> None:
        """Set value in cache"""
        # Try Redis first
        if self.use_redis and self.redis_client:
            try:
                if isinstance(value, AddressValidationResult):
                    data = value.to_dict()
                elif isinstance(value, SuburbLookupResult):
                    data = value.to_dict()
                else:
                    data = value
                
                await self.redis_client.setex(
                    key,
                    self.cache_ttl_seconds,
                    json.dumps(data)
                )
                return
            except Exception as e:
                logger.warning(f"Redis cache set error: {e}. Falling back to in-memory cache.")
        
        # Fallback to in-memory cache
        self._cache[key] = (value, datetime.now())
