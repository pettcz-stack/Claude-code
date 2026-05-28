from datetime import datetime, timezone
from imap_tools import MailBox, AND

from .provider import FetchedMessage, MailProvider


class ImapMailProvider(MailProvider):
    def __init__(self, host: str, port: int, use_ssl: bool, username: str, password: str):
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.username = username
        self.password = password

    def _connect(self) -> MailBox:
        # imap_tools přepíná SSL/STARTTLS podle třídy; pro jednoduchost SSL pevně
        mb = MailBox(self.host, port=self.port)
        mb.login(self.username, self.password)
        return mb

    def fetch_since(self, folder: str, since: datetime | None) -> list[FetchedMessage]:
        out: list[FetchedMessage] = []
        with self._connect() as mb:
            try:
                mb.folder.set(folder)
            except Exception:
                # složka neexistuje – přeskočit
                return out
            criteria = AND(date_gte=since.date()) if since else "ALL"
            for msg in mb.fetch(criteria, mark_seen=False, bulk=False):
                date = msg.date or datetime.now(timezone.utc)
                if date.tzinfo is None:
                    date = date.replace(tzinfo=timezone.utc)
                if since and date < since:
                    continue
                out.append(
                    FetchedMessage(
                        message_id=msg.headers.get("message-id", ("",))[0].strip("<>") or msg.uid or "",
                        in_reply_to=(msg.headers.get("in-reply-to", ("",))[0] or "").strip("<>") or None,
                        references=[r.strip("<>") for r in (msg.headers.get("references", ("",))[0] or "").split() if r],
                        folder=folder,
                        from_addr=msg.from_ or "",
                        to_addrs=list(msg.to or []),
                        cc_addrs=list(msg.cc or []),
                        subject=msg.subject or "",
                        date=date,
                        body_text=msg.text or "",
                        body_html=msg.html or "",
                        raw_headers={k: v[0] if isinstance(v, tuple) else v for k, v in msg.headers.items()},
                    )
                )
        return out
