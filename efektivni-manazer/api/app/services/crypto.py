from cryptography.fernet import Fernet, InvalidToken
from ..config import get_settings


def _fernet() -> Fernet:
    key = get_settings().efektivni_encryption_key
    if not key:
        raise RuntimeError(
            "EFEKTIVNI_ENCRYPTION_KEY není nastaven. "
            "Vygeneruj: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise RuntimeError("Nelze dešifrovat – byl změněn EFEKTIVNI_ENCRYPTION_KEY?") from e
