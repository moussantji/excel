# Stream — app mobile (React Native / Expo)

Maquette interactive de [stream.mandenbaoubab.com](http://stream.mandenbaoubab.com) :

- champ de recherche en haut (pas de marque)
- hero *A Shop for Killers*
- séries populaires
- zone **Téléchargements**
- onglets Accueil / Recherche / Téléchargements / Profil
- palette sombre + rouge (`#E50914`)
- icônes vectorielles Ionicons (`@expo/vector-icons`)

Branche sur `https://stream.mandenbaoubab.com/api` :

- `GET /home` — sections + hero
- `GET /trending` — tendances
- `GET /history` — continuer (auth)
- `GET /category` — catégories
- `GET /detail?subjectId=` — fiche, saisons, casting
- `GET /search?q=` — recherche
- `GET /downloads?subjectId=&season=&episode=` — qualités
- `GET /auth/me` + `POST /auth/login` — profil

Lecture progressive **du fichier local** : un seul téléchargement écrit le MP4 ; un mini serveur HTTP (`127.0.0.1`) sert des **Range** uniquement sur les octets déjà reçus. Le player lit ces parties pendant que le DL continue (pas un 2e stream).

Build natif requis pour le serveur local (`react-native-tcp-socket`) : `npx expo prebuild` / dev client. Sur le web, repli sur l’URL distante.

```bash
cd mobile
npm install
npx expo start
```
