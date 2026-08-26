import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchHistory,
  fetchMe,
  login,
  logout as apiLogout,
} from "../api";
import { colors } from "../theme";
import { useJobs } from "../useJobs";
import { Icon, ImageWithFallback } from "../ui";

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

export default function ProfileScreen({ onOpenItem, onOpenFiles }) {
  const [me, setMe] = useState(null);
  const [history, setHistory] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const jobs = useJobs();
  const insets = useSafeAreaInsets();

  async function load() {
    setBusy(true);
    try {
      const user = await fetchMe();
      setMe(user.user || user);
      const hist = await fetchHistory().catch((e) => {
        if (e.code === "AUTH") return { items: [] };
        throw e;
      });
      setHistory(hist.items || hist.history || []);
      setError("");
    } catch (e) {
      setMe(null);
      setError(e.code === "AUTH" ? "" : e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onLogin() {
    setError("");
    if (!email.trim() || !password) {
      setError("Email et mot de passe requis");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password);
      setEmail("");
      setPassword("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onLogout() {
    await apiLogout();
    setMe(null);
    setHistory([]);
  }

  const name = me?.name || me?.email || "Touriste";
  const userId = me?.id || me?.subjectId || "—";
  const doneCount = useMemo(() => jobs.filter((j) => j.status === "done").length, [jobs]);

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* hero */}
        <View style={styles.hero}>
          <LinearGradient
            colors={["#3A0A0D", "#160506", colors.bg]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ paddingTop: insets.top + 26, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View style={styles.avatar}>
              {me ? (
                <Text style={styles.letter}>{String(name).charAt(0).toUpperCase()}</Text>
              ) : (
                <Icon name="person" size={38} color={colors.onRed} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.name}>
                {name}
              </Text>
              <Text style={styles.idTxt}>ID Manden : {String(userId)}</Text>
            </View>
          </View>

          {me ? (
            <Pressable onPress={onLogout} style={styles.loginRow} hitSlop={6}>
              <Icon name="log-out-outline" size={18} color={colors.onRed} />
              <Text style={styles.loginTxt}>Déconnexion</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => setShowForm((v) => !v)} style={styles.loginRow}>
              <Text style={styles.loginTxt}>Connexion/Inscription</Text>
              <Icon name={showForm ? "chevron-up" : "chevron-forward"} size={18} color={colors.onRed} />
            </Pressable>
          )}

          {/* stats */}
          <View style={styles.statsRow}>
            <Stat label="Vus" value={history.length} />
            <Stat label="Téléchargements" value={jobs.length} />
            <Stat label="Hors-ligne" value={doneCount} />
          </View>
        </View>

        {!me && showForm ? (
          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Icon name="mail-outline" size={18} color={colors.dim} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="#8A8A8A"
                style={styles.input}
              />
            </View>
            <View style={styles.inputWrap}>
              <Icon name="lock-closed-outline" size={18} color={colors.dim} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Mot de passe"
                placeholderTextColor="#8A8A8A"
                style={styles.input}
              />
            </View>
            <Pressable style={[styles.btn, busy && { opacity: 0.7 }]} onPress={onLogin}>
              <Icon name="log-in-outline" size={18} color={colors.onRed} />
              <Text style={styles.btnText}>{busy ? "Connexion…" : "Connexion"}</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.filesRow} onPress={() => onOpenFiles?.()}>
          <Icon name="download-outline" size={18} color={colors.redSoft} />
          <Text style={styles.filesTxt}>Mes fichiers</Text>
          <Icon name="chevron-forward" size={16} color={colors.dim} />
        </Pressable>

        {history.length ? (
          <>
            <Text style={styles.h2}>Des postes</Text>
            <View style={styles.histGrid}>
              {history.slice(0, 9).map((item, idx) => (
                <Pressable
                  key={`${item.subjectId}-${idx}`}
                  onPress={() => onOpenItem?.(item)}
                  style={styles.histCell}
                >
                  <ImageWithFallback
                    source={{ uri: item.coverSmall || item.cover }}
                    style={styles.histThumb}
                    iconSize={16}
                  />
                  <Text numberOfLines={1} style={styles.histTxt}>
                    {item.displayTitle || item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.empty}>Pas encore de contenu</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  hero: { paddingBottom: 8 },
  avatar: {
    width: 79,
    height: 79,
    borderRadius: 40,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.18)",
  },
  letter: { fontSize: 32, fontWeight: "800", color: colors.onRed },
  name: { color: colors.text, fontSize: 21, fontWeight: "900" },
  idTxt: { color: "rgba(255,255,255,0.65)", fontSize: 12.5, marginTop: 4 },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginTop: 22,
    backgroundColor: colors.red,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  loginTxt: { color: colors.onRed, fontSize: 16, fontWeight: "900" },
  statsRow: { flexDirection: "row", marginTop: 20, paddingHorizontal: 20 },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statVal: { color: colors.text, fontSize: 21, fontWeight: "900" },
  statLbl: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600" },
  form: { marginTop: 18, gap: 10, paddingHorizontal: 20 },
  inputWrap: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { flex: 1, color: colors.text, height: 46 },
  btn: {
    backgroundColor: colors.red,
    borderRadius: 12,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnText: { color: colors.onRed, fontWeight: "800" },
  error: { color: "#F87171", marginTop: 12, textAlign: "center", paddingHorizontal: 20 },
  filesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  filesTxt: { color: colors.text, fontWeight: "700", flex: 1 },
  h2: { color: colors.text, fontWeight: "900", fontSize: 17, marginTop: 24, marginBottom: 4, paddingHorizontal: 16 },
  histGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginTop: 8 },
  histCell: { width: "31.5%" },
  histThumb: { width: "100%", height: 120, borderRadius: 10, backgroundColor: "#222" },
  histTxt: { color: colors.text, fontSize: 11.5, fontWeight: "600", marginTop: 5 },
  emptyBox: { alignItems: "center", marginTop: 60 },
  empty: { color: colors.dim },
});
