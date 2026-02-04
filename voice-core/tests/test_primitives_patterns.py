"""Tests for receptionist capture patterns and incremental repair."""

import pytest

from src.primitives.capture_email_au import CaptureEmailAU
from src.primitives.capture_phone_au import CapturePhoneAU
from src.primitives.capture_address_au import CaptureAddressAU
from src.primitives.capture_datetime_au import CaptureDatetimeAU


@pytest.mark.asyncio
async def test_email_confirmation_not_robotic():
    primitive = CaptureEmailAU()
    await primitive._update_components_from_value("jane@gmail.com", confidence=0.9)
    prompt = await primitive._contextual_confirmation("jane@gmail.com")
    assert "j-a-n-e" not in prompt.lower()
    assert "jane" in prompt.lower()


@pytest.mark.asyncio
async def test_email_incremental_repair_username():
    primitive = CaptureEmailAU()
    await primitive._update_components_from_value("jane@gmail.com", confidence=0.9)
    updated = await primitive._incremental_repair("it's jaine with an i")
    assert updated == "jaine@gmail.com"


@pytest.mark.asyncio
async def test_phone_incremental_repair_last_four():
    primitive = CapturePhoneAU()
    await primitive._update_components_from_value("0412345678", confidence=0.9)
    updated = await primitive._incremental_repair("ending in 6789")
    assert updated.endswith("6789")


@pytest.mark.asyncio
async def test_address_confirmation_full_state_name():
    primitive = CaptureAddressAU()
    primitive.street = "123 Main Street"
    primitive.suburb = "Bondi"
    primitive.state = "NSW"
    primitive.postcode = "2026"
    prompt = await primitive._contextual_confirmation("123 Main Street, Bondi, NSW, 2026")
    assert "New South Wales" in prompt


@pytest.mark.asyncio
async def test_datetime_incremental_repair_time_only():
    primitive = CaptureDatetimeAU()
    await primitive._update_components_from_value("15/10/2026 10:00", confidence=0.9)
    updated = await primitive._incremental_repair("at 2pm")
    assert updated is not None
    assert updated.endswith("14:00")
