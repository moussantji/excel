import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "./theme";

export function Icon({ name, size = 22, color = colors.text, style }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

export function RatingBadge({ value, style }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <View style={[styles.badge, style]}>
      <Icon name="star" size={11} color={colors.redSoft} />
      <Text style={styles.badgeText}>{value}</Text>
    </View>
  );
}

export function SearchField({ value, onChangeText, onFocus, autoFocus, placeholder }) {
  return (
    <View style={styles.searchWrap}>
      <Icon name="search" size={18} color="#C8C8C8" style={{ marginRight: 8 }} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder={placeholder || "Rechercher films, séries..."}
        placeholderTextColor="#9A9A9A"
        style={styles.search}
      />
    </View>
  );
}

export function PrimaryButton({ label, icon = "play", onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && styles.pressed, style]}
    >
      <Text style={styles.primaryText}>{label}</Text>
      {icon ? <Icon name={icon} size={15} color={colors.onRed} /> : null}
    </Pressable>
  );
}

export function GhostButton({ label, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.ghost, pressed && styles.pressed, style]}
    >
      <Text style={styles.ghostText}>{label}</Text>
    </Pressable>
  );
}

export function SectionTitle({ children, icon }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{children}</Text>
      {icon ? <Icon name={icon} size={22} color={colors.text} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.search,
    borderRadius: 22,
    height: 44,
    paddingHorizontal: 14,
  },
  search: { flex: 1, color: colors.text, fontSize: 16 },
  primary: {
    backgroundColor: colors.red,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryText: { color: colors.onRed, fontWeight: "700", fontSize: 15 },
  ghost: {
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  ghostText: { color: colors.redSoft, fontWeight: "600", fontSize: 15 },
  pressed: { opacity: 0.82 },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    marginHorizontal: 16,
  },
  section: { color: colors.text, fontSize: 22, fontWeight: "800" },
});
