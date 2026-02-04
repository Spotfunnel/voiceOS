# Australian-Specific Information Capture Primitives

Prevents 100% failure rate from US validation applied to Australian data. Australian phone/address/date formats differ fundamentally from US formats. Getting this wrong blocks all Australian customer onboarding.

## Why This Skill Matters

- **100% failure rate**: US validation (E.164, city/state/ZIP, MM/DD/YYYY) doesn't work in Australia
- **Business blocker**: Wrong validation = no customers can onboard
- **Locale expansion**: Proper locale architecture enables US/UK expansion in V2
- **Critical for V1**: Platform ONLY serves Australian home service businesses

## Australian Phone Number Validation

### Format Structure

**Mobile**: 10 digits starting with 04
- Example: 0412 345 678
- International: +61 412 345 678

**Landline**: 10 digits with 2-digit area code (02, 03, 07, 08)
- Example: 02 9876 5432
- International: +61 2 9876 5432

### Validation Pattern

```python
# ✅ CORRECT: Australian phone validation
import re

def validate_phone_au(phone: str) -> bool:
    # Remove all non-digits
    digits = re.sub(r'\D', '', phone)
    
    # Mobile: 04xx xxx xxx (10 digits starting with 04)
    if re.match(r'^04\d{8}$', digits):
        return True
    
    # Landline: 02/03/07/08 xxxx xxxx (10 digits)
    if re.match(r'^(02|03|07|08)\d{8}$', digits):
        return True
    
    # International: +61 (drop leading 0)
    if phone.startswith('+61'):
        return validate_phone_au(phone.replace('+61', '0', 1))
    
    return False

# Normalize to +61 format for storage
def normalize_phone_au(phone: str) -> str:
    digits = re.sub(r'\D', '', phone)
    
    if digits.startswith('0'):
        return f"+61{digits[1:]}"  # Remove leading 0, add +61
    elif digits.startswith('61'):
        return f"+{digits}"
    else:
        return f"+61{digits}"

# ❌ INCORRECT: Using US E.164 validation
def validate_phone_us(phone: str) -> bool:
    # Expects +1 XXX XXX XXXX (doesn't work for +61)
    return phone.startswith('+1')  # 100% failure rate for AU
```

### Supported Input Variations

```python
# All these should validate as TRUE for Australian mobile:
assert validate_phone_au("0412 345 678")  # Spaces
assert validate_phone_au("0412345678")  # No spaces
assert validate_phone_au("+61 412 345 678")  # International with spaces
assert validate_phone_au("+61412345678")  # International no spaces
assert validate_phone_au("(04) 1234 5678")  # Parentheses (non-standard)

# All these should validate as TRUE for Australian landline:
assert validate_phone_au("02 9876 5432")  # Sydney area code
assert validate_phone_au("03 9876 5432")  # Melbourne area code
assert validate_phone_au("07 3876 5432")  # Brisbane area code
assert validate_phone_au("08 8876 5432")  # Adelaide area code
assert validate_phone_au("+61 2 9876 5432")  # International
```

## Australian Address Validation

### Format Structure

**Australian Format**: Street, Suburb, State, Postcode
- NOT: Street, City, State, ZIP (US format)

**Key Difference**: Suburb (not city) + 4-digit postcode (not 5-digit ZIP)

**Example**:
- Australian: "123 Main Street, Richmond, NSW, 2000"
- US (WRONG): "123 Main Street, Sydney, NSW, 12345"

### Australia Post API Integration (Mandatory)

**Why**: Many suburbs share names across states (Richmond exists in NSW, VIC, QLD, SA)

**Solution**: Australia Post Validate Suburb API validates suburb+state+postcode combinations

```python
# ✅ CORRECT: Australian address validation with Australia Post API
import httpx

async def validate_address_au(street: str, suburb: str, state: str, postcode: str) -> bool:
    # Normalize state: "New South Wales" → "NSW"
    state_code = normalize_state(state)
    
    # Australia Post Validate Suburb API
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://auspost.com.au/api/postcode/search.json",
            params={
                "q": suburb,
                "state": state_code,
                "postcode": postcode
            },
            headers={"Auth-Key": AUSTRALIA_POST_API_KEY}
        )
    
    data = response.json()
    
    # Check if combination is valid
    for locality in data.get("localities", {}).get("locality", []):
        if (locality["location"].lower() == suburb.lower() and
            locality["state"] == state_code and
            locality["postcode"] == postcode):
            return True
    
    return False

# State normalization
def normalize_state(state: str) -> str:
    STATE_CODES = {
        "new south wales": "NSW",
        "victoria": "VIC",
        "queensland": "QLD",
        "south australia": "SA",
        "western australia": "WA",
        "tasmania": "TAS",
        "northern territory": "NT",
        "australian capital territory": "ACT"
    }
    
    state_lower = state.lower()
    return STATE_CODES.get(state_lower, state.upper())

# ❌ INCORRECT: Using US address format
def validate_address_us(city: str, state: str, zip_code: str):
    # Expects city (not suburb) + 5-digit ZIP (not 4-digit postcode)
    # Does not work for Australian addresses (100% failure rate)
    pass
```

### Suburb Conflict Examples

**Richmond** exists in 4 states:
- Richmond, NSW, 2753
- Richmond, VIC, 3121
- Richmond, QLD, 4822
- Richmond, SA, 5033

**Without Australia Post API**: Cannot determine which Richmond

**With Australia Post API**: Validates suburb+state+postcode combination

## Australian Date Format (DD/MM/YYYY)

### Format Structure

**Australian Standard**: DD/MM/YYYY
- Example: 15/10/2026 = 15 October 2026

**US Format (WRONG)**: MM/DD/YYYY
- Example: 10/15/2026 = October 15, 2026

**Impact of Wrong Format**: 50% of dates will be wrong (e.g., 5/6 = 5 June or 6 May?)

### Date Parsing with Ambiguity Clarification

```python
# ✅ CORRECT: Australian date parsing with ambiguity detection
from datetime import datetime

def parse_date_au(date_str: str) -> datetime:
    # Try DD/MM/YYYY (Australian standard)
    if '/' in date_str:
        parts = date_str.split('/')
        
        if len(parts) == 3:
            day, month, year = parts
            day, month, year = int(day), int(month), int(year)
            
            # Detect ambiguity (both day and month <= 12)
            if day <= 12 and month <= 12:
                raise AmbiguousDateError(
                    f"Ambiguous date: {date_str}. Is this {day} {month_name(day)} or {month} {month_name(month)}?"
                )
            
            # Assume DD/MM/YYYY (not MM/DD/YYYY)
            if month > 12:
                # month value too high, must be DD/MM/YYYY
                return datetime(year, month, day)
            else:
                return datetime(year, month, day)
    
    # Natural language: "next Tuesday", "this arvo" (Australian slang)
    return parse_natural_language_au(date_str)

# Ambiguity clarification with user
async def confirm_ambiguous_date(date_str: str) -> datetime:
    parts = date_str.split('/')
    day, month = int(parts[0]), int(parts[1])
    
    # Both values <= 12, could be either DD/MM or MM/DD
    await say(f"Just to clarify, is that {day} {month_name(day)} or {month} {month_name(month)}?")
    
    response = await listen()
    
    if month_name(day) in response.lower():
        return datetime(int(parts[2]), day, month)  # User confirmed DD/MM
    else:
        return datetime(int(parts[2]), month, day)  # User confirmed MM/DD

# ❌ INCORRECT: Assuming MM/DD/YYYY (US format)
def parse_date_us(date_str: str) -> datetime:
    parts = date_str.split('/')
    month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
    return datetime(year, month, day)  # 50% of dates will be wrong for AU
```

### Storage: ISO 8601 Internally

```python
# ✅ CORRECT: Store as ISO 8601, display as DD/MM/YYYY
def store_date(date: datetime) -> str:
    # Store as ISO 8601 (YYYY-MM-DD) internally
    return date.isoformat()

def display_date_au(iso_date: str) -> str:
    # Display as DD/MM/YYYY to Australian users
    date = datetime.fromisoformat(iso_date)
    return date.strftime("%d/%m/%Y")
```

## Australian Timezone Handling

### Timezone Structure

**AEST** (UTC+10): NSW, VIC, QLD, TAS, ACT
- Sydney, Melbourne, Brisbane, Hobart, Canberra

**ACST** (UTC+9.5): SA, NT
- Adelaide, Darwin

**AWST** (UTC+8): WA
- Perth

**AEDT** (UTC+11): Daylight Saving (October-April)
- NSW, VIC, SA, TAS, ACT only (QLD, NT, WA do NOT observe DST)

### Timezone Conversion

```python
# ✅ CORRECT: Australian timezone handling
from zoneinfo import ZoneInfo
from datetime import datetime

def convert_to_user_timezone(utc_time: datetime, state: str) -> datetime:
    # Map state to timezone
    TIMEZONE_MAP = {
        "NSW": "Australia/Sydney",  # AEST/AEDT
        "VIC": "Australia/Melbourne",  # AEST/AEDT
        "QLD": "Australia/Brisbane",  # AEST (no DST)
        "SA": "Australia/Adelaide",  # ACST/ACDT
        "WA": "Australia/Perth",  # AWST (no DST)
        "TAS": "Australia/Hobart",  # AEST/AEDT
        "NT": "Australia/Darwin",  # ACST (no DST)
        "ACT": "Australia/Sydney",  # AEST/AEDT
    }
    
    tz = ZoneInfo(TIMEZONE_MAP[state])
    return utc_time.astimezone(tz)

# Storage: Always UTC
def store_appointment(local_time: datetime, state: str) -> str:
    # Convert to UTC for storage
    tz = ZoneInfo(TIMEZONE_MAP[state])
    local_dt = local_time.replace(tzinfo=tz)
    utc_dt = local_dt.astimezone(ZoneInfo("UTC"))
    return utc_dt.isoformat()

# ❌ INCORRECT: Using US timezone
def convert_to_us_timezone(utc_time: datetime) -> datetime:
    # Assumes US timezone (10-16 hour difference from Australia)
    return utc_time.astimezone(ZoneInfo("America/New_York"))  # Wrong continent
```

## Locale-Aware Primitive Architecture

### Why Locale Parameter Matters

**V1**: Only Australian customers (`en-AU`)

**V2**: Potential expansion to US (`en-US`), UK (`en-GB`)

**Architecture**: Primitives designed with `locale` parameter even though V1 only implements `en-AU`

**Benefit**: Enables international expansion in V2 (40-80 hours vs 200-400 hours without locale architecture)

```python
# ✅ CORRECT: Locale-aware primitive architecture
class CapturePhonePrimitive:
    def __init__(self, locale: str = "en-AU"):
        self.locale = locale
        
        # Select validator based on locale
        if locale == "en-AU":
            self.validator = validate_phone_au
        elif locale == "en-US":
            self.validator = validate_phone_us  # V2
        elif locale == "en-GB":
            self.validator = validate_phone_uk  # V2
        else:
            raise ValueError(f"Unsupported locale: {locale}")
    
    async def capture(self, llm, tts, stt):
        # Capture logic (locale-independent)
        transcript = await stt.listen()
        phone = extract_phone(transcript)
        
        # Validate using locale-specific validator
        if self.validator(phone):
            return phone
        else:
            await tts.speak("That doesn't look like a valid phone number. Can you try again?")
            return await self.capture(llm, tts, stt)

# ❌ INCORRECT: Hardcoded Australian logic without locale parameter
class CapturePhonePrimitive:
    async def capture(self):
        # Hardcoded for Australia (blocks international expansion)
        if not validate_phone_au(phone):
            raise ValidationError()
```

## Critical Rules (Non-Negotiable)

1. ✅ **Phone validation MUST use Australian format**
   - Mobile: 04xx (10 digits)
   - Landline: 02/03/07/08 (10 digits)
   - NOT US E.164 (+1 format)

2. ✅ **Address validation MUST use Australia Post API**
   - Validates suburb+state+postcode combination
   - NOT USPS (city+state+ZIP)

3. ✅ **Date parsing MUST assume DD/MM/YYYY**
   - NOT MM/DD/YYYY (causes 50% error rate)
   - Clarify ambiguous dates (5/6 could be 5 June or 6 May)

4. ✅ **Timezone MUST be Australian (AEST/AEDT/ACST/AWST)**
   - NOT UTC or US timezone (10-16 hour difference)
   - Store as UTC internally, display in user's timezone

5. ✅ **Primitives MUST be locale-aware**
   - Even if V1 only implements `en-AU`
   - Enables international expansion in V2

## Common Mistakes to Avoid

### ❌ Mistake 1: Using US phone validation (E.164)
**Problem**: 100% failure rate for Australian numbers
**Solution**: Australian format (04xx mobile, 02/03/07/08 landline)

### ❌ Mistake 2: Using US address format (city/state/ZIP)
**Problem**: Missing suburb field, wrong postcode format
**Solution**: Australian format (street/suburb/state/postcode) + Australia Post API

### ❌ Mistake 3: Assuming MM/DD/YYYY date format
**Problem**: 50% of dates will be wrong
**Solution**: DD/MM/YYYY format with ambiguity clarification

### ❌ Mistake 4: Using UTC or US timezone
**Problem**: 10-16 hour difference from Australian timezone
**Solution**: AEST/AEDT/ACST/AWST based on state

### ❌ Mistake 5: Hardcoding Australian logic without locale parameter
**Problem**: Blocks international expansion in V2
**Solution**: Locale-aware primitives with `locale` parameter

## Testing Requirements

**Before deploying ANY Australian primitive:**

1. ✅ Test with 20+ Australian phone number formats
2. ✅ Test with 30+ Australian address combinations (suburb conflicts)
3. ✅ Test with 15+ Australian date formats (ambiguous dates)
4. ✅ Test with all 4 Australian timezone zones (AEST, ACST, AWST, AEDT)
5. ✅ Verify locale parameter architecture (can add `en-US` in V2)

## Production Metrics to Track

- **Validation success rate**: >95% for valid Australian data
- **Validation false positive rate**: <5% (rejecting valid data)
- **Australia Post API latency**: P95 <500ms
- **Timezone conversion accuracy**: 100% (wrong timezone = wrong appointment)

## References

- Research: `research/21-objectives-and-information-capture.md` (lines 168-311)
- Architecture Law: `docs/ARCHITECTURE_LAWS.md` D-ARCH-003 (lines 956-969)
- Production evidence: 100% failure rate with US validation on Australian data
