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
import { Icon, ImageWithFallback, SearchField } from "../ui";

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

  // Recherche (debounce) avec pagination
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

  // Catégories quand pas de recherche active (fetchCategory enfin branché)
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
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
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
      ) : null}

      {loading && !items.length && !catItems.length ? (
        <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} />
      ) : null}
      {error ? <Text style={styles.empty}>{error}</Text> : null}

      <FlatList
        data={showingSearch ? items : catItems}
        keyExtractor={(item) => String(item.subjectId)}
        onEndReachedThreshold={0.4}
        onEndReached={() => showingSearch && loadMore()}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 + insets.bottom }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Icon name="search-outline" size={36} color={colors.dim} />
              <Text style={styles.empty}>
                {showingSearch ? "Aucun résultat" : "Tape au moins 2 lettres pour chercher"}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpenItem(item)}>
            <ImageWithFallback source={{ uri: item.coverSmall || item.cover }} style={styles.thumb} iconSize={20} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.displayTitle || item.title}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {item.typeLabel} · {item.year}
                </Text>
                {item.imdbRating ? (
                  <>
                    <Text style={styles.meta}> · </Text>
                    <Icon name="star" size={12} color={colors.redSoft} />
                    <Text style={styles.meta}> {item.imdbRating}</Text>
                  </>
                ) : null}
              </View>
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
  searchPad: { marginHorizontal: 16 },
  catRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  chip: {
    borderWidth: 1,
    borderColor: "#3A3A3A",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: colors.red, borderColor: colors.red },
  chipTxt: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  chipTxtOn: { color: colors.onRed },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 64, height: 88, borderRadius: 10 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  meta: { color: colors.muted },
  emptyBox: { alignItems: "center", marginTop: 48, gap: 10 },
  empty: { color: colors.muted, textAlign: "center" },
});
