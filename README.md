# excel

Contenu du dépôt :

| Dossier / fichier | Description |
|---|---|
| `trading/` | **Journal de trading + plan écrit + tableau de bord de performance** (application web autonome, voir `trading/README.md`) |
| `mobile/` | App mobile React Native / Expo (maquette *Stream*) |
| `Copy of ADDITION TEMPLATE for MALI 2026.xlsx` | Modèle Excel |
| `LISTE DES PRESCRIPTEUR.xlsx` | Liste des prescripteurs |
| `mandenbaoubab-mobile-ui.png` | Maquette UI mobile |

## Journal & plan de trading

Application statique (HTML/CSS/JS, aucune dépendance) : saisie des trades, métriques en **R** et en devise, courbe d'équité, drawdown, calendrier annuel, analyses par setup / instrument / session / émotion, plan de trading complet et score de discipline. Données sauvegardées localement, export CSV et JSON, **sauvegarde cloud automatique dans votre propre dépôt GitHub** (avec états d'erreur affichés en clair) et **verrouillage chiffré optionnel** (code, code de secours imprimable, biométrie) — l'application reste pleinement utilisable **hors ligne**.

**Application installable (PWA)** : utilisable sur ordinateur **et sur tablette**, en plein écran, avec une ergonomie tactile (journal en cartes, navigation en bas d'écran). **Rappels du plan en notifications de la tablette** (préparation, ouverture et fermeture des fenêtres de tir, revue du dimanche), produits par l'appareil lui-même, sans service tiers. **Tout fonctionne hors ligne** (saisie, statistiques, plan, checklists, verrouillage) ; seul l'envoi vers le dépôt GitHub attend le retour du réseau, et repart alors tout seul.

**Relire ses vrais trades** : la vue Formation reprend les trades de votre journal et vous repose les questions du plan (stop 15 pips, ratio 1:7, risque 1 %, fenêtre de tir, limite du jour) avec correction automatique et chiffrée — **le résultat du trade reste masqué jusqu'à votre conclusion**, et les questions de lecture, que l'application ne peut pas juger, sont enregistrées à part. La Formation indique aussi, chapitre par chapitre, **ce qui est gratuit en 2026 pour s'entraîner sur de vrais graphiques depuis la tablette** (replay journalier TradingView, compte démo MT5, quiz SMC), avec la limite du replay intraday devenu payant.

**Étude de cas réelle — l'or, 17 → 22 octobre 2025** : la vue Formation contient désormais un trade complet, du début à la fin, sur des cours réels (44 bougies journalières et 69 bougies horaires d'un relevé figé) : le contexte, la veille, le **balayage de liquidité** au-dessus des records (4 398,0 puis 4 393,6), le scénario écrit avant d'entrer, la cassure confirmée, l'entrée à 4 368, le stop à 4 402 jamais approché, les trois objectifs touchés (1:2, 1:4, 1:7) et **+238 $ l'once en douze heures** — puis la **relecture des 5 règles du plan, qui rend 4 sur 5** : le risque de 3,4 % sur un compte de 1 000 $ viole la règle du 1 %, et la page conclut qu'il fallait laisser passer ce trade ou attendre 3 400 $. Le contre-exemple (acheter le record : −6,9 % par once, −30,5 % du compte) est chiffré à côté. L'étude se termine par **5 décisions notées** (où vendre, quelle bougie confirme, où poser le stop, le trade est-il conforme, que faire avec 1 000 $) : correction immédiate expliquée, score enregistré avec la progression — et la suite du marché est dite honnêtement (après le plus bas de 4 021,2 le prix est retombé à 3 901,3 le 28 octobre : un plus bas ne fait pas un retournement). Les graphiques sont **dessinés par l'application** (SVG, aucune image, aucun appel réseau) — avec un placement automatique des étiquettes, vérifié par la recette : l'étude s'affiche et s'imprime hors ligne.

**Ma routine, jour par jour** : les quatre moments de la routine (avant la séance, pendant, après, revue du dimanche) sont **cochables et datés**, dans le plan (bloc 14). Une journée est **complète** quand toutes ses cases sont cochées, **entamée** dès la première ; l'écran affiche le jour en cours, permet de revenir sur la veille ou de choisir un jour dans la **grille du mois** (chaque jour porte son état : complète, entamée, rien), et calcule les **jours complets du mois**, la **semaine** et la **série d'affilée**. Une journée entamée mais non finie arrête la série ; une journée pas encore commencée laisse compter jusqu'à hier. Tout s'enregistre avec le journal — **chiffré par le verrou, sauvegardé dans votre dépôt, fusionné entre appareils jour par jour** — et les moments sont lus dans `plan.js`, jamais recopiés.

**Graphique à côté du journal** : un bouton ouvre TradingView **sur le bon instrument et la bonne unité de temps** (chaque trade a le sien), sans jamais charger de script externe ni transmettre de donnée du journal — vos tracés restent dans votre compte. Sur Android, la procédure d'écran partagé est écrite dans `trading/README.md`, avec le piège connu de l'application TradingView.

**Vue Formation** : le plan est expliqué **chapitre par chapitre, dans son ordre** (l'essentiel, les leçons, la lecture sur le graphique, les étapes à suivre, les erreurs fréquentes) avec **52 exercices notés** et un **entraîneur interactif** qui dessine ses propres graphiques de bougies et corrige chaque réponse en marquant la zone et le niveau de cassure. Six concepts à réviser, dont « identifier la tendance » ; la progression (chapitres étudiés, scores, série par concept) est conservée avec le journal et sauvegardée dans votre dépôt.

**Sur tablette**, trois voies (détaillées dans [`trading/README.md`](trading/README.md#sur-tablette-ipad--android)) :

1. **Wi-Fi local, tout de suite** : `node trading/tools/serve.js` affiche un QR code à scanner depuis la tablette (pas d'installation possible, ni de hors ligne, en `http://`).
2. **Application installable (recommandé)** : GitHub Pages → <https://github.com/moussantji/excel/settings/pages> → *Source : Deploy from a branch*, branche `main` (ou `arena/01a09dd0-excel`), dossier `/ (root)` → `https://moussantji.github.io/excel/` (la racine redirige vers l'application). Puis sur la tablette : iPad *Partager → Sur l'écran d'accueil*, Android *menu ⋮ → Installer l'application*.
3. **Sans GitHub** : déposer l'archive `trading-site.zip` sur [Netlify Drop](https://app.netlify.com/drop) ou Cloudflare Pages → adresse HTTPS en quelques secondes.

```bash
node trading/tools/serve.js     # http://localhost:8777
# ou simplement ouvrir trading/index.html
```

Sur tablette : ouvrir l'adresse HTTPS puis *Partager → Sur l'écran d'accueil* (iPad) ou *menu ⋮ → Installer l'application* (Android).

Détails, formules, modèles d'import CSV et guide du jeton GitHub : [`trading/README.md`](trading/README.md) (sections *Sauvegarde & vie privée* et *Sur tablette*).
