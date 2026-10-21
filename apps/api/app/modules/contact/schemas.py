"""Schemas of the contact form."""

from pydantic import BaseModel, EmailStr, Field

#: The topics a visitor can choose in the form.
CONTACT_SUBJECTS = {
    "general": "General inquiry",
    "sales": "Sales and pricing",
    "demo": "Request a demo",
    "support": "Technical support",
    "partnership": "Partnerships",
}


class ContactRequest(BaseModel):
    """A message that a visitor sent through the contact form."""

    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=2, max_length=60)
    message: str = Field(min_length=10, max_length=4000)

    def normalized_subject(self) -> str:
        """Return the label of the topic, or the topic itself."""
        return CONTACT_SUBJECTS.get(self.subject.lower(), self.subject)


class ContactResponse(BaseModel):
    """The answer of the contact form."""

    message: str
    reference: str
