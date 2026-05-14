from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str = ""
    telegram_admin_ids: str = ""
    database_url: str = "sqlite:///./signals.db"
    cors_origins: str = "http://localhost:5173"

    @property
    def admin_id_set(self) -> set[int]:
        raw = self.telegram_admin_ids.strip()
        if not raw:
            return set()
        return {int(x.strip()) for x in raw.split(",") if x.strip().isdigit()}


settings = Settings()
