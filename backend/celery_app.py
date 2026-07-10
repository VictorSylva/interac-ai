import os
from config import config
from celery import Celery
# Pre-load all models to populate SQLAlchemy registry for worker
from database.models import general, workflow, chat, crm, behavior_analytics
from celery.schedules import crontab

REDIS_URL = config.REDIS_URL or "redis://localhost:6379/0"

celery_app = Celery(
    "interact_worker",
    broker=REDIS_URL,
    backend=REDIS_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
)

# Schedule periodic behavior analytics aggregation
celery_app.conf.beat_schedule = {
    "behavior-analytics-daily-aggregation": {
        "task": "behavior_analytics.run_daily_aggregation",
        "schedule": crontab(hour=0, minute=0), # Run every day at midnight
    },
    "monthly-token-refill": {
        "task": "billing.monthly_token_refill",
        "schedule": crontab(hour=1, minute=0), # Run every day at 1 AM to check renewals
    },
}

# Explicitly import the module containing tasks
celery_app.conf.update(include=[
    "services.workflow_engine", 
    "services.behavior_analytics_service", 
    "services.fulfillment_service",
    "tasks.billing_tasks"
])
