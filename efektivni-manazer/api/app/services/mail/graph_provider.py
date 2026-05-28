from datetime import datetime
from .provider import FetchedMessage, MailProvider


class GraphMailProvider(MailProvider):
    """
    Stub Microsoft Graph implementace. Aktivuje se až bude k dispozici
    OAuth aplikace v Azure AD a admin consent. Doplnit:
      - msal.ConfidentialClientApplication / PublicClientApplication
      - GET /me/mailFolders/{id}/messages?$filter=receivedDateTime ge ...
      - delta query pro inkrementální sync
      - subscription pro push notifikace (volitelně)
    """

    def __init__(self, client_id: str, tenant_id: str, refresh_token: str):
        self.client_id = client_id
        self.tenant_id = tenant_id
        self.refresh_token = refresh_token

    def fetch_since(self, folder: str, since: datetime | None) -> list[FetchedMessage]:
        raise NotImplementedError(
            "GraphMailProvider zatím není zapojen. "
            "Vyžaduje Azure App Registration + admin consent v tenantu. "
            "Pro MVP použij IMAP."
        )
