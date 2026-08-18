# Rex's Diner — Caisse & Gestion V11

## Nouveautés V11

### Thème sombre
- activation depuis Réglages > Apparence
- choix mémorisé sur chaque appareil
- adaptation de la caisse, stocks, tableaux, dialogues, commandes fournisseurs et écrans de gestion
- aucune incidence sur les données partagées

### Ajout manuel de dollars
- bouton « Ajouter des dollars » dans le fonds de caisse
- saisie d'un montant en USD
- conversion automatique au taux fixe 1 $ = 23 pesos
- ajout immédiat au solde global unique en pesos
- aperçu de la conversion avant validation
- motif / note optionnel
- mouvement enregistré dans l'historique du fonds de caisse
- journal d'activité avec employé et conversion

Exemple :
100 $ → +2 300 pesos au solde global.

## Synchronisation
La synchronisation V10 est conservée :
- SSE temps réel
- polling de secours toutes les 1,5 seconde
- synchronisation entre utilisateurs sur des réseaux différents

## Mise à jour depuis V10
Remplace les fichiers du dépôt GitHub par ceux de la V11 puis laisse Render redéployer.
Le disque persistant `/var/data` reste inchangé et conserve toutes les données.
