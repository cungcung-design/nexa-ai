from app.modules.security.api_keys import (
    generate_api_key,
    hash_api_key,
)


def test_generated_keys_are_unique():
    first, _, _ = generate_api_key()
    second, _, _ = generate_api_key()

    assert first != second


def test_generated_key_has_correct_prefix():
    key, prefix, digest = generate_api_key()

    assert key.startswith("nexa_live_")
    assert prefix == key[:20]
    assert digest == hash_api_key(key)


def test_api_key_hash_is_deterministic():
    key, _, digest = generate_api_key()

    assert hash_api_key(key) == digest
    assert hash_api_key(key + "x") != digest