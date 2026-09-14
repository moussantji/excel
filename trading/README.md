# Journal & Plan de trading — Tableau de bord de performance

Application **locale, sans dépendance** (HTML + CSS + JavaScript vanilla) pour :

1. **écrire un plan de trading** et le garder sous les yeux (règles de risque, setups, routine, KPI, checklists) ;
2. **tenir un journal** de chaque trade (chiffres, capture, émotion, erreur, respect du plan) ;
3. **voir ses performances** : courbe d'équité, drawdown, P&L par jour/mois/setup/instrument/session, distribution des R, calendrier annuel, score de discipline.

Cible : compte **forex & indices CFD** (EURUSD, XAUUSD, US30, NAS100…), style intraday / swing court, résultats suivis **en R et en devise**.

![Tableau de bord](apercu-dashboard.jpg)

*Aperçu du plan : `apercu-plan.jpg`.*

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
├── assets/
│   ├── css/styles.css            Thème sombre / or, responsive, styles d'impression
│   └── js/
│       ├── store.js              État, persistance, trade normalisé, CSV, démo
│       ├── metrics.js            Statistiques, agrégats, drawdown, objectifs, garde-fous
│       ├── charts.js             Graphiques SVG sans dépendance (ligne, barres, donut, calendrier)
│       ├── plan.js               Contenu du plan + contrôles de discipline
│       ├── ui.js                 Formatage FR, modales, toasts, icônes SVG
│       ├── views.js              Vues Calendrier, Analyses, Plan, Paramètres
│       └── app.js                Navigation, tableau de bord, journal, formulaire, import/export
├── exemples/                     Modèles CSV + jeu de démonstration
└── tools/
    ├── serve.js                  Serveur statique local (node tools/serve.js)
    └── smoke-test.js             Contrôle automatique de tous les écrans (jsdom)
```

## Outils de développement (optionnels)

```bash
node tools/serve.js                  # servir l'app sur http://localhost:8777
npm i -D jsdom && node tools/smoke-test.js   # vérifie que chaque vue se rend sans erreur
```

Le test de fumée charge la démo, parcourt les 6 vues, les 4 modes de courbe, les 6 regroupements, ouvre le formulaire, enregistre un trade, coche une checklist, modifie les paramètres et vérifie l'aller-retour CSV — et échoue si une erreur JavaScript apparaît.

## Limites connues

- Le multi-comptes n'est pas géré (un seul journal par navigateur).
- Les captures d'écran sont référencées par URL/chemin (pas d'upload de fichier, pour rester sans serveur).
- Les frais de swap ne sont pas modélisés séparément : à inclure dans la colonne « Frais ».
