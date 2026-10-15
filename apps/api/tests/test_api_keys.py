from app.modules.security.api_keys import (
    generate_api_key,
    hash_api_key,
)


def test_api_key_generation():
    plaintext, prefix, digest = generate_api_key()
    assert plaintext.startswith("nexa_live_")
    assert prefix == plaintext[:20]
    assert digest == hash_api_key(plaintext)


def test_api_keys_are_unique():
    first, _, _ = generate_api_key()
    second, _, _ = generate_api_key()
    assert first != second


def test_api_key_is_not_stored_as_plaintext():
    plaintext, _, digest = generate_api_key()
    assert plaintext != digest
    assert len(digest) == 64
