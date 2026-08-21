import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { fetchHistory, fetchHome, fetchTrending, formatBytes } from "../api";
import { colors } from "../theme";

function PosterRow({ title, items, onOpen }) {
  if (!items?.length) return null;
  return (
    <View>
      <Text style={styles.section}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.slice(0, 16).map((item) => (
          <Pressable key={String(item.subjectId)} style={styles.posterCard} onPress={() => onOpen(item)}>
            <Image source={{ uri: item.coverSmall || item.cover }} style={styles.poster} />
            {item.imdbRating ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>★ {item.imdbRating}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

export default function HomeScreen({
  query,
  setQuery,
  onSearchFocus,
  downloads,
  onOpenItem,
  onAddDownload,
  onPlay,
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hero, setHero] = useState(null);
  const [sections, setSections] = useState([]);
  const [trending, setTrending] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    let live = true;
    (async () => {
      const [homeRes, trendRes, histRes] = await Promise.allSettled([
        fetchHome(),
        fetchTrending(1),
        fetchHistory(),
      ]);
      if (!live) return;

      if (homeRes.status === "fulfilled") {
        const list = homeRes.value.sections || [];
        setSections(list);
        setHero(list[0]?.items?.[0] || null);
      } else {
        setError(homeRes.reason?.message || "Accueil indisponible");
      }

      if (trendRes.status === "fulfilled") {
        setTrending(trendRes.value.items || []);
        if (!hero && trendRes.value.items?.[0]) {
          setHero(trendRes.value.items[0]);
        }
      }
      if (histRes.status === "fulfilled") {
        const data = histRes.value;
        setHistory(data.items || data.history || []);
      }
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    );
  }

  const preview = downloads.slice(0, 2);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ImageBackground source={{ uri: hero?.cover }} style={styles.hero} imageStyle={styles.heroImg}>
        <LinearGradient
          colors={["rgba(5,5,5,0.15)", "rgba(5,5,5,0.4)", "#050505"]}
          locations={[0.15, 0.55, 1]}
          style={styles.heroFade}
        >
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onFocus={onSearchFocus}
              placeholder="Rechercher films, séries..."
              placeholderTextColor="#9A9A9A"
              style={styles.search}
            />
          </View>
          {hero ? (
            <View style={styles.heroMeta}>
              <Text style={styles.kicker}>
                {hero.typeLabel} · {hero.year} · ★ {hero.imdbRating ?? "–"}
              </Text>
              <Text style={styles.title}>{hero.displayTitle || hero.title}</Text>
              <Text style={styles.genres}>{(hero.genres || []).join(" · ")}</Text>
              <View style={styles.actions}>
                <Pressable style={styles.play} onPress={() => onPlay(hero)}>
                  <Text style={styles.playText}>Lecture  ▶</Text>
                </Pressable>
                <Pressable style={styles.info} onPress={() => onAddDownload(hero)}>
                  <Text style={styles.infoText}>Télécharger</Text>
                </Pressable>
              </View>
            </View>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : null}
        </LinearGradient>
      </ImageBackground>

      <PosterRow title="Tendances" items={trending} onOpen={onOpenItem} />
      <PosterRow title="Continuer" items={history} onOpen={onOpenItem} />
      {sections.slice(0, 4).map((section) => (
        <PosterRow key={section.title} title={section.title} items={section.items} onOpen={onOpenItem} />
      ))}

      <View style={styles.dlHead}>
        <Text style={styles.section}>Téléchargements</Text>
        <Text style={styles.dlIcon}>↓</Text>
      </View>
      {preview.length === 0 ? (
        <Text style={styles.empty}>Aucun fichier. Touche « Télécharger » sur un titre.</Text>
      ) : (
        <View style={styles.dlRow}>
          {preview.map((item) => (
            <Pressable key={item.id} style={styles.dlCard} onPress={() => onPlay(item)}>
              <Image source={{ uri: item.cover }} style={styles.dlThumb} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.dlTitle}>
                  {item.title}
                </Text>
                <Text style={styles.dlSub}>{item.quality}</Text>
                {item.status === "done" ? (
                  <Text style={styles.done}>✓  Terminé</Text>
                ) : (
                  <>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${item.progress * 100}%` }]} />
                    </View>
                    <Text style={styles.size}>
                      {formatBytes(item.size * item.progress)} / {formatBytes(item.size)}
                    </Text>
                  </>
                )}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 120 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#F87171", marginBottom: 16 },
  hero: { height: 520, width: "100%", backgroundColor: "#111" },
  heroImg: { resizeMode: "cover" },
  heroFade: { flex: 1, justifyContent: "space-between", paddingTop: 58, paddingHorizontal: 16 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.search,
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 14,
  },
  searchIcon: { color: "#C8C8C8", fontSize: 20, marginRight: 8 },
  search: { flex: 1, color: colors.text, fontSize: 16 },
  heroMeta: { paddingBottom: 8 },
  kicker: { color: "#EDEDED", fontSize: 14, marginBottom: 6 },
  title: { color: colors.text, fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  genres: { color: "#E8E8E8", fontSize: 15, marginTop: 6, marginBottom: 16 },
  actions: { flexDirection: "row", gap: 12 },
  play: { backgroundColor: colors.gold, borderRadius: 24, paddingHorizontal: 22, paddingVertical: 10 },
  playText: { color: "#1A1404", fontWeight: "700", fontSize: 15 },
  info: { borderWidth: 1.5, borderColor: colors.gold, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 10 },
  infoText: { color: colors.goldSoft, fontWeight: "600", fontSize: 15 },
  section: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 18, marginHorizontal: 16 },
  row: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  posterCard: { width: 148, height: 200 },
  poster: { width: "100%", height: "100%", borderRadius: 16, backgroundColor: "#222" },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: { color: "#F5D76E", fontSize: 12, fontWeight: "700" },
  dlHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dlIcon: { color: colors.text, fontSize: 22, marginTop: 18 },
  empty: { color: colors.dim, marginHorizontal: 16, marginTop: 10 },
  dlRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginTop: 12 },
  dlCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 8,
    flexDirection: "row",
    gap: 8,
  },
  dlThumb: { width: 40, height: 52, borderRadius: 6, backgroundColor: "#222" },
  dlTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  dlSub: { color: colors.dim, fontSize: 11, marginTop: 2 },
  done: { color: colors.green, fontSize: 12, marginTop: 6, fontWeight: "600" },
  track: { height: 4, backgroundColor: colors.track, borderRadius: 4, marginTop: 8 },
  fill: { height: 4, backgroundColor: colors.gold, borderRadius: 4 },
  size: { color: colors.dim, fontSize: 10, marginTop: 4, textAlign: "right" },
});
