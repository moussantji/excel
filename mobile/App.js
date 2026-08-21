import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { cancelDownload, downloadId } from "./src/downloadManager";
import DetailScreen from "./src/screens/DetailScreen";
import DownloadsScreen from "./src/screens/DownloadsScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
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
  const [player, setPlayer] = useState(null);
  const [downloads, setDownloads] = useState([]);

  function upsertDownload(partial) {
    setDownloads((list) => {
      const idx = list.findIndex((d) => d.id === partial.id);
      if (idx === -1) {
        return [
          {
            progress: 0,
            status: "progress",
            title: partial.title,
            cover: partial.cover,
            ...partial,
          },
          ...list,
        ];
      }
      const next = [...list];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
  }

  function playItem(item) {
    const id = item.id || downloadId(item);
    setPlayer({ ...item, id });
  }

  async function addDownload(item) {
    playItem(item);
  }

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <StatusBar style="light" />
        {player ? (
          <PlayerScreen
            item={player}
            onBack={() => setPlayer(null)}
            onDownloadUpdate={upsertDownload}
          />
        ) : detail ? (
          <DetailScreen
            item={detail}
            onBack={() => setDetail(null)}
            onAddDownload={addDownload}
            onOpenItem={setDetail}
            onPlay={playItem}
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
                onPlay={playItem}
              />
            )}
            {tab === "search" && (
              <SearchScreen query={query} setQuery={setQuery} onOpenItem={setDetail} />
            )}
            {tab === "downloads" && (
              <DownloadsScreen
                downloads={downloads}
                onPlay={playItem}
                onRemove={(id) => {
                  cancelDownload(id);
                  setDownloads((list) => list.filter((d) => d.id !== id));
                }}
              />
            )}
            {tab === "profile" && <ProfileScreen onOpenItem={setDetail} />}
          </>
        )}

        {!player ? (
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
        ) : null}
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
