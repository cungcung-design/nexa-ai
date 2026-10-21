from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None = None
    email_verified: bool = False

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class EmailVerificationRequest(BaseModel):
    token: str = Field(min_length=10, max_length=512)


class EmailVerificationStatusResponse(BaseModel):
    email: str
    verified: bool
    cooldown_seconds: int = 0
    expires_in_minutes: int = 0


class EmailVerificationSendResponse(BaseModel):
    sent: bool
    email: str
    cooldown_seconds: int = 0
    retry_after_seconds: int = 0
    expires_in_minutes: int = 0
    delivery: str = "smtp"
    verification_url: str | None = None


class EmailVerificationConfirmResponse(BaseModel):
    verified: bool
    email: str
    status: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetRequestResponse(BaseModel):
    message: str
    resend_available_in_seconds: int = 0
    #: Only filled outside of production and only when no mail server is
    #: available, so the flow stays testable without SMTP.
    dev_reset_link: str | None = None


class PasswordResetValidateRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)


class PasswordResetValidateResponse(BaseModel):
    valid: bool
    expires_in_minutes: int | None = None


class PasswordResetConfirmRequest(BaseModel):
    token: str = Field(min_length=1, max_length=512)
    password: str = Field(min_length=12, max_length=128)


class PasswordResetConfirmResponse(BaseModel):
    ok: bool
