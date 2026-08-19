import json
from typing import Any

from django.conf import settings
from django.db import connection
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .services import ServiceConfigError, ServiceUnavailableError, SupabaseFeedbackService


def error_response(
    code: str, message: str, status_code: int, details: dict[str, Any] | None = None
) -> JsonResponse:
    payload: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        payload["error"]["details"] = details
    return JsonResponse(payload, status=status_code)


def parse_json(request: HttpRequest) -> tuple[dict[str, Any] | None, JsonResponse | None]:
    try:
        body = request.body.decode("utf-8") if request.body else "{}"
        parsed = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None, error_response(
            code="invalid_json",
            message="Request body must be valid JSON.",
            status_code=400,
        )
    if not isinstance(parsed, dict):
        return None, error_response(
            code="invalid_payload",
            message="JSON payload must be an object.",
            status_code=400,
        )
    return parsed, None


@require_GET
def health(request: HttpRequest) -> JsonResponse:
    db_ok = True
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        db_ok = False

    supabase_configured = bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY)
    hf_active_configured = bool(settings.HF_ACTIVE_MODEL_REPO)
    hf_candidate_configured = bool(settings.HF_CANDIDATE_MODEL_REPO)
    hf_token_configured = bool(settings.HF_API_TOKEN)

    return JsonResponse(
        {
            "status": "ok" if db_ok else "degraded",
            "checks": {
                "django": "ok",
                "database": "ok" if db_ok else "error",
                "supabase_configured": supabase_configured,
                "hf_placeholders": {
                    "active_model": hf_active_configured,
                    "candidate_model": hf_candidate_configured,
                    "api_token": hf_token_configured,
                },
            },
        }
    )


@csrf_exempt
@require_POST
def predict(request: HttpRequest) -> JsonResponse:
    payload, error = parse_json(request)
    if error:
        return error

    text = payload.get("text")
    if not isinstance(text, str) or not text.strip():
        return error_response(
            code="validation_error",
            message="`text` is required and must be a non-empty string.",
            status_code=400,
        )

    normalized_text = text.strip().lower()
    label = "general_support"
    confidence = 0.5
    if any(keyword in normalized_text for keyword in ["bill", "payment", "invoice"]):
        label = "billing"
        confidence = 0.7
    elif any(keyword in normalized_text for keyword in ["login", "password", "account"]):
        label = "account_access"
        confidence = 0.72

    return JsonResponse(
        {
            "prediction": {
                "label": label,
                "confidence": confidence,
                "routing": "active",
                "model_ref": settings.HF_ACTIVE_MODEL_REPO or "placeholder-active-model",
            },
            "input": {"text": text.strip()},
        }
    )


@csrf_exempt
@require_POST
def feedback(request: HttpRequest) -> JsonResponse:
    payload, error = parse_json(request)
    if error:
        return error

    text = payload.get("text")
    label = payload.get("label")

    if not isinstance(text, str) or not text.strip():
        return error_response(
            code="validation_error",
            message="`text` is required and must be a non-empty string.",
            status_code=400,
        )
    if not isinstance(label, str) or not label.strip():
        return error_response(
            code="validation_error",
            message="`label` is required and must be a non-empty string.",
            status_code=400,
        )

    feedback_record = {
        "text": text.strip(),
        "label": label.strip(),
        "metadata": payload.get("metadata", {}),
    }

    try:
        service = SupabaseFeedbackService.from_settings()
        stored = service.save_feedback(feedback_record)
    except ServiceConfigError:
        return error_response(
            code="configuration_error",
            message="Feedback storage is not configured on the server.",
            status_code=503,
        )
    except ServiceUnavailableError:
        return error_response(
            code="dependency_error",
            message="Feedback storage dependency is unavailable.",
            status_code=502,
        )

    return JsonResponse(
        {
            "status": "accepted",
            "feedback": {
                "text": feedback_record["text"],
                "label": feedback_record["label"],
                "id": stored.get("id"),
            },
            "notes": "Phase 2 will connect this feedback to active/candidate retraining flow.",
        },
        status=201,
    )
