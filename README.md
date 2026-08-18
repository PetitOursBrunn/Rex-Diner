# Rex's Diner — V11.2

Cette version conserve la logique et les fonctionnalités de la V11 actuelle.

## Modifications uniquement

### Thème sombre
Le bouton Réglages > Apparence modifie maintenant réellement l'ensemble du site :
- fond général plus sombre
- panneaux, tableaux, caisse, formulaires et dialogues assombris
- contrastes renforcés
- textes clairs et secondaires lisibles
- couleurs d'état adaptées
- écran de connexion et barre latérale harmonisés

Le thème reste mémorisé uniquement sur l'appareil utilisé.

### Fonds de caisse : Pesos ou Dollars
L'ajout manuel se fait désormais dans le même formulaire :
- champ Montant
- sélection de devise juste à côté : `Pesos` ou `Dollars`
- si Dollars est choisi, conversion automatique à `1 $ = 23 pesos`
- aperçu du montant réellement ajouté au solde global
- le solde global reste toujours exprimé en pesos

Exemple :
100 dollars → +2 300 pesos.

## Tout le reste est inchangé
- profils et connexion
- rôles/PIN
- synchronisation temps réel
- caisse
- ventes
- stocks
- matières premières
- commandes fournisseurs
- employés
- journal
- hébergement Render
- stockage persistant `/var/data`
