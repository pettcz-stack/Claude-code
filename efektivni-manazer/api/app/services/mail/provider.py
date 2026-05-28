from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class FetchedMessage:
    message_id: str
    in_reply_to: str | None
    references: list[str] = field(default_factory=list)
    folder: str = "INBOX"
    from_addr: str = ""
    to_addrs: list[str] = field(default_factory=list)
    cc_addrs: list[str] = field(default_factory=list)
    subject: str = ""
    date: datetime | None = None
    body_text: str = ""
    body_html: str = ""
    raw_headers: dict = field(default_factory=dict)


class MailProvider(ABC):
    """Abstrakce nad mailovým účtem. Implementace: IMAP, MS Graph (TBD)."""

    @abstractmethod
    def fetch_since(self, folder: str, since: datetime | None) -> list[FetchedMessage]:
        """Vrátí všechny mejly v dané složce s datem >= since (nebo všechny, je-li None)."""
