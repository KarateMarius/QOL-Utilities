// Client fuer die eigenen Serverless-Funktionen unter /api.
// Das Session-Cookie ist HttpOnly und wird vom Browser automatisch
// mitgeschickt (same-origin), es gibt hier also bewusst kein Token-Handling.

const NOT_AUTHENTICATED = Symbol("notAuthenticated");
export { NOT_AUTHENTICATED };

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 401) return NOT_AUTHENTICATED;

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    throw new Error(payload?.error || `Serverfehler (${res.status})`);
  }
  return payload;
}

// Liefert { user, plans } - oder NOT_AUTHENTICATED, wenn nicht angemeldet.
export function fetchPlans() {
  return request("/api/plans");
}

export function savePlan({ id, name, floorPlan }) {
  return request("/api/plans", {
    method: "PUT",
    body: JSON.stringify({ id, name, floorPlan }),
  });
}

export function deletePlan(id) {
  return request(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}
