# Rex's Diner — Caisse & Gestion V10 Synchronisation fiable

Cette version corrige le cas où un utilisateur affichait « Hors ligne » alors que le site restait accessible.

## Synchronisation V10
La V10 utilise maintenant deux mécanismes simultanément :

1. **SSE temps réel** — mise à jour instantanée lorsque la connexion permanente est acceptée par le navigateur/réseau.
2. **Polling de secours toutes les 1,5 secondes** — vérifie la révision du serveur et récupère automatiquement les changements si SSE est bloqué ou coupé.

Le polling ne télécharge la base complète que lorsqu'une révision plus récente existe.

La synchronisation est également forcée :
- quand l'utilisateur revient sur l'onglet ;
- quand la fenêtre reprend le focus ;
- quand la connexion Internet revient.

## Indicateur
- `Temps réel connecté` : SSE fonctionne.
- `Synchronisation active` : SSE est indisponible mais le système de secours fonctionne. Les changements arrivent automatiquement, généralement sous 1 à 2 secondes.
- `Reconnexion…` : aucun des deux mécanismes ne joint momentanément le serveur.

## Déploiement
Remplace les fichiers de la V9 dans ton dépôt GitHub par ceux de cette V10 puis laisse Render redéployer.

Le disque persistant `/var/data` n'est pas supprimé par cette mise à jour : les données existantes restent conservées.

## Test
Ouvre le site sur deux appareils différents.
1. Connecte les deux utilisateurs.
2. Modifie un stock ou le solde sur le premier.
3. Le deuxième doit se mettre à jour automatiquement sans déconnexion.
