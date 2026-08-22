import { API_URL } from "../config";

function getToken() {
  return localStorage.getItem("treasury_token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });

  if (res.status === 401) {
    localStorage.removeItem("treasury_token");
    localStorage.removeItem("treasury_user");
    window.location.reload();
    throw new Error("Session expired, please log in again");
  }

  if (!res.ok) {
  const body = await res.json().catch(() => ({}));
  throw new Error(body.detail || body.error || `Request failed: ${res.status}`);
}
  return res.json();
}

export const api = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: "POST", body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: "DELETE" }),
};


