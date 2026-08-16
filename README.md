# Spellaho

Prototype de jeu de cartes fantasy (HTML/CSS/JS vanilla) inspiré des duels tactiques
type Magic / Hearthstone. Aucun framework, aucune dépendance : juste Node pour le
petit serveur statique et l'API du salon multijoueur.

**Jouer en ligne :** https://themiaouwinebonbon.github.io/Tonitos/

## Contenu

- `index.html` : menu de lancement + plateau jouable.
- `styles.css` : direction artistique, tapis de jeu, zones, effets et cartes.
- `game.js` : moteur de partie (IA solo, 2 joueurs local, 2 joueurs en ligne).
- `progression.js` : profils locaux, XP, niveaux, statistiques et grades.
- `serve.js` : serveur HTTP statique + API du salon en mémoire (code `1234`).
- `data/cards.json` : créatures et champions.
- `data/lands.json` : terrains par couleur.
- `data/spells.json` : sorts, artefacts et améliorations.
- `tools/generate-cards.js` : génération des cartes SVG imprimables.
- `tools/smoke-test.js` : vérification automatisée (serveur + API salon + données).
- `Images/Cartes` : cartes SVG générées à partir des illustrations d'origine.

## Modes de jeu

Depuis le menu de lancement (nom du jeu : **Spellaho**) :

- **1 joueur contre IA** : tu joues le côté joueur, l'IA joue l'adversaire.
- **2 joueurs local** : les deux camps se jouent sur le même écran et la main
  affichée suit automatiquement le joueur actif.
- **2 joueurs en ligne** : les deux joueurs saisissent le **code 1234**. Le serveur
  local garde le salon en mémoire et l'état se synchronise par polling (~1 s). Sur
  un hébergement statique comme GitHub Pages, Spellaho bascule automatiquement sur
  une connexion directe WebRTC entre les deux joueurs. Chacun ne contrôle que son
  côté ; les actions du camp adverse sont verrouillées. Le statut d'attente, de
  connexion et de synchronisation est affiché en clair.

Chaque joueur choisit son **nom**, son **portrait/avatar** (affiché dans la zone
Commandant du tapis, sans activer les règles Commander) et son **deck** bicolore.

## Profils et progression

Spellaho peut conserver plusieurs profils sur le même appareil. Les données restent
dans le navigateur afin de rester compatibles avec GitHub Pages : il ne s'agit pas
d'un compte distant protégé par mot de passe.

- Victoire : **100 XP** · égalité : **60 XP** · défaite : **35 XP**.
- Grades : Débutant, Bronze, Silver, Or, Platine, Diamant, Émeraude et Master.
- Le menu affiche le niveau, la barre d'XP et les statistiques du profil actif.
- En mode local, chaque joueur peut choisir son propre profil ; la main est masquée
  entre les tours jusqu'à ce que le joueur suivant confirme qu'il a l'écran.

## Contrôles (glisser-déposer)

- **Jouer une carte** : glisse-la de ta main vers le **champ de bataille** (il
  s'illumine en vert). Un simple clic ouvre toujours la fiche détaillée.
- **Attaquer** : glisse une de tes créatures prêtes (⚔) vers sa cible — une
  créature adverse ou le **commandant**. Une flèche de visée rouge suit le
  curseur et la cible valide s'illumine. Le clic (créature puis cible) reste
  disponible en alternative.
- Chaque attaque déclenche une **charge de l'attaquant** et une **secousse
  d'impact** ; l'IA attaque de la même manière, une créature à la fois.

## Cadrage des illustrations

Certaines illustrations larges (16:9) étaient cernées de bandes noires dans le
cadre 4:3. Un champ optionnel `art` par carte (`{ "fit": "cover", "position":
"50% 32%" }` dans `data/cards.json`) permet de remplir le cadre en gardant le
sujet bien centré, sans toucher aux autres cartes.

## Règles de combat (style Hearthstone)

- **Plus de phase de combat ni de bloqueurs.** Pendant tout ton tour tu poses tes
  cartes et tu attaques librement, dans l'ordre que tu veux, puis « Fin du tour ».
- **Attaquer** : clique une de tes créatures prêtes (surbrillance verte ⚔), puis
  clique sa cible — une créature adverse ou directement le **commandant**. La
  résolution est immédiate : l'attaquant frappe, la cible riposte.
- Une créature ne peut attaquer qu'une fois par tour. **Vigilance** lui évite de
  s'engager après l'attaque, mais ne lui accorde pas d'attaque supplémentaire.
- **Mal d'invocation 💤** : une créature ne peut pas attaquer le tour où elle arrive,
  sauf avec **Célérité**.
- **Défenseur 🛡 = Provocation** : ces créatures ne peuvent pas attaquer, mais elles
  doivent être frappées en premier — elles protègent le commandant et le reste du
  plateau. Le **Vol** permet de les ignorer.
- Les cartes **jouables** de ta main sont mises en surbrillance dorée.
- Mots-clés gérés : Vol, Vigilance, Célérité, Défenseur (Provocation), Contact
  mortel, Lien de vie. (Portée reste décorative depuis la suppression du blocage.)
- La vie est **plafonnée à 30**. Piocher sans bibliothèque coûte 1 point de vie par
  carte manquante, et peut faire perdre la partie.
- Un **écran de fin de partie** annonce le vainqueur et propose une revanche
  immédiate (mêmes decks et profils, y compris en ligne).
- L'IA ne lance plus de sorts sans cible utile et choisit ses attaques en privilégiant
  les échanges favorables ou les dégâts létaux.

## Effets visuels de cartes

- La pioche fait voyager un dos de carte de la bibliothèque vers la main sans
  révéler les cartes adverses.
- Les composants d'une invocation légendaire se désagrègent avant de rejoindre
  le cimetière.
- Une créature détruite s'assombrit, se fragmente et est aspirée vers son
  cimetière.
- Chaque arrivée au cimetière ouvre brièvement un vortex ; un cimetière occupé
  conserve ensuite une aura animée discrète.
- Le réglage système « réduire les animations » raccourcit automatiquement ces
  effets.

Les cinq zones interactives suivent les cadres imprimés des tapis : Bibliothèque,
Cimetière, Champ de bataille, Exil et Commandant. Le survol affiche une copie complète
de la carte dans un calque indépendant, sans découpe par la main ou le panneau latéral ;
sur mobile, le clic ouvre la fiche complète dans une fenêtre adaptée à l'écran.
Le recto fourni sert de cadre commun aux cartes, le dos apparaît dans les bibliothèques,
et la carte supérieure est visible directement dans les zones Cimetière et Exil.
Sur téléphone en paysage, les deux tapis, les commandes et la main tiennent dans
le même écran sans défilement. Les vues Cartes, Règles et Journal restent accessibles
depuis la barre inférieure.

## Mana coloré

Chaque carte exige autant de terrains **de sa propre couleur** que son coût :
une carte noire à 3 ne se lance qu'avec **3 terrains noirs dégagés**. Les terrains
d'une autre couleur ne comptent pas. Seules les cartes **Incolores** (Pierre de
Norne) acceptent n'importe quel terrain.

La zone Commandant affiche donc le mana **par couleur** (ex. `2B 2V` = 2 blancs et
2 verts disponibles), et le journal précise ce qu'il manque : « Il manque 2
terrain(s) vert(s) dégagé(s) pour lancer Golem de pierre. »

## Invocations divines

Les cinq **dieux** et les **invocations légendaires** ne peuvent pas être lancés librement : il faut d'abord accomplir
une condition de légende sur ta propre moitié de table. Tant qu'elle n'est pas
remplie, la carte reste **verrouillée 🔱🔒** dans ta main (elle ne s'allume pas et
le clic ne la joue pas). Sa fiche affiche la condition et coche ✔ chaque étape
accomplie en direct. **Plus la condition est dure, plus le dieu est puissant.**

| Dieu | Difficulté | Condition | Puissance |
| ---- | :--------: | --------- | :-------: |
| **Umi Dieu des océans** | ★☆☆☆☆ | Roi des mers **ou** Terreur des mers Iguis est tombé au combat | 5/8 · pioche 3 |
| **Dieu de la mort Bhaal** | ★★☆☆☆ | Noxis Drathis **ou** Valerius Dracul en jeu, **et** Retour à la vie déjà lancé | 9/8 · détruit la plus puissante + 3 au héros |
| **Aldia déesse de lumière** | ★★★☆☆ | Dyklanne + Marinéhote + Johanna réunies, **ou** Trios des Héros après Confiance d'Aldia | 6/9 · +6 vie et +1/+1 aux alliés |
| **Ulgod Dieu de l'enfer** | ★★★★☆ | Amrin **et** Ragast réunis sur ton champ de bataille | 9/8 · 5 blessures au héros |
| **Rena Déesse de la nature** | ★★★★★ | Deux Sceptres de Rena lancés **et** Uldrid le sage arbre en jeu | 8/10 · +2/+2 aux alliés et +5 vie |
| **Noxis Bhaal, Fusion complète** | ★★★★★ | Noxis Drathis **et** Dieu de la mort Bhaal en jeu ; les deux sont sacrifiés | 15/15 · détruit toutes les créatures adverses, 5 au héros, célérité |
| **Héritage des héros** | ★★★★☆ | Johanna et Dyklanne survivent ensemble pendant 3 tours ; les deux sont sacrifiés | 10/10 · +6 vie et +2/+2 aux autres alliés |
| **Apocalypse d'UMI** | ★★★★★ | Le Roi des mers survit pendant 5 tours, puis il est sacrifié pour évoluer | 13/14 · engage toute l'armée adverse et inflige 5 au héros |

Les conditions sont décrites dans `data/cards.json` (champ `divine`) et évaluées
génériquement : `board` (toutes ces cartes en jeu), `boardAny` (au moins une),
`cast` (sorts déjà lancés, doublons = N copies), `died` (créature tombée) et
`survived` (créature restée en jeu pendant N tours de son propriétaire).
Ajouter une nouvelle invocation ne demande donc aucun code, seulement des données.
L'IA est soumise aux mêmes conditions.

## Format construit Spellaho

- Deck construit : **60 cartes exactes**.
- Répartition actuelle : **24 terrains**, **22 créatures** et **14 sorts**.
- Maximum **4 exemplaires** d'une carte non-terrain ; terrains de base illimités.
- Decks bicolores disponibles : Blanc/Vert, Rouge/Noir, Bleu/Vert, Noir/Blanc, Rouge/Bleu.

## Couleurs / nature des cartes

Correspondances respectées dans les données, les palettes et la construction des decks :

- Fée → **Vert** · Golem de pierre → **Vert** · Uldrid, Protecteurs de la nature → **Vert**
- Magicien exilé, Valerius Dracul (vampire, pacte avec la mort), Nilith et Fusion complète → **Noir**
- Roi des mers, Kraken, Umi → **Bleu**
- Dyklanne de Mirthodil, Johanna Bordeciel, Aldia → **Blanc**
- Premier Roi de l'enfer Amrin, Ulgod, Ragast → **Rouge**

## Analyse d'équilibre par couleur

Hypothèse retenue : pour une base **mono-couleur** jouable (max 4 copies), il faut au
moins **6 créatures uniques** et **4 sorts uniques** par couleur. Les terrains sont
comptés séparément. Cette analyse est aussi affichée en direct dans le panneau
« Équilibre cartes » du jeu.

| Couleur | Créatures uniques | Sorts uniques | Terrains uniques | Manque pour la base mono-couleur |
| ------- | :---------------: | :-----------: | :--------------: | -------------------------------- |
| Blanc   | 17                | 4             | 5                | Base atteinte                    |
| Bleu    | 11                | 7             | 5                | Base atteinte                    |
| Noir    | 12                | 5             | 6                | Base atteinte                    |
| Rouge   | 9                 | 5             | 5                | Base atteinte                    |
| Vert    | 17                | 4             | 8                | Base atteinte                    |

Sorts incolores polyvalents (jouables dans tous les decks) : **2** (Pierre de Norne et Générateur antique).

Les cinq bases mono-couleur atteignent désormais les quotas : **aucune carte ne
manque** pour cette base de construction. Les 31 sorts disposent tous de leur propre
illustration.

Les decks bicolores restent tous à 60 cartes et respectent la limite de quatre copies :

| Deck | Terrains | Créatures | Sorts dédiés |
| ---- | :------: | :-------: | :-----------: |
| Blanc / Vert | 24 | 22 | 14 |
| Rouge / Noir | 24 | 22 | 14 |
| Bleu / Vert | 24 | 22 | 14 |
| Noir / Blanc | 24 | 22 | 14 |
| Rouge / Bleu | 24 | 22 | 14 |

## Lancer le jeu

Depuis ce dossier :

```powershell
node .\serve.js
```

Puis ouvre l'adresse affichée (par défaut `http://localhost:4173`). Pour tester le mode
en ligne, ouvre deux onglets ou navigateurs, choisis « 2 joueurs en ligne » des deux
côtés et saisis le code `1234`. Chaque onglet possède sa propre identité de joueur.

## Régénérer les cartes SVG

```powershell
node .\tools\generate-cards.js
```

Les SVG utilisent les illustrations du dossier `Images` par référence afin d'éviter
de dupliquer plusieurs centaines de mégaoctets dans le dépôt et sur l'hébergement.

## Vérification automatisée

```powershell
node .\tools\smoke-test.js
```

Démarre le serveur sur un port de test et vérifie les fichiers statiques, les couleurs
des cartes, la répartition des sorts et le cycle complet du salon `1234` (connexion des
deux joueurs, synchronisation de l'état, rejets des codes invalides et du 3e joueur).
