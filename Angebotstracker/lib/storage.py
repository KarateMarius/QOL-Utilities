"""Key/value storage.

On Vercel there is no writable filesystem, so state lives in Upstash Redis
(reached over its REST API — no extra pip dependency needed).
Locally, when the Upstash env vars are missing, everything falls back to a
JSON file so the app runs without any cloud setup.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import httpx

LOCAL_STORE = Path(__file__).resolve().parent.parent / ".local-store.json"


def _rest_config() -> tuple[str, str] | None:
    """Upstash credentials. The Vercel integration sets the KV_* names."""
    url = os.getenv("KV_REST_API_URL") or os.getenv("UPSTASH_REDIS_REST_URL")
    token = os.getenv("KV_REST_API_TOKEN") or os.getenv("UPSTASH_REDIS_REST_TOKEN")
    if url and token:
        return url.rstrip("/"), token
    return None


def is_remote() -> bool:
    return _rest_config() is not None


# ── local file fallback ───────────────────────────────────────────────────────

def _read_local() -> dict[str, Any]:
    if not LOCAL_STORE.exists():
        return {}
    try:
        return json.loads(LOCAL_STORE.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"[storage] local read failed: {e}")
        return {}


def _write_local(data: dict[str, Any]) -> None:
    try:
        LOCAL_STORE.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[storage] local write failed: {e}")


# ── public API ────────────────────────────────────────────────────────────────

async def get(key: str, default: Any = None) -> Any:
    cfg = _rest_config()
    if not cfg:
        return _read_local().get(key, default)

    url, token = cfg
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{url}/get/{key}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
        if resp.status_code != 200:
            print(f"[storage] get {key} -> HTTP {resp.status_code}")
            return default
        raw = resp.json().get("result")
        if raw is None:
            return default
        return json.loads(raw)
    except Exception as e:
        print(f"[storage] get {key} failed: {e}")
        return default


async def set(key: str, value: Any) -> bool:
    cfg = _rest_config()
    if not cfg:
        data = _read_local()
        data[key] = value
        _write_local(data)
        return True

    url, token = cfg
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{url}/set/{key}",
                headers={"Authorization": f"Bearer {token}"},
                content=json.dumps(value, ensure_ascii=False).encode("utf-8"),
                timeout=15.0,
            )
        if resp.status_code != 200:
            print(f"[storage] set {key} -> HTTP {resp.status_code}: {resp.text[:200]}")
            return False
        return True
    except Exception as e:
        print(f"[storage] set {key} failed: {e}")
        return False


async def delete(key: str) -> bool:
    cfg = _rest_config()
    if not cfg:
        data = _read_local()
        data.pop(key, None)
        _write_local(data)
        return True

    url, token = cfg
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{url}/del/{key}",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
        return resp.status_code == 200
    except Exception as e:
        print(f"[storage] delete {key} failed: {e}")
        return False
