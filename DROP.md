# Système de rareté et de drop — Spellaho

Source unique des probabilités : **`drop.js`**, objet `DROP_CONFIG`.
Aucun taux n'est dupliqué ailleurs dans le projet. Toute modification de
probabilité se fait à un seul endroit.

## Principe

La **rareté est tirée avant la carte**. La carte est ensuite choisie
uniformément parmi celles de cette rareté.

C'est le point central : une table de butin qui tire directement dans un
pool global favorise mécaniquement les raretés qui contiennent le plus de
cartes. Ici, une rareté qui compte 3 cartes et une qui en compte 37 ont
exactement le poids que la configuration leur donne.

Les poids sont des **entiers sur une base de 10 000**. La somme est
vérifiée à l'exécution par `assertWeightsValid()`, qui lève une erreur au
chargement si elle ne vaut pas exactement 100 %.

## Taux

| Rareté | Poids | Probabilité | Cartes du pool | Fréquence d'une carte donnée |
|---|---|---|---|---|
| Commune | 6000 | 60,000 % | 37 | 1 tirage sur 62 |
| Peu commune | 2500 | 25,000 % | 30 | 1 sur 120 |
| Rare | 1000 | 10,000 % | 18 | 1 sur 175 |
| Épique | 400 | 4,000 % | 10 | 1 sur 248 |
| Légendaire | 100 | 1,000 % | 3 | 1 sur 280 |
| **Total** | **10000** | **100,000 %** | **98** | — |

**Logique de la répartition.** Les communes restent majoritaires (3 cartes
sur 5 en moyenne par booster). Les peu communes apparaissent à presque
chaque booster. Les rares sortent environ une fois sur deux boosters. Les
épiques une fois sur cinq boosters. Les légendaires restent un événement :
une tous les 15 boosters environ.

**Décroissance de la fréquence individuelle.** Le nombre de cartes par
rareté suit la hiérarchie (37 > 30 > 18 > 10 > 3). Sans cela, une carte
« rare » individuelle serait plus facile à obtenir qu'une commune — 10 %
partagés entre 7 cartes battent 60 % partagés entre 53. C'était le cas
avant calibrage ; `inferRarity()` a été réglée pour l'éviter, et la
simulation contrôle cette décroissance à chaque exécution.

## Garanties

**Plancher de booster.** Le 5ᵉ emplacement (`slot: 4`) est garanti « peu
commune ou mieux ». Il évite le booster intégralement commun, très punitif
en ressenti. Ce plancher **déplace volontairement les taux effectifs** :

| Rareté | Taux brut | Taux effectif en booster |
|---|---|---|
| Commune | 60,000 % | 48,045 % |
| Peu commune | 25,000 % | 32,419 % |
| Rare | 10,000 % | 12,978 % |
| Épique | 4,000 % | 5,190 % |
| Légendaire | 1,000 % | 1,368 % |

L'écart est attendu et calculable : 4 emplacements suivent les taux bruts,
le 5ᵉ suit la distribution conditionnelle « rang ≥ 1 ».

**Pity.** Deux filets, désactivables par `DROP_CONFIG.pity.enabled`.

- `rareAfter: 25` — après 25 tirages sans rare ou mieux, le suivant est forcé.
- `legendaryAfter: 250` — après 250 tirages sans légendaire, le suivant est forcé.

Le calibrage compte. Avec `E[intervalle] = (1-(1-p)^N)/p` :

- légendaire à `N=100` donnait **1,58 %** effectif au lieu de 1 %, soit
  +58 % : le filet devenait la source principale ;
- à `N=250`, l'effectif est **1,07 %**, soit +0,07 point.

Règle à retenir : **le seuil de pity doit être très au-delà de l'espérance
du tirage naturel**, sinon il gonfle le taux qu'il est censé garantir.

## Simulation

```bash
node tools/simulate-drops.js
```

100 000 tirages par défaut (paramètre optionnel pour davantage). Le script
mesure les taux observés, l'écart au théorique, le χ², la couverture du
pool, les doublons par booster et la décroissance de fréquence.

Résultats de référence (graine 20260730, 100 000 tirages) :

- **Moteur seul, sans pity : χ² = 6,36** pour un seuil critique de 9,488 à
  4 degrés de liberté → conforme. Les taux suivent la configuration.
- Avec pity : χ² = 13,84. L'écart est intentionnel et provient des filets.
- Couverture : **98/98 cartes obtenues**, aucune carte inatteignable.
- Doublons internes : 0,103 par booster.
- Légendaire : une tous les 14,9 boosters.

## Étendre le système

- **Ajouter une rareté** : l'ajouter à `RARITIES` et à `DROP_CONFIG.weights`
  en conservant une somme de 10 000. `assertWeightsValid()` échoue sinon.
- **Passer à un champ `rarity` dans les JSON** : donner un autre `resolve`
  à `buildLootTable()`. `inferRarity()` devient alors un simple repli.
- **Brancher sur le gameplay** : `createDropSystem(cartes)` renvoie un objet
  encapsulant l'état de pity, avec `draw()` et `openBooster()`.

Le système est autonome : il n'est pas encore relié à une boucle de
récompense en jeu, et n'affecte donc aucune règle de partie.
