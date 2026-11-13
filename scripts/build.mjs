import {copyFileSync} from 'node:fs';
for (const [src,dest] of [['chess.js/dist/esm/chess.js','chess.js'],['chess.js/LICENSE','chess-LICENSE.txt'],['stockfish/bin/stockfish-18-lite-single.js','stockfish.js'],['stockfish/bin/stockfish-18-lite-single.wasm','stockfish.wasm']])copyFileSync('node_modules/'+src,'dist/vendor/'+dest);
console.log('Static distribution ready: dist/');
