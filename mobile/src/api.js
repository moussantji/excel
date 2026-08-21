export const API_BASE = "https://stream.mandenbaoubab.com/api";

let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

export function getAuthToken() {
  return authToken;
}

function qs(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

async function request(path, { method = "GET", body } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || `Erreur API ${res.status}`);
  }
  return json.data ?? json;
}

export const fetchHome = () => request("/home");
export const fetchTrending = (page = 1) => request(`/trending${qs({ page })}`);
export const fetchHistory = () => request("/history");
export const fetchCategory = (params = {}) => request(`/category${qs(params)}`);
export const fetchDetail = (subjectId) => request(`/detail${qs({ subjectId })}`);
export const fetchItem = (subjectId) => request(`/item${qs({ subjectId })}`);
export const searchTitles = (q) => request(`/search${qs({ q })}`);

export function fetchDownloads(subjectId, { season, episode } = {}) {
  return request(`/downloads${qs({ subjectId, season, episode })}`);
}

export const fetchMe = () => request("/auth/me");

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const token = data.token || data.access_token || data.user?.token;
  if (token) setAuthToken(token);
  return data;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  const units = ["o", "Ko", "Mo", "Go"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
