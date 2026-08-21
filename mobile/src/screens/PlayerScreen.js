import { Video } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBytes } from "../api";
import { downloadId, MIN_PLAY_BYTES, startDownload } from "../downloadManager";
import { colors } from "../theme";

export default function PlayerScreen({ item, onBack, onDownloadUpdate }) {
  const video = useRef(null);
  const [playUrl, setPlayUrl] = useState(null);
  const [progress, setProgress] = useState(item.progress || 0);
  const [written, setWritten] = useState(0);
  const [status, setStatus] = useState(item.status || "progress");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    let live = true;
    startedRef.current = false;
    (async () => {
      try {
        const rec = await startDownload(item, (evt) => {
          if (!live) return;
          setProgress(evt.progress || 0);
          setStatus(evt.status);
          setWritten(evt.written || 0);
          onDownloadUpdate?.({
            id: item.id || downloadId(item),
            progress: evt.progress || 0,
            status: evt.status,
            localUri: evt.localUri,
          });
          const enough = evt.status === "done" || (evt.written || 0) >= MIN_PLAY_BYTES;
          if (!startedRef.current && evt.playUrl && enough) {
            startedRef.current = true;
            setPlayUrl(evt.status === "done" && evt.localUri ? evt.localUri : evt.playUrl);
          }
        });
        if (!live) return;
        onDownloadUpdate?.({
          id: rec.id,
          title: rec.displayTitle || rec.title,
          cover: rec.coverSmall || rec.cover,
          quality: rec.quality,
          size: rec.size,
          url: rec.url,
          subjectId: rec.subjectId,
          season: rec.season,
          episode: rec.episode,
          progress: rec.progress,
          status: rec.status,
          localUri: rec.localUri,
        });
        if (!startedRef.current && rec.playUrl) {
          if (rec.status === "done" || rec.written >= MIN_PLAY_BYTES || rec.playUrl.startsWith("http://127.0.0.1")) {
            startedRef.current = true;
            setPlayUrl(rec.status === "done" && rec.localUri ? rec.localUri : rec.playUrl);
          }
        }
      } catch (e) {
        if (live) setError(e.message);
      }
    })();
    return () => {
      live = false;
    };
  }, [item.subjectId, item.season, item.episode, item.quality]);

  const label =
    item.season && item.episode
      ? `${item.displayTitle || item.title} · S${item.season}E${item.episode}`
      : item.displayTitle || item.title;

  const waitingFile = !playUrl;

  return (
    <View style={styles.root}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Retour</Text>
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
            progressUpdateIntervalMillis={500}
            onLoad={() => setReady(true)}
            onError={() => setError("Lecture du fichier local impossible pour l’instant")}
          />
        ) : (
          <ActivityIndicator color={colors.gold} />
        )}
        {(waitingFile || (playUrl && !ready)) && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.hint}>
              {waitingFile
                ? "Réception des premières données…"
                : "Lecture des parties déjà téléchargées"}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.dlLabel}>
        {status === "done"
          ? "Fichier complet — lecture locale"
          : "Lecture du fichier en cours d’écriture (pas de 2e stream)"}
        {item.quality ? ` · ${item.quality}` : ""}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, progress * 100)}%` }]} />
      </View>
      <Text style={styles.size}>
        {formatBytes(written || (item.size || 0) * progress)}
        {item.size ? ` / ${formatBytes(item.size)}` : ""} déjà sur disque
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 52, paddingHorizontal: 12 },
  back: { marginBottom: 8 },
  backText: { color: colors.goldSoft, fontSize: 16 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 12 },
  player: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#111",
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  video: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  hint: { color: colors.muted, marginTop: 10, fontSize: 13, textAlign: "center", paddingHorizontal: 16 },
  dlLabel: { color: colors.muted, marginTop: 16, fontSize: 13 },
  track: { height: 5, backgroundColor: colors.track, borderRadius: 4, marginTop: 8 },
  fill: { height: 5, backgroundColor: colors.gold, borderRadius: 4 },
  size: { color: colors.dim, marginTop: 6, fontSize: 12 },
  error: { color: "#F87171", marginTop: 12 },
});
