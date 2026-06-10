from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://stockgame:stockgame@localhost:5432/stockgame"
    cors_origins: list[str] = ["*"]
    secret_key: str = "dev-secret-change-me-in-production"
    token_expire_days: int = 30
    quote_cache_ttl_seconds: int = 300
    daily_update_hour_utc: int = 21  # after US market close
    scheduler_enabled: bool = True

    class Config:
        env_file = ".env"


settings = Settings()
