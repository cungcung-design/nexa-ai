from fastapi import (
    Depends,
    HTTPException,
    Security,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.security.api_keys import authenticate_api_key
from app.modules.security.rate_limit import enforce_rate_limit


bearer_scheme = HTTPBearer(auto_error=False)


def require_agent_api_key(
    credentials: HTTPAuthorizationCredentials | None = Security(
        bearer_scheme
    ),
    db: Session = Depends(get_db),
):
    if (
        credentials is None
        or credentials.scheme.lower() != "bearer"
    ):
        raise HTTPException(
            status_code=401,
            detail="API key required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    record = authenticate_api_key(
        db=db,
        plaintext=credentials.credentials,
        required_scope="agent:invoke",
    )

    if record is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or unauthorized API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    enforce_rate_limit(
        identity=f"api-key:{record.id}",
        limit=60,
        window_seconds=60,
    )

    return record