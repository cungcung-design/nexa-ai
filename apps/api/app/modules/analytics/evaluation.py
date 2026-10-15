from dataclasses import dataclass


@dataclass(frozen=True)
class EvaluationOutcome:
    passed: bool
    score: float
    reason: str


def evaluate_contains(
    actual_response: str,
    expected_text: str,
) -> EvaluationOutcome:
    actual = actual_response.casefold().strip()
    expected = expected_text.casefold().strip()

    if not expected:
        return EvaluationOutcome(
            passed=False,
            score=0.0,
            reason="Expected text cannot be empty",
        )

    passed = expected in actual

    return EvaluationOutcome(
        passed=passed,
        score=1.0 if passed else 0.0,
        reason=(
            f'Expected text "{expected}" was'
            f' {"found" if passed else "not found"} in actual response'
        ),
    )