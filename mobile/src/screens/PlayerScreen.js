import { Audio, Video } from "expo-av";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatBytes, storeHistory } from "../api";
import { saveWatchEntry } from "../watchHistory";
import {
  getJobsSnapshot,
  savePosition,
  startDownload,
  subscribeJobs,
} from "../downloadManager";
import { ensureRangeServer } from "../localRangeServer";
import { colors } from "../theme";
import { Icon } from "../ui";

export default function PlayerScreen({ item, onBack, onNext }) {
  const video = useRef(null);
  const insets = useSafeAreaInsets();
  const [recId, setRecId] = useState(item.id || null);
  const [playUrl, setPlayUrl] = useState(null);
  const [playMode, setPlayMode] = useState(null); // 'file' | 'range' | 'remote'
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const startedKeyRef = useRef(null);
  const pendingSeekRef = useRef(0);
  const lastSavedRef = useRef(0);
  const lastHistRef = useRef(0);

  const jobsSnapshot = useSyncExternalStore(subscribeJobs, getJobsSnapshot);
  const rec = recId ? jobsSnapshot.find((j) => j.id === recId) || null : null;

  /* ------------------------- démarrage / rattachement du job ------------------------ */

  useEffect(() => {
    let live = true;
    setError("");
    setReady(false);
    setPlayUrl(null);
    setPlayMode(null);
    startedKeyRef.current = null;

    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
          shouldDuckAndroid: true,
        }).catch(() => {});
        const record = await startDownload(item);
        if (live && record?.id) setRecId(record.id);
      } catch (e) {
        if (live) setError(e?.message || "Impossible de démarrer la lecture");
      }
    })();

    return () => {
      live = false;
      if (video.current) video.current.unloadAsync?.().catch(() => {});
      Audio.setAudioModeAsync({ playsInSilentModeIOS: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.subjectId, item.season, item.episode, item.quality]);

  /* --------------------- choix de la source + bascule range -> file:// --------------------- */

  useEffect(() => {
    if (!rec) return;
    const target = decideSource(rec);
    if (!target) return; // pas encore lisible → UI d'attente honnête
    const key = `${target.mode}:${target.url}`;
    if (startedKeyRef.current === key) return;

    let dead = false;
    (async () => {
      if (target.mode === "range") {
        const ok = await ensureRangeServer();
        if (!ok || dead) return;
      }
      const wasStreaming =
        (playMode === "range" || playMode === "remote") && target.mode === "file" && video.current;
      if (wasStreaming) {
        // garder la position lors du passage au fichier complet
        try {
          const st = await video.current.getStatusAsync();
          if (st?.isLoaded) pendingSeekRef.current = Math.max(0, st.positionMillis || 0);
        } catch {
          /* ignore */
        }
        try {
          await video.current.unloadAsync();
        } catch {
          /* ignore */
        }
      } else if (!playUrl) {
        // première ouverture : reprendre à la position sauvegardée
        pendingSeekRef.current = Math.max(pendingSeekRef.current, rec.positionMs || 0);
      }
      if (dead) return;
      startedKeyRef.current = key;
      setPlayMode(target.mode);
      setPlayUrl(target.url);
      setReady(false);
    })();
    return () => {
      dead = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec?.id, rec?.status, rec?.written, rec?.probe, rec?.playable?.url]);

  function decideSource(r) {
    if (r.status === "done" && r.localUri) return { url: r.localUri, mode: "file" };
    if (r.status === "remote" && r.remoteUrl) return { url: r.remoteUrl, mode: "remote" };
    if (r.playable) return { url: r.playable.url, mode: r.playable.mode };
    return null;
  }

  /* ------------------------------ position & fin d'épisode ------------------------------ */

  const handleStatus = useCallback(
    (st) => {
      if (!st.isLoaded) {
        if (st.error) setError(String(st.error));
        return;
      }
      if (st.didJustFinish) {
        if (recId) savePosition(recId, 0);
        onNext?.();
        return;
      }
      const now = Date.now();
      if ((st.positionMillis || 0) > 2000 && now - lastSavedRef.current > 5000) {
        lastSavedRef.current = now;
        if (recId) savePosition(recId, st.positionMillis);
        // historique serveur (auth facultative) : alimente « Continuer »
        if (now - lastHistRef.current > 10000 && st.durationMillis) {
          lastHistRef.current = now;
          const histEntry = {
            subjectId: String(item.subjectId),
            season: item.season || 0,
            episode: item.episode || 0,
            title: item.displayTitle || item.title,
            cover: item.cover || item.coverSmall || "",
            positionSeconds: Math.floor((st.positionMillis || 0) / 1000),
            durationSeconds: Math.floor((st.durationMillis || 0) / 1000),
          };
          saveWatchEntry(histEntry).catch(() => {});
          storeHistory({
            subject_id: String(item.subjectId),
            season: item.season || 0,
            episode: item.episode || 0,
            title: item.displayTitle || item.title,
            cover: item.cover || item.coverSmall || "",
            subject_id: histEntry.subjectId,
            season: histEntry.season,
            episode: histEntry.episode,
            title: histEntry.title,
            cover: histEntry.cover,
            position_seconds: histEntry.positionSeconds,
            duration_seconds: histEntry.durationSeconds,
          }).catch(() => {});
        }
      }
    },
    [onNext, recId, item]
  );

  const handleError = (e) => {
    const msg = e?.nativeEvent?.error || e?.nativeEvent?.what || null;
    setError(
      typeof msg === "string" && msg ? msg : "Lecture impossible pour le moment"
    );
    setReady(false);
  };

  async function goFullscreen() {
    try {
      await video.current?.presentFullscreenPlayerAsync();
    } catch {
      /* ignore */
    }
  }

  const label =
    rec?.season && rec?.episode
      ? `${rec.displayTitle || rec.title} · S${rec.season}E${rec.episode}`
      : rec?.displayTitle || rec?.title || item.displayTitle || item.title;

  const waitingReason = !playUrl ? waitingMessage(rec, error) : null;
  const pct = Math.round((rec?.progress || 0) * 100);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={onBack} style={styles.back} hitSlop={8}>
        <Icon name="chevron-back" size={22} color={colors.redSoft} />
        <Text style={styles.backText}>Retour</Text>
      </Pressable>
      <Text style={styles.title} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.player}>
        {playUrl ? (
          <Video
            ref={video}
            style={styles.video}
            source={{ uri: playUrl, overrideFileExtensionAndroid: "mp4" }}
            useNativeControls
            resizeMode="contain"
            shouldPlay
            progressUpdateIntervalMillis={800}
            onLoad={() => {
              setReady(true);
              if (pendingSeekRef.current > 0) {
                video.current?.setStatusAsync({ positionMillis: pendingSeekRef.current });
                pendingSeekRef.current = 0;
              }
            }}
            onPlaybackStatusUpdate={handleStatus}
            onError={handleError}
          />
        ) : (
          <View style={styles.waitBox}>
            {!error ? (
              <>
                <ActivityIndicator color={colors.red} size="small" />
                {pct > 0 ? <Text style={styles.waitPct}>{pct} %</Text> : null}
              </>
            ) : null}
            <Text style={styles.hint}>{waitingReason}</Text>
          </View>
        )}
        {playUrl && !ready && !error ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.red} size="small" />
            <Text style={styles.hint}>Mise en place de la lecture…</Text>
          </View>
        ) : null}
      </View>

      {rec ? (
        <>
          <View style={styles.dlHead}>
            <Icon
              name={
                rec.status === "done"
                  ? "checkmark-circle"
                  : rec.status === "paused"
                  ? "pause-circle"
                  : "download-outline"
              }
              size={16}
              color={rec.status === "done" ? colors.green : colors.redSoft}
            />
            <Text style={styles.dlLabel}>{downloadLabel(rec)}</Text>
            {playUrl ? (
              <Pressable onPress={goFullscreen} style={styles.fsBtn} hitSlop={6}>
                <Icon name="expand" size={18} color={colors.redSoft} />
              </Pressable>
            ) : null}
          </View>
          {rec.status !== "done" && rec.status !== "remote" ? (
            <>
              <View style={styles.track}>
                <View
                  style={[styles.fill, { width: `${Math.max(2, (rec.progress || 0) * 100)}%` }]}
                />
              </View>
              <Text style={styles.size}>
                {formatBytes(rec.written || 0)}
                {rec.size ? ` / ${formatBytes(rec.size)}` : ""} sur disque
                {rec.speed ? ` · ${formatBytes(rec.speed)}/s` : ""}
                {rec.probe === "tail"
                  ? " · moov en fin de fichier → lecture au téléchargement complet"
                  : ""}
              </Text>
            </>
          ) : null}
        </>
      ) : null}

      {onNext ? (
        <Pressable onPress={onNext} style={styles.nextBtn}>
          <Icon name="play-skip-forward" size={16} color={colors.playText} />
          <Text style={styles.nextText}>Épisode suivant</Text>
        </Pressable>
      ) : null}

      {error ? (
        <View style={styles.errRow}>
          <Icon name="alert-circle" size={16} color="#F87171" />
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

function waitingMessage(rec, error) {
  if (error) return error;
  if (!rec) return "Préparation du téléchargement…";
  if (rec.status === "paused") return "Téléchargement en pause — reprends-le depuis l’onglet Téléchargements.";
  if (rec.probe === "tail")
    return "Téléchargement… l’index vidéo (moov) est à la fin de ce fichier : la lecture démarrera quand il sera complet.";
  return `Téléchargement… lecture dès que le fichier est lisible (${Math.round(
    (rec.progress || 0) * 100
  )} %).`;
}

function downloadLabel(rec) {
  switch (rec.status) {
    case "done":
      return "Fichier complet — lecture locale";
    case "paused":
      return "Téléchargement en pause";
    case "remote":
      return "Lecture distante (web)";
    case "error":
      return rec.error || "Erreur de téléchargement";
    default:
      return "Lecture depuis les octets déjà téléchargés (aucun 2ᵉ flux distant)";
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingHorizontal: 12 },
  back: { marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 2 },
  backText: { color: colors.redSoft, fontSize: 16, fontWeight: "700" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 12, letterSpacing: -0.3 },
  player: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111",
    borderRadius: 14,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  waitPct: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  video: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    gap: 10,
  },
  waitBox: { alignItems: "center", gap: 12, paddingVertical: 40, paddingHorizontal: 16 },
  hint: { color: colors.muted, fontSize: 13, textAlign: "center" },
  dlHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 },
  dlLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  fsBtn: { paddingHorizontal: 8 },
  track: { height: 5, backgroundColor: colors.track, borderRadius: 4, marginTop: 8 },
  fill: { height: 5, backgroundColor: colors.red, borderRadius: 4 },
  size: { color: colors.dim, marginTop: 6, fontSize: 12 },
  nextBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nextText: { color: colors.playText, fontWeight: "800" },
  errRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  error: { color: "#F87171", flex: 1 },
});
