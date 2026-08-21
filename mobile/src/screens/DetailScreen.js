import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { fetchDetail, fetchDownloads, formatBytes } from "../api";
import { colors } from "../theme";

export default function DetailScreen({ item, onBack, onAddDownload, onOpenItem, onPlay }) {
  const [pack, setPack] = useState(null);
  const [files, setFiles] = useState([]);
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const detail = pack?.item || item;
  const seasons = pack?.seasons || [];
  const current = seasons.find((s) => s.season === season) || seasons[0];

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = await fetchDetail(item.subjectId);
        if (!live) return;
        setPack(data);
        const first = data.seasons?.[0];
        if (first) {
          setSeason(first.season);
          setEpisode(first.episodes?.[0] || 1);
        }
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [item.subjectId]);

  useEffect(() => {
    if (!item.subjectId) return;
    let live = true;
    (async () => {
      try {
        const data = await fetchDownloads(item.subjectId, {
          season: pack?.isSeries ? season : undefined,
          episode: pack?.isSeries ? episode : undefined,
        });
        if (live) setFiles(data.downloads || []);
      } catch {
        if (live) setFiles([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [item.subjectId, season, episode, pack?.isSeries]);

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={{ paddingBottom: 120 }}>
      <Pressable onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>‹ Retour</Text>
      </Pressable>
      <Image source={{ uri: detail.cover || detail.coverSmall }} style={styles.cover} />
      <Text style={styles.title}>{detail.displayTitle || detail.title}</Text>
      <Text style={styles.meta}>
        {detail.typeLabel} · {detail.year} · ★ {detail.imdbRating ?? "–"}
      </Text>
      <Text style={styles.genres}>{(detail.genres || []).join(" · ")}</Text>
      {detail.description ? <Text style={styles.desc}>{detail.description}</Text> : null}
      <Pressable
        style={styles.playNow}
        onPress={() =>
          onPlay({
            ...detail,
            season: pack?.isSeries ? season : undefined,
            episode: pack?.isSeries ? episode : undefined,
            url: files[0]?.url,
            quality: files[0]?.quality,
            size: files[0]?.size,
          })
        }
      >
        <Text style={styles.playNowText}>Lecture + téléchargement  ▶</Text>
      </Pressable>

      {loading ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {seasons.length ? (
        <>
          <Text style={styles.h2}>Saisons</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {seasons.map((s) => (
              <Pressable
                key={s.season}
                onPress={() => {
                  setSeason(s.season);
                  setEpisode(s.episodes?.[0] || 1);
                }}
                style={[styles.chip, season === s.season && styles.chipOn]}
              >
                <Text style={[styles.chipText, season === s.season && styles.chipTextOn]}>S{s.season}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.h2}>Épisodes</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {(current?.episodes || []).map((ep) => (
              <Pressable
                key={ep}
                onPress={() => setEpisode(ep)}
                style={[styles.chip, episode === ep && styles.chipOn]}
              >
                <Text style={[styles.chipText, episode === ep && styles.chipTextOn]}>E{ep}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={styles.h2}>Qualités {pack?.isSeries ? `· S${season}E${episode}` : ""}</Text>
      {files.map((file) => (
        <View key={file.quality} style={styles.file}>
          <View>
            <Text style={styles.q}>{file.quality}</Text>
            <Text style={styles.size}>{formatBytes(file.size)}</Text>
          </View>
          <View style={styles.fileBtns}>
            <Pressable
              style={styles.btn}
              onPress={() =>
                onPlay({
                  ...detail,
                  quality: file.quality,
                  size: file.size,
                  url: file.url,
                  season,
                  episode,
                })
              }
            >
              <Text style={styles.btnText}>Jouer</Text>
            </Pressable>
            <Pressable
              style={styles.btnGhost}
              onPress={() =>
                onAddDownload({
                  ...detail,
                  quality: file.quality,
                  size: file.size,
                  url: file.url,
                  season,
                  episode,
                })
              }
            >
              <Text style={styles.btnGhostText}>DL</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {pack?.cast?.length ? (
        <>
          <Text style={styles.h2}>Casting</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {pack.cast.slice(0, 12).map((actor) => (
              <View key={`${actor.name}-${actor.character}`} style={styles.actor}>
                {actor.avatar ? <Image source={{ uri: actor.avatar }} style={styles.avatar} /> : null}
                <Text numberOfLines={1} style={styles.actorName}>
                  {actor.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      {pack?.recommendations?.length ? (
        <>
          <Text style={styles.h2}>Recommandés</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {pack.recommendations.slice(0, 12).map((rec) => (
              <Pressable key={String(rec.subjectId)} onPress={() => onOpenItem(rec)}>
                <Image source={{ uri: rec.coverSmall || rec.cover }} style={styles.rec} />
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: 54, paddingHorizontal: 16 },
  back: { marginBottom: 12 },
  backText: { color: colors.goldSoft, fontSize: 16 },
  cover: { width: "100%", height: 220, borderRadius: 16, backgroundColor: "#222" },
  title: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: 14 },
  meta: { color: colors.muted, marginTop: 6 },
  genres: { color: colors.muted, marginTop: 4 },
  desc: { color: "#D4D4D4", marginTop: 12, lineHeight: 20 },
  h2: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 24, marginBottom: 10 },
  chips: { gap: 8, paddingRight: 8 },
  chip: {
    borderWidth: 1,
    borderColor: "#3A3A3A",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.muted, fontWeight: "700" },
  chipTextOn: { color: "#1A1404" },
  file: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  q: { color: colors.text, fontWeight: "700" },
  size: { color: colors.dim, marginTop: 4 },
  playNow: {
    marginTop: 16,
    backgroundColor: colors.gold,
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 12,
  },
  playNowText: { color: "#1A1404", fontWeight: "800", fontSize: 16 },
  fileBtns: { flexDirection: "row", gap: 8 },
  btn: { backgroundColor: colors.gold, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: "#1A1404", fontWeight: "700" },
  btnGhost: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  btnGhostText: { color: colors.goldSoft, fontWeight: "700" },
  error: { color: "#F87171", marginTop: 16 },
  actor: { width: 72, alignItems: "center" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#222" },
  actorName: { color: colors.muted, fontSize: 11, marginTop: 6, textAlign: "center" },
  rec: { width: 110, height: 150, borderRadius: 12, backgroundColor: "#222" },
});
