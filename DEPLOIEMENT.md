# Rex's Diner V9 — Mise en ligne

La V9 est prévue pour être accessible depuis Internet à plusieurs utilisateurs en temps réel.

## Architecture

- Le navigateur affiche l'interface de caisse.
- Un serveur Node.js central conserve la source unique des données.
- Les changements sont diffusés en temps réel avec Server-Sent Events (SSE).
- Le panier en cours reste local à chaque navigateur.
- Les données communes sont persistées dans `rexs-diner-data.json`.
- Le dossier de stockage peut être configuré avec la variable `DATA_DIR`.
- Un accès HTTP protégé est activé quand `REXS_ACCESS_PASSWORD` est défini.

## Variables d'environnement

- `PORT` : port HTTP, fourni automatiquement par la plupart des hébergeurs.
- `DATA_DIR` : dossier persistant. Sur Render avec la configuration fournie : `/var/data`.
- `REXS_ACCESS_USER` : identifiant d'accès global au site. Valeur recommandée : `rex`.
- `REXS_ACCESS_PASSWORD` : mot de passe global du site. Utiliser un mot de passe long et unique.

Le mot de passe global protège le site avant même l'écran des PIN employés.

# Déploiement recommandé : Render

## 1. Créer un dépôt GitHub

1. Créer un compte GitHub si nécessaire.
2. Créer un nouveau dépôt privé, par exemple `rexs-diner`.
3. Décompresser la V9 sur votre PC.
4. Envoyer tous les fichiers du dossier dans le dépôt GitHub.

Vous pouvez utiliser l'interface web de GitHub avec `Add file` > `Upload files`.

## 2. Créer le service Render

1. Se connecter à Render.
2. Cliquer sur `New` > `Blueprint`.
3. Connecter le compte GitHub.
4. Sélectionner le dépôt `rexs-diner`.
5. Render détecte le fichier `render.yaml`.
6. Lors de la création, Render demande une valeur pour `REXS_ACCESS_PASSWORD`.
7. Choisir un mot de passe long et unique.
8. Lancer le déploiement.

Le fichier `render.yaml` configure :
- le serveur Node.js ;
- la commande `node server.js` ;
- le contrôle de santé `/health` ;
- un disque persistant de 1 Go monté sur `/var/data`.

## 3. Ouvrir le site

Une fois le déploiement terminé, Render fournit une adresse du type :

`https://rexs-diner-xxxx.onrender.com`

Les deux utilisateurs ouvrent exactement cette même adresse, même depuis deux réseaux différents.

Le navigateur demande d'abord :
- identifiant : la valeur de `REXS_ACCESS_USER` (`rex` par défaut) ;
- mot de passe : la valeur choisie pour `REXS_ACCESS_PASSWORD`.

Ensuite apparaît l'écran de PIN de Rex's Diner.

## 4. Vérifier le temps réel

Connectez deux navigateurs ou deux ordinateurs.
Le voyant doit afficher `Temps réel connecté`.

Effectuez par exemple un changement de stock sur le premier navigateur :
le deuxième doit recevoir la nouvelle valeur automatiquement sans actualisation.

# Sauvegardes

Les données sont écrites sous `DATA_DIR`. Avec Render, elles sont donc stockées sur le disque persistant `/var/data`.

Le site contient également les fonctions d'export JSON/CSV existantes. Faites régulièrement un export JSON manuel important, en plus du disque persistant.

# Mise à jour du site

Après une modification du code :
1. envoyer les nouveaux fichiers sur GitHub ;
2. Render peut redéployer automatiquement le service depuis le dépôt ;
3. le disque `/var/data` reste séparé du code et conserve les données.

# Domaine personnalisé

Vous pouvez ensuite ajouter votre propre domaine depuis les réglages Render, par exemple :
`caisse.rexsdiner.com`.

# Alternative : Railway

La V9 contient aussi `railway.toml` et un `Dockerfile`.
Pour Railway :
1. créer un projet depuis le dépôt GitHub ;
2. ajouter un volume persistant ;
3. monter le volume sur `/var/data` ;
4. ajouter `DATA_DIR=/var/data` ;
5. ajouter `REXS_ACCESS_USER=rex` ;
6. ajouter `REXS_ACCESS_PASSWORD=<votre mot de passe>` ;
7. générer un domaine public Railway.

## Important

Ne publiez jamais le site avec `REXS_ACCESS_PASSWORD` vide. Sans ce mot de passe, toute personne connaissant l'URL pourrait atteindre l'application.
