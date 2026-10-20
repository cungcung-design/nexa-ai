from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.db.models import Membership, User
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    UserResponse,
    TokenResponse,
)
from app.modules.security.audit import record_audit_event

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


def _record_authentication_event(
    db: Session,
    user: User,
    action: str,
    outcome: str,
) -> None:
    """Record a sign-in or sign-out for every workspace the user belongs to."""
    memberships = db.scalars(
        select(Membership).where(Membership.user_id == user.id)
    ).all()
    for membership in memberships:
        record_audit_event(
            db,
            organization_id=membership.organization_id,
            actor_user_id=user.id,
            actor_type="user",
            action=action,
            resource_type="member",
            resource_id=user.id,
            resource_name=user.email,
            outcome=outcome,
            source="web_application",
            details={"member_email": user.email},
            summary=(
                f"{user.email} signed in."
                if outcome == "success"
                else f"{user.email} failed to sign in."
            ),
        )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    password_hash = hash_password(request.password)
    user = User(
        email=request.email.lower(),
        password_hash=password_hash,
        full_name=(request.full_name or "").strip() or None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    db.refresh(user)
    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user or not verify_password(request.password, user.password_hash):
        if user is not None:
            _record_authentication_event(db, user, "user.login_failed", "failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    _record_authentication_event(db, user, "user.login", "success")
    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)


@router.post("/logout")
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _record_authentication_event(db, current_user, "user.logout", "success")
    return {"ok": True}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user
