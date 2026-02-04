"""
Manual testing script for Smart Turn V3 configuration.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from transports.smart_turn_config import SmartTurnConfig


def test_smart_turn_config():
    print("=== Smart Turn V3 Configuration Test ===\n")

    config = SmartTurnConfig.from_env()
    print(f"Enabled: {config['enabled']}")
    print(f"Model Path: {config['model_path'] or '(using bundled model)'}")
    print(f"CPU Count: {config['cpu_count']}")

    if not config["enabled"]:
        print("\nSmart Turn is DISABLED")
        print("Set SMART_TURN_ENABLED=true in .env to enable")
        return False

    print("\nSmart Turn configuration loaded successfully")
    return True


def test_smart_turn_analyzer():
    print("\n=== Smart Turn V3 Analyzer Test ===\n")

    try:
        analyzer = SmartTurnConfig.create_analyzer(sample_rate=16000)

        if analyzer is None:
            print("Smart Turn analyzer is None (disabled or import failed)")
            return False

        print(f"Smart Turn analyzer created: {type(analyzer).__name__}")
        print("Model: smart-turn-v3.2-cpu (8MB, 12ms inference)")
        print("Languages: 23 (including English AU)")
        return True
    except Exception as exc:
        print(f"Failed to create Smart Turn analyzer: {exc}")
        print(f"Error type: {type(exc).__name__}")
        return False


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    success = True
    success &= test_smart_turn_config()
    success &= test_smart_turn_analyzer()

    print("\n" + "=" * 50)
    if success:
        print("ALL TESTS PASSED")
        print("\nNext steps:")
        print("1. Run full test suite: pytest tests/")
        print("2. Test with real audio: use record_and_predict.py from smart-turn repo")
        print("3. Deploy to staging and monitor turn latency metrics")
    else:
        print("SOME TESTS FAILED")
        print("\nTroubleshooting:")
        print("1. Check Pipecat version: pip list | grep pipecat")
        print("2. Verify Pipecat >= 0.0.85 installed")
        print("3. Check .env has SMART_TURN_ENABLED=true")

    sys.exit(0 if success else 1)
