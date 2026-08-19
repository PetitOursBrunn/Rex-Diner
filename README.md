# Rex's Diner — V11.12.0

Cette version corrige le problème où certains utilisateurs voyaient encore une ancienne version après un nouveau déploiement.

## Protection anti-cache
- `styles.css` et `app.js` portent un numéro de version dans leur URL.
- HTML/CSS/JS sont servis avec `no-store` / `no-cache`.
- le serveur expose `/api/build`.
- le navigateur vérifie périodiquement la version réellement déployée.
- si le serveur possède une nouvelle version, la page se recharge automatiquement avec une URL différente.

## Vérification
Dans Réglages > Synchronisation, la version doit afficher :
`11.12.0`

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
