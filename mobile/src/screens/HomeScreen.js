import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchCategory,
  fetchHistory,
  fetchHome,
  fetchTrending,
  formatBytes,
  isSeries,
} from "../api";
import { colors } from "../theme";
import { useJobs } from "../useJobs";
import { Icon, ImageWithFallback, SectionTitle } from "../ui";

const SCREEN_W = Dimensions.get("window").width;
const GAP = 8;
const CELL_W = (SCREEN_W - 32 - GAP * 2) / 3;
const CARDS_W = SCREEN_W - 110; // bannière centrale + aper latéraux

const TABS = [
  { id: "trend", label: "Tendance" },
  { id: "series", label: "Séries TV", tab: "series" },
  { id: "film", label: "Film", tab: "film" },
  { id: "animation", label: "Animation", tab: "animation" },
];

const YEAR_BUCKETS = [
  { label: "Tous", test: () => true },
  { label: "2020s", test: (it) => it.year >= 2020 },
  { label: "2010s", test: (it) => it.year >= 2010 && it.year < 2020 },
  { label: "2000s", test: (it) => it.year >= 2000 && it.year < 2010 },
  { label: "1990s", test: (it) => it.year >= 1990 && it.year < 2000 },
  { label: "Autre", test: (it) => it.year < 1990 || !it.year },
];

const AUDIO = [
  { label: "Tous", test: () => true },
  { label: "Doublage français", test: (it) => Boolean(it.french) },
  { label: "Doublage anglais", test: (it) => Boolean(it.english) },
];

const SORTS = [
  { id: "rec", label: "Pour toi" },
  { id: "hot", label: "Le plus chaud" },
  { id: "new", label: "Dernier" },
  { id: "rate", label: "Notation" },
];

function Chip({ label, on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <Text style={[styles.chipTxt, on && styles.chipTxtOn]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function ChipRow({ items, active, onPick }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
    >
      {items.map((label) => (
        <Chip key={label} label={label} on={active === label} onPress={() => onPick(label)} />
      ))}
    </ScrollView>
  );
}

function Grid3({ items, onOpen }) {
  return (
    <View style={styles.grid}>
      {items.map((item, i) => (
        <Pressable
          key={`${item.subjectId}-${i}`}
          style={styles.cell}
          onPress={() => onOpen(item)}
        >
          <View>
            <ImageWithFallback
              source={{ uri: item.coverSmall || item.cover }}
              style={styles.cellImg}
              iconSize={20}
            />
            {item.imdbRating ? (
              <View style={styles.cellBadge}>
                <Icon name="star" size={10} color={colors.redSoft} />
                <Text style={styles.cellBadgeTxt}>{item.imdbRating}</Text>
              </View>
            ) : null}
            {item.french ? (
              <View style={styles.cellVf}>
                <Text style={styles.cellVfTxt}>V.F.</Text>
              </View>
            ) : null}
          </View>
          <Text numberOfLines={2} style={styles.cellTitle}>
            {item.displayTitle || item.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LandCard({ item, onPress }) {
  return (
    <Pressable style={styles.landCard} onPress={onPress}>
      <View style={styles.landThumbWrap}>
        <ImageWithFallback
          source={{ uri: item.coverSmall || item.cover }}
          style={styles.landThumb}
          iconSize={18}
        />
        {item.imdbRating ? (
          <View style={styles.cellBadge}>
            <Icon name="star" size={10} color={colors.redSoft} />
            <Text style={styles.cellBadgeTxt}>{item.imdbRating}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={styles.landTitle}>
        {item.displayTitle || item.title}
      </Text>
    </Pressable>
  );
}

export default function HomeScreen({ onOpenItem, onPlay, onOpenFiles, onOpenSearch }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("trend");
  const [hero, setHero] = useState(null);
  const [sections, setSections] = useState([]);
  const [trending, setTrending] = useState([]);
  const [catItems, setCatItems] = useState([]);
  const [catPage, setCatPage] = useState(1);
  const [catMore, setCatMore] = useState(false);
  const [catLoading, setCatLoading] = useState(false);
  const [genre, setGenre] = useState("Tous");
  const [yearB, setYearB] = useState("Tous");
  const [audio, setAudio] = useState("Tous");
  const [sort, setSort] = useState("rec");
  const jobs = useJobs();
  const insets = useSafeAreaInsets();
  const loadedTabs = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [homeRes, trendRes] = await Promise.allSettled([fetchHome(), fetchTrending(1)]);
    if (homeRes.status === "fulfilled") {
      const list = homeRes.value.sections || [];
      setSections(list);
      setHero(list[0]?.items?.[0] || null);
    } else {
      setError(homeRes.reason?.message || "Accueil indisponible");
    }
    if (trendRes.status === "fulfilled") {
      const items = trendRes.value.items || [];
      setTrending(items);
      setHero((h) => h || items[0] || null);
    }
    setLoading(false);
  }, []);

  const loadCat = useCallback(async (tabDef, page = 1, append = false) => {
    setCatLoading(true);
    try {
      const data = await fetchCategory({ tab: tabDef.tab, page });
      const items = data.items || [];
      setCatItems((prev) => {
        if (!append) return items;
        const seen = new Set(prev.map((x) => String(x.subjectId)));
        return [...prev, ...items.filter((m) => !seen.has(String(m.subjectId)))];
      });
      setCatPage(page);
      setCatMore(items.length > 0);
      loadedTabs.current[tabDef.id] = true;
    } catch (e) {
      if (!append) setError(e.message);
      setCatMore(false);
    } finally {
      setCatLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const def = TABS.find((t) => t.id === tab);
    if (def?.tab && !loadedTabs.current[def.id]) {
      setGenre("Tous");
      setYearB("Tous");
      setAudio("Tous");
      setSort("rec");
      loadCat(def);
    }
  }, [tab, loadCat]);

  const genres = useMemo(() => {
    const count = new Map();
    for (const it of catItems) {
      for (const g of it.genres || []) count.set(g, (count.get(g) || 0) + 1);
    }
    return ["Tous", ...Array.from(count.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([g]) => g)];
  }, [catItems]);

  const filtered = useMemo(() => {
    if (tab === "trend") return [];
    const gTest = (it) => genre === "Tous" || (it.genres || []).includes(genre);
    const yTest = YEAR_BUCKETS.find((b) => b.label === yearB)?.test || (() => true);
    const aTest = AUDIO.find((a) => a.label === audio)?.test || (() => true);
    let out = catItems.filter((it) => gTest(it) && yTest(it) && aTest(it));
    if (sort === "rate") out = [...out].sort((a, b) => (b.imdbRating || 0) - (a.imdbRating || 0));
    if (sort === "new") out = [...out].sort((a, b) => (b.year || 0) - (a.year || 0));
    if (sort === "hot")
      out = [...out].sort(
        (a, b) => (b.imdbRating || 0) * (b.seasonCount ? 1.1 : 1) - (a.imdbRating || 0) * (a.seasonCount ? 1.1 : 1)
      );
    return out;
  }, [tab, catItems, genre, yearB, audio, sort]);

  if (loading && !trending.length && !sections.length) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  const heroTitle = hero?.displayTitle || hero?.title || "Manden Stream";
  const def = TABS.find((t) => t.id === tab);
  const preview = jobs.slice(0, 2);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      {/* barre du haut : titre en vedette + mini affiche + recherche */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={{ flex: 1 }} onPress={() => hero && onOpenItem(hero)}>
          <Text numberOfLines={2} style={styles.topTitle}>
            {heroTitle}
          </Text>
        </Pressable>
        <Pressable onPress={() => hero && onOpenItem(hero)} hitSlop={6}>
          <ImageWithFallback
            source={{ uri: hero?.coverSmall || hero?.cover }}
            style={styles.topPoster}
            iconSize={16}
          />
        </Pressable>
        <Pressable onPress={onOpenSearch} hitSlop={8} style={styles.topSearch}>
          <Icon name="search" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* onglets catégorie */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} style={styles.tab}>
            <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtOn]}>{t.label}</Text>
            {tab === t.id ? <View style={styles.tabLine} /> : null}
          </Pressable>
        ))}
      </ScrollView>

      {tab === "trend" ? (
        <>
          {/* carrousel avec aper latéraux */}
          <ScrollView
            horizontal
            snapToInterval={CARDS_W + GAP}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingLeft: 55, paddingRight: 55, gap: GAP }}
          >
            {(trending.length ? trending : sections.flatMap((s) => s.items || [])).slice(0, 10).map((item, i) => (
              <Pressable key={`${item.subjectId}-${i}`} style={styles.banner} onPress={() => onOpenItem(item)}>
                <ImageWithFallback source={{ uri: item.cover }} style={StyleSheet.absoluteFill} iconSize={36} />
                <LinearGradient
                  colors={["transparent", "rgba(0,0,0,0.85)"]}
                  style={styles.bannerShade}
                >
                  <Text numberOfLines={2} style={styles.bannerTitle}>
                    {item.displayTitle || item.title}
                  </Text>
                  <View style={styles.bannerPill}>
                    <Icon name="download-outline" size={12} color="#fff" />
                    <Text style={styles.bannerPillTxt}>Téléchargement gratuit</Text>
                  </View>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>

          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.err}>{error}</Text>
              <Pressable onPress={load} hitSlop={8}>
                <Text style={styles.retry}>Réessayer</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Film / Nouveautés : grille 3 col + lien complet */}
          <View style={styles.secHead}>
            <View style={styles.secChip}>
              <Icon name="film-outline" size={14} color="#fff" />
            </View>
            <Text style={styles.secTitle}>Film · Nouveautés</Text>
          </View>
          <Grid3 items={trending.slice(0, 9)} onOpen={onOpenItem} />
          <Pressable style={styles.moreLink} onPress={() => setTab("film")}>
            <Text style={styles.moreLinkTxt}>Vérifier la liste complète</Text>
          </Pressable>

          {/* sections serveur en rangées paysage */}
          {sections.slice(0, 3).map((section) => (
            <View key={section.title}>
              <SectionTitle>{section.title}</SectionTitle>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.landRow}
              >
                {(section.items || []).slice(0, 12).map((item) => (
                  <LandCard key={String(item.subjectId)} item={item} onPress={() => onOpenItem(item)} />
                ))}
              </ScrollView>
            </View>
          ))}
        </>
      ) : (
        <>
          {/* filtres client-side */}
          <ChipRow items={genres} active={genre} onPick={setGenre} />
          <ChipRow items={YEAR_BUCKETS.map((b) => b.label)} active={yearB} onPick={setYearB} />
          <ChipRow items={AUDIO.map((a) => a.label)} active={audio} onPick={setAudio} />

          {/* tri */}
          <View style={styles.sortRow}>
            {SORTS.map((s) => (
              <Pressable key={s.id} onPress={() => setSort(s.id)} style={styles.sortTab}>
                <Text style={[styles.sortTxt, sort === s.id && styles.sortTxtOn]}>{s.label}</Text>
                {sort === s.id ? <View style={styles.sortLine} /> : null}
              </Pressable>
            ))}
          </View>

          {catLoading && !catItems.length ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} />
          ) : null}
          {error ? <Text style={[styles.err, { marginHorizontal: 16, marginTop: 12 }]}>{error}</Text> : null}

          {!catLoading || catItems.length ? (
            <>
              <Grid3 items={filtered} onOpen={onOpenItem} />
              {!filtered.length && !catLoading ? (
                <Text style={styles.empty}>Aucun titre avec ces filtres.</Text>
              ) : null}
              {catMore ? (
                <Pressable
                  style={styles.moreLink}
                  onPress={() => loadCat(def, catPage + 1, true)}
                  disabled={catLoading}
                >
                  <Text style={styles.moreLinkTxt}>
                    {catLoading ? "Chargement…" : "Vérifier la liste complète"}
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
        </>
      )}

      {/* téléchargements en cours */}
      <Pressable style={styles.dlHead} onPress={() => onOpenFiles?.()}>
        <SectionTitle icon="download-outline">Téléchargements</SectionTitle>
        <View style={styles.sectionAll}>
          <Text style={styles.sectionAllTxt}>Tous</Text>
          <Icon name="chevron-forward" size={14} color={colors.dim} />
        </View>
      </Pressable>
      {preview.length === 0 ? (
        <Text style={styles.empty}>Aucun fichier. Ouvre une fiche puis touche « Télécharger ».</Text>
      ) : (
        <View style={styles.dlRow}>
          {preview.map((item) => (
            <Pressable key={item.id} style={styles.dlCard} onPress={() => onPlay(item)}>
              <ImageWithFallback source={{ uri: item.cover }} style={styles.dlThumb} iconSize={18} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={styles.dlTitle}>
                  {item.season && item.episode
                    ? `${item.title}, S${item.season} E${item.episode}`
                    : item.title}
                </Text>
                <Text style={styles.dlSub}>{item.quality || "Fichier"}</Text>
                {item.status === "done" ? (
                  <View style={styles.doneRow}>
                    <Icon name="checkmark-circle" size={14} color={colors.green} />
                    <Text style={styles.done}>Terminé</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.track}>
                      <View
                        style={[styles.fill, { width: `${Math.max(3, (item.progress || 0) * 100)}%` }]}
                      />
                    </View>
                    <Text style={styles.size}>
                      {formatBytes(item.written || 0)}
                      {item.size ? ` / ${formatBytes(item.size)}` : ""}
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
  center: { flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  topBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 4 },
  topTitle: { color: colors.text, fontSize: 21, fontWeight: "900", lineHeight: 25, letterSpacing: -0.4 },
  topPoster: { width: 42, height: 60, borderRadius: 8, backgroundColor: "#1C1C1C" },
  topSearch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  tabRow: { paddingHorizontal: 16, gap: 22, marginTop: 6 },
  tab: { alignItems: "center", paddingBottom: 8 },
  tabTxt: { color: colors.dim, fontSize: 15.5, fontWeight: "700" },
  tabTxtOn: { color: colors.text, fontWeight: "900", fontSize: 16.5 },
  tabLine: { position: "absolute", bottom: 0, width: "60%", height: 3, borderRadius: 2, backgroundColor: colors.red },
  banner: {
    width: CARDS_W,
    aspectRatio: 736 / 430,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#161616",
  },
  bannerShade: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, justifyContent: "flex-end", gap: 8 },
  bannerTitle: { color: "#fff", fontSize: 18, fontWeight: "900", textShadowColor: "#000", textShadowRadius: 6 },
  bannerPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: colors.red,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bannerPillTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  secHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 20, marginHorizontal: 16 },
  secChip: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  secTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, paddingTop: 12, columnGap: GAP, rowGap: 14 },
  cell: { width: CELL_W },
  cellImg: { width: "100%", aspectRatio: 0.7, borderRadius: 10, backgroundColor: "#222" },
  cellBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cellBadgeTxt: { color: "#fff", fontSize: 10.5, fontWeight: "700" },
  cellVf: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.red,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  cellVfTxt: { color: "#fff", fontSize: 9.5, fontWeight: "800" },
  cellTitle: { color: colors.text, fontSize: 12, fontWeight: "600", marginTop: 6, lineHeight: 16 },
  moreLink: { alignItems: "center", paddingVertical: 14, marginTop: 6 },
  moreLinkTxt: { color: colors.dim, fontSize: 13.5, fontWeight: "700" },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingTop: 10 },
  chip: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2E2E2E",
    borderRadius: 17,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipOn: { backgroundColor: colors.red, borderColor: colors.red },
  chipTxt: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  chipTxtOn: { color: "#fff" },
  sortRow: {
    flexDirection: "row",
    gap: 20,
    paddingHorizontal: 16,
    marginTop: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sortTab: { alignItems: "center", paddingBottom: 8 },
  sortTxt: { color: colors.dim, fontSize: 14, fontWeight: "700" },
  sortTxtOn: { color: colors.text, fontWeight: "900" },
  sortLine: { position: "absolute", bottom: 0, width: "80%", height: 3, borderRadius: 2, backgroundColor: colors.red },
  landRow: { paddingHorizontal: 16, gap: 10, paddingTop: 12 },
  landCard: { width: 150 },
  landThumbWrap: {
    width: 150,
    height: 85,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#161616",
  },
  landThumb: { width: "100%", height: "100%" },
  landTitle: { color: colors.text, fontSize: 12, fontWeight: "600", marginTop: 6, lineHeight: 16 },
  dlHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginTop: 6 },
  sectionAll: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 14 },
  sectionAllTxt: { color: colors.dim, fontSize: 13, fontWeight: "600" },
  errBox: { marginHorizontal: 16, marginTop: 14, gap: 8 },
  err: { color: "#F87171" },
  retry: { color: colors.redSoft, fontWeight: "800" },
  empty: { color: colors.dim, marginHorizontal: 16, marginTop: 12 },
  dlRow: { flexDirection: "row", paddingHorizontal: 16, gap: 10, marginTop: 12 },
  dlCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 8,
    flexDirection: "row",
    gap: 8,
  },
  dlThumb: { width: 40, height: 52, borderRadius: 6 },
  dlTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  dlSub: { color: colors.dim, fontSize: 11, marginTop: 2 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  done: { color: colors.green, fontSize: 12, fontWeight: "600" },
  track: { height: 4, backgroundColor: colors.track, borderRadius: 4, marginTop: 8 },
  fill: { height: 4, backgroundColor: colors.red, borderRadius: 4 },
  size: { color: colors.dim, fontSize: 10, marginTop: 4, textAlign: "right" },
});
