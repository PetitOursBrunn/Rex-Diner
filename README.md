# Rex's Diner — V11.21.0

Cette version corrige le problème où certains utilisateurs voyaient encore une ancienne version après un nouveau déploiement.

## Protection anti-cache
- `styles.css` et `app.js` portent un numéro de version dans leur URL.
- HTML/CSS/JS sont servis avec `no-store` / `no-cache`.
- le serveur expose `/api/build`.
- le navigateur vérifie périodiquement la version réellement déployée.
- si le serveur possède une nouvelle version, la page se recharge automatiquement avec une URL différente.

## Vérification
Dans Réglages > Synchronisation, la version doit afficher :
`11.21.0`

Si ton collègue voit une ancienne version, après déploiement de cette V11.8 :
1. il ouvre le lien normalement ;
2. la page vérifie `/api/build` ;
3. si sa version est ancienne, elle se recharge automatiquement sur la nouvelle.

Tout le reste reste identique à la V11.6.

## Nouveautés V11.10.0
- Réorganisation manuelle des matières premières avec les flèches ↑ / ↓.
- Tri alphabétique A → Z des matières premières.
- Renommage des catégories de produits dans Réglages > Catégories des produits.
- Réorganisation de l'ordre des catégories affichées dans la caisse.
- Ordres et noms synchronisés et persistants avec les données du serveur.


## Nouveautés V11.10.0 — écran vertical
- La caisse détecte l’orientation portrait et passe automatiquement sur une seule colonne.
- La partie ticket/paiement n’est plus coupée sur les écrans verticaux.
- Le ticket perd son positionnement fixe en portrait pour rester entièrement accessible au défilement.
- Le panier conserve une zone de défilement adaptée à la hauteur de l’écran.
- Le catalogue et ses catégories s’adaptent à la largeur disponible.
- L’affichage horizontal existant reste inchangé.


## Nouveautés V11.11.0 — services et salaires
- Chaque utilisateur peut prendre et terminer son propre service depuis le tableau de bord.
- Un minuteur individuel démarre à la prise de service.
- Le patron peut régler, pour chaque employé, le salaire en pesos et la durée du cycle en minutes.
- À chaque fin de cycle, le salaire est automatiquement déduit du fond de caisse.
- Tant que l’employé reste en service, le minuteur redémarre automatiquement pour le cycle suivant.
- Les prélèvements sont effectués côté serveur et inscrits dans les mouvements de caisse et le journal.


## Nouveautés V11.12.0 — permissions par grade

Le patron peut configurer les accès des grades Employé et Manager aux sections (caisse, stocks, matières, ventes, fonds de caisse, journal, réglages) et aux actions sensibles (ajustement manuel du fonds, modification des stocks, commandes fournisseurs, effacement des ventes et du journal). Le grade Patron conserve toujours l’accès complet.


## Nouveautés V11.13.0 — menus composés
- Création, modification et suppression de menus depuis la gestion des stocks.
- Un menu possède un nom, un prix, une icône et une composition en produits existants.
- La caisse calcule la disponibilité d’un menu à partir du stock réel de ses composants.
- Lors de la confirmation d’une vente, chaque élément du menu est automatiquement retiré du stock avec sa quantité.
- Les besoins sont cumulés entre produits vendus seuls et produits présents dans plusieurs menus afin d’éviter tout dépassement de stock.


## Nouveautés V11.15.0 — quantités directes & recettes
- Chaque matière du catalogue possède maintenant un champ de quantité avant le bouton Commander.
- Les quantités du panier fournisseur sont directement modifiables et acceptent jusqu’à 3 décimales.
- Nouvel onglet Recettes & production dans Matières premières.
- Création, modification et suppression de recettes reliées aux produits existants ou personnalisées.
- Chaque recette mémorise les matières et quantités nécessaires pour 1 préparation.
- En indiquant le nombre d’unités à produire, les besoins sont multipliés et ajoutés automatiquement au panier fournisseur.
- Les besoins d’une recette se cumulent avec les matières déjà présentes dans le panier.
- Les recettes sont intégrées aux données synchronisées et persistantes du serveur.


## Nouveautés V11.16.1 — frais de conversion dollars retenus sur encaissement

- Le paiement en dollars ne majore plus le montant demandé au client.
- Une retenue de 20 % est calculée sur le total payé en dollars.
- Seuls les 80 % restants sont convertis en pesos et ajoutés au fonds de caisse.
- Exemple : 100 $ payés → 20 $ de frais → 80 $ nets → 1 840 pesos crédités à la caisse au taux 1 $ = 23 pesos.
- Les paiements en pesos restent inchangés et sans frais de conversion.


## Nouveautés V11.17.0 — reçus de commandes avec recettes
- Les recettes ajoutées au panier fournisseur sont mémorisées avec leur quantité de production.
- L’historique des commandes de matières propose un bouton **Voir reçu**.
- Le reçu affiche les matières commandées et les recettes sélectionnées.
- Les anciennes commandes restent lisibles même sans information de recette.


## Nouveautés V11.18.0 — montants visibles sur les devises de la caisse
- Les boutons Dollars et Pesos affichent désormais directement le total à payer dans chaque devise.
- Les deux montants sont visibles simultanément sans changer de devise.
- Les montants se mettent à jour automatiquement avec le panier et les remises.
- Le comportement de paiement, le taux de change et la retenue de 20 % sur les paiements en dollars restent inchangés.


## Nouveautés V11.19.0 — stock recettes & ventes par employé
- Lorsqu'une commande fournisseur contient des recettes liées à des produits, les quantités produites sont ajoutées automatiquement au stock des produits correspondants après validation de la commande.
- Le reçu fournisseur indique les produits ajoutés au stock et le stock avant/après.
- La section Employés affiche désormais les ventes détaillées de chaque employé, avec date/heure, ticket, produits, paiement, montant net encaissé, total individuel et total global.


## Nouveautés V11.20.0 — Bot Discord temps réel
- Bot Discord intégré au même serveur Node.js que le site.
- Notifications riches pour les actions enregistrées : ventes, stocks, commandes, caisse, équipe, permissions et administration.
- Détails enrichis pour les ventes et les commandes de matières.
- Alertes de stock faible et rupture.
- Création automatique facultative d'une catégorie privée et de salons de logs séparés.
- Commandes `/rex-status`, `/rex-stats`, `/rex-services`, `/rex-stock`, `/rex-test` et `/rex-help`.
- Commandes sensibles réservées aux administrateurs Discord ou aux rôles configurés.
- Une panne Discord ne bloque jamais le fonctionnement du site.
- Configuration complète dans `DISCORD-BOT-GUIDE.md`.


## Nouveautés V11.21.0 — Bot Discord Manager
- Nouveau tableau de bord Discord avec `/rex-dashboard`.
- Statistiques filtrables par période et par employé avec `/rex-stats`.
- Consultation détaillée des ventes avec `/rex-ventes`.
- Gestion des prises/fins de service depuis Discord avec `/rex-service`.
- Ajustement des stocks depuis Discord avec autocomplétion des produits et confirmation obligatoire.
- Consultation de la caisse et ajustement sécurisé de la caisse réservé par défaut aux administrateurs Discord.
- Consultation des dernières commandes de matières premières.
- Rapports manuels et automatiques quotidiens/hebdomadaires dans `#rex-rapports`.
- Nouveau salon `#rex-alertes` avec alertes intelligentes lors des passages en stock faible, rupture et retour à la normale.
- Toutes les mutations Discord sont persistées, synchronisées en temps réel avec le site et inscrites dans le journal d’activité.
- File d’envoi, temporisation, retries et déduplication pour réduire le spam et améliorer la fiabilité Discord.
- Les fonctionnalités V11.20.0 et toutes les fonctions antérieures du site sont conservées.
