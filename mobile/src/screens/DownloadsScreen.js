import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBytes } from "../api";
import { colors } from "../theme";

export default function DownloadsScreen({ downloads, onRemove }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.h1}>Téléchargements</Text>
      {downloads.length === 0 ? (
        <Text style={styles.empty}>Rien en file. Ajoute un titre depuis l’accueil.</Text>
      ) : null}
      {downloads.map((item) => (
        <View key={item.id} style={styles.card}>
          <Image source={{ uri: item.cover }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>
              {item.quality} · {formatBytes(item.size)}
            </Text>
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
            <Pressable onPress={() => onRemove(item.id)}>
              <Text style={styles.remove}>Retirer</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: 64, paddingHorizontal: 16 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "800", marginBottom: 20 },
  empty: { color: colors.dim },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  thumb: { width: 56, height: 76, borderRadius: 8, backgroundColor: "#222" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.dim, marginTop: 4 },
  done: { color: colors.green, marginTop: 10, fontWeight: "600" },
  track: { height: 5, backgroundColor: colors.track, borderRadius: 4, marginTop: 14 },
  fill: { height: 5, backgroundColor: colors.gold, borderRadius: 4 },
  size: { color: colors.dim, fontSize: 12, marginTop: 6, textAlign: "right" },
  remove: { color: colors.gold, marginTop: 8, fontSize: 13 },
});
