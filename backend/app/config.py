from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str = ""
    telegram_admin_ids: str = ""
    database_url: str = "sqlite:///./signals.db"
    cors_origins: str = "http://localhost:5173"
    default_signal_points_percent: float = 1.0
    max_signal_points_percent: float = 10.0
    price_check_interval_seconds: int = 60
    mini_app_url: str = ""
    media_root: str = "./media"
    max_image_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 50 * 1024 * 1024
    usdt_ton_address: str = "UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe"
    public_base_url: str = ""

    @property
    def admin_id_set(self) -> set[int]:
        raw = self.telegram_admin_ids.strip()
        if not raw:
            return set()
        return {int(x.strip()) for x in raw.split(",") if x.strip().isdigit()}


settings = Settings()
