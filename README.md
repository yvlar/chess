# Grandmaster Chess — Battle Edition 2D

Jeu sans backend en HTML5, CSS3 et modules JavaScript, avec rendu Canvas 2D. Distribution prête à héberger dans `dist/`.

## Lancer

Servir `dist/` par HTTP (les modules et le Worker ne fonctionnent pas via file://). Par exemple `python -m http.server 8080 --directory dist`.

## Construire et vérifier

- `npm ci` (Node 20+)
- `npm run build` : copie chess.js et Stockfish depuis les versions verrouillées.
- `npm test` : tests des règles, transactions, animations, horloges, sauvegarde, réponses tardives et moteur WASM réel dans un contexte Worker simulé.
- `python scripts/create-sprites.py` avec Pillow : régénère les douze spritesheets PNG originales.

## Fonctionnalités

Sélection au clic/toucher ou au clavier (flèches et Entrée), coups légaux, roque animé à deux acteurs, prise en passant, quatre promotions, échec et mat, analyse FEN/Stockfish, export PGN, sauvegarde/reprise locale, parties à deux sur le même appareil, Stockfish 18 Lite en Worker avec 10 niveaux, réglages des animations/particules/volume, passage des animations et démo de capture.

Les deux camps disposent de 10 minutes. Les horloges démarrent après le premier coup, sont suspendues pendant les animations et continuent pendant la réflexion de Stockfish. Une nouvelle partie, une annulation ou un chargement invalide la génération précédente et termine le Worker. La position légale est validée et mise à jour une seule fois avant l'animation ; le rendu conserve un instantané antérieur et revient à l'état courant à la fin ou au passage.

Le combat est chorégraphié : l'événement `impact` de la frame 4 de l'attaque déclenche la réaction, le son et les particules. Il n'existe aucun calcul de dégâts ni hasard modifiant une capture.

## Ressources et finition

Les 12 spritesheets transparentes (672 frames non vides), leurs métadonnées communes et leur générateur sont présents. Les personnages sont des dessins vectoriels originaux rasterisés, avec palette ivoire/vert ou ardoise/pourpre. Aucune ressource de personnage tierce n'est utilisée. Les animations sont de première production, avec une chorégraphie commune et des armes différenciées. Ce ne sont pas des illustrations fantasy HD finalisées. La vue est en trois quarts sur un échiquier vu de dessus, sans moteur 3D.

À produire pour une finition commerciale : personnages illustrés haute définition, locomotions plus complexes, animations spéciales propres à chaque personnage, multiples chorégraphies par couple attaquant/défenseur, véritable transformation de promotion et finale plus élaborée, bruitages enregistrés et musique. La promotion comporte actuellement un changement de personnage et des particules ; le roque déplace les deux acteurs ; l'échec utilise une pulsation visuelle et un son ; le mat anime la défaite du roi sans le capturer. La scène de combat reste sur l'échiquier, sans caméra de cinématique distincte.

## Vérification

17 tests passent : 16 tests de logique et de rendu instrumenté, plus un test du véritable WASM. Ils couvrent aussi un changement de partie pendant l'animation, une réponse tardive, les quatre promotions, la prise en passant et un redimensionnement pendant le combat. Le rendu instrumenté vérifie les appels Canvas et la suppression des acteurs, sans validation esthétique.

La QA visuelle dans un navigateur, les appareils mobiles physiques et les performances sur matériel faible ne sont pas vérifiés dans cet environnement : l'outil `cua_repl.js` requis pour la prévisualisation Sites n'est pas disponible. La mise en page dispose de points de rupture responsive et prend en charge Pointer Events ; cela ne remplace pas ces essais.

## Licences

Projet publié sous GPL-3.0, voir LICENSE. chess.js 1.4.0 : BSD-2-Clause, texte dans dist/vendor/chess-LICENSE.txt. Stockfish.js 18.0.5 / Stockfish 18 Lite : GPLv3, copyright Chess.com LLC et contributeurs Stockfish. Binaire single-thread non modifié, renommé stockfish.js/stockfish.wasm. Source et instructions de compilation : https://github.com/nmrugg/stockfish.js/tree/v18.0.0 ; distribution npm verrouillée : https://www.npmjs.com/package/stockfish/v/18.0.5. Une archive du source upstream accompagne la distribution. Les polices Google Cormorant Garamond et DM Sans sont facultatives, avec repli Georgia/Arial ; leur absence ne bloque pas le jeu.
