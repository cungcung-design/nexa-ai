from typing import Literal
from pydantic import BaseModel


class CheckoutRequest(BaseModel):
    plan: Literal["PRO", "BUSINESS"]


class CheckoutResponse(BaseModel):
    checkout_url: str