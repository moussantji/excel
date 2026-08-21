# Stream — app mobile (React Native / Expo)

Maquette interactive de [stream.mandenbaoubab.com](http://stream.mandenbaoubab.com) :

- champ de recherche en haut (pas de marque)
- hero *A Shop for Killers*
- séries populaires
- zone **Téléchargements**
- onglets Accueil / Recherche / Téléchargements / Profil
- palette sombre + or

Branche sur `https://stream.mandenbaoubab.com/api` :

- `GET /home` — sections + hero
- `GET /trending` — tendances
- `GET /history` — continuer (auth)
- `GET /category` — catégories
- `GET /detail?subjectId=` — fiche, saisons, casting
- `GET /search?q=` — recherche
- `GET /downloads?subjectId=&season=&episode=` — qualités
- `GET /auth/me` + `POST /auth/login` — profil

```bash
cd mobile
npm install
npx expo start
```
