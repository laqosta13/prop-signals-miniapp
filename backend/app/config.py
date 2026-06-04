from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    bot_token: str = ""
    telegram_bot_username: str = ""
    telegram_support_username: str = ""
    telegram_support_group_id: str = ""
    telegram_admin_ids: str = ""
    telegram_former_admin_ids: str = ""
    database_url: str = "sqlite:///./signals.db"
    cors_origins: str = "http://localhost:5173"
    default_signal_points_percent: float = 1.0
    max_signal_points_percent: float = 10.0
    price_check_interval_seconds: int = 60
    price_http_timeout_seconds: float = 10.0
    mini_app_url: str = ""
    media_root: str = "./media"
    max_image_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 100 * 1024 * 1024
    usdt_ton_address: str = "UQDdFFYSG8sGiQfps2WWuIWFuaDPv1GAcFeRck6y5oeR_sPe"
    usdt_ton_jetton_master: str = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
    toncenter_api_base: str = "https://toncenter.com/api/v3"
    toncenter_api_key: str = ""
    ton_payment_min_confirmations: int = 3
    public_base_url: str = ""
    exchange_secrets_key: str = ""

    @property
    def admin_id_set(self) -> set[int]:
        raw = self.telegram_admin_ids.strip()
        if not raw:
            return set()
        return {int(x.strip()) for x in raw.split(",") if x.strip().isdigit()}

    @property
    def former_admin_id_set(self) -> set[int]:
        raw = self.telegram_former_admin_ids.strip()
        if not raw:
            return set()
        return {int(x.strip()) for x in raw.split(",") if x.strip().isdigit()}


settings = Settings()
