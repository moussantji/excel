import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import DetailScreen from "./src/screens/DetailScreen";
import FilesScreen from "./src/screens/DownloadsScreen";
import HomeScreen from "./src/screens/HomeScreen";
import PlayerScreen from "./src/screens/PlayerScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import SearchScreen from "./src/screens/SearchScreen";
import { initAuth, isSeries } from "./src/api";
import { initDownloads, startDownload } from "./src/downloadManager";
import { colors, TAB_BAR_HEIGHT } from "./src/theme";
import { Icon } from "./src/ui";

const Stack = createNativeStackNavigator();

const TABS = [
  { id: "home", label: "Accueil", icon: "home-outline", iconOn: "home" },
  { id: "search", label: "Recherche", icon: "search-outline", iconOn: "search" },
  { id: "downloads", label: "Téléchargements", icon: "download-outline", iconOn: "download" },
  { id: "profile", label: "Compte", icon: "person-outline", iconOn: "person" },
];

function Tabs({ navigation }) {
  const [tab, setTab] = useState("home");
  const insets = useSafeAreaInsets();

  function openItem(item) {
    navigation.navigate("Detail", { item });
  }

  // Lecture : une série passe toujours par sa fiche (choix saison/épisode),
  // un film joue directement.
  function playItem(item) {
    if (isSeries(item)) {
      navigation.navigate("Detail", { item });
      return;
    }
    navigation.navigate("Player", { item });
  }

  // Téléchargement en fond : reste sur l'écran courant.
  function addDownload(item) {
    startDownload(item).catch(() => {});
  }

  return (
    <View style={styles.root}>
      <View style={styles.screen}>
        <View
          style={[styles.pane, tab !== "home" && styles.paneOff]}
          pointerEvents={tab === "home" ? "auto" : "none"}
        >
          <HomeScreen
            active={tab === "home"}
            onOpenItem={openItem}
            onAddDownload={addDownload}
            onPlay={playItem}
            onOpenFiles={() => setTab("downloads")}
            onOpenSearch={() => setTab("search")}
          />
        </View>
        <View
          style={[styles.pane, tab !== "search" && styles.paneOff]}
          pointerEvents={tab === "search" ? "auto" : "none"}
        >
          <SearchScreen active={tab === "search"} onOpenItem={openItem} />
        </View>
        <View
          style={[styles.pane, tab !== "downloads" && styles.paneOff]}
          pointerEvents={tab === "downloads" ? "auto" : "none"}
        >
          <FilesScreen onPlay={playItem} onOpenItem={openItem} />
        </View>
        <View
          style={[styles.pane, tab !== "profile" && styles.paneOff]}
          pointerEvents={tab === "profile" ? "auto" : "none"}
        >
          <ProfileScreen onOpenItem={openItem} onOpenFiles={() => setTab("downloads")} />
        </View>
      </View>

      <View
        style={[
          styles.tabBar,
          { paddingBottom: Math.max(8, insets.bottom), height: TAB_BAR_HEIGHT + insets.bottom },
        ]}
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setTab(item.id)}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.75 }]}
            >
              <Icon
                name={active ? item.iconOn : item.icon}
                size={22}
                color={active ? colors.redSoft : colors.dim}
              />
              <Text
                style={[styles.tabLabel, active && styles.active]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function DetailScreenWrapper({ navigation }) {
  const params = useRoute().params || {};
  if (!params.item) {
    // deep link sans payload : on ne peut rien afficher
    return null;
  }
  return (
    <DetailScreen
      item={params.item}
      onBack={() => navigation.goBack()}
      // reco → push sur le stack : Retour remonte l'historique complet
      onOpenItem={(rec) => navigation.push("Detail", { item: rec })}
      onPlay={(payload, queue) =>
        isSeries(payload)
          ? navigation.navigate("Player", { item: payload, queue })
          : navigation.navigate("Player", { item: payload })
      }
      onAddDownload={(payload) => startDownload(payload).catch(() => {})}
    />
  );
}

function PlayerScreenWrapper({ navigation }) {
  const params = useRoute().params || {};
  const { item, queue } = params;

  function goNext() {
    if (!queue?.length) {
      navigation.goBack();
      return;
    }
    const idx = queue.findIndex(
      (e) => e.season === item.season && e.episode === item.episode
    );
    const next = queue[idx + 1];
    if (!next) {
      navigation.goBack();
      return;
    }
    navigation.replace("Player", {
      item: { ...item, season: next.season, episode: next.episode },
      queue,
    });
  }

  return <PlayerScreen item={item} queue={queue} onBack={() => navigation.goBack()} onNext={goNext} />;
}

export default function App() {
  useEffect(() => {
    initAuth();
    initDownloads();
  }, []);

  return (
    <NavigationContainer
      linking={{
        prefixes: ["mandenstream://"],
        config: {
          screens: {
            Tabs: "",
            Detail: "detail/:subjectId",
            Player: "play",
          },
        },
      }}
    >
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Detail" component={DetailScreenWrapper} />
        <Stack.Screen name="Player" component={PlayerScreenWrapper} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1 },
  pane: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  paneOff: { opacity: 0, zIndex: 0 },
  tabBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(8,8,8,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3 },
  tabLabel: { color: colors.dim, fontSize: 10.5, fontWeight: "600" },
  active: { color: colors.redSoft, fontWeight: "800" },
});
