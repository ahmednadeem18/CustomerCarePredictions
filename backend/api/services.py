import requests
from django.conf import settings


class ServiceConfigError(Exception):
    pass


class ServiceUnavailableError(Exception):
    pass


class SupabaseFeedbackService:
    def __init__(self, base_url: str, api_key: str, table: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.table = table

    @classmethod
    def from_settings(cls):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise ServiceConfigError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured."
            )
        return cls(
            base_url=settings.SUPABASE_URL,
            api_key=settings.SUPABASE_SERVICE_ROLE_KEY,
            table=settings.SUPABASE_FEEDBACK_TABLE,
        )

    def save_feedback(self, payload: dict) -> dict:
        endpoint = f"{self.base_url}/rest/v1/{self.table}"
        headers = {
            "apikey": self.api_key,
            "Authorization": "Bearer " + self.api_key,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        try:
            response = requests.post(endpoint, json=payload, headers=headers, timeout=10)
        except requests.RequestException as exc:
            raise ServiceUnavailableError("Unable to reach Supabase.") from exc

        if response.status_code >= 400:
            raise ServiceUnavailableError("Supabase rejected feedback request.")

        try:
            data = response.json()
        except ValueError:
            data = None

        if isinstance(data, list) and data:
            return data[0]
        if isinstance(data, dict):
            return data
        return {}
