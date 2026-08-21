import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { fetchDownloads } from "./src/api";
import DetailScreen from "./src/screens/DetailScreen";
import DownloadsScreen from "./src/screens/DownloadsScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";
import { colors } from "./src/theme";

const TABS = [
  { id: "home", label: "Accueil", icon: "⌂" },
  { id: "search", label: "Recherche", icon: "⌕" },
  { id: "downloads", label: "Téléchargements", icon: "↓" },
  { id: "profile", label: "Profil", icon: "☺" },
];

export default function App() {
  const [tab, setTab] = useState("home");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [downloads, setDownloads] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDownloads((list) =>
        list.map((item) => {
          if (item.status === "done") return item;
          const next = Math.min(1, item.progress + 0.08);
          return { ...item, progress: next, status: next >= 1 ? "done" : "progress" };
        })
      );
    }, 800);
    return () => clearInterval(timer);
  }, []);

  async function addDownload(item) {
    let quality = item.quality;
    let size = item.size;
    let url = item.url;
    if (!url) {
      const pack = await fetchDownloads(item.subjectId);
      const best = (pack.downloads || [])[0];
      if (!best) return;
      quality = best.quality;
      size = best.size;
      url = best.url;
    }
    const id = `${item.subjectId}-${item.season || 0}-${item.episode || 0}-${quality}`;
    setDownloads((list) => {
      if (list.some((d) => d.id === id)) return list;
      return [
        {
          id,
          subjectId: item.subjectId,
          title: item.displayTitle || item.title,
          cover: item.coverSmall || item.cover,
          quality,
          size,
          url,
          progress: 0.08,
          status: "progress",
        },
        ...list,
      ];
    });
    setTab("downloads");
    setDetail(null);
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {detail ? (
          <DetailScreen
            item={detail}
            onBack={() => setDetail(null)}
            onAddDownload={addDownload}
            onOpenItem={setDetail}
          />
        ) : (
          <>
            {tab === "home" && (
              <HomeScreen
                query={query}
                setQuery={setQuery}
                onSearchFocus={() => setTab("search")}
                downloads={downloads}
                onOpenItem={setDetail}
                onAddDownload={addDownload}
              />
            )}
            {tab === "search" && (
              <SearchScreen query={query} setQuery={setQuery} onOpenItem={setDetail} />
            )}
            {tab === "downloads" && (
              <DownloadsScreen
                downloads={downloads}
                onRemove={(id) => setDownloads((list) => list.filter((d) => d.id !== id))}
              />
            )}
            {tab === "profile" && <ProfileScreen onOpenItem={setDetail} />}
          </>
        )}

        <View style={styles.tabBar}>
          {TABS.map((item) => {
            const active = !detail && tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  setDetail(null);
                  setTab(item.id);
                }}
                style={styles.tab}
              >
                <Text style={[styles.tabIcon, active && styles.active]}>{item.icon}</Text>
                <Text style={[styles.tabLabel, active && styles.active]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 86,
    backgroundColor: colors.bar,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#2A2A2A",
    flexDirection: "row",
    paddingBottom: 18,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center" },
  tabIcon: { color: "#8A8A8A", fontSize: 20 },
  tabLabel: { color: "#8A8A8A", fontSize: 11, marginTop: 4 },
  active: { color: colors.goldSoft },
});
