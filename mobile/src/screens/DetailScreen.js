import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchDetail, fetchDownloads, formatBytes } from "../api";
import { downloadId } from "../downloadManager";
import { colors } from "../theme";
import { useJobs } from "../useJobs";
import { GlassButton, Icon, ImageWithFallback, PlayButton } from "../ui";

const SCREEN_W = Dimensions.get("window").width;

function fmtDur(sec) {
  if (!sec && sec !== 0) return "";
  const s = Math.round(Number(sec));
  if (!Number.isFinite(s) || s <= 0) return "";
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export default function DetailScreen({ item, onBack, onAddDownload, onOpenItem, onPlay }) {
  const [pack, setPack] = useState(() => peekCache(`detail:${item.subjectId}`) || null);
  const [files, setFiles] = useState([]);
  const [season, setSeason] = useState(item.season || 1);
  const [episode, setEpisode] = useState(item.episode || 1);
  const [loading, setLoading] = useState(!item?.title && !item?.cover);
  const [error, setError] = useState("");
  const [descOpen, setDescOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const jobs = useJobs();
  const insets = useSafeAreaInsets();

  const detail = pack?.item || item;
  const seasons = pack?.seasons || [];
  const isSeriesPack = Boolean(pack?.isSeries) || seasons.length > 0;
  const current = seasons.find((s) => s.season === season) || seasons[0];

  const displayTitle = detail.displayTitle || detail.title || "";
  const originalTitle = detail.title && detail.title !== displayTitle ? detail.title : null;
  const rating = detail.imdbRating;
  const country = detail.country;
  const genres = detail.genres || [];
  const year = detail.year;
  const dur = detail.durationSeconds;
  const desc = detail.description;

  async function loadDetail(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const data = await fetchDetail(item.subjectId);
      setPack(data);
      if (data.isSeries && data.seasons?.length) {
        const first = data.seasons.find((s) => s.season === season) || data.seasons[0];
        // ne pas écraser si l'utilisateur a déjà changé
        if (!showRefresh) {
          setSeason(first.season);
          setEpisode(
            item.season === first.season && item.episode ? item.episode : first.episodes?.[0] || 1
          );
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = await fetchDetail(item.subjectId);
        if (!live) return;
        setPack(data);
        if (data.isSeries && data.seasons?.length) {
          const first = data.seasons.find((s) => s.season === season) || data.seasons[0];
          setSeason(first.season);
          setEpisode(
            item.season === first.season && item.episode
              ? item.episode
              : first.episodes?.[0] || 1
          );
        }
      } catch (e) {
        if (live) setError(e.message);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.subjectId]);

  useEffect(() => {
    if (!item.subjectId) return;
    let live = true;
    (async () => {
      try {
        const data = await fetchDownloads(item.subjectId, {
          season: isSeriesPack ? season : undefined,
          episode: isSeriesPack ? episode : undefined,
        });
        if (live) setFiles(data.downloads || []);
      } catch {
        if (live) setFiles([]);
      }
    })();
    return () => {
      live = false;
    };
  }, [item.subjectId, season, episode, isSeriesPack]);

  function payload(file) {
    return {
      ...detail,
      subjectId: detail.subjectId || item.subjectId,
      quality: file?.quality,
      size: file?.size,
      url: file?.url,
      season: isSeriesPack ? season : undefined,
      episode: isSeriesPack ? episode : undefined,
    };
  }

  function buildQueue() {
    if (!isSeriesPack) return undefined;
    const q = [];
    for (const s of seasons) {
      for (const ep of s.episodes || []) q.push({ season: s.season, episode: ep });
    }
    return q;
  }

  function jobFor(quality) {
    const id = downloadId({
      subjectId: detail.subjectId || item.subjectId,
      season: isSeriesPack ? season : 0,
      episode: isSeriesPack ? episode : 0,
      quality,
    });
    return jobs.find((j) => j.id === id);
  }

  const queue = buildQueue();
  const bestFile = files[0] || null;

  // méta ligne compacte type MovieBox
  const metaParts = [];
  if (country) metaParts.push(country);
  if (genres.length) metaParts.push(genres.slice(0, 3).join(" · "));
  if (year) metaParts.push(String(year));
  if (dur) metaParts.push(fmtDur(dur));
  const metaLine = metaParts.join(" · ");

  return (
    <View style={styles.wrap}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 36 + insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={styles.hero}>
          {detail.cover ? (
            <ImageWithFallback
              source={{ uri: detail.cover }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              iconSize={48}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.55)", "rgba(5,5,5,0.92)", colors.bg]}
            locations={[0, 0.45, 0.78, 1]}
            style={StyleSheet.absoluteFill}
          />
          {/* top bar */}
          <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 12 }}>
            <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
              <Icon name="chevron-back" size={24} color="#fff" />
            </Pressable>
          </View>
          {/* hero bottom */}
          <View style={styles.heroBottom}>
            <View style={styles.titleRow}>
              <Text style={styles.heroTitle} numberOfLines={2}>
                {displayTitle}
              </Text>
              {rating ? (
                <View style={styles.ratingPill}>
                  <Icon name="star" size={13} color={colors.gold} />
                  <Text style={styles.ratingTxt}>{String(rating).slice(0, 3)}</Text>
                </View>
              ) : null}
            </View>
            {originalTitle ? (
              <Text style={styles.aka} numberOfLines={1}>
                Aussi connu sous le nom: {originalTitle}
              </Text>
            ) : null}
            {metaLine ? <Text style={styles.heroMeta}>{metaLine}</Text> : null}
          </View>
        </View>

        {/* LECTURE principale + ressource */}
        <View style={styles.body}>
          <View style={styles.ctaCol}>
            <PlayButton
              label={isSeriesPack ? `Lecture S${season} E${episode}` : "Lecture"}
              onPress={() => onPlay(payload(bestFile), queue)}
            />
            {bestFile ? (
              <GlassButton
                label="Télécharger"
                icon="download-outline"
                onPress={() => onAddDownload(payload(bestFile))}
              />
            ) : null}
          </View>

          {/* saison / épisode */}
          {isSeriesPack && seasons.length ? (
            <View style={{ marginTop: 18 }}>
              <Text style={styles.sectionTitle}>Saisons & épisodes</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                {seasons.map((s) => (
                  <Pressable
                    key={s.season}
                    onPress={() => {
                      setSeason(s.season);
                      setEpisode(s.episodes?.[0] || 1);
                    }}
                    style={[styles.chip, season === s.season && styles.chipOn]}
                  >
                    <Text style={[styles.chipTxt, season === s.season && styles.chipTxtOn]}>
                      S{s.season}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.chips, { marginTop: 8 }]}
              >
                {(current?.episodes || []).map((ep) => (
                  <Pressable
                    key={ep}
                    onPress={() => setEpisode(ep)}
                    style={[styles.chip, episode === ep && styles.chipOn]}
                  >
                    <Text style={[styles.chipTxt, episode === ep && styles.chipTxtOn]}>E{ep}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Détecteur de ressources */}
          <View style={styles.resourceHead}>
            <Text style={styles.sectionTitle}>Fichiers disponibles</Text>
            <Text style={styles.resourceSub}>Source: stream.mandenbaoubab.com</Text>
          </View>

          {loading && !files.length ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 18 }} />
          ) : null}
          {error ? <Text style={styles.err}>{error}</Text> : null}

          {!loading && !files.length ? (
            <Text style={styles.noFiles}>Aucun fichier listé pour cet épisode.</Text>
          ) : null}

          <View style={styles.qGrid}>
          {files.map((file) => {
            const job = jobFor(file.quality);
            const isDone = job?.status === "done";
            const isActive = job && job.status !== "done" && job.status !== "error";
            const pct = Math.max(3, (job?.progress || 0) * 100);
            const epLabel = isSeriesPack
              ? `S${String(season).padStart(2, "0")} EP${String(episode).padStart(2, "0")}`
              : file.quality;
            return (
              <View key={file.quality} style={styles.qCard}>
                <View style={styles.qCardTop}>
                  <Text style={styles.qTitle} numberOfLines={1}>{epLabel}</Text>
                  <Pressable
                    onPress={() => onPlay(payload(file), queue)}
                    style={styles.qPlay}
                    hitSlop={6}
                  >
                    <Icon name="play" size={13} color={colors.playText} />
                  </Pressable>
                </View>
                <Text style={styles.qSub} numberOfLines={1}>
                  {file.quality}
                  {formatBytes(file.size) ? ` · ${formatBytes(file.size)}` : ""}
                  {dur ? ` · ${fmtDur(dur)}` : ""}
                </Text>
                {isActive ? (
                  <View style={styles.qTrack}>
                    <View style={[styles.qFill, { width: `${pct}%` }]} />
                  </View>
                ) : null}
                {isDone ? (
                  <View style={styles.qDoneRow}>
                    <Icon name="checkmark-circle" size={12} color={colors.green} />
                    <Text style={styles.qDoneTxt}>Disponible hors connexion</Text>
                  </View>
                ) : null}
                {job?.status === "error" ? (
                  <Text style={styles.qErr} numberOfLines={1}>{job.error || "Erreur"}</Text>
                ) : null}
                <Pressable
                  onPress={() => onAddDownload(payload(file))}
                  disabled={isDone}
                  style={styles.qDl}
                >
                  <Icon
                    name={isDone ? "checkmark" : "download-outline"}
                    size={12}
                    color={isDone ? colors.dim : colors.playText}
                  />
                  <Text style={[styles.qDlTxt, isDone && { color: colors.dim }]}>
                    {isDone ? "Fait" : "Télécharger"}
                  </Text>
                </Pressable>
              </View>
            );
          })}
          </View>

          {/* Info */}
          {desc ? (
            <View style={{ marginTop: 22 }}>
              <Text style={styles.sectionTitle}>Info</Text>
              <Text
                style={styles.desc}
                numberOfLines={descOpen ? undefined : 4}
              >
                {desc}
              </Text>
              <Pressable onPress={() => setDescOpen((v) => !v)} style={styles.moreBtn} hitSlop={8}>
                <Text style={styles.moreTxt}>{descOpen ? "Moins" : "Plus"}</Text>
                <Icon
                  name={descOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.redSoft}
                />
              </Pressable>
            </View>
          ) : null}

          {/* Casting – grille */}
          {pack?.cast?.length ? (
            <View style={{ marginTop: 22 }}>
              <Text style={styles.sectionTitle}>
                En vedette ({pack.cast.length})
              </Text>
              <View style={styles.castGrid}>
                {pack.cast.slice(0, 12).map((actor) => (
                  <View key={`${actor.name}-${actor.character}`} style={styles.castCell}>
                    {actor.avatar ? (
                      <ImageWithFallback
                        source={{ uri: actor.avatar }}
                        style={styles.castAvatar}
                        iconSize={18}
                      />
                    ) : (
                      <View style={[styles.castAvatar, styles.castAvatarPh]}>
                        <Icon name="person" size={20} color="#666" />
                      </View>
                    )}
                    <Text numberOfLines={1} style={styles.castName}>
                      {actor.name}
                    </Text>
                    {actor.character ? (
                      <Text numberOfLines={1} style={styles.castChar}>
                        {actor.character}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Recommandés – grille 3 col */}
          {pack?.recommendations?.length ? (
            <View style={{ marginTop: 22 }}>
              <View style={styles.recoHead}>
                <Text style={styles.sectionTitle}>Pour vous</Text>
                <Pressable
                  onPress={() => loadDetail(true)}
                  style={styles.refreshBtn}
                  hitSlop={8}
                >
                  <Icon name="refresh" size={13} color={colors.redSoft} />
                  <Text style={styles.refreshTxt}>
                    {refreshing ? "…" : "Actualiser"}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.recoGrid}>
                {pack.recommendations.slice(0, 12).map((rec) => (
                  <Pressable
                    key={String(rec.subjectId)}
                    onPress={() => onOpenItem(rec)}
                    style={styles.recoCell}
                  >
                    <View style={styles.recoImgWrap}>
                      <ImageWithFallback
                        source={{ uri: rec.coverSmall || rec.cover }}
                        style={styles.recoImg}
                      />
                      {rec.imdbRating ? (
                        <View style={styles.recoBadge}>
                          <Icon name="star" size={10} color={colors.gold} />
                          <Text style={styles.recoBadgeTxt}>{rec.imdbRating}</Text>
                        </View>
                      ) : null}
                      {rec.french ? (
                        <View style={styles.vfBadge}>
                          <Text style={styles.vfTxt}>V.F.</Text>
                        </View>
                      ) : null}
                      <View style={styles.recoDlIcon}>
                        <Icon name="download-outline" size={11} color="#fff" />
                      </View>
                    </View>
                    <Text numberOfLines={1} style={styles.recoTitle}>
                      {rec.displayTitle || rec.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {!pack?.recommendations?.length && !loading ? (
            <Pressable onPress={() => loadDetail(true)} style={styles.refreshFull} hitSlop={8}>
              <Icon name="refresh" size={14} color={colors.redSoft} />
              <Text style={styles.refreshFullTxt}>Actualiser le nouveau contenu</Text>
            </Pressable>
          ) : null}

          {/* Commentaires placeholder – fidèle à la capture */}
          <View style={{ marginTop: 22, marginBottom: 8 }}>
            <Text style={styles.sectionTitle}>Commentaires</Text>
            <View style={styles.commentCard}>
              <View style={styles.commentHead}>
                <View style={styles.commentAvatar}>
                  <Icon name="person" size={14} color="#888" />
                </View>
                <Text style={styles.commentName}>Utilisateur</Text>
                <Text style={styles.commentDate}>· à l'instant</Text>
              </View>
              <Text style={styles.commentBody}>
                Partage ton avis après avoir regardé — les commentaires apparaîtront ici.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 460, width: "100%", backgroundColor: "#000000", overflow: "hidden" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBottom: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  heroTitle: { flex: 1, color: "#fff", fontSize: 30, fontWeight: "900", lineHeight: 34, letterSpacing: 0.3, textTransform: "uppercase" },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  ratingTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  aka: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 6 },
  heroMeta: { color: "rgba(255,255,255,0.88)", fontSize: 13, marginTop: 6, lineHeight: 18 },
  body: { paddingHorizontal: 16, paddingTop: 8 },
  ctaCol: { gap: 10 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  chips: { gap: 8, paddingRight: 8, marginTop: 10 },
  chip: {
    borderWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#2A2A2A",
  },
  chipOn: { backgroundColor: colors.red, borderColor: colors.red },
  chipTxt: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  chipTxtOn: { color: "#fff" },
  resourceHead: { marginTop: 20, gap: 2 },
  resourceSub: { color: colors.dim, fontSize: 12, marginTop: 2 },
  err: { color: "#F87171", marginTop: 10 },
  noFiles: { color: colors.dim, marginTop: 12, fontSize: 13 },
  qGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  qCard: {
    width: (SCREEN_W - 32 - 10) / 2,
    backgroundColor: "#171717",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  qCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  qTitle: { color: colors.text, fontWeight: "700", fontSize: 13, flexShrink: 1 },
  qSub: { color: colors.dim, fontSize: 12, marginTop: 3 },
  qTrack: { height: 4, backgroundColor: colors.track, borderRadius: 4, marginTop: 8 },
  qFill: { height: 4, backgroundColor: colors.red, borderRadius: 4 },
  qDoneRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  qDoneTxt: { color: colors.green, fontSize: 11, fontWeight: "600" },
  qErr: { color: "#FCA5A5", fontSize: 11, marginTop: 4 },
  qPlay: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.play,
    alignItems: "center",
    justifyContent: "center",
  },
  qDl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: colors.play,
    borderRadius: 6,
    paddingVertical: 7,
    marginTop: 10,
    borderWidth: 0,
    borderColor: colors.play,
  },
  qDlTxt: { color: colors.playText, fontWeight: "700", fontSize: 11.5 },
  desc: { color: "#D4D4D4", marginTop: 8, lineHeight: 20, fontSize: 13 },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, alignSelf: "flex-start" },
  moreTxt: { color: colors.redSoft, fontWeight: "700", fontSize: 13 },
  castGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 },
  castCell: { width: (SCREEN_W - 32 - 30) / 4, alignItems: "center" },
  castAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#222" },
  castAvatarPh: { alignItems: "center", justifyContent: "center" },
  castName: { color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 6, textAlign: "center" },
  castChar: { color: colors.dim, fontSize: 10, textAlign: "center" },
  recoHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  refreshBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "#1C1C1C", borderWidth: 1, borderColor: "#2A2A2A" },
  refreshTxt: { color: colors.redSoft, fontSize: 12, fontWeight: "700" },
  recoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  recoCell: { width: (SCREEN_W - 32 - 16) / 3 },
  recoImgWrap: { borderRadius: 12, overflow: "hidden", backgroundColor: "#222" },
  recoImg: { width: "100%", aspectRatio: 2 / 3 },
  recoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  recoBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "700" },
  vfBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.red,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  vfTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  recoDlIcon: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  recoTitle: { color: colors.text, fontSize: 11, fontWeight: "600", marginTop: 6 },
  refreshFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#232323",
  },
  refreshFullTxt: { color: colors.redSoft, fontWeight: "700", fontSize: 13 },
  commentCard: { backgroundColor: "#171717", borderRadius: 12, padding: 12, marginTop: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#222", alignItems: "center", justifyContent: "center" },
  commentName: { color: colors.text, fontWeight: "700", fontSize: 13 },
  commentDate: { color: colors.dim, fontSize: 12 },
  commentBody: { color: colors.muted, fontSize: 13, marginTop: 8, lineHeight: 18 },
});
