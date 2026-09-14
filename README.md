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

Application statique (HTML/CSS/JS, aucune dépendance) : saisie des trades, métriques en **R** et en devise, courbe d'équité, drawdown, calendrier annuel, analyses par setup / instrument / session / émotion, plan de trading complet et score de discipline. Données sauvegardées localement dans le navigateur, export CSV et JSON.

```bash
node trading/tools/serve.js     # http://localhost:8777
# ou simplement ouvrir trading/index.html
```

Détails, formules et modèles d'import CSV : [`trading/README.md`](trading/README.md).
