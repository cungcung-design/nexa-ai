from uuid import UUID
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.email import (
    EmailDeliveryError,
    send_email_verification_email,
    smtp_is_configured,
)
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
)
from app.db.models import Membership, User
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.password_reset import (
    INVALID_TOKEN_MESSAGE,
    NEUTRAL_MESSAGE,
    PasswordResetError,
    confirm_password_reset,
    find_valid_token,
    request_password_reset,
)
from app.modules.auth.schemas import (
    RegisterRequest,
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetConfirmResponse,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    PasswordResetValidateRequest,
    PasswordResetValidateResponse,
    UserResponse,
    TokenResponse,
    EmailVerificationConfirmResponse,
    EmailVerificationRequest,
    EmailVerificationSendResponse,
    EmailVerificationStatusResponse,
)
from app.modules.security.audit import record_audit_event
from app.modules.security.rate_limit import (
    client_address,
    enforce_login_limits,
    enforce_password_reset_limit,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

#: The cooldown between two verification emails.
EMAIL_VERIFICATION_COOLDOWN_SECONDS = 45
#: How long a verification link stays valid.
EMAIL_VERIFICATION_TTL_MINUTES = 60


def _hash_verification_token(token: str) -> str:
    """Hash a verification token so the database never stores it."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _verification_cooldown_remaining(user: User) -> int:
    """Return the seconds the user still has to wait for a new email."""
    if user.email_verification_sent_at is None:
        return 0
    elapsed = datetime.now(timezone.utc) - user.email_verification_sent_at
    remaining = EMAIL_VERIFICATION_COOLDOWN_SECONDS - int(elapsed.total_seconds())
    return max(0, remaining)


def _verification_link(token: str) -> str:
    base = settings.frontend_url.rstrip("/")
    return f"{base}/verify-email?token={token}"


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


@router.get(
    "/verification",
    response_model=EmailVerificationStatusResponse,
)
def email_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Report the verification state of the signed in user."""
    return EmailVerificationStatusResponse(
        email=current_user.email,
        verified=bool(current_user.email_verified),
        cooldown_seconds=_verification_cooldown_remaining(current_user),
        expires_in_minutes=EMAIL_VERIFICATION_TTL_MINUTES,
    )


@router.post(
    "/verification/send",
    response_model=EmailVerificationSendResponse,
)
def send_email_verification(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a new verification email to the signed in user."""
    if current_user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already verified.",
        )

    # A configured mail server is the only case that should rate limit sends.
    mail_configured = smtp_is_configured()
    remaining = _verification_cooldown_remaining(current_user) if mail_configured else 0
    if remaining > 0:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "A verification email was sent recently. "
                f"Try again in {remaining} seconds."
            ),
        )

    token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    current_user.email_verification_token_hash = _hash_verification_token(token)
    current_user.email_verification_expires_at = now + timedelta(
        minutes=EMAIL_VERIFICATION_TTL_MINUTES
    )
    # Without a mail server there is no inbox to protect, so the page can
    # issue a fresh link instead of pretending a message was delivered.
    current_user.email_verification_sent_at = now if mail_configured else None
    db.commit()

    link = _verification_link(token)
    delivery = "smtp" if mail_configured else "development"
    if mail_configured:
        try:
            send_email_verification_email(
                to_email=current_user.email,
                verification_link=link,
                expires_in_minutes=EMAIL_VERIFICATION_TTL_MINUTES,
            )
        except EmailDeliveryError as error:
            current_user.email_verification_token_hash = None
            current_user.email_verification_expires_at = None
            current_user.email_verification_sent_at = None
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(error),
            ) from error

    cooldown = EMAIL_VERIFICATION_COOLDOWN_SECONDS if mail_configured else 0
    return EmailVerificationSendResponse(
        sent=mail_configured,
        email=current_user.email,
        cooldown_seconds=cooldown,
        retry_after_seconds=cooldown,
        expires_in_minutes=EMAIL_VERIFICATION_TTL_MINUTES,
        delivery=delivery,
        verification_url=link if delivery == "development" else None,
    )


@router.post(
    "/verification/confirm",
    response_model=EmailVerificationConfirmResponse,
)
def confirm_email_verification(
    request: EmailVerificationRequest,
    db: Session = Depends(get_db),
):
    """Validate a verification link and confirm the address it belongs to."""
    token_hash = _hash_verification_token(request.token.strip())
    user = (
        db.query(User)
        .filter(User.email_verification_token_hash == token_hash)
        .first()
    )
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is not valid. Request a new one.",
        )
    if user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This email address is already verified.",
        )
    expires_at = user.email_verification_expires_at
    if expires_at is not None and expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link has expired. Request a new one.",
        )

    user.email_verified = True
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    db.commit()
    return EmailVerificationConfirmResponse(
        verified=True,
        email=user.email,
        status="verified",
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
    access_token = create_access_token(user.id, user.token_version)
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
def login(
    request: LoginRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    enforce_login_limits(request.email, client_address(http_request))
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user or not verify_password(request.password, user.password_hash):
        if user is not None:
            _record_authentication_event(db, user, "user.login_failed", "failed")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    _record_authentication_event(db, user, "user.login", "success")
    access_token = create_access_token(user.id, user.token_version)
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


def _record_password_reset_event(
    db: Session,
    user: User,
    action: str,
    outcome: str,
    summary: str,
) -> None:
    """Record a password reset step for every workspace the user belongs to."""
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
            summary=summary,
        )


@router.post(
    "/password-reset/request",
    response_model=PasswordResetRequestResponse,
)
def request_password_reset_link(
    request: PasswordResetRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """Send a password reset link.

    The answer is the same for every address, so the endpoint cannot be used
    to find out which accounts exist.
    """
    enforce_password_reset_limit(client_address(http_request))
    try:
        result = request_password_reset(
            db,
            request.email,
            base_url=settings.frontend_url,
        )
    except EmailDeliveryError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "The reset email could not be sent. "
                "Please try again in a moment."
            ),
        )

    if result.user_id is not None:
        user = db.get(User, result.user_id)
        if user is not None:
            _record_password_reset_event(
                db,
                user,
                "user.password_reset_requested",
                "success",
                f"{user.email} requested a password reset link.",
            )

    dev_link = None
    if (
        result.dev_reset_link
        and settings.password_reset_dev_expose_link
        and settings.app_env.lower() != "production"
    ):
        dev_link = result.dev_reset_link

    return PasswordResetRequestResponse(
        message=NEUTRAL_MESSAGE,
        resend_available_in_seconds=result.resend_available_in_seconds,
        dev_reset_link=dev_link,
    )


@router.post(
    "/password-reset/validate",
    response_model=PasswordResetValidateResponse,
)
def validate_password_reset_link(
    request: PasswordResetValidateRequest,
    db: Session = Depends(get_db),
):
    """Check a reset link before the new password is asked for."""
    record = find_valid_token(db, request.token)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=INVALID_TOKEN_MESSAGE,
        )
    return PasswordResetValidateResponse(
        valid=True,
        expires_in_minutes=settings.password_reset_token_minutes,
    )


@router.post(
    "/password-reset/confirm",
    response_model=PasswordResetConfirmResponse,
)
def confirm_password_reset_link(
    request: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
):
    """Store the new password and sign the previous sessions out."""
    try:
        user = confirm_password_reset(db, request.token, request.password)
    except PasswordResetError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )

    _record_password_reset_event(
        db,
        user,
        "user.password_reset_completed",
        "success",
        f"{user.email} reset the password of their account.",
    )
    return PasswordResetConfirmResponse(ok=True)
