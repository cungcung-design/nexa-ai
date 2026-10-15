import stripe
from app.core.config import settings

stripe.api_key = settings.stripe_secret_key


def create_checkout_session(
    organization_id: str,
    plan: str,
    customer_id: str | None = None,
):
    price_map = {
        "PRO": settings.stripe_pro_price_id,
        "BUSINESS": settings.stripe_business_price_id,
    }
    price_id = price_map.get(plan)
    if not price_id:
        raise ValueError("Plan is not configured")

    params = {
        "mode": "subscription",
        "line_items": [
            {
                "price": price_id,
                "quantity": 1,
            }
        ],
        "success_url": f"{settings.frontend_url}/dashboard/billing?success=true",
        "cancel_url": f"{settings.frontend_url}/dashboard/billing?canceled=true",
        "metadata": {
            "organization_id": organization_id,
        },
    }
    if customer_id:
        params["customer"] = customer_id
    else:
        params["customer_email"] = None

    session = stripe.checkout.Session.create(**params)
    return session.url


def get_subscription(subscription_id: str):
    return stripe.Subscription.retrieve(subscription_id)