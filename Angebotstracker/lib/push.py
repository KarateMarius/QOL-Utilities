"""Web Push delivery via VAPID.

Subscriptions live in the KV store; dead ones (410/404 from the push service)
are pruned automatically so the list does not grow stale.
"""
from __future__ import annotations

import asyncio
import json
import os

from pywebpush import WebPushException, webpush

from . import storage

SUBSCRIPTIONS_KEY = "push:subscriptions"


def vapid_public_key() -> str:
    return os.getenv("VAPID_PUBLIC_KEY", "")


def _vapid_claims() -> dict[str, str]:
    return {"sub": os.getenv("VAPID_SUBJECT", "mailto:admin@example.com")}


def is_configured() -> bool:
    return bool(os.getenv("VAPID_PUBLIC_KEY") and os.getenv("VAPID_PRIVATE_KEY"))


async def list_subscriptions() -> list[dict]:
    return await storage.get(SUBSCRIPTIONS_KEY, []) or []


def _endpoint(subscription: dict) -> str:
    return subscription.get("endpoint", "")


async def add_subscription(subscription: dict) -> int:
    subscriptions = await list_subscriptions()
    endpoint = _endpoint(subscription)
    subscriptions = [s for s in subscriptions if _endpoint(s) != endpoint]
    subscriptions.append(subscription)
    await storage.set(SUBSCRIPTIONS_KEY, subscriptions)
    return len(subscriptions)


async def remove_subscription(endpoint: str) -> int:
    subscriptions = await list_subscriptions()
    remaining = [s for s in subscriptions if _endpoint(s) != endpoint]
    await storage.set(SUBSCRIPTIONS_KEY, remaining)
    return len(remaining)


def _send_blocking(subscription: dict, payload: dict) -> tuple[bool, int]:
    """Returns (delivered, http_status). Runs in a thread — pywebpush is sync."""
    try:
        webpush(
            subscription_info=subscription,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=os.getenv("VAPID_PRIVATE_KEY", ""),
            vapid_claims=_vapid_claims(),
            ttl=60 * 60 * 12,
        )
        return True, 201
    except WebPushException as e:
        status = getattr(e.response, "status_code", 0) or 0
        print(f"[push] failed ({status}): {e}")
        return False, status
    except Exception as e:
        print(f"[push] unexpected error: {e}")
        return False, 0


async def send_to_all(payload: dict) -> dict:
    """Push to every stored subscription and drop the expired ones."""
    if not is_configured():
        return {"sent": 0, "failed": 0, "error": "VAPID keys not configured"}

    subscriptions = await list_subscriptions()
    if not subscriptions:
        return {"sent": 0, "failed": 0, "error": "no subscriptions"}

    results = await asyncio.gather(
        *(asyncio.to_thread(_send_blocking, sub, payload) for sub in subscriptions)
    )

    alive: list[dict] = []
    sent = failed = 0
    for subscription, (delivered, status) in zip(subscriptions, results):
        if delivered:
            sent += 1
            alive.append(subscription)
        else:
            failed += 1
            # 404/410 mean the browser dropped the subscription for good.
            if status not in (404, 410):
                alive.append(subscription)

    if len(alive) != len(subscriptions):
        await storage.set(SUBSCRIPTIONS_KEY, alive)

    return {"sent": sent, "failed": failed}
