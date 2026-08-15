# Audit technique et gameplay de Spellaho

Date : 15 août 2026  
Portée : moteur, règles, cartes, IA, multijoueur, interactions tactiles, responsive et progression.

## Méthode et résultat global

- Lecture du cycle complet, de la construction des decks à la fin de partie.
- Tests de logique pure : 15 scénarios, tous réussis après correction.
- Smoke test : données, médias, responsive et salon multijoueur, tous réussis après correction.
- Tests navigateur : partie réelle, double-tap, plusieurs passages de tour, ouverture/fermeture répétée des fiches, nouvelle partie pendant le délai IA, smartphone paysage 844 x 390 et portrait 390 x 844.
- Simulation de ressources : 10 000 parties pour chacun des cinq decks, avec la construction réelle de 60 cartes.
- Aucune mécanique majeure n'a été changée. Seules des erreurs techniques et des incohérences d'exécution ont été corrigées.

Commandes reproductibles :

```text
node --test tools/gameplay-test.mjs
node tools/smoke-test.js
node tools/resource-simulation.mjs 10000
```

Le mode debug est désactivé par défaut. Il s'active avec `?debug=1` ou `SpellahoDebug.enable()` dans la console. Il conserve les 300 derniers événements et expose `SpellahoDebug.events` et `SpellahoDebug.validate()`.

## A — BUGS CRITIQUES

### A1. L'IA continuait à jouer après une mort par fatigue

**Description :** l'IA pouvait mourir pendant sa pioche de début de tour, puis poser un terrain, lancer des cartes ou attaquer.  
**Cause :** `enemyTurn()` ne vérifiait pas à nouveau la fin de partie après `beginTurn()`.  
**Reproduction :** vider la bibliothèque adverse, mettre son héros à 1 PV, puis terminer le tour.  
**Correction effectuée :** arrêt immédiat du tour IA après une pioche fatale et gardes répétées avant ses actions.  
**Test de régression :** smoke test « Une pioche fatale arrête immédiatement le tour de l'IA ».

### A2. Un ancien minuteur pouvait contaminer une nouvelle partie

**Description :** lancer une revanche juste après « Fin du tour » pouvait déclencher l'IA de la partie précédente dans la nouvelle.  
**Cause :** les `setTimeout` n'étaient associés ni à la partie ni à un mécanisme d'annulation.  
**Reproduction :** terminer le tour, ouvrir immédiatement « Nouvelle partie », relancer avant 450 ms.  
**Correction effectuée :** registre de minuteurs, annulation à chaque nouvelle partie, contrôle du `matchId` avant toute résolution.  
**Test de régression :** test navigateur : après 1,2 s, la revanche reste au tour 1 avec 53 cartes dans chaque bibliothèque.

### A3. La partie continuait derrière le menu

**Description :** ouvrir « Nouvelle partie » pendant le tour IA laissait l'IA agir sous le menu.  
**Cause :** le menu masquait le plateau sans suspendre le moteur.  
**Reproduction :** terminer le tour puis ouvrir le menu avant la première action IA.  
**Correction effectuée :** état de pause moteur, annulation des minuteurs et du ciblage à l'ouverture du menu.  
**Test de régression :** test navigateur : le libellé de tour reste identique pendant l'attente.

### A4. Les règles dépendaient partiellement des boutons désactivés

**Description :** les fonctions internes de pose, d'invocation et de sort pouvaient accepter un appel hors tour.  
**Cause :** les gardes existaient surtout dans le gestionnaire d'interface.  
**Reproduction :** appeler deux fois une action pendant un changement de DOM ou réutiliser un index périmé.  
**Correction effectuée :** validation dans chaque fonction moteur : tour, partie active, animation, index, type, condition divine, place et paiement atomique.  
**Test de régression :** tests « actions principales hors tour », « spam de paiement » et vérification statique des trois actions.

### A5. Une attaque périmée pouvait encore se résoudre

**Description :** un attaquant engagé, mort ou remplacé pendant l'animation pouvait frapper malgré tout.  
**Cause :** la disponibilité n'était vérifiée qu'au moment de la sélection.  
**Reproduction :** sélectionner une créature, modifier l'état avant la fin de la charge, puis résoudre la cible.  
**Correction effectuée :** revalidation de l'attaquant, de la cible, du tour, de Provocation et de la présence sur le plateau au moment exact de la résolution.  
**Test de régression :** smoke test de ciblage et tests de combat pur.

### A6. La fin de tour en ligne n'était pas publiée

**Description :** le second joueur pouvait rester bloqué sur l'ancien tour.  
**Cause :** `endCurrentTurn()` ne marquait pas l'état réseau comme modifié.  
**Reproduction :** ne rien faire puis terminer directement son tour en ligne.  
**Correction effectuée :** publication explicite de chaque fin de tour.  
**Test de régression :** smoke test « La fin de tour est publiée au second joueur ».

### A7. Un état réseau ancien pouvait écraser une action récente

**Description :** deux publications retardées pouvaient arriver dans le mauvais ordre.  
**Cause :** le serveur incrémentait une version, mais n'exigeait pas que le client parte de la dernière version.  
**Reproduction :** publier une version 0 après qu'une version 1 a déjà été acceptée.  
**Correction effectuée :** contrôle optimiste de version, réponse 409 et réapplication de l'état autoritaire.  
**Test de régression :** le serveur refuse l'état obsolète et conserve le marqueur de la version 1.

### A8. La fatigue pouvait produire un héros vivant mais déclaré perdant

**Description :** « pioche puis soigne » pouvait faire passer le héros à 0, déclarer la défaite, puis le soigner.  
**Cause :** l'effet continuait après `GAME_OVER`.  
**Reproduction :** jouer une carte de pioche et soin à 1 PV avec une bibliothèque vide.  
**Correction effectuée :** interruption immédiate de la suite de l'effet après une pioche fatale.  
**Test de régression :** smoke test « Un soin ne ressuscite pas un héros mort de fatigue ».

### A9. Le glisser du joueur 2 ciblait le mauvais tapis

**Description :** en local ou en ligne, le joueur contrôlant le camp `enemy` ne pouvait pas glisser une attaque vers le camp `player`.  
**Cause :** les cibles tactiles étaient codées en dur sur `enemy-board` et le commandant adverse visuel.  
**Reproduction :** au tour du joueur 2, glisser une créature vers une cible du joueur 1.  
**Correction effectuée :** plateau, commandant et surbrillance calculés depuis le camp qui défend réellement.  
**Test de régression :** smoke test des cibles relatives et contrôle du clic sur les deux commandants.

### A10. Un début de tour dupliqué renforçait Connor plusieurs fois

**Description :** deux appels identiques à `beginTurn` pouvaient appliquer deux fois les compteurs de survie et le +1/+1 de Connor.  
**Cause :** le début de tour n'était pas idempotent.  
**Reproduction :** déclencher deux fois le même callback de tour avec le même match, numéro et camp.  
**Correction effectuée :** clé unique `matchId:tour:camp`; le second appel est refusé.  
**Test de régression :** Connor passe de 1 à 3 après deux tours distincts, pas à 4 après un doublon.

## B — BUGS MINEURS

- Plusieurs Parasites ne produisaient qu'une seule Vengeance de Rena. Ils infligent désormais 2 dégâts chacun.
- `hasKeyword` supposait toujours la présence d'un tableau `keywords`; une donnée incomplète pouvait provoquer une exception.
- La boucle de pose de l'IA n'avait pas de limite de sécurité. Elle est maintenant bornée à 80 itérations.
- Le son différé de victoire pouvait se jouer pendant une revanche très rapide. Il est maintenant rattaché à la partie.
- Le mode portrait et le paysage 844 x 390 ne produisent ni scroll ni débordement; le verrou portrait reste volontaire.
- La main n'a actuellement aucune limite. Ce n'est pas un crash, mais la lisibilité et la pression de ressource se dégradent au-delà de 10 cartes.

## C — DETTE TECHNIQUE

1. `game.js` concentre encore DOM, réseau, IA, règles, animations et données spéciales dans un seul module très long.
2. Les effets de 40 créatures sont une chaîne de conditions sur leur identifiant. Ajouter une carte oblige à modifier le moteur.
3. Il n'existe pas de file d'événements générale. Les événements réellement structurés sont surtout `onPlay`, début de tour de Connor, attaque du Parasite et quelques morts particulières.
4. `onSummon`, `onTurnEnd`, `onDamage`, `onHeal`, `onKill` et `onDraw` ne sont pas des contrats génériques du moteur.
5. Les anciennes phases `COMBAT`, `BLOCK` et `MAIN_2` restent déclarées alors que le jeu fonctionne dans une phase principale continue.
6. Le serveur du salon 1234 conserve l'état en mémoire : un redémarrage efface la partie et un seul salon mondial est disponible.
7. Le serveur vérifie l'identité du joueur et la version, mais ne recalcule pas les règles. Un client volontairement modifié peut encore publier un état frauduleux.
8. Les comptes et l'XP sont des profils locaux `localStorage`, pas des comptes authentifiés ni synchronisés.
9. Quelques minuteurs purement visuels restent autonomes. Ils ne modifient plus les règles, mais mériteraient un gestionnaire d'animations commun.
10. La couche pure créée dans `engine-core.mjs` couvre les invariants essentiels; le prochain refactoring devrait y déplacer progressivement les effets et le cycle complet.

## D — FORCES ACTUELLES DU GAMEPLAY

- La règle d'attaque directe est rapide à comprendre et adaptée au tactile.
- Défenseur joue bien le rôle de Provocation, tandis que Vol crée une exception lisible.
- L'ordre des attaques compte à cause de Contact mortel, Lien de vie, Gel, Noxis et Vengeance de Rena.
- Les invocations divines donnent une vraie planification sur plusieurs tours : survie, combinaison et sacrifice.
- Héritage, Apocalypse et Fusion complète constituent déjà une signature plus personnelle qu'un simple changement de thème.
- Les cinq couleurs ont des directions visibles : soin/défense, gel/pioche, mort/réanimation, dégâts, nature/buffs/Parasites.
- Les effets d'arrivée produisent du tempo immédiatement et évitent que chaque carte soit seulement un bloc de statistiques.
- La limite de sept créatures maintient le plateau lisible sur téléphone.
- Le journal, les animations de pioche/mort/cimetière et les fiches détaillées donnent une base de feedback solide.

## E — FAIBLESSES DU GAMEPLAY

### Boucle décisionnelle actuelle

Un tour consiste à piocher, poser éventuellement un terrain, jouer ce que la couleur permet, puis ordonner ses attaques. Le placement gauche/droite n'a aucun effet. L'ordre de jeu et l'ordre d'attaque peuvent être importants, mais beaucoup de tours ont une action optimale évidente : poser le seul terrain disponible, jouer la carte abordable, puis prendre l'échange favorable calculable.

Le bluff est presque absent : la main est cachée, mais aucune réaction n'est possible pendant le tour adverse. La planification existe surtout grâce aux invocations divines et à la progression des terrains.

### Ressources : principal problème mesuré

Chaque deck possède 12 terrains de chacune de ses deux couleurs. Pourtant une carte de coût 4 demande quatre terrains de sa propre couleur. Les autres terrains ne contribuent pas. La moyenne des créatures est de 4,02 manas et celle des sorts de 3,90.

Simulation de 10 000 parties par deck, en jouant les terrains et cartes disponibles :

| Deck | Tour 1 sans carte jouée | Tour 3 | Tour 5 | Tour 10 |
|---|---:|---:|---:|---:|
| Blanc / Vert | 83,6 % | 51,2 % | 44,8 % | 37,6 % |
| Rouge / Noir | 100 % | 62,5 % | 54,2 % | 37,3 % |
| Bleu / Vert | 100 % | 58,7 % | 51,9 % | 39,1 % |
| Noir / Blanc | 83,4 % | 52,3 % | 45,5 % | 34,2 % |
| Rouge / Bleu | 100 % | 68,4 % | 59,3 % | 41,8 % |

La simulation considère les invocations divines comme verrouillées et ne simule pas les effets de pioche. Elle n'est donc pas une prédiction exacte de victoire, mais elle mesure correctement la friction de base. Le risque dominant est le **color screw**, puis le mana flood. Les cartes chères restent trop longtemps mortes en main.

### Interaction et rythme

Le joueur adverse regarde entièrement le tour en cours. Ce n'est pas grave si les tours restent courts, mais les animations successives et les gros plateaux peuvent créer du temps mort. L'absence de réaction simplifie fortement le téléphone, mais réduit la tension et le bluff.

Estimation prudente avec les valeurs actuelles : premières décisions intéressantes aux tours 2 à 4, partie souvent décidée entre les tours 8 et 14, fin complète entre 10 et 18 tours, soit environ 8 à 15 minutes contre un humain. Les mains fortement bloquées peuvent allonger la partie sans ajouter de décisions.

### Card advantage, tempo et comeback

Le jeu possède bien du card advantage grâce à la pioche, aux invocations multiples et à la réanimation. Il possède du tempo via Gel, dégâts d'arrivée, destruction et Défenseur. Cependant le système de couleur décide parfois davantage que ces arbitrages.

Les nettoyages de zone et le Gel permettent des retours, mais un joueur avec plus de créatures obtient plus d'attaques, de buffs collectifs et de cibles d'effets. Le snowball est donc réel. Il est aggravé lorsque le joueur derrière ne pioche pas la bonne couleur.

### Terrains et héros

Les 28 terrains offrent cinq comportements mécaniques seulement : chacun produit un mana de sa couleur. Choisir une illustration plutôt qu'une autre ne change aucune décision. Ils sont une contrainte de tirage, pas encore une signature stratégique.

Le héros est aujourd'hui un portrait, un nom et une réserve de PV. Il ne définit pas les règles du deck, n'a ni capacité active ni passive et n'est pas une condition alternative de victoire.

### Archétypes réellement compatibles

- **Midrange / Buff :** déjà naturel en Blanc-Vert et Vert.
- **Tempo :** compatible avec Bleu, Gel et attaques directes.
- **Aggro / Burn :** compatible avec Rouge-Noir, mais le mana coloré le ralentit fortement.
- **Sacrifice / Graveyard :** prometteur en Noir grâce aux invocations et réanimations.
- **Token :** présent avec Familiers, Zombies et Parasites.
- **Control :** possible via zone, Gel et destruction, mais sans réaction adverse.
- **Ramp :** pas réellement présent, car aucun terrain n'accélère durablement la ressource.
- **Combo :** les invocations divines sont des objectifs de combinaison visibles, pas du combo caché.

## F — COMPARAISON

| Axe | Spellaho actuel | Hearthstone | Magic |
|---|---|---|---|
| Ressources | 24 terrains, coût entièrement coloré | Mana automatique progressif | Terrains, coûts colorés + génériques |
| Combat | Attaquant choisit cible, riposte immédiate | Très proche | Attaques puis bloqueurs |
| Interaction adverse | Presque nulle pendant le tour | Faible, secrets indirects | Très élevée, éphémères et pile |
| Terrain | Source colorée sans pouvoir distinct | Aucun terrain en main | Ressource, couleurs, nombreux effets |
| Héros | PV + identité visuelle | PV + pouvoir héroïque | Joueur; commandant seulement selon format |
| Triggers | Surtout arrivée, quelques débuts/morts/attaques | Cri de guerre, Râle, nombreux événements | Système général de capacités déclenchées |
| Tempo | Gel, dégâts, Défenseur, attaque directe | Central | Central mais modulé par bloqueurs/réponses |
| Card advantage | Pioche, jetons, réanimation | Très lisible et fréquent | Très profond, nombreuses zones |
| Deckbuilding | 5 decks auto-construits de 60 cartes | 30 cartes par classe | 60+, couleurs et formats multiples |
| Comeback | Zones et Gel, mais snowball de plateau | Nombreux nettoyages et outils de classe | Réponses variées selon couleurs |
| Complexité | Règle centrale simple, nombreuses exceptions de cartes | Faible à moyenne | Élevée |

Spellaho est actuellement plus proche de Hearthstone dans le combat et plus proche de Magic dans la présence de terrains. Son identité la plus forte n'est pourtant ni l'un ni l'autre : ce sont les **légendes qui survivent, fusionnent, évoluent ou se sacrifient pour une invocation supérieure**.

## G — AMÉLIORATIONS PROPOSÉES

### G1. Coût avec couleur requise et mana générique

**Problème résolu :** trop de cartes injouables malgré plusieurs terrains.  
**Fonctionnement :** une carte de coût 4 exige au moins un terrain de sa couleur, puis trois terrains quelconques. Les cartes très identitaires pourraient exiger deux symboles colorés.  
**Pourquoi :** conserve les terrains et les couleurs sans reproduire le color screw actuel.  
**Impact stratégique :** plus de choix de courbe, moins de tours vides, bicolore réellement jouable.  
**Profondeur stratégique : ÉLEVÉ** · **Complexité ajoutée : FAIBLE** · **Lisibilité : ÉLEVÉE** · **Impact rythme : ÉLEVÉ** · **Difficulté technique : MOYENNE** · **Risque d'équilibrage : MOYEN** · **Priorité : 5/5**

### G2. Mulligan unique et lisible

**Problème résolu :** main initiale sans terrain utile ou sans carte de début de partie.  
**Fonctionnement :** avant le tour 1, sélectionner les cartes à remplacer une seule fois.  
**Pourquoi :** crée une première décision et réduit les parties perdues au mélange.  
**Impact stratégique :** adaptation au deck adverse et recherche d'une courbe, sans garantie artificielle.  
**Profondeur : MOYENNE** · **Complexité : FAIBLE** · **Lisibilité : ÉLEVÉE** · **Impact rythme : MOYEN** · **Difficulté : MOYENNE** · **Risque : FAIBLE** · **Priorité : 5/5**

### G3. Un terrain signature par deck

**Problème résolu :** 28 terrains visuels mais seulement cinq décisions mécaniques.
**Fonctionnement :** garder les terrains de base simples et autoriser un seul terrain signature en 1 ou 2 exemplaires : soin léger, compteur d'évolution, création différée, ou bonus conditionnel.  
**Pourquoi :** valorise les tapis, les mondes et les archétypes sans transformer chaque terrain en texte à mémoriser.  
**Impact stratégique :** choix du moment de pose et identité du deck.  
**Profondeur : ÉLEVÉE** · **Complexité : MOYENNE** · **Lisibilité : MOYENNE** · **Impact rythme : FAIBLE** · **Difficulté : MOYENNE** · **Risque : MOYEN** · **Priorité : 4/5**

### G4. Une capacité passive simple par héros

**Problème résolu :** le portrait n'a aucun impact stratégique.  
**Fonctionnement :** une passive visible et courte, choisie avant la partie, par exemple « la première créature soignée chaque tour gagne +1 PV max ». Pas de nouveau bouton.  
**Pourquoi :** donne une identité de deck sans ajouter une ressource ou une phase.  
**Impact stratégique :** influence construction et ordre des actions.  
**Profondeur : ÉLEVÉE** · **Complexité : FAIBLE À MOYENNE** · **Lisibilité : ÉLEVÉE** · **Impact rythme : FAIBLE** · **Difficulté : MOYENNE** · **Risque : ÉLEVÉ** · **Priorité : 4/5**

### G5. Préparer un seul sort de réaction

**Problème résolu :** aucun choix pendant le tour adverse.  
**Fonctionnement :** en fin de tour, réserver volontairement un sort compatible et ses terrains; le déclencher sur une condition simple, sans pile générale.  
**Pourquoi :** ajoute lecture, risque et bluff tout en limitant les interruptions à une seule réaction.  
**Impact stratégique :** arbitrage immédiat entre tempo présent et protection future.  
**Profondeur : ÉLEVÉE** · **Complexité : MOYENNE** · **Lisibilité : MOYENNE** · **Impact rythme : MOYEN** · **Difficulté : ÉLEVÉE** · **Risque : ÉLEVÉ** · **Priorité : 3/5**

### G6. Comeback conditionnel au plateau, jamais aux PV

**Problème résolu :** un large plateau génère encore plus de buffs et d'attaques.  
**Fonctionnement :** quelques cartes coûtent moins ou gagnent un effet si l'adversaire contrôle au moins quatre créatures.  
**Pourquoi :** punit l'extension excessive sans récompenser artificiellement le joueur simplement parce qu'il perd.  
**Impact stratégique :** oblige le leader à mesurer son engagement sur le plateau.  
**Profondeur : ÉLEVÉE** · **Complexité : FAIBLE** · **Lisibilité : ÉLEVÉE** · **Impact rythme : MOYEN** · **Difficulté : FAIBLE** · **Risque : MOYEN** · **Priorité : 4/5**

### G7. Prévisualisation complète des conséquences

**Problème résolu :** le joueur ne voit pas toujours pourquoi une unité meurt ou quel trigger répond.  
**Fonctionnement :** flèche avec dégâts prévus, badges `-3`, source du trigger brièvement surlignée, mention « Contact mortel », « Vengeance de Rena », « +1/+1 permanent ».  
**Pourquoi :** la profondeur ne sert à rien si la résolution paraît arbitraire.  
**Impact stratégique :** meilleures décisions et apprentissage plus rapide.  
**Profondeur : MOYENNE** · **Complexité : FAIBLE** · **Lisibilité : ÉLEVÉE** · **Impact rythme : POSITIF** · **Difficulté : MOYENNE** · **Risque : FAIBLE** · **Priorité : 5/5**

### G8. File d'événements interne

**Problème résolu :** effets difficiles à ordonner, tester et expliquer.  
**Fonctionnement :** événements typés `TURN_START`, `SUMMON`, `DAMAGE`, `DEATH`, puis résolution ordonnée. Aucun changement visible des règles au départ.  
**Pourquoi :** rend possibles les tests exhaustifs et les futurs triggers sans chaîne de conditions fragile.  
**Impact stratégique :** neutre immédiatement, fondation indispensable pour les nouvelles cartes.  
**Profondeur : FAIBLE** · **Complexité joueur : NULLE** · **Lisibilité moteur : ÉLEVÉE** · **Impact rythme : NUL** · **Difficulté : ÉLEVÉE** · **Risque : MOYEN** · **Priorité : 5/5 technique**

## H — TOP 5

1. **Remplacer le coût entièrement coloré par couleur requise + mana générique.** Plus grand gain de rythme et de décisions.
2. **Ajouter un mulligan unique.** Réduit les non-parties avec une règle connue et courte.
3. **Améliorer la prévisualisation des dégâts et la provenance des triggers.** Fort gain de plaisir et de maîtrise, presque aucune complexité de règles.
4. **Créer une passive courte par héros.** Donne une identité stratégique aux portraits déjà présents.
5. **Créer un terrain signature par deck, les autres restant simples.** Rend les terrains intéressants sans multiplier 25 exceptions.

La réaction pendant le tour adverse est prometteuse, mais vient après ces cinq points : elle demande davantage de tests UX et d'équilibrage.

## I — MÉCANIQUES À NE PAS AJOUTER

1. **La pile complète et les fenêtres de priorité de Magic.** Trop de confirmations, de temps mort et de charge tactile.
2. **Les phases et bloqueurs complets de Magic.** Ils annuleraient la simplicité actuelle du choix direct de cible.
3. **La destruction fréquente de terrains.** Avec la variance actuelle, elle transformerait trop de parties en impossibilité de jouer.
4. **Le mana automatique de Hearthstone tel quel.** Il supprimerait l'identité potentielle des terrains au lieu de la réparer.
5. **Un pouvoir héroïque actif pour chaque héros dès maintenant.** Un bouton, un coût et des dizaines d'équilibrages supplémentaires; commencer par une passive.
6. **Des secrets nombreux et invisibles.** Ils augmenteraient les erreurs perçues et les textes à mémoriser sur petit écran.
7. **Des dizaines de nouveaux mots-clés.** Les mots-clés actuels suffisent; approfondir leurs interactions vaut mieux qu'élargir le glossaire.
8. **Un bonus automatique basé uniquement sur les PV du joueur en retard.** Il punirait artificiellement le joueur qui a bien joué.
9. **Des lignes ou positions obligatoires sur le plateau.** Le tapis mobile manque d'espace et le placement n'est pas aujourd'hui une promesse centrale.
10. **Une limite de temps très courte avant de résoudre le color screw.** Elle accélérerait seulement des tours déjà pauvres en décisions.

## Conclusion

Spellaho possède déjà une direction propre : un duel tactile direct où des légendes évoluent, survivent et fusionnent. Le moteur est maintenant nettement plus résistant aux doubles actions, états périmés et désynchronisations. Le premier chantier de game design ne devrait pas être une nouvelle famille de mécaniques, mais la réduction de la friction du mana coloré. Ensuite, les héros et un petit nombre de terrains signatures peuvent porter l'identité du jeu sans le transformer en clone de Magic ou Hearthstone.
