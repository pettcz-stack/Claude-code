from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://efektivni:efektivni@db:5432/efektivni"

    anthropic_api_key: str = ""
    llm_extractor_model: str = "claude-sonnet-4-6"
    llm_draft_model: str = "claude-opus-4-7"

    efektivni_master_password: str = "zmen-me-prosim"
    efektivni_encryption_key: str = ""
    efektivni_session_secret: str = "zmen-me-na-nahodny-retezec"

    mail_sync_interval: int = 120
    sla_tick_interval: int = 300

    working_hours_start: int = 8
    working_hours_end: int = 18
    working_days: str = "1,2,3,4,5"
    timezone: str = "Europe/Prague"

    @property
    def working_days_set(self) -> set[int]:
        return {int(x) for x in self.working_days.split(",") if x.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
