# Journal & Plan de trading — Tableau de bord de performance

Application **locale, sans dépendance** (HTML + CSS + JavaScript vanilla) pour :

1. **écrire un plan de trading** et le garder sous les yeux (règles de risque, setups, routine, KPI, checklists) ;
2. **tenir un journal** de chaque trade (chiffres, capture, émotion, erreur, respect du plan) ;
3. **voir ses performances** : courbe d'équité, drawdown, P&L par jour/mois/setup/instrument/session, distribution des R, calendrier annuel, score de discipline.

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

Au premier lancement, le journal est vide. Trois boutons sont proposés : **Ajouter un trade**, **Importer un CSV**, **Charger la démo** (80 trades fictifs pour voir le tableau de bord en action — supprimables depuis *Paramètres*).

---

## Sur tablette (iPad / Android)

L'application est une **PWA** : une fois chargée, elle s'installe comme une vraie application, s'ouvre en plein écran (sans barre d'adresse), fonctionne **sans réseau** et reste adaptée au doigt.

### 1. La mettre en ligne (une seule fois, gratuit, en HTTPS)

L'installation sur écran d'accueil et le mode hors ligne exigent **HTTPS** (ou `localhost`) : un fichier ouvert en `file://` s'affiche très bien sur tablette, mais ne peut pas s'installer.

#### Méthode A — GitHub Pages, sans ajouter de fichier (le plus rapide)

1. Fusionner la branche `arena/01a09dd0-excel` dans `main`.
2. Sur GitHub : **Settings → Pages → Build and deployment → Source = « Deploy from a branch »**, puis *Branch* = `main`, *Folder* = `/ (root)` → **Save**.
3. Après une minute, l'adresse est active :

```
https://<utilisateur>.github.io/excel/trading/
```

La mise en ligne s'applique à chaque push sur `main` (aucune configuration supplémentaire).

#### Méthode B — déploiement automatique par GitHub Actions

1. Copier le modèle fourni :

```bash
mkdir -p .github/workflows
cp trading/exemples/deploiement/github-pages.yml .github/workflows/deploy-trading-pages.yml
git add .github/workflows/deploy-trading-pages.yml && git commit -m "Déploie le journal de trading" && git push
```

2. Sur GitHub : **Settings → Pages → Source = « GitHub Actions »**.
3. Le workflow republie l'application à chaque modification du dossier `trading/`.

> Si le push est refusé avec un message du type *« refusing to allow a GitHub App to create or update workflow »*, c'est que votre jeton n'a pas la permission `workflows` : utilisez la méthode A, ou ajoutez le fichier directement depuis l'interface GitHub (**Actions → New workflow → set up a workflow yourself**).

#### Méthode C — hébergeur statique (glisser-déposer)

Netlify Drop, Cloudflare Pages ou Vercel : glissez le dossier `trading/` dans l'interface, l'HTTPS et l'installation PWA fonctionnent immédiatement, sans compte Git.

### 2. L'installer sur la tablette

| Appareil | Manipulation |
|---|---|
| **iPad / iPhone (Safari)** | Ouvrir l'adresse → bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil** → **Ajouter**. |
| **Tablette Android (Chrome)** | Ouvrir l'adresse → menu **⋮** → **Installer l'application** / **Ajouter à l'écran d'accueil**. |
| **Ordinateur (Chrome/Edge)** | Icône d'installation dans la barre d'adresse, ou menu → *Installer*. |

L'application affiche elle-même le mode opératoire : un bandeau en haut d'écran propose l'installation, et un bouton « Installer sur cet appareil » figure en bas de la barre latérale.

### 3. Ce qui est pensé pour la tablette

- **Barre de navigation en bas**, cibles tactiles ≥ 44 px, champs de saisie en 16 px (évite le zoom automatique sur iOS).
- **Journal en cartes** : sur écran étroit, chaque trade devient une carte (instrument, P&L, R, setup, session, risque, pips, frais, durée, badges plan/émotion/erreur) — plus de tableau coupé. Bascule **Tableau / Cartes / Auto** en haut du journal ; en mode *Auto*, l'affichage s'adapte à la largeur de l'écran.
- **Rotation** portrait/paysage prise en charge (mode paysage : barre latérale complète, grille de KPI sur 3 colonnes).
- **Hors ligne** : après une première ouverture avec connexion, le service worker met en cache l'application. Le bandeau d'accueil, l'onglet actif, les checklists et les saisies en cours sont conservés si vous passez à une autre application.
- **Synchronisation entre onglets** : si le journal est ouvert deux fois (ou sur deux fenêtres), l'affichage se met à jour. Un bouton **⟳** en haut à droite recharge les données enregistrées.

### 4. Vos données sur tablette

Elles sont stockées **dans le navigateur de la tablette** (aucun serveur). Deux conséquences pratiques :

- Pour **retrouver le même journal sur l'ordinateur et la tablette**, utilisez *Exporter → Sauvegarde JSON* sur l'un, puis *Importer* sur l'autre (fichier à transférer par e-mail, AirDrop, iCloud/Drive…).
- Un vidage du navigateur, une réinstallation ou une navigation privée effacent les données : **sauvegarde JSON hebdomadaire**, en même temps que la revue du plan.

### 5. Vérifier le rendu sur tablette (développement)

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

### 🧭 Plan de trading
Plan complet prêt à personnaliser : identité de trading, objectifs et kill-switch, règles de risque + formule de taille de position, **3 setups documentés** (contexte, déclencheur, entrée, stop, objectifs, invalidation), routine quotidienne, tenue du journal, protocole de discipline, KPI et seuils.
- **3 checklists interactives** (pré-trade, post-trade, revue hebdomadaire) dont l'état est sauvegardé.
- Bouton **Imprimer / PDF** avec une feuille de style dédiée (fond clair, lisible sur papier).

### ⚙️ Paramètres
Capital, devise, risque par trade, valeur du pip, limites (jour/semaine/drawdown), objectif mensuel, listes d'instruments, de setups et de sessions ; import/export ; effacement des données.

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

- Les données sont stockées **dans votre navigateur** (`localStorage`), jamais envoyées sur un serveur.
- *Paramètres → Exporter → Sauvegarde JSON* produit un fichier complet (trades + réglages) à réimporter ailleurs ou après un changement de machine.
- Videz le cache du navigateur sans sauvegarde = données perdues. Faites la sauvegarde JSON en même temps que la revue hebdomadaire.
- Un export CSV est également disponible (séparateur `;`, virgules décimales : ouvrable directement dans Excel français).

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
│   ├── css/styles.css            Thème sombre / or, responsive, impression, ergonomie tactile
│   └── js/
│       ├── store.js              État, persistance, trade normalisé, CSV, démo
│       ├── metrics.js            Statistiques, agrégats, drawdown, objectifs, garde-fous
│       ├── charts.js             Graphiques SVG sans dépendance (ligne, barres, donut, calendrier)
│       ├── plan.js               Contenu du plan + contrôles de discipline
│       ├── ui.js                 Formatage FR, modales, toasts, icônes SVG
│       ├── views.js              Vues Calendrier, Analyses, Plan, Paramètres
│       ├── app.js                Navigation, tableau de bord, journal, formulaire, import/export
│       └── pwa.js                Installation, hors ligne, synchronisation entre onglets
├── exemples/                     Modèles CSV, jeu de démonstration, modèle de workflow Pages
└── tools/
    ├── serve.js                  Serveur statique local (node tools/serve.js)
    ├── smoke-test.js             Contrôle automatique de tous les écrans (jsdom)
    └── tablet-check.js           Contrôle du rendu tablette + mode hors ligne (puppeteer)
```

Le déploiement HTTPS (GitHub Pages) est décrit dans `exemples/deploiement/` (modèle de workflow) et dans la section « Sur tablette ».

## Outils de développement (optionnels)

```bash
node tools/serve.js                                    # servir l'app sur http://localhost:8777
npm i -D jsdom && node tools/smoke-test.js              # chaque vue se rend sans erreur JS
npm i -D puppeteer && node tools/tablet-check.js        # rendu tablette + mode hors ligne
node tools/smoke-test.js                                # (test complet : import CSV, PWA, cartes…)
```

Le test de fumée charge la démo, parcourt les 6 vues, les 4 modes de courbe, les 6 regroupements, ouvre le formulaire, enregistre un trade, coche une checklist, modifie les paramètres et vérifie l'aller-retour CSV — et échoue si une erreur JavaScript apparaît.

## Limites connues

- Le multi-comptes n'est pas géré (un seul journal par navigateur).
- Les captures d'écran sont référencées par URL/chemin (pas d'upload de fichier, pour rester sans serveur).
- Les frais de swap ne sont pas modélisés séparément : à inclure dans la colonne « Frais ».
