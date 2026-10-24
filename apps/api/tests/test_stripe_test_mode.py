"""Stripe test-mode checks that never call the Stripe API.

Signature fixtures and these configuration checks are local. They do not
prove that a Stripe account accepted a test payment.
"""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.modules.billing.plans import valid_stripe_price_id
from app.modules.billing.stripe_service import (
    BillingProviderError,
    ensure_test_mode_event,
    provider_configured,
    webhook_configured,
)
from app.modules.billing.webhook_router import apply_verified_event


def test_only_a_test_secret_enables_the_provider(monkeypatch):
    monkeypatch.setattr(settings, "stripe_secret_key", "")
    assert provider_configured() is False
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_live_example")
    assert provider_configured() is False
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_REPLACE")
    assert provider_configured() is False
    monkeypatch.setattr(settings, "stripe_secret_key", "sk_test_example")
    assert provider_configured() is True


def test_webhook_secret_must_use_the_signing_prefix(monkeypatch):
    monkeypatch.setattr(settings, "stripe_webhook_secret", "")
    assert webhook_configured() is False
    monkeypatch.setattr(settings, "stripe_webhook_secret", "sk_test_example")
    assert webhook_configured() is False
    monkeypatch.setattr(settings, "stripe_webhook_secret", "whsec_test_fixture")
    assert webhook_configured() is True


def test_configured_price_ids_must_be_stripe_price_identifiers():
    assert valid_stripe_price_id("price_test_pro_monthly") == "price_test_pro_monthly"
    assert valid_stripe_price_id("price_1ABC") == "price_1ABC"
    assert valid_stripe_price_id("price_REPLACE_pro") is None
    assert valid_stripe_price_id("prod_123") is None
    assert valid_stripe_price_id("  ") is None


def test_a_live_event_is_refused_before_it_is_stored():
    with pytest.raises(BillingProviderError, match="Live Stripe events"):
        ensure_test_mode_event(SimpleNamespace(livemode=True))


def test_a_concurrent_duplicate_event_is_not_applied_twice():
    event = SimpleNamespace(
        id="evt_race",
        type="customer.subscription.updated",
        livemode=False,
        created=0,
        data=None,
    )
    db = MagicMock()
    db.scalar.return_value = None
    db.commit.side_effect = IntegrityError("insert", {}, Exception("duplicate"))

    result = apply_verified_event(db, event)

    assert result == {"received": True, "duplicate": True}
    db.rollback.assert_called_once()
