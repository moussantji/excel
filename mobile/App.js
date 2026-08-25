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
import { Icon } from "./src/ui";

const TABS = [
  { id: "home", label: "Accueil", icon: "home-outline", iconOn: "home" },
  { id: "search", label: "Recherche", icon: "search-outline", iconOn: "search" },
  { id: "downloads", label: "Téléchargements", icon: "download-outline", iconOn: "download" },
  { id: "profile", label: "Profil", icon: "person-outline", iconOn: "person" },
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

  const showTabs = !player && !detail;

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

        {showTabs ? (
          <View style={styles.tabBar}>
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setDetail(null);
                    setTab(item.id);
                  }}
                  style={({ pressed }) => [styles.tab, pressed && { opacity: 0.75 }]}
                >
                  <Icon
                    name={active ? item.iconOn : item.icon}
                    size={22}
                    color={active ? colors.redSoft : colors.dim}
                  />
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
    borderTopColor: "rgba(229,9,20,0.28)",
    flexDirection: "row",
    paddingBottom: 18,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 4 },
  tabLabel: { color: colors.dim, fontSize: 11 },
  active: { color: colors.redSoft },
});
