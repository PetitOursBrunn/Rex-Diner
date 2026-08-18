# Rex's Diner — V11.1 Thème sombre

Cette version repart directement de la V11 fonctionnelle.

## Différences par rapport à la V11
Une seule fonctionnalité a été ajoutée :
- un interrupteur `Thème sombre` dans Réglages > Apparence.

Le thème est mémorisé localement sur chaque appareil.

## Inchangé par rapport à la V11
- écran de connexion
- sélection des profils
- PIN
- rôles Employé / Manager / Patron
- synchronisation temps réel + fallback
- caisse
- ventes
- stocks
- commandes de matières premières
- fonds global en pesos
- ajout manuel de dollars et conversion ×23
- employés
- journal
- sauvegardes
- serveur Render et stockage persistant

Aucune logique mobile de la V12 n'a été conservée afin d'éviter toute régression sur la connexion.

## Mise à jour Render
Remplace les fichiers actuels du dépôt GitHub par ceux de ce ZIP.
Ne supprime pas le disque persistant `/var/data`.
