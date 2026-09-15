# Journal & Plan de trading — Tableau de bord de performance

Application **locale, sans dépendance** (HTML + CSS + JavaScript vanilla) pour :

1. **écrire un plan de trading** et le garder sous les yeux (règles de risque, setups, routine, KPI, checklists) ;
2. **tenir un journal** de chaque trade (chiffres, capture, émotion, erreur, respect du plan) ;
3. **voir ses performances** : courbe d'équité, drawdown, P&L par jour/mois/setup/instrument/session, distribution des R, calendrier annuel, score de discipline ;
4. **apprendre la méthode et s'entraîner** : la vue **Formation** explique le plan chapitre par chapitre et fait réviser chaque concept (lire une tendance, reconnaître une cassure, trouver une zone, repérer la liquidité, suivre Wyckoff) sur des graphiques générés et corrigés par l'application.

Le graphique de votre plateforme (TradingView) se met **à côté** de l'application, pas dedans : l'application vous emmène au bon instrument et à la bonne unité de temps d'un appui, sans jamais lire ni remplacer vos tracés (voir [Trader avec le graphique à côté](#trader-avec-le-graphique-à-côté-tradingview)).

Cible : compte **forex & indices CFD** (EURUSD, XAUUSD, US30, NAS100…), style intraday / swing court, résultats suivis **en R et en devise**.

**Utilisable sur ordinateur et sur tablette** : application installable (PWA), plein écran, fonctionne **hors ligne** et adaptée au tactile (voir la section [Sur tablette](#sur-tablette-ipad--android)).

![Tableau de bord](apercu-dashboard.jpg)

*Aperçus : `apercu-tablette.jpg` (journal en cartes sur iPad), `apercu-installation.jpg` (bandeau d'installation), `apercu-plan.jpg` (plan complet), `apercu-calendrier.jpg`.*

---

## Démarrer

L'application est 100 % statique : aucune installation n'est nécessaire.

| Méthode | Comment |
|---|---|
| **Le plus simple** | Double-cliquez sur `index.html` (fonctionne en `file://`, les données restent dans le navigateur). |
| **Sans double-clic** | `node tools/serve.js` puis ouvrez <http://localhost:8777/> |
| **Depuis le repo** | `npx serve trading` ou tout autre serveur statique. |
| **Sur tablette, via le Wi-Fi** | `node tools/serve.js` puis scanner le QR code affiché (voir § Sur tablette). |
| **Sur tablette, en application** | Publier en HTTPS (GitHub Pages, ou l'archive `trading-site.zip` sur Netlify Drop) puis l'ajouter à l'écran d'accueil. |

À la racine du dépôt, `index.html` redirige automatiquement vers `trading/` : une fois le site publié (GitHub Pages par exemple), l'adresse racine ouvre directement l'application.

Au premier lancement, le journal est vide. Trois boutons sont proposés : **Ajouter un trade**, **Importer un CSV**, **Charger la démo** (80 trades fictifs pour voir le tableau de bord en action — supprimables depuis *Paramètres*).

---

## Accès rapide depuis la tablette

![Ouvrir l'application sur la tablette](ouvrir-sur-tablette.png)

Scannez le QR code de l'image ci-dessus (`ouvrir-sur-tablette.png`) avec l'appareil
photo de la tablette : le navigateur ouvre <https://moussantji.github.io/excel/>.
Ajoutez ensuite l'application à l'écran d'accueil (*Partager → Sur l'écran
d'accueil* sur iPad, *⋮ → Installer l'application* sur Android).

## Hors ligne — ce qui marche sans réseau

L'application **fonctionne entièrement sans connexion** une fois ouverte une première fois en ligne : tout est calculé dans l'appareil, rien ne dépend d'un serveur.

| Sans réseau | État |
|---|---|
| Consulter, ajouter, modifier, supprimer des trades | ✅ normal |
| Tableau de bord, calendrier, analyses, plan, checklists | ✅ normal |
| Verrouiller / déverrouiller (code, Face ID ou empreinte) | ✅ normal — le chiffrement est local |
| Export CSV / JSON, impression du plan en PDF | ✅ normal |
| Sauvegarde cloud GitHub | ⏸ en attente : l'envoi repart seul au retour du réseau (= état *Hors ligne* dans la barre du haut) |
| Récupérer une sauvegarde distante | Internet nécessaire |
| Première ouverture, installation sur l'écran d'accueil | Internet nécessaire **une fois** |
| Mise à jour de l'application (nouvelle version publiée) | Internet nécessaire |

Deux précisions utiles :

- **Tablette en Wi-Fi local** (`http://192.168.x.x`) : l'application marche, mais le mode hors ligne **et** l'installation sur l'écran d'accueil exigent **https** — donc l'adresse GitHub Pages (ou Netlify/Cloudflare). C'est la seule raison de préférer cette adresse au Wi-Fi local.
- **Après une mise à jour**, ouvrez l'application une fois avec du réseau : le service worker (`trading-desk-v14`) récupère la nouvelle version, et le hors ligne continue d'être assuré.

Recette automatique du mode hors ligne : `node tools/offline-test.js` (service worker réel simulé, réseau coupé, serveur en panne, fichiers manquants).

---

## Rappels du plan (notifications de la tablette)

L'application peut prévenir **aux heures de vos fenêtres de tir**, directement dans la boîte de notifications de la tablette — sans compte, sans serveur, sans service tiers : la notification est fabriquée par l'appareil lui-même.

### Ce qui peut vous être annoncé

| Moment | Message | Heure (plan SMV, heure de Bamako) |
|---|---|---|
| Préparation (15 min avant, réglable ou désactivable) | « Fenêtre Europe dans 15 min » — relisez votre biais HTF et vos zones | 07:45 |
| Ouverture | « Fenêtre Europe ouverte » — attendez la prise de liquidité, le ChoCh, le BOS | 08:00 |
| Fermeture | « Fenêtre Europe terminée » — notez vos trades tant que c'est frais | 09:00 |
| Revue hebdomadaire (facultatif) | « Revue hebdomadaire » — 30 min de relecture du journal | dimanche, heure au choix |

Les heures viennent **du plan lui-même** (bloc « Fenêtres de tir » : Asie 01:00–02:00, Europe 08:00–09:00, USA 13:00–14:00, heure du Mali). Modifier une heure dans `assets/js/plan.js` la change à la fois dans le texte du plan et dans les rappels : une seule source, aucune divergence possible. Chaque fenêtre peut être suivie ou ignorée individuellement.

### Activer

**Paramètres → Rappels du plan** :

1. « Autoriser les notifications » (la demande doit venir d'un appui : c'est le cas de ce bouton) ;
2. cochez les fenêtres voulues, l'avance avant ouverture et les alertes souhaitées ;
3. « Envoyer un essai » pour vérifier que la tablette affiche bien la notification.

Les rappels sont **éteints par défaut** : rien n'est demandé tant que vous n'appuyez pas sur le bouton. Le réglage suit votre journal (il part dans la sauvegarde cloud comme le reste des paramètres).

### Ce qu'il faut savoir

- **Adresse sécurisée obligatoire** : les notifications n'existent qu'en `https://` (GitHub Pages, Netlify Drop, Cloudflare Pages) ou depuis l'icône installée. En Wi-Fi local `http://192.168.x.x`, elles sont indisponibles — l'écran des Paramètres le dit clairement au lieu de faire semblant.
- **iPhone / iPad** : les notifications n'existent que pour une application **installée** (Safari → Partager → Sur l'écran d'accueil), à partir d'iOS 16.4. Ouverte dans un onglet Safari, la tablette ne les affiche pas ; l'application explique la marche à suivre dans ce cas.
- **Application fermée** : sans serveur de push (et il n'y en a pas, c'est le principe), une application fermée ne peut pas se réveiller seule. Les rappels partent donc tant que l'application est ouverte, **y compris en arrière-plan** — le cas qui compte : vous regardez votre plateforme de trading, pas le journal. Les rappels manqués sont signalés **à la réouverture**, regroupés en un seul message.
- **Pas de rafale** : plusieurs rappels dus en même temps donnent un seul message. Un rappel trop vieux (fenêtre terminée depuis longtemps) est abandonné plutôt que d'arriver hors sujet.
- **Aucun doublon** : chaque rappel porte une étiquette datée ; un rappel ne part jamais deux fois dans la journée. Le bouton « Réarmer les rappels du jour » remet les compteurs à zéro si besoin.
- **Vie privée** : aucune donnée de trading n'est transmise. Le message contient seulement l'heure et le nom de la fenêtre. La trace des rappels partis reste dans le navigateur (`journal-trading:notifications`, purgée au bout de huit jours).
- Si l'application est **au premier plan** au moment du rappel, le message s'affiche dans l'application plutôt que par-dessus : pas de notification redondante pendant que vous lisez déjà l'écran.

Recette dédiée : `node tools/notify-test.js` (83 contrôles — heures du plan, heure du Mali, anti-doublon, rattrapage, refus d'autorisation, `http://`, iPad sans installation, service worker, absence d'appel réseau).

---

## Formation — apprendre la méthode et s'entraîner

La vue **Formation** (menu de gauche) transforme le plan déjà écrit en **cours suivi** : les **12 chapitres du plan, dans l'ordre** (les 4 lois, les setups, la routine, le journal), puis un **entraîneur** qui fait réviser chaque concept sur des graphiques que l'application dessine elle-même.

### Le cours, chapitre par chapitre

Chaque chapitre suit toujours la même forme, pour aller vite :

1. **L'essentiel** — trois phrases à retenir ;
2. **Les leçons** — la définition exacte de la méthode (structure, BOS, cause à effet, offre/demande, liquidité, Wyckoff), avec les chiffres du plan (1 %, 15 pips, 1:7, 2 stop loss par jour) ;
3. **Comment le voir sur le graphique** — ce qu'on regarde, dans quel ordre, et où la lecture se trompe ;
4. **Les étapes à suivre** — la marche à suivre numérotée, dans l'ordre ;
5. **Les erreurs fréquentes** — celles qui coûtent le plus cher, et leur correction ;
6. **Les exercices notés** — questions à choix multiple avec explication, plus des exercices de **calcul de risque** (taille de position, perte en devise, R du trade).

Un chapitre s'ouvre d'un appui ; l'application retient les chapitres déjà étudiés et propose le suivant.

### L'entraîneur — réviser par concept

| Concept | Ce que l'exercice demande |
|---|---|
| Lire la structure et en déduire la tendance | La direction et la qualité de la tendance, avant toute entrée |
| Reconnaître la nature d'une cassure de structure | BOS de continuation, piège, ou changement de caractère |
| Identifier les zones d'offre et de demande | Où se trouvent la zone et son intérêt, et la désigner d'un appui sur le graphique |
| Repérer la liquidité (EQH/EQL, intacts) | Le niveau que le prix va chercher, et pourquoi |
| Reconnaître le déroulé de Wyckoff (golden setup) | La phase en cours — et en particulier l'entrée en phase C (SPRING / UTAD) |
| Mélange de tous les concepts | Une séance de révision complète, sans savoir à l'avance ce qui sera demandé |

- **Les graphiques sont fabriqués par l'application** : 50 à 60 bougies dessinées en SVG à partir d'une graine tirée au hasard — aucun fichier d'image, aucun accès réseau, et un tirage « autre graphique » pour recommencer sur un cas neuf.
- **La correction est immédiate** : la réponse juste est expliquée, la zone et le niveau de cassure sont **dessinés sur le graphique** avec leurs repères, et la fausse piste est nommée (« la cassure a cassé sans être tenue : c'est un piège »).
- **Le graphique se touche** : pour désigner une zone, un appui suffit (converti en prix et en bougie, comme sur la tablette).

### Progression

Trois scores en haut de la vue : **chapitres étudiés**, **exercices de cours**, **entraîneur** (essais, bonnes réponses, série en cours, meilleure série, et le détail par concept). La progression est enregistrée **dans le journal** — donc chiffrée par le verrouillage comme le reste du journal, et sauvegardée dans votre dépôt GitHub : on reprend où on s'était arrêté, sur l'ordinateur comme sur la tablette. Le bouton **Remise à zéro** efface seulement la progression de la formation, pas les trades.

### D'où vient le cours

Le contenu suit **les deux documents de la méthode que vous avez fournis** (`ULTRA BOOK FX.pdf` et `PLAN TRADING.pdf`), et la vue cite la source de chaque chapitre. Quand un module du plan n'est pas traité dans les documents, l'application le **signale au lieu de l'inventer** : la vue « Sources du cours » liste ces manques à compléter (modules 9 à 11, détail des prises partielles, gestion du risque sur plusieurs positions).

### Relire ses vrais trades

L'entraîneur travaille les concepts sur des graphiques **fabriqués par l'application**. La relecture, elle, reprend **vos trades réels** : l'application tire un trade clôturé du journal et vous repose les questions du plan, **sans révéler le résultat**.

Deux familles de questions, volontairement séparées :

| Famille | Exemples | Correction |
|---|---|---|
| **Les règles chiffrées du plan** | stop ≤ 15 pips, ratio visé ≥ 1:7, risque ≤ 1 % du capital, entrée dans une fenêtre de tir, limite de trades par jour | **Automatique et incontestable** : l'application compare votre réponse au chiffre, avec la mesure affichée (« écart entrée → stop mesuré : 13,0 pips ») |
| **Votre jugement de lecture** | « la structure allait-elle dans le sens de votre entrée ? » (avant la révélation) puis « était-ce un bon trade selon le plan, indépendamment du résultat ? » (après) | **Non notée, par honnêteté** : l'application ne peut pas lire le graphique de vos trades, elle ne fait pas semblant. Les réponses sont enregistrées pour montrer votre **constance** d'un trade à l'autre |

Pourquoi le résultat reste caché : pour que votre lecture ne soit pas influencée par ce que vous savez déjà. Le bilan de relecture (trades relus, règles justes, jugements) est rangé **avec la progression de la formation**, donc chiffré par le verrouillage et sauvegardé dans votre dépôt.

**Point de rigueur** : la règle des 15 pips est celle des **paires forex**. Sur l'or et les indices, l'application ne la pose pas — elle ne mélange pas les unités, et affiche l'écart en points.

### Pratiquer sur de vrais graphiques (gratuit, depuis la tablette)

L'entraîneur est illimité et hors ligne, mais ses graphiques sont générés. Voici ce qui est **réellement gratuit en 2026** et utilisable depuis une tablette Android (limites constatées, à revérifier si les éditeurs changent d'offre) :

| Chapitre du plan | Outil gratuit | Ce que vous y travaillez |
|---|---|---|
| 05 — La structure | **TradingView**, replay en unité **journalière** (gratuit dans l'application Android) | Le biais HTF, jour par jour : haussière, baissière ou consolidation — puis vérification |
| 06 — Offre et demande | TradingView, replay journalier | Marquer la zone **avant** d'avancer le prix, et compter celles qui sont réellement défendues |
| 07 — La liquidité | TradingView, replay journalier | Repérer EQH/EQL et intacts avant l'avance, noter lequel vient chercher le prix |
| 04 — Wyckoff | TradingView, replay journalier | Nommer les phases A à E à mesure qu'elles se forment, sans voir la suite |
| 03 et 09 — Risque, routine | **MetaTrader 5 pour Android**, compte démo gratuit | Le geste en conditions réelles : fenêtre de tir, taille de position, stop, breakeven, prises partielles, arrêt après deux stop loss |
| 08 — Tri des configurations | **QuizTraders** (navigateur, en anglais) | Décider « acheter / vendre / ne rien faire » sur de vrais graphiques SMC, correction immédiate (offre gratuite limitée) |

#### Applications du Play Store (Android) qui font vraiment réviser

La Formation liste aussi, **dans l'application et hors ligne**, les applications Android d'entraînement qui valent le détour — avec leur langue et leur limite, pour ne pas perdre du temps sur celles qui n'apprennent rien :

| Application | Ce qu'elle fait | Prix / langue | La limite |
|---|---|---|---|
| **Candle Master : Trading Game** | Prédire la prochaine bougie, quiz de chandeliers (180+ questions), précision et séries suivies | Gratuit · français | Petit éditeur (peu de téléchargements) ; l'application partage l'identifiant de l'appareil. Muet sur le SMC |
| **Chart Quiz — Stock & Crypto** | Vrais graphiques (crypto, actions, indices) : prédire le mouvement suivant, correction immédiate | Gratuit · anglais | Marchés surtout américains, aucune notion SMC |
| **Trading Game (GoForex)** | Simulateur temps réel, plus de 400 questions de quiz, leçons courtes | Gratuit, sans pub ni inscription · français | Orienté débutant et forex classique ; la partie « signaux » n'a rien à voir avec le plan |
| **Forex Smart Money Concept** (Appnovasi) | Fiches SMC : order blocks, FVG, premium/discount, cassures de structure, plans de trade | Gratuit · anglais | Lecture seule, sans exercices corrigés ni score |
| **Forex Trading : Learn SMC & ICT (GTS)** | SMC et ICT, simulateur papier, calcul de position, journal | Gratuit + offres payantes · anglais | Beaucoup de contenu verrouillé en premium, sources non citées |

**Mise en garde écrite dans l'application** : une grande partie des applications « trading » du Play Store sont des **vitrines de courtiers** qui poussent au dépôt d'argent réel (certaines accumulent les avis de retraits en échec). Aucune n'est nécessaire pour s'entraîner ; pour passer des ordres sans risque, un **compte démo** chez un courtier régulé suffit.

**La limite à connaître** : chez TradingView, le replay **intraday** (15 min, 1 h) n'est plus gratuit (offre payante depuis 2026). En gratuit, le replay s'arrête au **journalier** — ce qui couvre exactement la partie HTF du plan. L'intraday, c'est l'entraîneur de l'application qui le couvre, hors ligne, avec 50 à 60 bougies par scénario. **Les deux ensemble couvrent tout le plan.**

**Si un jour vous avez un ordinateur** : MetaTrader 5 dispose d'un mode de test **visuel** gratuit qui rejoue n'importe quelle période en intraday, bougie par bougie, avec des ordres placés à la main (Espace pour mettre en pause, F12 pour avancer d'une bougie, F9 pour passer un ordre). C'est la seule façon gratuite de s'entraîner en intraday sur des données réelles — dites-le-moi ce jour-là, j'ajouterai la procédure pas à pas dans la Formation.

### Hors ligne, tablette, impression

- Tout le cours, les exercices et l'entraîneur sont **dans le cache hors ligne** : la formation s'utilise sans réseau, y compris sur l'application installée.
- **Impression / PDF** : le bouton *Tout déplier (impression)* ouvre les chapitres, l'entraîneur est masqué (`@media print`) : la sortie papier contient le cours et les exercices, pas les graphiques d'entraînement.
- Aucun emoji dans le cours ni dans l'entraîneur ; aucune ressource distante (polices système, icônes vectorielles dessinées par l'application).

La formation **explique** le plan, elle ne le remplace pas : le plan reste la référence en séance, la formation sert à le comprendre et à s'entraîner dessus.

Recettes dédiées : `node tools/formation-test.js` (76 contrôles — contenu et définitions des notions clés, cohérence des graphiques sur 1 400 scénarios, questions et correction, calculs de risque, rendu et progression dans la vue, cache hors ligne et impression) et `node tools/relecture-test.js` (61 contrôles — règles chiffrées et leur notation, masquage du résultat avant la révélation, jugements séparés du score, bilan enregistré, cas particuliers).

---

## Trader avec le graphique à côté (TradingView)

Le journal et le graphique TradingView **cohabitent sur la même tablette** : l'application peut ouvrir **le bon symbole, sur la bonne unité de temps**, d'un appui — puis vous placez les deux fenêtres côte à côte.

### Où se trouvent les boutons

| Endroit | Ce qu'il fait |
|---|---|
| **Journal** → en-tête, bouton *Graphique* | Demande l'instrument et l'unité de temps, puis ouvre le graphique |
| **Journal** → chaque ligne / chaque carte | Ouvre directement le graphique **de l'instrument de ce trade** |
| **Fiche d'un trade** → *Voir le graphique* | Ouvre l'instrument en cours de saisie (suit ce que vous tapez dans le champ Instrument) |
| **Formation** → entraîneur → *Comparer sur un graphique réel* | Ouvre le graphique de l'instrument que vous tradez le plus, pour comparer votre lecture simulée au marché réel |

Chaque bouton ouvre un **nouvel onglet** : votre journal reste à l'écran, rien n'est remplacé.

### Vous mettre TradingView à côté (Android)

1. Ouvrez **TradingView** et l'application.
2. **Applications récentes** (le carré ou le geste bas→haut) → appui sur l'icône de TradingView au-dessus de sa vignette → **Ouvrir en affichage fractionné**.
3. La moitié du haut est prise par TradingView ; dans la moitié du bas, choisissez l'application du journal. La séparation se déplace en glissant la poignée centrale.

**Un piège connu** : depuis une mise à jour de 2026, l'**application** TradingView pour tablette Android refuse parfois l'écran partagé (le système affiche alors que ce n'est pas possible). Dans ce cas, utilisez **tradingview.com dans le navigateur** (Chrome) : le navigateur, lui, accepte toujours le fractionné, et le graphique est identique.

Sur iPad, la fonction s'appelle **Split View / Slide Over** (glisser une application depuis le Dock) ; la manipulation est décrite dans la section tablette ci-dessous.

### Ce que l'application peut faire — et ce qu'elle ne peut pas

| | |
|---|---|
| **Ce qu'elle fait** | Ouvrir le bon symbole et la bonne unité de temps, sans vous faire chercher ; garder l'adresse lisible (exemple : `?symbol=OANDA:XAUUSD&interval=240`) ; rester utilisable hors ligne, avec un message clair quand le réseau manque |
| **Ce qu'elle ne fait pas** | **Lire vos tracés** (zones, trendlines, position, watchlist). Aucun site web n'a accès au contenu d'une autre application ; l'API qui le permettrait est réservée aux professionnels. Vos tracés restent dans **votre compte** TradingView, et c'est très bien ainsi : rien ne sort de votre appareil |
| **Ce qu'elle ne fait jamais** | Charger un script TradingView dans la page, ouvrir une fenêtre toute seule, ou envoyer autre chose que le symbole et l'unité de temps. **Aucune donnée du journal** (date, prix, montant, note) ne part avec le lien |

### Réglages (Paramètres → Graphique TradingView)

- **Afficher le bouton** : allumé par défaut, déplaçable en un clic (les boutons disparaissent partout, y compris dans l'entraîneur et la fiche de trade).
- **Unité de temps** : 15 minutes, 1 heure, 4 heures, 1 jour, 1 semaine.
- **Correspondance des symboles** : l'application propose un symbole par instrument (les paires forex chez **FX**, l'or et l'argent chez **OANDA**, les indices chez **TVC**, les cryptos chez **BITSTAMP**). **Votre courtier a peut-être les mêmes références sous un autre fournisseur** : écrivez le vôtre une fois (exemple `CAPITALCOM:US30`, `FOREXCOM:XAUUSD`, `OANDA:XAUUSD`), il est réutilisé partout. Videz un champ pour revenir au symbole par défaut.
- **Tester l'ouverture** : ouvre le graphique de l'instrument le plus tradé, sans rien enregistrer.

Recette dédiée : `node tools/graphe-test.js` (57 contrôles — symboles et corrections, adresse produite, confidentialité, hors ligne, boutons présents/éteints, click-through, cache hors ligne et impression).

---

## Sur tablette (iPad / Android)

Trois façons de l'utiliser sur la tablette, de la plus rapide à la plus complète.

### Voie A — Tout de suite, en Wi-Fi local (aucun compte, rien à installer)

```bash
node tools/serve.js
```

Le terminal affiche l'adresse à ouvrir sur la tablette **et un QR code à scanner** avec l'appareil photo :

```
   Sur cet ordinateur  :  http://localhost:8777/
   Sur la tablette     :  http://192.168.1.42:8777/   (même réseau Wi-Fi)
   [QR code à scanner]
```

L'application fonctionne entièrement (saisie, statistiques, graphiques, export JSON), mais en `http://` elle n'est **pas installable** et **pas disponible hors ligne** : c'est la limite des navigateurs, qui réservent ces fonctions au HTTPS. Pour aller plus loin, choisissez la voie B ou C.

### Voie B — Application installable via GitHub Pages (recommandé)

Le dépôt est **public**, donc GitHub Pages est disponible gratuitement.

1. **Ouvrir la page** : <https://github.com/moussantji/excel/settings/pages>
2. Section **Build and deployment** → le champ **Source** est un *menu déroulant* : par défaut il n'affiche qu'une valeur (« GitHub Actions » ou « None »). **Cliquez sur ce menu** pour voir les deux choix, puis sélectionnez **Deploy from a branch**.

   ```
   Build and deployment
     Source   [ GitHub Actions  ▾ ]   ← cliquer ici
                ┌──────────────────────────┐
                │ Deploy from a branch   ✓ │
                │ GitHub Actions           │
                └──────────────────────────┘
   ```
3. Un nouveau bloc **Branch** apparaît : choisir la branche `arena/01a09dd0-excel` (pour tester tout de suite) ou `main` (après fusion de la pull request), dossier **/ (root)**, puis **Save**.
4. Après 1 à 3 minutes, l'adresse s'affiche en haut de la page du même nom :

```
https://moussantji.github.io/excel/
```

La racine du site redirige automatiquement vers l'application (`/trading/`), donc c'est cette adresse qu'il faut enregistrer sur la tablette.

#### Si « Source » ou « Deploy from a branch » n'apparaît pas

| Cause probable | Solution |
|---|---|
| Vous consultez GitHub **sur la tablette / le téléphone** : la version mobile masque le menu des réglages | Ouvrir le menu du navigateur → **Version pour ordinateur** (Safari : bouton **aA** → *Demander le site web pour ordinateur* ; Chrome Android : **⋮** → *Site pour ordinateur*), puis rouvrir l'adresse ci-dessus |
| Le menu **Source** affiche seulement « GitHub Actions » | C'est un menu déroulant : cliquez dessus, l'option **Deploy from a branch** s'y trouve |
| Vous êtes sur **Settings** mais pas sur la page **Pages** | Dans le menu de gauche, section **Code and automation** (ou *Sécurité* selon la version), cliquer sur **Pages** — ce n'est pas la même page que *General* |
| La page affiche un écran d'accueil « GitHub Pages » | Cliquer sur **Configure** / **Get started** : le menu **Source** apparaît ensuite |
| Vous n'êtes **pas propriétaire** du dépôt | Seul le propriétaire (ou un administrateur) voit et modifie cette page |
| Un bandeau parle d'un **forfait payant** | Cela arrive quand le dépôt est **privé**. Ici le dépôt `moussantji/excel` est public : ce message ne devrait pas s'afficher. Si c'est le cas, dites-moi le texte exact affiché. |
| Rien de tout cela | Utilisez la **voie C** (5 minutes, sans GitHub) |

### Voie C — Sans GitHub : Netlify Drop ou Cloudflare Pages

Une archive prête à publier est fournie à la racine du dépôt : **`trading-site.zip`** (326 Ko, `index.html` à la racine de l'archive). Elle se régénère à tout moment avec :

```bash
node trading/tools/make-site-zip.js
```

- **Netlify Drop** : ouvrir <https://app.netlify.com/drop>, déposer/choisir `trading-site.zip` → une adresse HTTPS est prête en quelques secondes (compte gratuit pour la conserver).
- **Cloudflare Pages** : *Workers & Pages → Create → Pages → Upload assets*, puis déposer l'archive.
- **Vercel** : *Add New → Project → Import* l'archive ou le dépôt GitHub.

Le résultat est identique à GitHub Pages : HTTPS, installation sur écran d'accueil, fonctionnement hors ligne (l'archive a été testée dans cet état).

### Installation sur la tablette (voies B et C)



| Appareil | Manipulation |
|---|---|
| **iPad / iPhone (Safari)** | Ouvrir l'adresse → bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**. |
| **Tablette Android (Chrome)** | Ouvrir l'adresse → menu **⋮** → **Installer l'application** / **Ajouter à l'écran d'accueil**. |
| **Ordinateur (Chrome/Edge)** | Icône d'installation dans la barre d'adresse, ou menu → *Installer*. |

L'application affiche elle-même le mode opératoire : un bandeau en haut d'écran propose l'installation, et un bouton « Installer sur cet appareil » figure en bas de la barre latérale.

### Ce qui est pensé pour la tablette

- **Barre de navigation en bas**, cibles tactiles ≥ 44 px, champs de saisie en 16 px (évite le zoom automatique sur iOS).
- **Journal en cartes** : sur écran étroit, chaque trade devient une carte (instrument, P&L, R, setup, session, risque, pips, frais, durée, badges plan/émotion/erreur) — plus de tableau coupé. Bascule **Tableau / Cartes / Auto** en haut du journal ; en mode *Auto*, l'affichage s'adapte à la largeur de l'écran.
- **Rotation** portrait/paysage prise en charge (mode paysage : barre latérale complète, grille de KPI sur 3 colonnes).
- **Hors ligne** : après une première ouverture avec connexion, le service worker met en cache l'application. Le bandeau d'accueil, l'onglet actif, les checklists et les saisies en cours sont conservés si vous passez à une autre application.
- **Mises à jour** : le code (JS/CSS/HTML) est chargé *réseau d'abord* — une nouvelle version est donc active dès le premier rechargement, y compris sur l'application installée, sans vider le cache à la main.
- **Synchronisation entre onglets** : si le journal est ouvert deux fois (ou sur deux fenêtres), l'affichage se met à jour. Un bouton **⟳** en haut à droite recharge les données enregistrées.

### Données de démonstration

Le bouton **Charger la démo** sert uniquement à découvrir l'application : il installe 80 trades fictifs cohérents. Chaque trade est marqué « démo », ce qui permet de les retirer **sans toucher à vos trades réels**, à trois endroits :

- le bandeau violet en haut du tableau de bord → bouton **Supprimer la démo** ;
- le bouton **Supprimer la démo (n)** dans la barre d'outils du journal ;
- **Paramètres → Données & sauvegarde → Supprimer les trades de démo (n)**.

Un indicateur dans la barre du haut rappelle en permanence **« Mode démonstration — n trades fictifs »** tant qu'il en reste. Dès qu'il n'y a plus aucun trade, le tableau de bord affiche l'écran d'accueil (ajouter un trade, importer un historique, voir la démo) au lieu de graphiques vides.

### Vos données sur tablette

Elles sont stockées **dans le navigateur de la tablette** et, si vous l'activez, **sauvegardées automatiquement dans votre dépôt GitHub privé** (voir *Sauvegarde cloud automatique*). Vous pouvez en plus les **chiffrer avec un code** (voir *Verrouillage et chiffrement*), avec Face ID sur iPad.

- Pour **retrouver le même journal sur l'ordinateur et la tablette** : activez la *Sauvegarde cloud* sur les deux appareils (même dépôt, même fichier) — la fusion se fait par trade. Sinon, *Exporter → Sauvegarde JSON* sur l'un puis *Importer* sur l'autre.
- Un vidage du navigateur, une réinstallation ou une navigation privée effacent le stockage local : avec la sauvegarde cloud, il suffit de reconfigurer le dépôt pour tout retrouver. Sans elle, gardez la **sauvegarde JSON hebdomadaire**.

### Vérifier le rendu sur tablette (développement)

```bash
node tools/serve.js                 # dans un premier terminal
npm i -D puppeteer
node tools/tablet-check.js          # dans un second : contrôle iPad portrait/paysage et Android 10"
```

Le script vérifie l'absence de débordement horizontal, la taille des cibles tactiles, la vue cartes et le rechargement hors ligne.

---

## Ce que contient chaque vue

### 📊 Tableau de bord
- **Garde-fous du jour** : nombre de trades restants, perte journalière encore disponible, alerte rouge dès qu'une limite du plan est atteinte.
- **12 KPI** : résultat, capital, total R, taux de réussite, profit factor, ratio gain/perte, drawdown max, espérance par trade, respect du plan, meilleur/pire trade, durée moyenne.
- **Courbe de performance** avec 4 modes : *Équité*, *Cumul R*, *Drawdown*, *P&L par jour* (survol = détail du trade).
- **Objectifs du mois** : progression vers +5 % (paramétrable), perte journalière, semaine en cours, drawdown vs seuil.
- **Répartition** : donut gagnants/perdants + distribution des multiples de R.
- **Performance mensuelle** : graphique + tableau (résultat, % du capital, total R, réussite, PF, espérance).
- **Performance par catégorie** : setup, instrument, session, jour de semaine, heure, sens.
- **Discipline** : score sur 100 et tableau « règle du plan / cible / réalisé / écart ».

### 📒 Journal
- Tableau triable et filtrable (instrument, setup, session, sens, respect du plan, recherche plein texte, période).
- Formulaire complet avec **calculs automatiques** : pips, R:R prévu, risque estimé, P&L net, multiple de R (aperçu en direct avant enregistrement).
- Dupliquer / supprimer une ligne en un clic, import CSV, export CSV ou sauvegarde JSON.

### 🗓️ Calendrier
- 12 mini-calendriers annuels : chaque jour coté en couleur avec son résultat et son total de R.
- Clic sur un jour → détail des trades de la journée + notes.
- Top 10 des meilleures et des pires journées, résultat par mois.

### 🔍 Analyses
- Indicateurs avancés : SQN, Sharpe par trade, écart-type des R, séries gagnantes/perdantes, frais, risque cumulé, coût du hors-plan.
- **Conformité au plan chiffrée** : espérance des trades « plan respecté » vs « hors plan » — autrement dit, combien coûte chaque écart.
- Classements par setup, session, jour, heure, instrument, émotion, erreur.

### 🧭 Plan de trading — méthode SMV (Smart Money Vision)
Plan rédigé sur la méthode **SMV** : les 4 lois (structure, offre/demande, cause à effet, liquidité), les types de BOS, les phases d'accumulation et de distribution, la lecture de la liquidité (intact, EQH/EQL, inducement, complexe pull back) et les outils (fibo SMC premium/discount, IPA, market shift, décompte 0-1-2-3).
- **4 setups documentés** avec 6 lignes chacun (contexte, déclencheur, entrée, stop, objectifs, invalidation) : Golden Setup (phase C), Complexe Pull Back, Market Shift (ChoCh), ODF.
- Règles de risque chiffrées : **1 % maximum par trade, stop 15 pips maximum, ratio minimum 1:7, 2 stop loss par jour maximum**, mise à breakeven à la cassure, prises partielles 30 % / 50 % / solde.
- Fenêtres de tir : Asie 1h–2h, Europe 8h–9h, USA 13h–14h (heure de Bamako).
- **4 checklists interactives** (pré-trade, gestion de position, post-trade, revue hebdomadaire) dont l'état est sauvegardé.
- **2 contrôles de discipline supplémentaires** dans le suivi : part des trades dont le ratio visé atteint 1:7 et respect du stop à 15 pips maximum.
- Bouton **Imprimer / PDF** avec une feuille de style dédiée (fond clair, lisible sur papier).

### 🎓 Formation
- **Le cours complet, chapitre par chapitre** : l'essentiel, les leçons, la lecture sur le graphique, les étapes à suivre, les erreurs fréquentes et **52 exercices notés** (dont le calcul de risque).
- **L'entraîneur** : graphiques de bougies générés par l'application et corrigés immédiatement, sur **6 concepts** — tendance, cassure de structure, zones d'offre et de demande, liquidité, Wyckoff, révision mélangée.
- **Progression enregistrée** : chapitres étudiés, score des exercices, bilan de l'entraîneur (série, meilleure série, détail par concept), conservée avec le journal et sauvegardée dans votre dépôt.
- **Sources et manques** : la source de chaque chapitre, et les points du plan non couverts par les documents fournis.
- Utilisable **hors ligne** et **imprimable** (l'entraîneur est masqué à l'impression).

### ⚙️ Paramètres
Capital, devise, risque par trade, valeur du pip, limites (jour/semaine/drawdown), objectif mensuel, listes d'instruments, de setups et de sessions ; **sécurité** (verrouillage, chiffrement, code de secours, biométrie, verrouillage automatique) ; **sauvegarde cloud (dépôt GitHub)** : dépôt, branche, fichier, jeton, test de connexion, journal des dernières opérations ; **rappels du plan** (notifications de la tablette aux heures des fenêtres de tir, avec aperçu des prochains rappels) ; **graphique TradingView** (bouton dans le journal, unité de temps, correspondance des symboles instrument par instrument) ; import/export ; effacement des données.

---

## Comment sont calculés les indicateurs

| Indicateur | Formule |
|---|---|
| P&L net | `P&L brut − frais` |
| Multiple R | `P&L net ÷ risque` (risque saisi, ou calculé : `taille × distance au stop ÷ taille du pip × valeur du pip`) |
| Pips | `(sortie − entrée) ÷ taille du pip` (signe selon achat/vente) |
| Taux de réussite | `trades gagnants ÷ trades clôturés` |
| Profit factor | `somme des gains ÷ somme des pertes` (en valeur absolue) |
| Espérance (R) | `moyenne des multiples R` |
| Ratio gain/perte | `gain moyen ÷ perte moyenne` |
| SQN | `√N × espérance ÷ écart-type des R` |
| Drawdown | `équité − plus haut atteint` (en % : relatif au plus haut), calculé depuis le capital de départ |
| Score de discipline | moyenne des 12 règles du plan (conforme = 1, à surveiller = 0,5, écart = 0) |

La **taille du pip** est déduite automatiquement de l'instrument : forex 0,0001 · paires JPY 0,01 · or 0,1 · indices 1 point · crypto 1. La valeur du pip par lot est paramétrable (10 € par défaut).

---

## Importer un CSV / Excel

1. Dans Excel : **Fichier → Enregistrer sous → CSV UTF-8** (ou copiez-collez dans le formulaire d'import).
2. Dans l'application : *Journal → Importer CSV* (ou *Paramètres → Importer*).
3. Le séparateur (`;`, `,`, tabulation) et les décimales (virgule ou point) sont détectés automatiquement, ainsi que les entêtes en français comme en anglais.

Modèles fournis dans `exemples/` :

- `modele-journal.csv` — toutes les colonnes disponibles ;
- `modele-journal-simple.csv` — colonnes minimales (date, instrument, sens, entrée, stop, sortie, taille, risque, frais, plan, émotion, erreur, notes) ;
- `donnees-demo.csv` — les 80 trades de démonstration.

Colonnes reconnues (accents et casse ignorés) : `Date, Heure, Instrument/Symbole/Paire, Sens/Direction, Session, Setup/Stratégie, Entrée, Stop/SL, Objectif/TP, Sortie, Taille/Lots/Volume, Risque, P&L, Frais/Commission, P&L net, R, Respect du plan, Émotion, Erreur, Durée, Notes, Capture`.

> Si la colonne `R` est fournie sans P&L, elle est utilisée telle quelle. Si seul le « P&L net » est fourni, il devient le résultat et les frais passent à 0.

---

## Sauvegarde & vie privée

### 1. Hors ligne, sur l'appareil (`localStorage`)

Les données sont stockées **dans votre navigateur**. L'application fonctionne entièrement hors ligne : réseau coupé, tout continue d'être enregistré.

- *Paramètres → Exporter → Sauvegarde JSON* produit un fichier complet (trades + réglages + cases des checklists) à réimporter ailleurs.
- Videz le cache du navigateur sans sauvegarde = données perdues. Faites la sauvegarde JSON en même temps que la revue hebdomadaire.
- Un export CSV est également disponible (séparateur `;`, virgules décimales : ouvrable directement dans Excel français).

### 2. Verrouillage et chiffrement du journal (optionnel)

*Paramètres → **Sécurité*** : le journal est chiffré avec un code que vous seul connaissez.

- **Ce qui est chiffré** : les trades, les paramètres et les cases des checklists — sur l'appareil **et** dans le fichier du dépôt GitHub. Le fichier du dépôt ne contient plus que du texte chiffré (AES-GCM 256, clé dérivée du code par PBKDF2).
- **Code de secours** : affiché **une seule fois** à l'activation, imprimable (bouton *Imprimer / enregistrer*). Il ouvre le même journal si vous oubliez le code, et permet ensuite d'en choisir un nouveau.
- **Biométrie** : Face ID / empreinte (passkey + dérivation de clé) sur les appareils qui savent le faire — iPadOS 18+, Android, macOS récents. Sur Surface/PC Windows, Windows Hello ne fournit pas encore cette clé : le code est demandé.
- **Verrouillage automatique** réglable (jamais, 5, 15, 30, 60 minutes sans activité), option « rester ouvert tant que l'onglet est ouvert », et bouton *Verrouiller maintenant*.
- **Précautions** : utilisez un code de **6 chiffres minimum** (le chiffrement est solide, un code de 4 chiffres ne l'est pas), et rangez le code de secours ailleurs que sur l'appareil.

> 🔴 **Code oublié + code de secours perdu = journal illisible définitivement.** Personne ne peut le reconstituer (ni l'hébergeur, ni GitHub, ni ce dépôt). Rien n'est effacé pour autant : les données chiffrées restent en place, il faut juste le code pour les ouvrir.
>
> La sauvegarde cloud continue de fonctionner avec le verrouillage : le fichier du dépôt est chiffré, chaque appareil doit saisir le même code pour le lire. Pendant que le journal est verrouillé, **aucune synchronisation n'a lieu** (impossible d'écraser la sauvegarde avec un journal vide par erreur).
>
> Le chiffrement demande une adresse **https** (l'adresse GitHub Pages de l'application). Ouvert depuis un fichier local en `http://`, le navigateur refuse de chiffrer : l'application le dit et propose la sauvegarde cloud ou l'export JSON.

### 3. Sauvegarde cloud automatique (votre dépôt GitHub)

*Paramètres → **Sauvegarde cloud (GitHub)*** : l'application écrit vos données dans **un fichier de votre dépôt GitHub**. Gratuit, sans service tiers, sans abonnement. Dès qu'une donnée change, la sauvegarde part toute seule (45 secondes après la dernière modification, et au retour du réseau).

Ce qui est sauvegardé : **tous les trades réels**, les paramètres du compte et de risque, et les **cases cochées des checklists**. Les trades de démonstration ne partent pas dans le dépôt.

| Champ | Valeur conseillée |
|---|---|
| Propriétaire | votre compte GitHub (ex. `moussantji`) |
| Dépôt | un dépôt **privé dédié** (ex. `journal-trading`) |
| Branche | `main` |
| Fichier | `journal-trading/sauvegarde.json` (créé automatiquement) |
| Jeton | jeton *fine-grained*, permission **Contents : Read and write** |

#### Créer le jeton (2 minutes)

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. **Repository access** : *Only select repositories* → votre dépôt de sauvegarde.
3. **Permissions → Repository permissions → Contents** : **Read and write**.
4. **Expiration** : 90 jours (à recréer ensuite). Générez, copiez, collez dans le champ *Jeton d'accès*.
5. Cliquez **Tester la connexion**, puis **Activer la sauvegarde automatique**.

> **Le jeton reste dans ce navigateur** (stockage local de l'appareil) et n'est **jamais** écrit dans le dépôt ni dans le code. Un dépôt **privé dédié** est fortement conseillé : dans un dépôt public, votre journal serait lisible par tout le monde (l'application vous le signale).

#### Les états de la sauvegarde (affichés en clair dans l'application)

| État | Ce que ça veut dire | Ce que fait l'application |
|---|---|---|
| Sauvegarde cloud désactivée | Aucun dépôt configuré | Rien, tout reste local |
| Journal verrouillé — sauvegarde en pause | Le verrouillage est actif et le code n'a pas été saisi | N'envoie ni ne récupère rien (protection contre l'écrasement) |
| Configuré, aucune sauvegarde envoyée | Premier envoi pas encore fait | Envoie à la première modification |
| Hors ligne — modifications en attente | Réseau coupé (ou avion) | Garde tout en local, repart au retour du réseau |
| *n* modification(s) à sauvegarder | Envoi différé en cours | Envoie après 45 s |
| Synchronisation en cours… | Appel en cours vers GitHub | Attend la réponse (15 s maximum) |
| **À jour** | Sauvegarde à jour | Indique la date du dernier envoi |
| Sauvegarde disponible dans le cloud | Un autre appareil a une sauvegarde plus récente et le journal local est vide | Propose de la **récupérer** (jamais sans votre accord) |
| Conflit : le cloud a été modifié ailleurs | Deux appareils ont modifié le journal | Propose **Fusionner les deux** / Garder mes données / Prendre le cloud |
| Clé refusée | Jeton expiré, révoqué, ou sans droit sur le dépôt | Explique quoi vérifier (Contents : Read and write) |
| Quota GitHub atteint | Trop de requêtes | Réessaie plus tard, rien n'est perdu |
| GitHub injoignable | Panne ou réseau | Réessaie, données locales intactes |
| Échec de la sauvegarde | Autre erreur, renvoyée telle quelle | Affiche le message exact |

Un **bandeau** apparaît dans l'application uniquement quand une action est attendue (hors ligne, conflit, jeton refusé…), avec les boutons utiles. Le reste du temps, une **pastille** discrète dans la barre du haut suffit.

#### Plusieurs appareils

Tablette + ordinateur : chaque appareil garde son journal et **fusionne par trade** — les modifications les plus récentes gagnent, les suppressions sont conservées (un trade supprimé sur la tablette ne revient pas de l'ordinateur). En cas de doute, « Fusionner les deux » est toujours proposé.

#### Mise en place rapide du dépôt

```bash
# sur GitHub : New repository → nom « journal-trading » → Private → Create
# rien à uploader : le premier envoi crée le fichier de sauvegarde tout seul
```

---

## Personnaliser le plan

Le contenu du plan (textes, setups, checklists, seuils) est dans `assets/js/plan.js`, objet `PLAN`. Les règles chiffrées du tableau de bord (limites de risque, instruments, setups, sessions, devise, valeur du pip) se modifient directement dans *Paramètres*.

Règle de bon sens proposée dans le plan lui-même : **une modification du plan par mois maximum, jamais après une perte**, et seulement après 20 trades sur un setup.

---

## Structure du projet

```
trading/
├── index.html                    Application (point d'entrée)
├── manifest.webmanifest          Application installable : nom, icônes, raccourcis
├── sw.js                         Service worker : cache hors ligne
├── assets/
│   ├── icons/                    Icônes (192/512/maskable/Apple/iOS)
│   ├── css/styles.css            Thème sombre / or (jetons de design), responsive, impression, tactile
│   └── js/
│       ├── store.js              État, persistance, trade normalisé, CSV, démo
│       ├── metrics.js            Statistiques, agrégats, drawdown, objectifs, garde-fous
│       ├── charts.js             Graphiques SVG sans dépendance (ligne, barres, donut, calendrier)
│       ├── plan.js               Contenu du plan + contrôles de discipline
│       ├── formation-contenu.js  Cours de la vue Formation (12 chapitres, sources, manques)
│       ├── entraineur.js         Générateur de scénarios et correction (structure, zones, liquidité, Wyckoff)
│       ├── relecture.js          Relecture des vrais trades : règles du plan + jugements
│       ├── formation.js          Vue Formation : cours, exercices, entraîneur, progression
│       ├── ui.js                 Formatage FR, modales, toasts, icônes SVG
│       ├── graphe.js             Lien vers le graphique TradingView (symbole, unité de temps)
│       ├── views.js              Vues Calendrier, Analyses, Plan, Paramètres
│       ├── sync.js               Sauvegarde cloud GitHub (états, conflits, fusion, hors ligne)
│       ├── lock.js               Verrouillage, chiffrement AES-GCM, code de secours, biométrie
│       ├── app.js                Navigation, tableau de bord, journal, formulaire, import/export
│       └── pwa.js                Installation, hors ligne, synchronisation entre onglets
├── exemples/                     Modèles CSV, jeu de démonstration, modèle de workflow Pages
└── tools/
    ├── serve.js                  Serveur local + QR code pour la tablette (node tools/serve.js)
    ├── make-site-zip.js          Archive prête à publier (trading-site.zip)
    ├── smoke-test.js             Contrôle automatique de tous les écrans (jsdom)
    ├── sync-test.js              Recette de la sauvegarde cloud : états, conflits, fusion (jsdom)
    ├── lock-test.js              Recette du verrouillage : chiffrement, code, secours, biométrie (jsdom)
    ├── offline-test.js           Recette du mode hors ligne : service worker, cache, réseau coupé
    ├── notify-test.js            Recette des rappels : heures du plan, anti-doublon, rattrapage
    ├── formation-test.js         Recette de la formation : cours, scénarios, correction, progression
    ├── graphe-test.js            Recette du lien graphique : symboles, correction, hors ligne, boutons
    ├── relecture-test.js         Recette de la relecture des trades : notation, masquage, bilan
    ├── style-check.js            Recette du thème : contrastes AA, jetons, cibles tactiles, impression
    ├── tablet-check.js           Contrôle du rendu tablette + mode hors ligne (puppeteer)
    └── vendor/qrcode.js          Générateur de QR code (MIT, Kazuhiko Arase)
```

À la racine du dépôt : `index.html` (redirection vers l'application), `.nojekyll` (nécessaire pour GitHub Pages) et `trading-site.zip` (archive publiée).

Le déploiement HTTPS (GitHub Pages) est décrit dans `exemples/deploiement/` (modèle de workflow) et dans la section « Sur tablette ».

## Outils de développement (optionnels)

```bash
node tools/serve.js                                    # serveur local + QR code pour la tablette
node trading/tools/make-site-zip.js                     # régénérer l'archive de publication
npm i -D jsdom && node tools/smoke-test.js              # chaque vue se rend sans erreur JS
npm i -D jsdom && node tools/sync-test.js                # sauvegarde cloud : états, conflits, fusion
npm i -D jsdom && node tools/lock-test.js                # verrouillage : chiffrement, code, secours, biométrie
node tools/offline-test.js                              # hors ligne : service worker et cache (aucune dépendance)
node tools/notify-test.js                               # rappels du plan : heures, doublons, autorisation
npm i -D jsdom && node tools/formation-test.js           # formation : cours, entraîneur, correction, progression
npm i -D jsdom && node tools/graphe-test.js              # graphique TradingView : lien, hors ligne, boutons
npm i -D jsdom && node tools/relecture-test.js           # relecture des vrais trades : règles, notation, bilan
node tools/style-check.js                               # thème : contrastes, jetons, accessibilité (aucune dépendance)
npm i -D puppeteer && node tools/tablet-check.js        # rendu tablette + mode hors ligne
node tools/smoke-test.js                                # (test complet : import CSV, PWA, cartes…)
```

Le test de fumée charge la démo, parcourt les 6 vues, les 4 modes de courbe, les 6 regroupements, ouvre le formulaire, enregistre un trade, coche une checklist, modifie les paramètres et vérifie l'aller-retour CSV — et échoue si une erreur JavaScript apparaît.

## Journal des correctifs notables

| Version | Correction |
|---|---|
| 2.8 | **Applications d'entraînement du Play Store listées dans la Formation** : les trois qui corrigent et notent (Candle Master, Chart Quiz, Trading Game/GoForex) et les deux qui expliquent (Forex Smart Money Concept, GTS), avec leur langue, leur prix et **leur limite**. Plus une mise en garde explicite : beaucoup d'applications « trading » du Play Store sont des **vitrines de courtiers** poussant au dépôt d'argent réel — aucune n'est nécessaire pour s'entraîner. La liste est écrite **dans l'application, hors ligne**, sans aucun lien externe ajouté. |
| 2.7 | **Relire ses vrais trades** : l'application reprend vos trades du journal et vous repose les questions du plan — règles chiffrées (stop 15 pips, ratio 1:7, risque 1 %, fenêtre de tir, limite du jour) corrigées automatiquement avec la mesure affichée, jugements de lecture enregistrés séparément et non notés. **Le résultat du trade reste masqué jusqu'à la révélation**, pour que la lecture ne soit pas influencée. La règle des 15 pips n'est posée que sur les paires forex. Recette `tools/relecture-test.js` (61 contrôles). |
| 2.7 | **Pratiquer sur de vrais graphiques** : la Formation indique désormais, chapitre par chapitre, ce qui est réellement gratuit et utilisable **depuis une tablette Android** — replay journalier TradingView, compte démo MT5 pour l'exécution, quiz SMC dans le navigateur — avec la limite constatée en 2026 (le replay **intraday** TradingView n'est plus gratuit) et l'annexe ordinateur (testeur visuel MT5 + FX Blue) pour le jour où vous en auriez un. |
| 2.6 | **Graphique TradingView à côté du journal** : bouton sur chaque trade, dans l'en-tête du journal, dans la fiche de saisie et dans l'entraîneur. L'application ouvre **le bon symbole et la bonne unité de temps** — et rien d'autre : aucun script externe n'est chargé dans la page, aucune donnée du journal ne part avec le lien. Correspondance des symboles corrigeable (le symbole de votre courtier gagne sur le défaut), bouton désactivable, et message explicite hors ligne. Recette dédiée `tools/graphe-test.js` (57 contrôles). |
| 2.6 | **Journal → place à côté (Android)** : procédure écrite pour l'écran partagé, avec le **piège connu** de l'application TradingView pour tablette Android (écran partagé refusé depuis une mise à jour de 2026 — passer par tradingview.com dans le navigateur). Limite assumée et écrite noir sur blanc : **vos tracés ne sont pas lisibles** par l'application, ils restent dans votre compte. |
| 2.5 | **Vue Formation — apprendre la méthode et s'entraîner** : le plan est expliqué dans l'ordre de ses **12 chapitres** (essentiel, leçons, lecture sur le graphique, étapes, erreurs fréquentes) avec **52 exercices notés**, dont le calcul de risque. |
| 2.5 | **Entraîneur interactif** : l'application **dessine ses propres graphiques de bougies** (SVG, aucune image, aucun réseau) et corrige la réponse en **dessinant la zone et le niveau de cassure** sur le graphique. **6 concepts** d'entraînement, dont « identifier la tendance ». Recette dédiée `tools/formation-test.js` (76 contrôles) — cohérence vérifiée sur **1 400 scénarios**. |
| 2.5 | **Progression conservée** : chapitres étudiés, score des exercices, série et détail par concept, enregistrés avec le journal (donc chiffrés par le verrouillage et sauvegardés dans votre dépôt). Sources de chaque chapitre citées, et **modules absents des documents signalés** au lieu d'être inventés. |
| 2.5 | **Défaut corrigé au passage** : la recette des rappels figeait encore le numéro de version du cache (`trading-desk-v9`) — même faux échec que `lock-test` et `sync-test` en 2.4 ; elle lit désormais la version du fichier. |
| 2.4 | **Rappels du plan en notifications de la tablette** : préparation avant l'ouverture, ouverture, fermeture (rappel de saisie) et revue du dimanche, aux heures des fenêtres de tir du plan. Heures lues dans le plan lui-même — plus aucun risque de divergence. Application en arrière-plan comprise ; rappels manqués regroupés et signalés à la réouverture ; jamais deux fois le même rappel. |
| 2.4 | **Rien sans votre accord** : rappels éteints par défaut, autorisation demandée par un appui explicite, refus respecté, `http://` et iPhone/iPad non installé détectés et expliqués au lieu d'échouer en silence. Rien ne sort de l'appareil, aucun service tiers, aucune donnée de trading dans le message. |
| 2.4 | **Deux défauts corrigés au passage** : un rappel était consommé même quand l'appareil ne pouvait pas l'afficher (autorisation absente) — il reste désormais en attente ; et les recettes `lock-test` / `sync-test` figeaient le numéro de version du cache, ce qui provoquait un faux échec à chaque incrément. |
| 2.3 | **Affichage plus premium** : palette resserrée (fonds bleutés plus profonds, traits fins, or légèrement adouci), **chiffres alignés en colonnes** dans tous les tableaux et cartes (chiffres tabulaires), titres de cartes repérés par une pastille dorée, cartes qui se soulèvent au survol, tableaux avec en-têtes dégradés et survol doré, boutons et champs avec relief discret, notifications et modales en verre dépoli, barres de défilement fines, filet doré en haut de fenêtre. |
| 2.3 | **Confort et accessibilité** : contraste du texte secondaire remonté (6,8:1 au lieu de 5,6:1, minimum AA respecté partout), anneau de focus doré pour la navigation au clavier, sélection de texte dorée, respect du réglage système « réduire les animations ». |
| 2.3 | **Un seul thème pour tout** : les graphiques lisent désormais les couleurs de la feuille de style (`Charts.rafraichirPalette()`) au lieu de les coder en dur — un changement de thème se répercute partout. Recette `tools/style-check.js` (41 contrôles) : contrastes, jetons, cibles tactiles, impression, et vérification qu'aucun réglage adaptatif n'est écrasé. |
| 2.2 | **Hors ligne vérifié et corrigé** : `pwa.js` manquait dans le cache du service worker (l'installation et la synchronisation entre onglets ne survivaient pas à une ouverture sans réseau) ; un serveur joignable mais en panne ne casse plus la page (repli sur la copie en cache) ; cache en `trading-desk-v7`. Recette dédiée `tools/offline-test.js`. |
| 2.2 | **Deux bugs du verrouillage corrigés** (trouvés par la recette) : l'application ne rechargeait pas le journal après un déverrouillage quand le verrou avait été activé en cours de session (journal vide à l'écran) ; le **code de secours disparaissait de l'écran** aussitôt affiché, avant qu'on puisse le noter (il faut désormais confirmer par « J'ai noté mon code »). |
| 2.2 | **Journal chiffré et verrouillé (optionnel)** : code de déverrouillage, chiffrement AES-GCM 256 avec clé dérivée par PBKDF2, **code de secours imprimable** et **biométrie Face ID / empreinte** (passkey + PRF) quand l'appareil le permet. Le fichier du dépôt GitHub devient illisible lui aussi. |
| 2.2 | **Sécurité dans les Paramètres** : activation en trois étapes expliquées, jauge de force du code, changement de code, nouveau code de secours, désactivation, verrouillage automatique réglable, bouton *Verrouiller maintenant*. |
| 2.2 | **Aucune écriture pendant le verrouillage** : ni sauvegarde locale, ni envoi vers le dépôt, ni récupération — impossible d'écraser la sauvegarde avec un journal vide (état *Journal verrouillé — sauvegarde en pause*). |
| 2.2 | **Défenses contre la devinette** : ralentissement progressif après 5 essais (5 s, 15 s, 60 s, 5 min), chiffrement refusé sur les codes trop courts, avertissements explicites sur les codes de 4 chiffres. |
| 2.1 | **Sauvegarde cloud automatique dans votre dépôt GitHub** : envoi différé (45 s), reprise au retour du réseau, récupération sur un nouvel appareil, **fusion par trade** entre la tablette et l'ordinateur, suppressions conservées. Gratuit, aucun service tiers. |
| 2.1 | **États de la sauvegarde affichés en clair** : hors ligne, en attente, à jour, conflit, clé refusée, quota, GitHub injoignable, échec — pastille dans la barre du haut et bandeau avec les boutons utiles (*Réessayer*, *Fusionner les deux*, *Récupérer la sauvegarde*). |
| 2.1 | **Configuration dans les Paramètres** : dépôt, branche, fichier, jeton (fine-grained, *Contents : Read and write*), bouton *Tester la connexion*, journal des dernières opérations. Le jeton reste dans le navigateur de l'appareil. |
| 2.0 | **Plan réécrit sur la méthode SMV** (Smart Money Vision) : les 4 lois, la structure (HH/HL, LH/LL, consolidation, 3 types de BOS), l'offre et la demande (OB/POI, order flow, breaker bloc), la cause à effet (phases A à E, accumulation et distribution) et la liquidité (intact, EQH/EQL, trendline, signature, inducement, complexe pull back). |
| 2.0 | **4 setups SMV** documentés en 6 lignes : Golden Setup (prise de position en phase C), Complexe Pull Back, Market Shift (prise de liquidité + ChoCh), ODF (entrée ratée). |
| 2.0 | **Règles de risque SMV** : 1 % maximum par trade, stop 15 pips maximum, ratio minimum 1:7, 2 stop loss par jour maximum, breakeven à la cassure, prises partielles 30 / 50 / solde. Deux contrôles de discipline suivent ces règles automatiquement (part des trades à 1:7 ou plus, respect du stop à 15 pips). |
| 2.0 | **Journal au vocabulaire SMV** : setups, sessions (Asie / Europe / USA avec les fenêtres de tir) et liste d'erreurs réécrite (pas de ChoCh, entrée hors zone, stop supérieur à 15 pips, ratio inférieur à 1:7, poursuite du prix, prises partielles non respectées…). |
| 2.0 | **Démo conforme à la méthode** : stops entre 7 et 15 pips, ratios visés de 1:7 à 1:12 sur les trades conformes, sessions et setups SMV. |
| 1.3 | **Objectifs : plus de jauge trompeuse.** Les barres « perte autorisée » et « semaine » affichaient le signe du résultat (une journée gagnante apparaissait comme 92 % de perte consommée, en vert). Elles montrent désormais la perte réellement utilisée, toujours positive, et virent au rouge avant d'atteindre le seuil. | Les barres « perte autorisée » et « semaine » affichaient le signe du résultat (une journée gagnante apparaissait comme 92 % de perte consommée, en vert). Elles montrent désormais la perte réellement utilisée, toujours positive, et virent au rouge avant d'atteindre le seuil. |
| 1.3 | **Drawdown honnête** : la barre « drawdown vs seuil » avançait avec un montant négatif (−9,07 % / 10 %) ; elle affiche la valeur absolue et colore l'alerte. |
| 1.3 | **Calendrier lisible** : les cases faisaient 28 px de large, le symbole « € » passait à la ligne et les niveaux de couleur étaient tous au maximum. Cases élargies (deux mois par ligne sur tablette), montant sur une ligne, multiple de R en dessous, nombre de trades dans le coin, intensité proportionnelle à la meilleure journée de l'année, contraste renforcé. |
| 1.3 | **Journal sans défilement horizontal** : sur tablette et sur petit écran le tableau masque les colonnes secondaires (risque, P&L brut, frais, émotion, durée, puis pips sous 1250 px), fixe ses largeurs pour tenir exactement dans la page, raccourcit les badges et passe aux dates numériques. Plus aucune valeur tronquée de 768 à 1680 px. |
| 1.3 | **Vue par défaut** : le journal s'ouvre en tableau compact dès la tablette (cartes sur téléphone, sous 700 px) — 5 300 px de défilement au lieu de 23 500 px pour 80 trades. |
| 1.3 | **Analyses cohérentes** : « Coût estimé » d'un montant qui ne correspondait à aucune colonne du graphique est remplacé par le résultat réel des trades hors plan ; les bandes du SQN suivent la grille de Van Tharp (« Bon » à 2,88 au lieu de « moyen ») ; les frais ne s'affichent plus avec un « + ». |
| 1.3 | **Cache v3** : le service worker reprend les fichiers au premier rechargement (`trading-desk-v3`). |
| 1.2 | **Confirmations fiabilisées** : « Annuler » répondait à la place de « Confirmer », ce qui empêchait silencieusement la suppression d'un trade, la purge de la démo et « Tout effacer » (le verrou de résolution est désormais posé avant la fermeture de la fenêtre). |
| 1.2 | **Démo repérée et supprimable** : chaque trade fictif porte un marqueur `demo`, trois points de purge, indicateur permanent dans la barre du haut. |
| 1.2 | **Écran d'accueil** quand le journal est vide (au lieu de graphiques à zéro) et message « Journal vide » dans la barre du haut. |
| 1.2 | **Icônes 100 % SVG** : plus aucune dépendance aux polices emoji (les caractères s'affichaient en carrés vides sur certaines tablettes) — logo, alertes, notifications, plan, états vides. |
| 1.2 | **Lisibilité** : la sparkline ne chevauche plus le texte des cartes de KPI, notifications remontées au-dessus de la barre de navigation basse, 3 notifications maximum à l'écran, colonnes du journal plus aérées. |
| 1.2 | **Français** : accords corrigés (« 1 trade », « 80 trades clôturés » au lieu de « trade(s) clôturé(s) »), libellé « Chaque écart au plan coûte … par trade ». |
| 1.2 | **Mises à jour instantanées** : service worker en *réseau d'abord* pour le code (cache v2), pour que les correctifs arrivent au premier rechargement sans manipulation. |

## Limites connues

- Le multi-comptes n'est pas géré (un seul journal par navigateur).
- La sauvegarde cloud passe par l'API GitHub : un fichier au-delà de ~950 Ko doit être exporté en JSON (le nombre de trades nécessaire est très largement supérieur à un usage normal).
- La première activation de la sauvegarde cloud demande un jeton GitHub (voir *Sauvegarde & vie privée*) ; sans elle, tout continue de fonctionner en local.
- Le verrouillage n'est pas une authentification en ligne : il protège les données (elles sont chiffrées), pas l'accès au site. Ouvrir l'application sans le code ne montre rien, c'est le but.
- La biométrie dépend de l'appareil : elle fonctionne sur iPadOS 18+, Android et macOS récents ; Windows Hello ne fournit pas encore de clé exploitable par un site web — le code reste la solution universelle.
- Verrouillage actif + code oublié + code de secours perdu : les données sont définitivement illisibles (c'est le principe même du chiffrement de bout en bout).
- Les captures d'écran sont référencées par URL/chemin (pas d'upload de fichier, pour rester sans serveur).
- Les frais de swap ne sont pas modélisés séparément : à inclure dans la colonne « Frais ».
- Les rappels du plan sont des notifications **locales** : elles partent quand l'application est ouverte (même en arrière-plan). Application quittée, la tablette ne peut pas les déclencher — il faudrait un serveur de push, ce que ce projet refuse par principe. Les rappels manqués sont rattrapés à la réouverture, dans la limite du retard toléré (30 min pour une préparation, 1 h pour une ouverture, 3 h pour un rappel de saisie).
