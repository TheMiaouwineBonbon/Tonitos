# Tonitos

Prototype de jeu de cartes fantasy (HTML/CSS/JS vanilla) inspiré des duels tactiques
type Magic / Hearthstone. Aucun framework, aucune dépendance : juste Node pour le
petit serveur statique et l'API du salon multijoueur.

**Jouer en ligne :** https://themiaouwinebonbon.github.io/Tonitos/

## Contenu

- `index.html` : menu de lancement + plateau jouable.
- `styles.css` : direction artistique, tapis de jeu, zones, effets et cartes.
- `game.js` : moteur de partie (IA solo, 2 joueurs local, 2 joueurs en ligne).
- `serve.js` : serveur HTTP statique + API du salon en mémoire (code `1234`).
- `data/cards.json` : créatures et champions.
- `data/lands.json` : terrains par couleur.
- `data/spells.json` : sorts, artefacts et améliorations.
- `tools/generate-cards.js` : génération des cartes SVG imprimables.
- `tools/smoke-test.js` : vérification automatisée (serveur + API salon + données).
- `Images/Cartes` : cartes SVG générées à partir des illustrations d'origine.

## Modes de jeu

Depuis le menu de lancement (nom du jeu : **Tonitos**) :

- **1 joueur contre IA** : tu joues le côté joueur, l'IA joue l'adversaire.
- **2 joueurs local** : les deux camps se jouent sur le même écran (la main affichée
  suit le joueur actif / le défenseur pendant les blocages).
- **2 joueurs en ligne** : les deux joueurs saisissent le **code 1234**. Le serveur
  local garde le salon en mémoire et l'état se synchronise par polling (~1 s). Sur
  un hébergement statique comme GitHub Pages, Tonitos bascule automatiquement sur
  une connexion directe WebRTC entre les deux joueurs. Chacun ne contrôle que son
  côté ; les actions du camp adverse sont verrouillées. Le statut d'attente, de
  connexion et de synchronisation est affiché en clair.

Chaque joueur choisit son **nom**, son **portrait/avatar** (affiché dans la zone
Commandant du tapis, sans activer les règles Commander) et son **deck** bicolore.

Les cinq zones interactives suivent les cadres imprimés des tapis : Bibliothèque,
Cimetière, Champ de bataille, Exil et Commandant. Le survol affiche une copie complète
de la carte dans un calque indépendant, sans découpe par la main ou le panneau latéral ;
sur mobile, le clic ouvre la fiche complète dans une fenêtre adaptée à l'écran.

## Format construit Tonitos

- Deck construit : **60 cartes exactes**.
- Répartition : **24 terrains, 22 créatures, 14 sorts**.
- Maximum **4 exemplaires** d'une carte non-terrain ; terrains de base illimités.
- Decks bicolores disponibles : Blanc/Vert, Rouge/Noir, Bleu/Vert, Noir/Blanc, Rouge/Bleu.

## Couleurs / nature des cartes

Correspondances respectées dans les données, les palettes et la construction des decks :

- Fée → **Vert** · Golem de pierre → **Vert** · Uldrid, Protecteurs de la nature → **Vert**
- Magicien exilé, Valerius Dracul (vampire, pacte avec la mort), Nilith → **Noir**
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
| Blanc   | 8                 | 5             | 4                | — équilibré                      |
| Bleu    | 5                 | 4             | 4                | **1 créature unique**            |
| Noir    | 7                 | 4             | 6                | — équilibré                      |
| Rouge   | 6                 | 4             | 4                | — équilibré                      |
| Vert    | 4                 | 5             | 5                | **2 créatures uniques**          |

Sorts incolores polyvalents (jouables dans tous les decks) : **1** (Pierre de Norne).

Total à ajouter pour atteindre la base mono-couleur partout : **3 créatures uniques**
(1 en Bleu, 2 en Vert). Toutes les couleurs disposent d'au moins 4 sorts. Les decks
bicolores actuels restent tous parfaitement constructibles à 60 cartes.

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
