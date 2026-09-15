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

**Application installable (PWA)** : utilisable sur ordinateur **et sur tablette**, en plein écran, avec une ergonomie tactile (journal en cartes, navigation en bas d'écran). **Tout fonctionne hors ligne** (saisie, statistiques, plan, checklists, verrouillage) ; seul l'envoi vers le dépôt GitHub attend le retour du réseau, et repart alors tout seul.

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
