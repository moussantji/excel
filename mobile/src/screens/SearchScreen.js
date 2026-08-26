import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchCategory, searchTitles } from "../api";
import { colors } from "../theme";
import { Icon, ImageWithFallback, Logo, RatingBadge, SearchField, VfBadge } from "../ui";

const CATEGORIES = [
  { label: "Films", params: {} },
  { label: "Séries", params: { subjectType: 2 } },
];

export default function SearchScreen({ onOpenItem }) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState(null);
  const [catItems, setCatItems] = useState([]);
  const lastQueryRef = useRef("");
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setError("");
      setCategory(null);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await searchTitles(q);
        if (lastQueryRef.current !== q) setItems([]);
        lastQueryRef.current = q;
        setItems(data.items || []);
        setPage(1);
        setHasMore((data.items || []).length >= 20);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function loadMore() {
    const q = query.trim();
    if (q.length < 2 || loading || !hasMore) return;
    setLoading(true);
    try {
      const data = await searchTitles(q, page + 1);
      const more = data.items || [];
      setItems((prev) => {
        const seen = new Set(prev.map((x) => String(x.subjectId)));
        return [...prev, ...more.filter((m) => !seen.has(String(m.subjectId)))];
      });
      setPage((p) => p + 1);
      setHasMore(more.length >= 20);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (query.trim().length >= 2) return;
    let live = true;
    (async () => {
      try {
        const data = await fetchCategory(category?.params || {});
        if (live) setCatItems(data.items || []);
      } catch {
        if (live) setCatItems([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [query, category]);

  function switchCategory(cat) {
    setCategory(cat === category ? null : cat);
  }

  const showingSearch = query.trim().length >= 2;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.brandRow}>
        <Logo size={20} />
      </View>
      <View style={styles.searchPad}>
        <SearchField autoFocus value={query} onChangeText={setQuery} />
      </View>

      {!showingSearch ? (
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c.label}
              onPress={() => switchCategory(c)}
              style={[styles.chip, category === c && styles.chipOn]}
            >
              <Text style={[styles.chipTxt, category === c && styles.chipTxtOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={styles.resultCount}>
          {loading && !items.length ? "Recherche…" : `${items.length} résultat${items.length > 1 ? "s" : ""}`}
        </Text>
      )}

      {loading && !items.length && !catItems.length ? (
        <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} />
      ) : null}
      {error ? <Text style={styles.empty}>{error}</Text> : null}

      <FlatList
        data={showingSearch ? items : catItems}
        keyExtractor={(item) => String(item.subjectId)}
        onEndReachedThreshold={0.4}
        onEndReached={() => showingSearch && loadMore()}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 + insets.bottom }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <View style={styles.emptyRing}>
                <Icon name="search-outline" size={28} color={colors.redSoft} />
              </View>
              <Text style={styles.emptyTitle}>
                {showingSearch ? "Aucun résultat" : "Que veux-tu regarder ?"}
              </Text>
              <Text style={styles.empty}>
                {showingSearch
                  ? "Essaie un autre titre, un acteur ou un genre."
                  : "Tape au moins 2 lettres pour chercher un film ou une série."}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.86 }]}
            onPress={() => onOpenItem(item)}
          >
            <View style={styles.thumbWrap}>
              <ImageWithFallback
                source={{ uri: item.coverSmall || item.cover }}
                style={styles.thumb}
                iconSize={20}
              />
              {item.french ? <VfBadge style={styles.vf} /> : null}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title} numberOfLines={2}>
                {item.displayTitle || item.title}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {[item.typeLabel, item.year].filter(Boolean).join(" · ")}
                </Text>
                {item.imdbRating ? (
                  <RatingBadge value={item.imdbRating} style={{ marginLeft: 6 }} />
                ) : null}
              </View>
              {(item.genres || []).length ? (
                <Text style={styles.genres} numberOfLines={1}>
                  {(item.genres || []).slice(0, 3).join(" · ")}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-forward" size={18} color={colors.dim} />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  brandRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchPad: { marginHorizontal: 16 },
  catRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  resultCount: {
    color: colors.dim,
    fontSize: 12.5,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#3A3A3A",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#141414",
  },
  chipOn: { backgroundColor: colors.red, borderColor: colors.red },
  chipTxt: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  chipTxtOn: { color: colors.onRed },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 8,
  },
  thumbWrap: { borderRadius: 10, overflow: "hidden", backgroundColor: "#222" },
  thumb: { width: 68, height: 96 },
  vf: { position: "absolute", top: 5, left: 5 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  meta: { color: colors.muted, fontSize: 13 },
  genres: { color: colors.dim, fontSize: 12 },
  emptyBox: { alignItems: "center", marginTop: 56, gap: 8, paddingHorizontal: 28 },
  emptyRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: "rgba(229,9,20,0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  empty: { color: colors.muted, textAlign: "center", lineHeight: 20 },
});
