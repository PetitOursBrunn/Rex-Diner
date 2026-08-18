# Rex's Diner — V11.6

Correction du bouton Espèces.

Le problème venait de deux appels JavaScript inexistants dans la fenêtre de confirmation :
- `totals()` au lieu de `calcTotals()`
- `usd()` au lieu de `money()`

Flux corrigé :
1. Ajouter des produits.
2. Choisir Dollars ou Pesos.
3. Cliquer sur Espèces.
4. Vérifier la liste des produits, quantités et total.
5. Cliquer sur Confirmer & encaisser.
6. La vente est enregistrée, le stock est déduit et le fonds de caisse est crédité en pesos.

Le bouton Carte reste supprimé. Tout le reste est inchangé.
