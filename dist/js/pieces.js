// Shared by the board, legend, promotion picker and faction gallery.
export const PIECES = Object.freeze({
 p: {name:'Pion', role:'Lancier', glyph:'♟', accent:'#7ad5ad', size:80, move:'Un pas en avant, prise en diagonale.'},
 n: {name:'Cavalier', role:'Chevalier monté', glyph:'♞', accent:'#76c9f1', size:94, move:'Saute en L, par-dessus les autres pièces.'},
 b: {name:'Fou', role:'Mage', glyph:'♝', accent:'#9ca0ff', size:88, move:'Se déplace et capture en diagonale.'},
 r: {name:'Tour', role:'Golem des remparts', glyph:'♜', accent:'#f2b368', size:94, move:'Se déplace et capture en ligne droite.'},
 q: {name:'Dame', role:'Enchanteresse', glyph:'♛', accent:'#f49ac5', size:92, move:'Combine les déplacements de la tour et du fou.'},
 k: {name:'Roi', role:'Gardien de la couronne', glyph:'♚', accent:'#ffe39b', size:96, move:'Une case dans toute direction, sans se mettre en échec.'},
});
export const PIECE_ORDER = Object.freeze(['p','n','b','r','q','k']);
