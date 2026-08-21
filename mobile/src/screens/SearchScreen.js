import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { searchTitles } from "../api";
import { colors } from "../theme";

export default function SearchScreen({ query, setQuery, onOpenItem }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setError("");
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const data = await searchTitles(q);
        setItems(data.items || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <View style={styles.wrap}>
      <View style={styles.searchWrap}>
        <Text style={styles.icon}>⌕</Text>
        <TextInput
          autoFocus
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher films, séries..."
          placeholderTextColor="#9A9A9A"
          style={styles.search}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.gold} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.empty}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.subjectId)}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              {query.trim().length < 2 ? "Tape au moins 2 lettres" : "Aucun résultat"}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpenItem(item)}>
            <Image source={{ uri: item.coverSmall || item.cover }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.displayTitle || item.title}</Text>
              <Text style={styles.meta}>
                {item.typeLabel} · {item.year}
                {item.imdbRating ? ` · ★ ${item.imdbRating}` : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: 58 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.search,
    borderRadius: 22,
    height: 44,
    marginHorizontal: 16,
    paddingHorizontal: 14,
  },
  icon: { color: "#C8C8C8", fontSize: 20, marginRight: 8 },
  search: { flex: 1, color: colors.text, fontSize: 16 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 64, height: 88, borderRadius: 10, backgroundColor: "#222" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.muted, marginTop: 4 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40 },
});
