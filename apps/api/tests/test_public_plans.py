"""The public pricing catalog matches the billing plans."""

from fastapi.testclient import TestClient

from app.modules.billing.plans import CATALOG_ORDER, PLANS


def test_public_plans_follow_the_billing_catalog(client: TestClient):
    response = client.get("/api/v1/public/plans")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [plan["key"] for plan in body["plans"]] == list(CATALOG_ORDER)

    for plan in body["plans"]:
        source = PLANS[plan["key"]]
        assert plan["label"] == source.label
        assert plan["tagline"] == source.tagline
        assert plan["features"] == list(source.features)
        assert plan["limits"]["agents"] == source.limits.agents
        assert plan["limits"]["monthly_requests"] == source.limits.monthly_requests
        assert plan["limits"]["knowledge_bases"] == source.limits.knowledge_bases
        assert plan["limits"]["workflow_executions"] == source.limits.workflow_executions
        assert plan["limits"]["storage_mb"] == source.limits.storage_mb
        assert plan["limits"]["seats"] == source.limits.seats
        assert plan["contact_sales"] is source.contact_sales
        if source.monthly is None:
            assert plan["monthly"] is None
        else:
            assert plan["monthly"]["amount"] == source.monthly.amount
        assert "price_" not in response.text
