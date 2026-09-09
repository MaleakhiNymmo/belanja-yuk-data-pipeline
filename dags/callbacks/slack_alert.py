"""
=============================================================
callbacks/slack_alert.py — Airflow Failure Alerting Service
=============================================================
Menyediakan handler on_failure_callback untuk Airflow tasks.
Mendukung:
  1. Pengiriman pesan terformat ke Slack Incoming Webhook (Block Kit format).
  2. Graceful Mock Fallback: jika SLACK_WEBHOOK_URL tidak dikonfigurasi,
     payload terformat akan dicetak ke task log tanpa membuat pipeline crash.
=============================================================
"""

import json
import logging
import os

import requests

log = logging.getLogger("airflow.task")


def format_slack_failure_message(context: dict) -> dict:
    """
    Format rich Slack Block Kit payload dari execution context Airflow.
    """
    dag = context.get("dag")
    ti = context.get("task_instance")

    dag_id = dag.dag_id if dag else "unknown_dag"
    task_id = ti.task_id if ti else "unknown_task"

    # Resolusi execution date / logical date
    execution_date = context.get("ts") or str(context.get("logical_date", "N/A"))

    # Resolusi task log URL
    log_url = ti.log_url if ti and hasattr(ti, "log_url") else "http://localhost:8081"

    # Resolusi exception message
    exception = context.get("exception")
    if exception:
        error_msg = str(exception)
    else:
        error_msg = "Task encountered an error without explicit exception trace."

    # Pangkas jika pesan error terlalu panjang untuk Slack block
    if len(error_msg) > 350:
        error_msg = error_msg[:347] + "..."

    payload = {
        "text": f"🚨 [Airflow Alert] Task Failed: {dag_id}.{task_id}",
        "blocks": [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": "🚨 Airflow Pipeline Task Failure Alert",
                    "emoji": True,
                },
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*DAG ID:*\n`{dag_id}`"},
                    {"type": "mrkdwn", "text": f"*Task ID:*\n`{task_id}`"},
                    {"type": "mrkdwn", "text": f"*Logical Date:*\n{execution_date}"},
                    {
                        "type": "mrkdwn",
                        "text": "*Environment:*\n`Production / Local DWH`",
                    },
                ],
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Error Trace:*\n```{error_msg}```",
                },
            },
            {
                "type": "actions",
                "elements": [
                    {
                        "type": "button",
                        "text": {
                            "type": "plain_text",
                            "text": "🔍 Open Task Logs in Airflow",
                            "emoji": True,
                        },
                        "url": log_url,
                        "style": "danger",
                    }
                ],
            },
        ],
    }
    return payload


def slack_alert_on_failure(context: dict) -> None:
    """
    Airflow on_failure_callback function.

    Dijalankan otomatis oleh worker Airflow saat task status berubah menjadi FAILED.
    """
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    payload = format_slack_failure_message(context)

    dag_id = context.get("dag").dag_id if context.get("dag") else "unknown"
    ti = context.get("task_instance")
    task_id = ti.task_id if ti else "unknown"

    # Cetak visual ASCII notification box di log Airflow
    alert_box = (
        "\n"
        "╔══════════════════════════════════════════════════════════════════════╗\n"
        "║             🚨 AIRFLOW ON_FAILURE_CALLBACK TRIGGERED 🚨             ║\n"
        "╠══════════════════════════════════════════════════════════════════════╣\n"
        f"║  DAG ID    : {dag_id:<55}║\n"
        f"║  Task ID   : {task_id:<55}║\n"
        "║  Status    : FAILED                                                 ║\n"
        "║  Action    : Generating formatted Slack Block Kit alert payload     ║\n"
        "╚══════════════════════════════════════════════════════════════════════╝"
    )
    print(alert_box)
    print(f"Payload Preview:\n{json.dumps(payload, indent=2)}\n")

    if webhook_url and webhook_url.startswith("https://hooks.slack.com/"):
        try:
            resp = requests.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=10,
            )
            if resp.status_code == 200:
                log.info("✅ Slack alert successfully dispatched to channel!")
            else:
                log.warning(
                    f"⚠️ Slack webhook returned non-200 status: {resp.status_code} - {resp.text}"
                )
        except Exception as e:
            log.error(f"❌ Failed to deliver webhook request to Slack: {e}")
    else:
        log.info(
            "ℹ️ [SLACK ALERT MOCK MODE] SLACK_WEBHOOK_URL environment variable is not configured. "
            "Alert was simulated and logged above without throwing network errors."
        )
