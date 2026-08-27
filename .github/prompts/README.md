# Prompts / Skills IA

Bibliothèque de prompts réutilisables pour les agents de code (Arena, Copilot, Cursor, Claude Code).

| Fichier | À quoi ça sert |
|---|---|
| [`react-native-app.prompt.md`](./react-native-app.prompt.md) | Générer une app mobile React Native / Expo complète, sans erreur, prête à lancer en une commande |
| [`finish-react-native-project.prompt.md`](./finish-react-native-project.prompt.md) | Reprendre un projet React Native inachevé ou cassé : audit, réparation, finition |

## Comment l'utiliser

1. Ouvre le fichier `.prompt.md`.
2. Copie **tout** son contenu dans ton agent IA.
3. Remplis le bloc `BRIEF` (§7) avec ton projet.
4. Envoie. L'agent doit exécuter lui-même la vérification `npx expo export` avant de dire que c'est fini.

Dans VS Code + Copilot Chat, ces fichiers sont aussi détectés automatiquement
(`.github/prompts/*.prompt.md`) et utilisables via `/react-native-app`.
