# Bot Discord Rex's Diner — V11.23.0

Le bot est intégré au même serveur Node.js que Rex's Diner. Il démarre avec le site sur Render et reste totalement non bloquant : une panne Discord n'empêche jamais la caisse ou la synchronisation du site de fonctionner.

## Nouveautés V11.23.0

- les notifications automatiques de salaire sont envoyées dans un salon dédié `#rex-salaires` ;
- avec `DISCORD_AUTO_SETUP=true`, ce salon est créé automatiquement s'il n'existe pas ;
- en configuration manuelle, le salon peut être défini avec `DISCORD_PAYROLL_CHANNEL_ID`.

## Gestion Discord héritée de V11.21.0

La V11.21 transforme le bot de journalisation en véritable console de gestion sécurisée.

### Consultation
- `/rex-dashboard` : tableau de bord du jour ;
- `/rex-status` : état du site et du bot ;
- `/rex-stats` : statistiques par période et par employé ;
- `/rex-ventes` : derniers tickets avec produits, employé, heure et net encaissé ;
- `/rex-services` : employés en service et prochain salaire ;
- `/rex-stock` : alertes, ruptures ou stock complet ;
- `/rex-caisse` : fond de caisse et derniers mouvements ;
- `/rex-commandes` : dernières commandes de matières ;
- `/rex-config` : configuration et santé du bot.

### Gestion depuis Discord
- `/rex-service` : démarrer ou terminer le service d'un employé ;
- `/rex-stock-ajuster` : ajouter, retirer ou définir exactement le stock d'un produit ;
- `/rex-caisse-ajuster` : ajouter, retirer ou définir la caisse. Cette commande est réservée par défaut aux administrateurs Discord.

Toutes les commandes de modification exigent `confirmer=true`. Toute modification réalisée depuis Discord est répercutée en temps réel sur le site, sauvegardée sur le serveur et ajoutée au journal d'activité avec le nom Discord de la personne ayant effectué l'action.

### Rapports
- `/rex-rapport` génère un rapport pour aujourd'hui, 7 jours, 30 jours ou tout l'historique ;
- `publier=true` l'envoie dans `#rex-rapports` ;
- un rapport quotidien est envoyé automatiquement (23:55 par défaut) ;
- un rapport hebdomadaire est envoyé automatiquement (dimanche 20:00 par défaut) ;
- les rapports automatiques sont dédupliqués dans les données serveur afin d'éviter les doublons après un redémarrage Render.

Les rapports contiennent ventes, unités vendues, net encaissé, ticket moyen, caisse, employés en service, produits les plus vendus, classement des encaissements employés et stocks faibles/ruptures.

### Alertes stock intelligentes
Le bot compare l'état précédent et le nouvel état des produits. Il signale uniquement les transitions utiles :
- stock normal → stock faible ;
- stock faible → rupture ;
- stock normal → rupture ;
- stock faible/rupture → stock rétabli.

Cela évite de spammer Discord à chaque synchronisation. Le rôle `DISCORD_ALERT_ROLE_ID` peut être mentionné en rupture et, avec `DISCORD_ALERT_LOW_STOCK=true`, dès le stock faible.

## Salons automatiques

Avec `DISCORD_AUTO_SETUP=true`, le bot conserve les salons existants et ajoute si nécessaire :
- `#rex-activite`
- `#rex-ventes`
- `#rex-stocks`
- `#rex-commandes`
- `#rex-caisse`
- `#rex-salaires`
- `#rex-equipe`
- `#rex-admin`
- `#rex-systeme`
- `#rex-alertes`
- `#rex-rapports`

Les salons sont rangés dans `🦖 Rex's Diner • Logs`.

## Sécurité

`DISCORD_BOT_TOKEN` doit uniquement rester dans les variables d'environnement Render.

Les commandes sont réservées aux administrateurs Discord et aux rôles listés dans `DISCORD_ALLOWED_ROLE_IDS`. L'ajustement de caisse est encore plus strict : seuls les administrateurs Discord peuvent l'utiliser tant que `DISCORD_ALLOW_CASH_FOR_ROLES=false`.

Le bot n'utilise pas le Message Content Intent : il n'écoute pas les messages privés ou les conversations du serveur. Il utilise les interactions slash Discord.

## Variables recommandées sur Render

```text
DISCORD_AUTO_SETUP=true
DISCORD_STARTUP_MESSAGE=true
DISCORD_ALLOWED_ROLE_IDS=ID_DU_ROLE_DIRECTION
DISCORD_ALERT_ROLE_ID=ID_DU_ROLE_A_PREVENIR
DISCORD_ALERT_LOW_STOCK=true
DISCORD_ALLOW_CASH_FOR_ROLES=false
TZ=Europe/Brussels
DISCORD_DAILY_REPORT_TIME=23:55
DISCORD_WEEKLY_REPORT_DAY=0
DISCORD_WEEKLY_REPORT_TIME=20:00
```

Les horaires sont au format `HH:MM`. Pour le jour hebdomadaire : 0=dimanche, 1=lundi, ... 6=samedi.

## Optimisations techniques

- file d'envoi Discord pour lisser les notifications ;
- temporisation légère entre messages ;
- jusqu'à trois tentatives en cas d'échec temporaire d'envoi ;
- déduplication des événements ;
- réponses sensibles éphémères ;
- autocomplétion des employés et produits ;
- synchronisation SSE du site après une action Discord ;
- persistance immédiate des mutations Discord ;
- bot totalement isolé du chemin critique de la caisse.


## Salon salaires

Les écritures de journal dont l'action est `Salaire` sont routées vers `#rex-salaires` au lieu de `#rex-caisse`. Les autres mouvements de caisse restent dans `#rex-caisse`. En configuration manuelle, utilisez `DISCORD_PAYROLL_CHANNEL_ID`.
