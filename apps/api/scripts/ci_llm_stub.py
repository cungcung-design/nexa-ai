"""Local OpenAI-compatible stub for browser tests.

Answers qwen3:4b with a short sentence. Any other model is rejected so the
provider-failure test still sees an error. This is not a production model.
"""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class Handler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length else b"{}"
        body = json.loads(raw.decode() or "{}")
        model = str(body.get("model") or "")
        if model != "qwen3:4b":
            payload = json.dumps(
                {"error": {"message": "model unavailable"}}
            ).encode()
            status = 404
        else:
            payload = json.dumps(
                {
                    "id": "chatcmpl-ci",
                    "object": "chat.completion",
                    "choices": [
                        {
                            "index": 0,
                            "message": {
                                "role": "assistant",
                                "content": "Hello from the CI model.",
                            },
                            "finish_reason": "stop",
                        }
                    ],
                    "usage": {
                        "prompt_tokens": 1,
                        "completion_tokens": 1,
                        "total_tokens": 2,
                    },
                }
            ).encode()
            status = 200
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    ThreadingHTTPServer(("127.0.0.1", 11434), Handler).serve_forever()


if __name__ == "__main__":
    main()
