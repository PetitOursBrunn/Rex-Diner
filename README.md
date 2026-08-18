# Rex's Diner — V11.3

Cette version corrige le problème où le bouton du thème sombre changeait d'état mais où les couleurs du site ne changeaient pas.

## Cause
Le serveur mettait `styles.css` en cache (`max-age=3600`). Après un déploiement Render, un navigateur pouvait donc charger :
- le nouveau `app.js`, où le bouton fonctionne ;
- l'ancien `styles.css`, qui ne contient pas les nouvelles couleurs sombres.

## Correction
- `styles.css?v=11.3.0` force le chargement de la nouvelle feuille de style.
- `app.js?v=11.3.0` est également versionné.
- HTML, CSS et JavaScript sont maintenant servis avec `no-store / no-cache`.
- le thème est appliqué à la fois via `.dark-theme` et `data-theme="dark"` pour plus de robustesse.

## Inchangé
Tout le reste reste identique à la V11.2 :
- profils et connexion
- synchronisation
- caisse
- stocks
- ventes
- matières premières
- fonds de caisse
- ajout Pesos/Dollars dans le même formulaire
- employés
- journal
- Render et `/var/data`

Après le redéploiement Render, un simple rechargement devrait suffire. Un Ctrl+F5 peut être utilisé une seule fois sur les navigateurs ayant gardé une ancienne version.
