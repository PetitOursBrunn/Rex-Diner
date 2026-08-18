# Rex's Diner — V11.7.0

Cette version corrige le problème où certains utilisateurs voyaient encore une ancienne version après un nouveau déploiement.

## Protection anti-cache
- `styles.css` et `app.js` portent un numéro de version dans leur URL.
- HTML/CSS/JS sont servis avec `no-store` / `no-cache`.
- le serveur expose `/api/build`.
- le navigateur vérifie périodiquement la version réellement déployée.
- si le serveur possède une nouvelle version, la page se recharge automatiquement avec une URL différente.

## Vérification
Dans Réglages > Synchronisation, la version doit afficher :
`11.7.0`

Si ton collègue voit une ancienne version, après déploiement de cette V11.7 :
1. il ouvre le lien normalement ;
2. la page vérifie `/api/build` ;
3. si sa version est ancienne, elle se recharge automatiquement sur la nouvelle.

Tout le reste reste identique à la V11.6.
