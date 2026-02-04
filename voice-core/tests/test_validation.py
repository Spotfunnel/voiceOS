"""
Unit tests for validation logic (email regex, phone format).

Tests Australian-specific validation patterns.
"""

import pytest
from src.primitives.capture_email_au import CaptureEmailAU
from src.primitives.capture_phone_au import CapturePhoneAU


class TestEmailValidation:
    """Test suite for Australian email validation"""
    
    @pytest.mark.asyncio
    async def test_valid_emails(self):
        """Test valid email addresses pass validation"""
        primitive = CaptureEmailAU()
        
        valid_emails = [
            "jane@gmail.com",
            "john.smith@outlook.com",
            "test_user@example.com",
            "user+tag@domain.co.au",
            "firstname.lastname@company.com.au",
            "123@test.com",
            "a@b.co"
        ]
        
        for email in valid_emails:
            is_valid = await primitive.validate_value(email)
            assert is_valid, f"Email should be valid: {email}"
    
    @pytest.mark.asyncio
    async def test_invalid_emails(self):
        """Test invalid email addresses fail validation"""
        primitive = CaptureEmailAU()
        
        invalid_emails = [
            "",  # Empty
            "notanemail",  # No @
            "@example.com",  # No username
            "user@",  # No domain
            "user@domain",  # No TLD
            "user @domain.com",  # Space
            "user@test.com@extra.com",  # Multiple @
            "user@example.com.",  # Trailing dot
            "user@.example.com"  # Leading dot in domain
        ]
        
        for email in invalid_emails:
            is_valid = await primitive.validate_value(email)
            assert not is_valid, f"Email should be invalid: {email}"
    
    @pytest.mark.asyncio
    async def test_email_extraction_from_speech(self):
        """Test extraction of email from spoken transcription"""
        primitive = CaptureEmailAU()
        
        test_cases = [
            ("jane at gmail dot com", "jane@gmail.com"),
            ("john underscore smith at outlook dot com", "john_smith@outlook.com"),
            ("test plus 1 at domain dot co dot au", "test+1@domain.co.au"),  # Use "1" instead of "one"
            ("my email is jane at gmail dot com", "jane@gmail.com"),
            ("it's john dot smith at example dot com", "john.smith@example.com"),
        ]
        
        for transcription, expected in test_cases:
            extracted = await primitive.extract_value(transcription)
            assert extracted == expected, f"Failed to extract {expected} from: {transcription}"
    
    @pytest.mark.asyncio
    async def test_email_normalization(self):
        """Test email normalization (lowercase)"""
        primitive = CaptureEmailAU()
        
        assert primitive.normalize_value("Jane@Gmail.COM") == "jane@gmail.com"
        assert primitive.normalize_value("JOHN@EXAMPLE.COM") == "john@example.com"
        assert primitive.normalize_value("  test@domain.com  ") == "test@domain.com"


class TestPhoneValidation:
    """Test suite for Australian phone validation"""
    
    @pytest.mark.asyncio
    async def test_valid_mobile_numbers(self):
        """Test valid Australian mobile numbers"""
        primitive = CapturePhoneAU()
        
        valid_mobiles = [
            "0412345678",  # No spaces
            "0412 345 678",  # With spaces
            "04 1234 5678",  # Alternative spacing
            "+61412345678",  # International format
            "+61 412 345 678",  # International with spaces
            "0400000000",  # Edge case (all zeros after 04)
            "0499999999",  # Edge case (all nines after 04)
        ]
        
        for phone in valid_mobiles:
            is_valid = await primitive.validate_value(phone)
            assert is_valid, f"Mobile should be valid: {phone}"
    
    @pytest.mark.asyncio
    async def test_valid_landline_numbers(self):
        """Test valid Australian landline numbers"""
        primitive = CapturePhoneAU()
        
        valid_landlines = [
            "0298765432",  # Sydney (02)
            "02 9876 5432",  # Sydney with spaces
            "0398765432",  # Melbourne (03)
            "03 9876 5432",  # Melbourne with spaces
            "0798765432",  # Brisbane (07)
            "07 3876 5432",  # Brisbane with spaces
            "0898765432",  # Adelaide (08)
            "08 8876 5432",  # Adelaide with spaces
        ]
        
        for phone in valid_landlines:
            is_valid = await primitive.validate_value(phone)
            assert is_valid, f"Landline should be valid: {phone}"
    
    @pytest.mark.asyncio
    async def test_invalid_phone_numbers(self):
        """Test invalid phone numbers"""
        primitive = CapturePhoneAU()
        
        invalid_phones = [
            "",  # Empty
            "123",  # Too short
            "01234567890",  # Wrong area code (01)
            "05123456789",  # Wrong area code (05)
            "412345678",  # Missing leading 0
            "+1234567890",  # Wrong country code (US)
            "abcd1234567",  # Contains letters
        ]
        
        for phone in invalid_phones:
            is_valid = await primitive.validate_value(phone)
            assert not is_valid, f"Phone should be invalid: {phone}"
    
    @pytest.mark.asyncio
    async def test_phone_extraction_from_speech(self):
        """Test extraction of phone from spoken transcription"""
        primitive = CapturePhoneAU()
        
        test_cases = [
            ("zero four one two three four five six seven eight", "0412345678"),
            ("oh four one two three four five six seven eight", "0412345678"),
            ("zero four one two, three four five, six seven eight", "0412345678"),
            ("plus six one four one two three four five six seven eight", "+61412345678"),
            ("zero two nine eight seven six five four three two", "0298765432"),
        ]
        
        for transcription, expected_digits in test_cases:
            extracted = await primitive.extract_value(transcription)
            # Remove all non-digits for comparison
            import re
            extracted_digits = re.sub(r'\D', '', extracted)
            expected_clean = re.sub(r'\D', '', expected_digits)
            assert extracted_digits == expected_clean, f"Failed to extract {expected_digits} from: {transcription}"
    
    @pytest.mark.asyncio
    async def test_phone_normalization_to_e164(self):
        """Test phone normalization to +61 format"""
        primitive = CapturePhoneAU()
        
        test_cases = [
            ("0412345678", "+61412345678"),  # Mobile
            ("0298765432", "+61298765432"),  # Landline
            ("04 1234 5678", "+61412345678"),  # Mobile with spaces
            ("02 9876 5432", "+61298765432"),  # Landline with spaces
            ("+61412345678", "+61412345678"),  # Already normalized
            ("61412345678", "+61412345678"),  # Without + prefix
        ]
        
        for input_phone, expected in test_cases:
            normalized = primitive.normalize_value(input_phone)
            assert normalized == expected, f"Failed to normalize {input_phone} to {expected}, got {normalized}"


class TestAustralianSpecificPatterns:
    """Test Australian-specific patterns and edge cases"""
    
    @pytest.mark.asyncio
    async def test_australian_mobile_prefix_04(self):
        """Test all Australian mobiles start with 04"""
        primitive = CapturePhoneAU()
        
        # All valid 04xx prefixes
        for second_digit in range(10):
            phone = f"04{second_digit}1234567"
            is_valid = await primitive.validate_value(phone)
            assert is_valid, f"Should accept 04{second_digit} prefix: {phone}"
    
    @pytest.mark.asyncio
    async def test_australian_landline_area_codes(self):
        """Test only valid Australian area codes (02, 03, 07, 08)"""
        primitive = CapturePhoneAU()
        
        # Valid area codes
        for area_code in ["02", "03", "07", "08"]:
            phone = f"{area_code}12345678"
            is_valid = await primitive.validate_value(phone)
            assert is_valid, f"Should accept {area_code} area code: {phone}"
        
        # Invalid area codes (note: 04 is valid for mobile, not landline)
        for area_code in ["01", "05", "06", "09"]:
            phone = f"{area_code}12345678"
            is_valid = await primitive.validate_value(phone)
            assert not is_valid, f"Should reject {area_code} area code: {phone}"
    
    @pytest.mark.asyncio
    async def test_australian_phone_length_exactly_10_digits(self):
        """Test Australian phones must be exactly 10 digits"""
        primitive = CapturePhoneAU()
        
        # Too short
        assert not await primitive.validate_value("041234567")  # 9 digits
        
        # Correct length
        assert await primitive.validate_value("0412345678")  # 10 digits
        
        # Too long
        assert not await primitive.validate_value("04123456789")  # 11 digits
    
    @pytest.mark.asyncio
    async def test_common_australian_email_domains(self):
        """Test common Australian email domains are accepted"""
        primitive = CaptureEmailAU()
        
        australian_domains = [
            "test@bigpond.com",
            "test@optusnet.com.au",
            "test@bigpond.net.au",
            "test@live.com.au",
            "test@gmail.com",  # Common globally, including AU
            "test@outlook.com",
        ]
        
        for email in australian_domains:
            is_valid = await primitive.validate_value(email)
            assert is_valid, f"Should accept common AU domain: {email}"


@pytest.mark.asyncio
class TestAffirmationDetection:
    """Test affirmation and correction detection"""
    
    async def test_affirmation_detection_email(self):
        """Test affirmation detection for email primitive"""
        primitive = CaptureEmailAU()
        
        affirmations = [
            "yes", "yeah", "yep", "yup", "correct", "that's right",
            "that's correct", "sure", "right", "exactly", "spot on",
            "absolutely", "definitely"
        ]
        
        for affirmation in affirmations:
            is_affirm = await primitive.is_affirmation(affirmation)
            assert is_affirm, f"Should detect as affirmation: {affirmation}"
    
    async def test_negation_detection_email(self):
        """Test negation detection (should not be affirmation)"""
        primitive = CaptureEmailAU()
        
        negations = [
            "no", "nope", "incorrect", "wrong", "that's wrong",
            "actually it's different"
        ]
        
        for negation in negations:
            is_affirm = await primitive.is_affirmation(negation)
            assert not is_affirm, f"Should NOT detect as affirmation: {negation}"
    
    async def test_correction_extraction_email(self):
        """Test extracting corrections from user speech"""
        primitive = CaptureEmailAU()
        
        test_cases = [
            ("no it's john at gmail dot com", "john@gmail.com"),
            ("actually it's jane underscore smith at outlook dot com", "jane_smith@outlook.com"),
            ("the correct email is test at example dot com", "test@example.com"),
        ]
        
        for transcription, expected in test_cases:
            corrected = await primitive.extract_correction(transcription)
            assert corrected == expected, f"Failed to extract correction: {transcription}"
