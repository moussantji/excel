import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { fetchHistory, fetchMe, login, setAuthToken } from "../api";
import { colors } from "../theme";

export default function ProfileScreen({ onOpenItem }) {
  const [me, setMe] = useState(null);
  const [history, setHistory] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const user = await fetchMe();
      setMe(user.user || user);
      const hist = await fetchHistory().catch(() => ({ items: [] }));
      setHistory(hist.items || hist.history || []);
      setError("");
    } catch (e) {
      setMe(null);
      setError(e.message.includes("login") ? "" : e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onLogin() {
    setError("");
    try {
      await login(email.trim(), password);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function logout() {
    setAuthToken(null);
    setMe(null);
    setHistory([]);
  }

  const name = me?.name || me?.email || "Invité";
  const letter = String(name).charAt(0).toUpperCase();

  return (
    <View style={styles.wrap}>
      <View style={styles.avatar}>
        <Text style={styles.letter}>{letter}</Text>
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{me ? "Connecté · /api/auth/me" : "Non connecté"}</Text>

      {!me ? (
        <View style={styles.form}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email"
            placeholderTextColor="#8A8A8A"
            style={styles.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mot de passe"
            placeholderTextColor="#8A8A8A"
            style={styles.input}
          />
          <Pressable style={styles.btn} onPress={onLogin}>
            <Text style={styles.btnText}>Connexion</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable style={styles.out} onPress={logout}>
          <Text style={styles.outText}>Déconnexion</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {history.length ? (
        <>
          <Text style={styles.h2}>Historique</Text>
          {history.slice(0, 8).map((item) => (
            <Pressable key={String(item.subjectId)} onPress={() => onOpenItem?.(item)}>
              <Text style={styles.hist}>{item.displayTitle || item.title}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, alignItems: "center", paddingTop: 90, paddingHorizontal: 20 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { fontSize: 34, fontWeight: "800", color: "#1A1404" },
  name: { color: colors.text, fontSize: 24, fontWeight: "800", marginTop: 16 },
  meta: { color: colors.muted, marginTop: 6 },
  form: { width: "100%", marginTop: 28, gap: 10 },
  input: {
    backgroundColor: colors.card,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  btn: { backgroundColor: colors.gold, borderRadius: 12, height: 46, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#1A1404", fontWeight: "800" },
  out: { marginTop: 20 },
  outText: { color: colors.goldSoft },
  error: { color: "#F87171", marginTop: 14, textAlign: "center" },
  h2: { color: colors.text, fontWeight: "800", alignSelf: "flex-start", marginTop: 28, marginBottom: 8 },
  hist: { color: colors.muted, alignSelf: "flex-start", marginBottom: 8 },
});
