import sys
import os
import pytest

# Add the parent directory to the path so we can import apps
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.modules.analytics.evaluation import evaluate_contains


@pytest.mark.parametrize(
    "actual,expected,should_pass",
    [
        ("Your order is preparing", "preparing", True),
        ("HELLO WORLD", "hello", True),
        ("Your order is delivered", "pending", False),
        ("Product available", "", False),
        ("  Payment successful  ", "payment", True),
    ],
)
def test_evaluate_contains(
    actual,
    expected,
    should_pass,
):
    result = evaluate_contains(actual, expected)

    assert result.passed is should_pass
    assert result.score == (1.0 if should_pass else 0.0)


def test_evaluation_has_reason():
    result = evaluate_contains("Hello world", "world")
    assert "Expected text \"world\" was found in actual response" in result.reason

    result = evaluate_contains("Hello world", "xyz")
    assert 'Expected text "xyz" was not found in actual response' in result.reason