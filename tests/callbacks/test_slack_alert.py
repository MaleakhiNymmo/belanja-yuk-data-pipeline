"""
=============================================================
test_slack_alert.py — Unit Tests for Airflow Slack Alerting
=============================================================
Memverifikasi:
  1. Payload Slack Block Kit terformat secara valid.
  2. Mock mode aktif jika SLACK_WEBHOOK_URL tidak diset (tanpa network call).
  3. Webhook HTTP request terpanggil saat SLACK_WEBHOOK_URL diset.
  4. Network exception ditangani dengan graceful tanpa melempar fatal crash.
=============================================================
"""

import os
import sys
from unittest.mock import MagicMock, patch
import pytest

# Pastikan folder dags masuk ke sys.path untuk import callbacks
dags_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../dags"))
for p in ["/usr/local/airflow/dags", "/opt/airflow/dags", dags_path]:
    if os.path.exists(p) and p not in sys.path:
        sys.path.insert(0, p)

from callbacks.slack_alert import format_slack_failure_message, slack_alert_on_failure


@pytest.fixture
def mock_context():
    """Mock execution context dictionary yang disediakan Airflow pada runtime."""
    dag = MagicMock()
    dag.dag_id = "test_ecommerce_pipeline"

    ti = MagicMock()
    ti.task_id = "test_extract_customers"
    ti.log_url = "http://localhost:8081/dags/test_dag/grid?task_id=test_task"

    return {
        "dag": dag,
        "task_instance": ti,
        "ts": "2026-09-03T12:00:00+00:00",
        "exception": ValueError("Database connection timeout during extract step"),
    }


def test_format_slack_failure_message_structure(mock_context):
    """Pastikan Block Kit format memiliki header, fields, error trace, dan action button."""
    payload = format_slack_failure_message(mock_context)

    assert "blocks" in payload
    assert len(payload["blocks"]) == 4

    # Header block
    assert payload["blocks"][0]["type"] == "header"

    # Fields block: DAG ID & Task ID
    fields = payload["blocks"][1]["fields"]
    field_texts = [f["text"] for f in fields]
    assert any("test_ecommerce_pipeline" in t for t in field_texts)
    assert any("test_extract_customers" in t for t in field_texts)

    # Error trace block
    error_section = payload["blocks"][2]["text"]["text"]
    assert "Database connection timeout" in error_section

    # Action button block
    action_elements = payload["blocks"][3]["elements"]
    assert action_elements[0]["url"] == mock_context["task_instance"].log_url


def test_slack_alert_mock_mode_when_no_webhook(mock_context, monkeypatch, capsys):
    """Pastikan jika SLACK_WEBHOOK_URL kosong, pipeline beralih ke mock mode aman."""
    monkeypatch.delenv("SLACK_WEBHOOK_URL", raising=False)

    with patch("requests.post") as mock_post:
        slack_alert_on_failure(mock_context)
        # Tidak boleh ada network call yang keluar
        mock_post.assert_not_called()

    captured = capsys.readouterr()
    assert "AIRFLOW ON_FAILURE_CALLBACK TRIGGERED" in captured.out
    assert "test_ecommerce_pipeline" in captured.out


def test_slack_alert_dispatches_when_webhook_configured(mock_context, monkeypatch):
    """Pastikan jika webhook URL Slack valid, requests.post terpanggil dengan payload JSON."""
    test_webhook = "https://hooks.slack.com/services/T00/B00/X00"
    monkeypatch.setenv("SLACK_WEBHOOK_URL", test_webhook)

    mock_resp = MagicMock()
    mock_resp.status_code = 200

    with patch("requests.post", return_value=mock_resp) as mock_post:
        slack_alert_on_failure(mock_context)
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[0][0] == test_webhook
        assert "blocks" in call_args[1]["json"]


def test_slack_alert_graceful_on_network_error(mock_context, monkeypatch):
    """Pastikan jika webhook Slack timeout/down, worker tidak crash fatal."""
    monkeypatch.setenv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/T00/B00/X00")

    with patch("requests.post", side_effect=Exception("Connection refused")):
        # Harus selesai tanpa unhandled exception
        slack_alert_on_failure(mock_context)
