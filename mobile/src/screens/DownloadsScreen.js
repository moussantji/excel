import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBytes } from "../api";
import { colors } from "../theme";
import { Icon } from "../ui";

export default function DownloadsScreen({ downloads, onRemove, onPlay }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.h1}>Téléchargements</Text>
        <Icon name="download-outline" size={26} color={colors.text} />
      </View>
      {downloads.length === 0 ? (
        <View style={styles.emptyBox}>
          <Icon name="cloud-download-outline" size={42} color={colors.dim} />
          <Text style={styles.empty}>Rien en file. Ajoute un titre depuis l’accueil.</Text>
        </View>
      ) : null}
      {downloads.map((item) => (
        <Pressable key={item.id} style={styles.card} onPress={() => onPlay(item)}>
          <Image source={{ uri: item.cover }} style={styles.thumb} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.sub}>
              {item.quality} · {formatBytes(item.size)}
            </Text>
            {item.status === "done" ? (
              <View style={styles.doneRow}>
                <Icon name="checkmark-circle" size={16} color={colors.green} />
                <Text style={styles.done}>Terminé</Text>
              </View>
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
            <Pressable onPress={() => onRemove(item.id)} style={styles.removeBtn} hitSlop={8}>
              <Icon name="trash-outline" size={14} color={colors.redSoft} />
              <Text style={styles.remove}>Retirer</Text>
            </Pressable>
          </View>
          <Icon name="play-circle" size={28} color={colors.redSoft} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingTop: 64, paddingHorizontal: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "800" },
  emptyBox: { alignItems: "center", marginTop: 48, gap: 12 },
  empty: { color: colors.dim, textAlign: "center" },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  thumb: { width: 56, height: 76, borderRadius: 8, backgroundColor: "#222" },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.dim, marginTop: 4 },
  doneRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  done: { color: colors.green, fontWeight: "600" },
  track: { height: 5, backgroundColor: colors.track, borderRadius: 4, marginTop: 14 },
  fill: { height: 5, backgroundColor: colors.red, borderRadius: 4 },
  size: { color: colors.dim, fontSize: 12, marginTop: 6, textAlign: "right" },
  removeBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  remove: { color: colors.redSoft, fontSize: 13 },
});
