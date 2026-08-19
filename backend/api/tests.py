from unittest.mock import patch

from django.test import TestCase


class ApiEndpointsTests(TestCase):
    def test_health_returns_json(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("status", data)
        self.assertIn("checks", data)
        self.assertIn("database", data["checks"])

    def test_predict_validation_error_when_text_missing(self):
        response = self.client.post(
            "/predict",
            data={"other": "value"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")

    @patch("api.views.SupabaseFeedbackService.from_settings")
    def test_feedback_validation_error_when_label_missing(self, _from_settings):
        response = self.client.post(
            "/feedback",
            data={"text": "hello"},
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "validation_error")

    @patch("api.views.SupabaseFeedbackService.from_settings")
    def test_feedback_accepts_valid_payload(self, from_settings):
        service = from_settings.return_value
        service.save_feedback.return_value = {"id": 123}

        response = self.client.post(
            "/feedback",
            data={"text": "Need refund", "label": "billing"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["status"], "accepted")
        self.assertEqual(body["feedback"]["id"], 123)
