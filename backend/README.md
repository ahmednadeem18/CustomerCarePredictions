# Django backend (Phase 1 foundation)

This backend now runs as a Django API foundation for the customer-care system.

## Completed in this phase

- Django project scaffold under `backend/` with `api` app and URL routing.
- Endpoints:
  - `GET /health`
  - `POST /predict`
  - `POST /feedback`
- Structured JSON validation/error responses.
- Environment-driven configuration for CORS, Supabase, and future Hugging Face active/candidate placeholders.
- Serverless deployment entrypoints (`config/wsgi.py`, `config/asgi.py`) and `vercel.json`.
- Basic endpoint tests for health and predict/feedback validation paths.

## Not completed yet (Phase 2)

- Dual Hugging Face active/candidate inference routing.
- Candidate training/evaluation/promotion workflow.

## Local run

```bash
cd /home/runner/work/CustomerCarePredictions/CustomerCarePredictions/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py test api
python manage.py runserver
```

## Endpoint examples

### Health

```bash
curl -X GET http://127.0.0.1:8000/health
```

### Predict

```bash
curl -X POST http://127.0.0.1:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"I cannot login to my account"}'
```

### Feedback

```bash
curl -X POST http://127.0.0.1:8000/feedback \
  -H "Content-Type: application/json" \
  -d '{"text":"I was charged twice","label":"billing","metadata":{"ticket_id":"123"}}'
```
