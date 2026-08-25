import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { searchTitles } from "../api";
import { colors } from "../theme";
import { Icon, SearchField } from "../ui";

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
      <View style={styles.searchPad}>
        <SearchField autoFocus value={query} onChangeText={setQuery} />
      </View>
      {loading ? <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} /> : null}
      {error ? <Text style={styles.empty}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.subjectId)}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyBox}>
              <Icon name="search-outline" size={36} color={colors.dim} />
              <Text style={styles.empty}>
                {query.trim().length < 2 ? "Tape au moins 2 lettres" : "Aucun résultat"}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => onOpenItem(item)}>
            <Image source={{ uri: item.coverSmall || item.cover }} style={styles.thumb} />
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
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: 58 },
  searchPad: { marginHorizontal: 16 },
  row: { flexDirection: "row", gap: 12, alignItems: "center" },
  thumb: { width: 64, height: 88, borderRadius: 10, backgroundColor: "#222" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  meta: { color: colors.muted },
  emptyBox: { alignItems: "center", marginTop: 48, gap: 10 },
  empty: { color: colors.muted, textAlign: "center" },
});
