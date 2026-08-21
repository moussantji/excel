const PORT = 18765;
let server = null;
let TcpSocket = null;

try {
  TcpSocket = require("react-native-tcp-socket");
} catch {
  TcpSocket = null;
}

const files = new Map();

export function registerLocalFile(id, { path, totalSize, getWritten }) {
  files.set(id, { path, totalSize: totalSize || 0, getWritten });
}

export function getPlayUrl(id) {
  return `http://127.0.0.1:${PORT}/${encodeURIComponent(id)}`;
}

export function isRangeServerAvailable() {
  return Boolean(TcpSocket);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitWritten(entry, need, timeoutMs = 20000) {
  const start = Date.now();
  let written = (await entry.getWritten()) || 0;
  while (written < need && Date.now() - start < timeoutMs) {
    await wait(200);
    written = (await entry.getWritten()) || 0;
    if (entry.totalSize && written >= entry.totalSize) break;
  }
  return written;
}

function parseRequest(raw) {
  const [head] = raw.split("\r\n\r\n");
  const lines = head.split("\r\n");
  const [method, path] = (lines[0] || "").split(" ");
  const headers = {};
  for (const line of lines.slice(1)) {
    const i = line.indexOf(":");
    if (i > 0) headers[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }
  return { method, path, headers };
}

function decodeBase64(b64) {
  const atobFn = global.atob;
  if (!atobFn) return new Uint8Array();
  const bin = atobFn(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function readSlice(path, start, length) {
  const FileSystem = require("expo-file-system");
  const b64 = await FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
    position: start,
    length,
  });
  return decodeBase64(b64);
}

async function handleSocket(socket) {
  let buf = "";
  socket.on("data", async (data) => {
    buf += data.toString();
    if (!buf.includes("\r\n\r\n")) return;
    const req = parseRequest(buf);
    buf = "";
    try {
      await serve(socket, req);
    } catch {
      try {
        socket.write("HTTP/1.1 500 Internal Server Error\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
      } catch {
        /* ignore */
      }
      socket.destroy();
    }
  });
}

async function serve(socket, req) {
  const id = decodeURIComponent((req.path || "/").replace(/^\//, "").split("?")[0]);
  const entry = files.get(id);
  if (!entry) {
    socket.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const total = entry.totalSize || (await entry.getWritten()) || 0;
  const range = req.headers.range;
  let start = 0;
  let end = total > 0 ? total - 1 : 0;

  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    if (m) {
      if (m[1]) start = parseInt(m[1], 10);
      if (m[2]) end = parseInt(m[2], 10);
    }
  }

  let written = await waitWritten(entry, start + 1);
  if (written <= start) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\nRetry-After: 1\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  if (end >= written) {
    written = await waitWritten(entry, Math.min(end + 1, start + 512 * 1024));
    end = Math.min(end, written - 1);
  }

  const length = Math.max(0, end - start + 1);
  const knownTotal = entry.totalSize || written;
  const head =
    `HTTP/1.1 206 Partial Content\r\n` +
    `Content-Type: video/mp4\r\n` +
    `Accept-Ranges: bytes\r\n` +
    `Content-Range: bytes ${start}-${end}/${knownTotal}\r\n` +
    `Content-Length: ${length}\r\n` +
    `Connection: close\r\n\r\n`;
  socket.write(head);

  const chunk = 64 * 1024;
  let offset = start;
  while (offset <= end) {
    const avail = await waitWritten(entry, offset + 1);
    if (avail <= offset) break;
    const take = Math.min(chunk, end - offset + 1, avail - offset);
    const bytes = await readSlice(entry.path, offset, take);
    socket.write(bytes);
    offset += take;
  }
  socket.destroy();
}

export async function ensureRangeServer() {
  if (!TcpSocket) return false;
  if (server) return true;
  return new Promise((resolve) => {
    try {
      server = TcpSocket.createServer(handleSocket);
      server.listen({ port: PORT, host: "127.0.0.1" }, () => resolve(true));
      server.on("error", () => {
        server = null;
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}
