# Rex's Diner — Caisse & Gestion V9 Hébergement Internet

V9 prête à être hébergée publiquement afin que plusieurs employés puissent utiliser la même caisse depuis des réseaux différents.

## Nouveautés V9
- déploiement public sur Render ou Railway
- `render.yaml`
- `Dockerfile`
- `railway.toml`
- stockage persistant configurable avec `DATA_DIR`
- endpoint de santé `/health`
- protection HTTP globale par identifiant + mot de passe
- synchronisation temps réel conservée
- base commune pour ventes, stocks, caisse, matières premières, employés et journal

## Démarrage local
`node server.js`

Puis ouvrir :
`http://localhost:8080`

## Publication
Lire `DEPLOIEMENT.md`.

## Sécurité
En production, définir obligatoirement :
- `REXS_ACCESS_USER`
- `REXS_ACCESS_PASSWORD`

L'écran PIN des employés reste ensuite la deuxième couche d'accès.
