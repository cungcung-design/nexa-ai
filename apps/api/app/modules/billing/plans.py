from dataclasses import dataclass


@dataclass(frozen=True)
class PlanLimits:
    agents: int
    monthly_requests: int
    knowledge_bases: int


PLANS = {
    "FREE": PlanLimits(
        agents=2,
        monthly_requests=100,
        knowledge_bases=1,
    ),
    "PRO": PlanLimits(
        agents=10,
        monthly_requests=5000,
        knowledge_bases=20,
    ),
    "BUSINESS": PlanLimits(
        agents=50,
        monthly_requests=25000,
        knowledge_bases=100,
    ),
}


def get_plan_limits(plan: str) -> PlanLimits:
    return PLANS.get(plan, PLANS["FREE"])