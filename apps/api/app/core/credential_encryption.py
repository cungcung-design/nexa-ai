import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings


def _fernet() -> Fernet:
    key_material = hashlib.sha256(
        settings.jwt_secret.encode("utf-8")
    ).digest()
    return Fernet(base64.urlsafe_b64encode(key_material))


def encrypt_credentials(credentials: dict) -> str:
    """Encrypt a credentials dict and return a Fernet token string.

    Never return the plaintext credentials outside this module.
    """
    import json

    plaintext = json.dumps(credentials, sort_keys=True).encode("utf-8")
    return _fernet().encrypt(plaintext).decode("utf-8")


def decrypt_credentials(token: str | None) -> dict:
    """Decrypt a Fernet token back into a credentials dict.

    Returns an empty dict when no token is stored.
    """
    import json

    if not token:
        return {}
    plaintext = _fernet().decrypt(token.encode("utf-8"))
    return json.loads(plaintext.decode("utf-8"))
