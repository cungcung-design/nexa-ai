"""Operational log and failed-job records do not keep sensitive content."""

import logging

from app.core.log_safety import RedactingFilter, redact_text
from app.worker.failure_log import record_task_failure


def test_redaction_removes_tokens_and_credentials():
    text = (
        "GET /password-recovery?token=raw-reset-token "
        "Authorization: Bearer eyJsecret password=mailbox-secret "
        "sk_test_example whsec_example"
    )
    redacted = redact_text(text)
    assert "raw-reset-token" not in redacted
    assert "eyJsecret" not in redacted
    assert "mailbox-secret" not in redacted
    assert "sk_test_example" not in redacted
    assert "whsec_example" not in redacted
    assert "password=[redacted]" in redacted
    assert "request finished" == redact_text("request finished")


def test_log_filter_redacts_the_formatted_message():
    record = logging.LogRecord(
        name="uvicorn.access",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="reset link %s",
        args=("https://app.example/password-recovery?token=raw-reset-token",),
        exc_info=None,
    )
    assert RedactingFilter().filter(record) is True
    assert "raw-reset-token" not in record.getMessage()


class _Redis:
    def __init__(self):
        self.counts = {}

    def hincrby(self, key, field, amount):
        self.counts[(key, field)] = self.counts.get((key, field), 0) + amount
        return self.counts[(key, field)]


def test_failed_job_counter_stores_the_task_name_only():
    client = _Redis()
    record_task_failure("documents.process", client)
    assert client.counts == {("nexa:monitor:failed-jobs", "documents.process"): 1}
    record_task_failure(None, client)
    assert ("nexa:monitor:failed-jobs", "unknown") in client.counts
