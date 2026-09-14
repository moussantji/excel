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

Application statique (HTML/CSS/JS, aucune dépendance) : saisie des trades, métriques en **R** et en devise, courbe d'équité, drawdown, calendrier annuel, analyses par setup / instrument / session / émotion, plan de trading complet et score de discipline. Données sauvegardées localement, export CSV et JSON.

**Application installable (PWA)** : utilisable sur ordinateur **et sur tablette**, en plein écran, **hors ligne**, avec une ergonomie tactile (journal en cartes, navigation en bas d'écran).

Pour l'utiliser sur tablette : publier le dossier en HTTPS (GitHub Pages — *Settings → Pages → Source : Deploy from a branch*, branche `main`, dossier `/ (root)`, ou glisser-déposer sur Netlify/Cloudflare Pages), puis ouvrir `https://<utilisateur>.github.io/excel/trading/` et l'ajouter à l'écran d'accueil (iPad : *Partager → Sur l'écran d'accueil* ; Android : *menu ⋮ → Installer l'application*).

```bash
node trading/tools/serve.js     # http://localhost:8777
# ou simplement ouvrir trading/index.html
```

Sur tablette : ouvrir l'adresse HTTPS puis *Partager → Sur l'écran d'accueil* (iPad) ou *menu ⋮ → Installer l'application* (Android).

Détails, formules et modèles d'import CSV : [`trading/README.md`](trading/README.md).
