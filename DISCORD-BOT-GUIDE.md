# Bot Discord Rex's Diner — V11.20.0

Le bot est directement intégré au serveur Node.js de Rex's Diner. Il n'a pas besoin d'un deuxième hébergement : lorsque le site démarre sur Render, le bot démarre avec lui.

## Ce que le bot journalise

Le bot surveille le journal serveur et envoie des embeds Discord pour les actions importantes réellement enregistrées par le site :

- connexions et verrouillages ;
- prises et fins de service ;
- ventes encaissées avec ticket, produits, devise, total client et montant net crédité ;
- ventes mises en attente ;
- modifications de stock et alertes de rupture/stock faible ;
- création, modification et suppression de produits ;
- menus et catégories ;
- commandes de matières premières avec détail des achats, recettes sélectionnées et produits ajoutés au stock ;
- recettes et matières premières ;
- mouvements du fond de caisse ;
- salaires automatiques ;
- employés ;
- permissions ;
- remises ;
- réglages, sauvegardes et opérations d'administration ;
- suppression du journal d'activité.

Les erreurs Discord ne bloquent jamais la caisse : si Discord est temporairement indisponible, le site continue de fonctionner normalement.

## Salons automatiques

Avec `DISCORD_AUTO_SETUP=true`, le bot crée une catégorie privée :

`🦖 Rex's Diner • Logs`

et les salons suivants :

- `#rex-activite`
- `#rex-ventes`
- `#rex-stocks`
- `#rex-commandes`
- `#rex-caisse`
- `#rex-equipe`
- `#rex-admin`
- `#rex-systeme`

La catégorie est invisible pour `@everyone`. Les administrateurs Discord la voient grâce à leur permission Administrateur. Les rôles présents dans `DISCORD_ALLOWED_ROLE_IDS` reçoivent aussi l'accès en lecture lors de la création automatique.

## Commandes Discord

Les commandes sont réservées aux administrateurs Discord et, si configurés, aux rôles présents dans `DISCORD_ALLOWED_ROLE_IDS` :

- `/rex-status` : état du site, version, bot, fond de caisse et nombre d'employés en service ;
- `/rex-stats` : ventes, articles encaissés, total net encaissé et fond de caisse actuel ;
- `/rex-services` : employés actuellement en service ;
- `/rex-stock` : stocks faibles et ruptures ;
- `/rex-test` : test d'envoi dans Discord ;
- `/rex-help` : aide rapide.

Les réponses contenant des chiffres internes sont éphémères : seul l'utilisateur qui lance la commande les voit.

## Variables Render nécessaires

Obligatoires :

- `DISCORD_BOT_TOKEN` : token secret du bot ;
- `DISCORD_GUILD_ID` : ID du serveur Discord.

Recommandées :

- `DISCORD_AUTO_SETUP=true`
- `DISCORD_STARTUP_MESSAGE=true`
- `DISCORD_ALLOWED_ROLE_IDS` : ID d'un ou plusieurs rôles Discord, séparés par des virgules ;
- `DISCORD_ALERT_ROLE_ID` : rôle à mentionner en cas d'alerte importante, par exemple une rupture de stock.

Les variables `DISCORD_*_CHANNEL_ID` de `.env.example` permettent de remplacer les salons automatiques par des salons existants.

## Sécurité

Le token Discord doit uniquement être stocké dans les variables d'environnement Render. Ne jamais le mettre dans GitHub, `app.js`, `index.html`, une capture d'écran ou un message public. Si un token est exposé, il faut immédiatement le réinitialiser depuis le portail développeur Discord.

Le bot n'a pas besoin de lire les messages des membres ni d'activer le Message Content Intent. Il utilise uniquement l'intent Guilds.
