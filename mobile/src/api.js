import { Platform } from "react-native";

let FileSystem = null;
if (Platform.OS !== "web") {
  try {
    FileSystem = require("expo-file-system");
  } catch {
    FileSystem = null;
  }
}

export const API_BASE = "https://stream.mandenbaoubab.com/api";
const TOKEN_FILE = `${FileSystem?.documentDirectory || ""}.auth_token`;

let authToken = null;

export function setAuthToken(token) {
  authToken = token || null;
}

export function getAuthToken() {
  return authToken;
}

export async function initAuth() {
  if (!FileSystem) return null;
  try {
    const info = await FileSystem.getInfoAsync(TOKEN_FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(TOKEN_FILE);
    const token = String(raw || "").trim();
    if (token) {
      authToken = token;
      return token;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function persistToken(token) {
  setAuthToken(token);
  if (!FileSystem) return;
  try {
    if (!token) {
      await FileSystem.deleteAsync(TOKEN_FILE, { idempotent: true });
    } else {
      await FileSystem.writeAsStringAsync(TOKEN_FILE, token);
    }
  } catch {
    /* ignore */
  }
}

function qs(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

function authError(message) {
  const err = new Error(message || "Non connecté");
  err.code = "AUTH";
  return err;
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
    // L'API renvoie 500 "Route [login] not defined." quand on appelle
    // une route authentifiée sans token valide.
    if (res.status === 401 || /route \[login\]/i.test(json.message || "")) {
      throw authError("Non connecté");
    }
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
export const searchTitles = (q, page = 1) => request(`/search${qs({ q, page })}`);

export function fetchDownloads(subjectId, { season, episode } = {}) {
  return request(`/downloads${qs({ subjectId, season, episode })}`);
}

export const fetchMe = () => request("/auth/me");

export async function storeHistory(payload) {
  return request("/history", { method: "POST", body: payload });
}

export async function login(email, password) {
  const data = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const token = data.token || data.access_token || data.user?.token;
  if (!token) throw new Error("Réponse de connexion inattendue");
  await persistToken(token);
  return data;
}

export async function logout() {
  await persistToken(null);
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

export function isSeries(item) {
  if (!item) return false;
  return item.subjectType === 2 || item.isSeries === true || Number(item.seasonCount) > 0;
}
