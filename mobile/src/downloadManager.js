import { Platform } from "react-native";
import { fetchDownloads } from "./api";
import { ensureRangeServer, getPlayUrl, isRangeServerAvailable, registerLocalFile } from "./localRangeServer";

let FileSystem = null;
try {
  FileSystem = require("expo-file-system");
} catch {
  FileSystem = null;
}

const jobs = new Map();
const MIN_PLAY_BYTES = 256 * 1024;

export function downloadId(item) {
  return `${item.subjectId}-${item.season || 0}-${item.episode || 0}-${item.quality || "auto"}`;
}

export function getJob(id) {
  return jobs.get(id);
}

export async function resolveSource(item) {
  if (item.url) {
    return { url: item.url, quality: item.quality, size: item.size };
  }
  const pack = await fetchDownloads(item.subjectId, {
    season: item.season,
    episode: item.episode,
  });
  const best = (pack.downloads || [])[0];
  if (!best) throw new Error("Aucune source vidéo");
  return { url: best.url, quality: best.quality, size: best.size };
}

async function fileSize(path) {
  if (!FileSystem || !path) return 0;
  const info = await FileSystem.getInfoAsync(path);
  return info.exists ? info.size || 0 : 0;
}

export async function startDownload(item, onProgress) {
  const id = item.id || downloadId(item);
  const existing = jobs.get(id);
  if (existing?.status === "done" && existing.localUri) {
    onProgress?.({
      progress: 1,
      status: "done",
      localUri: existing.localUri,
      playUrl: existing.playUrl || existing.localUri,
      written: existing.size,
    });
    return existing;
  }
  if (existing?.task) {
    onProgress?.({
      progress: existing.progress,
      status: existing.status,
      playUrl: existing.playUrl,
      written: existing.written,
      url: existing.url,
    });
    return existing;
  }

  const { url, quality, size } = await resolveSource(item);
  const record = {
    id,
    ...item,
    url,
    quality,
    size: size || item.size,
    progress: 0,
    written: 0,
    status: "progress",
    localUri: null,
    playUrl: null,
  };

  if (!FileSystem || Platform.OS === "web") {
    record.playUrl = url;
    jobs.set(id, record);
    onProgress?.({ progress: 0, status: "progress", url, playUrl: url });
    return record;
  }

  const dir = `${FileSystem.documentDirectory}downloads/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const dest = `${dir}${id.replace(/[^a-zA-Z0-9._-]/g, "_")}.mp4`;
  record.dest = dest;

  const writtenNow = await fileSize(dest);
  const total = record.size || 0;
  registerLocalFile(id, {
    path: dest,
    totalSize: total,
    getWritten: () => fileSize(dest),
  });
  const serverOk = await ensureRangeServer();

  if (writtenNow > 1024 && total && writtenNow >= total - 2048) {
    record.progress = 1;
    record.status = "done";
    record.localUri = dest;
    record.playUrl = dest;
    record.written = writtenNow;
    jobs.set(id, record);
    onProgress?.({ progress: 1, status: "done", localUri: dest, playUrl: dest, written: writtenNow });
    return record;
  }

  if (serverOk && isRangeServerAvailable()) {
    record.playUrl = getPlayUrl(id);
  }

  const emit = (extra = {}) => {
    onProgress?.({
      progress: record.progress,
      status: record.status,
      written: record.written,
      playUrl: record.playUrl,
      localUri: record.localUri,
      url: record.url,
      canPlayLocal: record.written >= MIN_PLAY_BYTES || record.status === "done",
      ...extra,
    });
  };

  if (writtenNow > 0 && !total) {
    record.written = writtenNow;
  }

  const task = FileSystem.createDownloadResumable(
    url,
    dest,
    {},
    ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
      const expected = totalBytesExpectedToWrite || size || 1;
      record.size = totalBytesExpectedToWrite || record.size;
      record.written = totalBytesWritten;
      record.progress = Math.min(1, totalBytesWritten / expected);
      record.status = "progress";
      emit();
    }
  );

  record.task = task;
  jobs.set(id, record);
  emit({ progress: writtenNow && total ? writtenNow / total : 0.01 });

  task
    .downloadAsync()
    .then(async (res) => {
      record.progress = 1;
      record.status = "done";
      record.localUri = res?.uri || dest;
      record.playUrl = record.localUri;
      record.written = await fileSize(record.localUri);
      emit();
    })
    .catch((err) => {
      record.status = "error";
      record.error = err.message;
      emit({ error: err.message });
    });

  return record;
}

export function cancelDownload(id) {
  const job = jobs.get(id);
  job?.task?.pauseAsync?.().catch(() => {});
  jobs.delete(id);
}

export { MIN_PLAY_BYTES };
