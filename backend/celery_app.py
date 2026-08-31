import os

from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "podclip_worker",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker", "tasks.analyze", "tasks.generate", "tasks.sweeper"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_time_limit=600,
    task_soft_time_limit=480,
    beat_schedule={
        "sweep-stale-jobs": {
            "task": "tasks.sweeper.sweep_stale_jobs",
            "schedule": 300.0,  # every 5 min
        }
    },
)
