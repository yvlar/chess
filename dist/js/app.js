import {GameSession, StockfishEngine} from './game.js';
import {SpriteSheetLoader, BoardRenderer, SoundManager} from './animation.js';
import {PIECES, PIECE_ORDER} from './pieces.js';
import {getDuel,createDuelPosition} from './combat.js';
const $=id=>document.getElementById(id), game=new GameSession(), sound=new SoundManager();
const settings={mode:'full',speed:1,particles:.75,labels:true,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};
let mode='ai',side='w',level=4,thinking=false,analysisPending=false,renderer,engineState='loading',toastTimer,request=0,promotionPending=false;
const names=Object.fromEntries(PIECE_ORDER.map(type=>[type,PIECES[type].name]));
let inspectedKey;
function inspect(square){
 const piece=square&&game.chess.get(square),box=$('piece-readout');
 const key=piece?`${square}:${piece.color}${piece.type}`:'empty';
 if(key===inspectedKey)return;inspectedKey=key;
 box.replaceChildren();
 const title=document.createElement('strong'),detail=document.createElement('span');
 if(piece){const info=PIECES[piece.type];title.textContent=`${info.glyph} ${info.name} · ${square} · ${piece.color==='w'?'Blancs':'Noirs'}`;detail.textContent=`${info.role} — ${info.move}`;}
 else {title.textContent='Reconnaître votre armée';detail.textContent='Survolez ou sélectionnez une pièce pour voir son nom et ses déplacements.';}
 box.append(title,detail);
}
function portrait(type,color){
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=160;canvas.setAttribute('aria-hidden','true');
 const img=renderer?.loader.cache.get(color+type);if(img)canvas.getContext('2d').drawImage(img,0,0,128,160,0,0,128,160);return canvas;
}
function buildLegend(){
 for(const type of PIECE_ORDER){const item=document.createElement('div');item.className='piece-key';item.title=`${PIECES[type].name} · ${PIECES[type].role}`;
  const name=document.createElement('span');name.textContent=names[type];item.append(portrait(type,'w'),name);$('piece-legend').append(item);}
 inspect(null);
}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
const engine=new StockfishEngine(s=>{engineState=s;updateStatus();});
function cancelEngine(){request++;engine.cancel();thinking=false;analysisPending=false;}
function title(){return game.result|| (game.chess.isCheckmate()?`Échec et mat · ${game.chess.turn()==='w'?'les noirs':'les blancs'} gagnent`:game.chess.isDraw()?'Partie nulle':game.chess.isCheck()?'Échec au roi':game.busy?'Les armées sont en mouvement':thinking?'Stockfish réfléchit…':mode==='ai'?(game.chess.turn()===side?'À vous de jouer':'Au tour de l’ordinateur'):`Aux ${game.chess.turn()==='w'?'blancs':'noirs'} de jouer`);}
function updateStatus(){if(!renderer)return;$('status').textContent=title();$('combat-badge').hidden=!game.busy;const duel=renderer.animator?.duel;$('combat-title').textContent=duel?duel.name:'Déplacement en cours';$('combat-detail').textContent=duel?`${names[duel.attacker]} × ${names[duel.defender]}`:'';$('engine-label').textContent=mode==='local'?'Joueur local · Noirs':`Stockfish 18 · Niveau ${level}${engineState==='error'?' · indisponible':''}`;}
function sync(){if(!renderer)return;const moves=game.chess.history();if(moves.length){$('history').innerHTML='';for(let i=0;i<moves.length;i+=2){const row=document.createElement('div');row.className='history-row';for(const txt of [`${i/2+1}.`,moves[i],moves[i+1]||'—']){const span=document.createElement('span');span.textContent=txt;row.append(span);}$('history').append(row);}$('history').scrollTop=$('history').scrollHeight;}else $('history').innerHTML='<div class="empty-history"><span>⚔</span><p>La bataille vous attend.</p><small>Chaque grand récit commence<br>par un premier mouvement.</small></div>';
 $('fen').value=game.chess.fen();const white=game.chess.turn()==='w';$('turn-label').textContent=white?'LE ROYAUME D’IVOIRE':'LA LÉGION D’OMBRE';$('turn-description').textContent=game.chess.isGameOver()||game.result?'La bataille est terminée':`Les ${white?'blancs':'noirs'} ont le trait`;$('turn-description').parentElement.previousElementSibling.textContent=white?'♔':'♚';const captures=game.chess.history({verbose:true}).filter(m=>m.captured);$('captured').textContent=captures.length?`${captures.length} capture${captures.length>1?'s':''} sur le champ de bataille`:'Votre armée est au complet';$('undo').disabled=!moves.length;$('opponent-name').textContent='Légion d’ombre';$('player-name').innerHTML=`Royaume d’ivoire ${mode==='ai'&&side==='w'?'<span>VOUS</span>':''}`;if(mode==='ai'&&side==='b')$('opponent-name').textContent='Légion d’ombre · Vous';updateStatus();clocks();inspect(game.selected);}
function clocks(){for(const c of ['w','b']){const secs=Math.ceil(game.clocks[c]/1000);$('clock-'+c).textContent=`${Math.floor(secs/60).toString().padStart(2,'0')}:${(secs%60).toString().padStart(2,'0')}`;$('clock-'+c).classList.toggle('active-clock',game.chess.turn()===c&&!game.chess.isGameOver()&&!game.result);}}
async function maybeAI(){if(mode!=='ai'||thinking||analysisPending||game.busy||promotionPending||game.chess.turn()===side||game.chess.isGameOver()||game.result)return;thinking=true;const generation=game.generation,fen=game.chess.fen(),token=++request;updateStatus();try{const result=await engine.search(fen,level);if(token!==request||generation!==game.generation||game.chess.fen()!==fen||game.busy)return;thinking=false;const m=result.move;if(m&&m!=='(none)'){commit({from:m.slice(0,2),to:m.slice(2,4),promotion:m[4]||'q'});}}catch(e){if(token===request){thinking=false;toast(e.message);}}updateStatus();}
function commit(move){const tx=game.play(move);if(!tx){toast('Ce coup n’est pas légal dans cette position.');return;}sound.play('move');renderer.start(tx);sync();}
rendererReady();
async function rendererReady(){try{const loader=await new SpriteSheetLoader().load();renderer=new BoardRenderer($('board'),game,loader,settings,sound);renderer.flipped=side==='b';renderer.onFinish=()=>{sync();if(game.chess.isCheck())sound.play('check');maybeAI();};$('board-loading').hidden=true;buildLegend();sync();let previous=performance.now();function frame(now){const dt=Math.min(now-previous,80);const realDt=now-previous;previous=now;game.tick(realDt);renderer.update(dt);renderer.draw();clocks();if(game.result){if(thinking)cancelEngine();updateStatus();}requestAnimationFrame(frame);}requestAnimationFrame(frame);}
 catch(e){$('board-loading').textContent='Chargement impossible. Rechargez la page.';console.error(e);}}
function select(square){if(!renderer||game.busy||thinking||analysisPending||promotionPending||game.result||game.chess.isGameOver())return;if(mode==='ai'&&game.chess.turn()!==side){maybeAI();return;}const p=game.chess.get(square);if(game.selected){const candidates=game.chess.moves({square:game.selected,verbose:true}).filter(m=>m.to===square);if(candidates.length){const from=game.selected;if(candidates.some(m=>m.promotion)){promotionPending=true;const generation=game.generation;$('promotion-options').innerHTML='';for(const type of ['q','r','b','n']){const btn=document.createElement('button');btn.textContent={q:'♕',r:'♖',b:'♗',n:'♘'}[type];btn.title=names[type];btn.setAttribute('aria-label',names[type]);btn.onclick=()=>{$('promotion').close();promotionPending=false;if(generation===game.generation)commit({from,to:square,promotion:type});};btn.replaceChildren(portrait(type,game.chess.turn()),document.createTextNode(names[type]));$('promotion-options').append(btn);}$('promotion').showModal();}else commit({from,to:square});return;}}
 game.selected=p&&p.color===game.chess.turn()?square:null;}
$('board').addEventListener('pointerup',e=>{if(!renderer)return;const r=$('board').getBoundingClientRect(),square=renderer.at((e.clientX-r.left)*900/r.width,(e.clientY-r.top)*900/r.height);if(square){select(square);inspect(game.selected||square);}});
$('board').addEventListener('keydown',e=>{if(!renderer)return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key))e.preventDefault();const s=renderer.keyboard||'e2';let c=s.charCodeAt(0)-97,r=Number(s[1])-1;const flip=renderer.flipped?-1:1;if(e.key==='ArrowLeft')c-=flip;if(e.key==='ArrowRight')c+=flip;if(e.key==='ArrowUp')r+=flip;if(e.key==='ArrowDown')r-=flip;renderer.keyboard=String.fromCharCode(97+Math.min(7,Math.max(0,c)))+(Math.min(7,Math.max(0,r))+1);if(e.key==='Enter'||e.key===' ')select(renderer.keyboard);if(e.key==='Escape')game.selected=null;inspect(game.selected||renderer.keyboard);});
function reset(fen){cancelEngine();promotionPending=false;$('promotion').close();game.reset(fen);renderer?.reset();sync();maybeAI();}
$('new-game').onclick=()=>{if(!renderer)return;reset();toast('Nouvelle bataille · Les blancs ouvrent le jeu.');};
$('mode-ai').onclick=()=>{mode='ai';$('mode-ai').classList.add('active');$('mode-local').classList.remove('active');reset();};
$('mode-local').onclick=()=>{mode='local';$('mode-ai').classList.remove('active');$('mode-local').classList.add('active');reset();};
$('difficulty').oninput=e=>{level=Number(e.target.value);$('level-label').textContent=`Niveau ${level}`;sync();};
$('difficulty').onchange=()=>{if(thinking){cancelEngine();maybeAI();}};
$('side').onchange=e=>{side=e.target.value;if(renderer)renderer.flipped=side==='b';reset();};
$('skip').onclick=()=>renderer?.skip();$('flip').onclick=()=>{if(renderer)renderer.flipped=!renderer.flipped;};
$('sound').onclick=()=>{sound.enabled=!sound.enabled;if(sound.enabled)sound.unlock();$('sound').style.color=sound.enabled?'#e5ca86':'#a8b39c';$('sound').title=sound.enabled?'Couper le son':'Activer le son';sound.play();toast(sound.enabled?'Effets sonores activés':'Effets sonores coupés');};
$('undo').onclick=()=>{if(!renderer)return;cancelEngine();promotionPending=false;$('promotion').close();game.undo();if(mode==='ai'&&game.chess.turn()!==side&&game.chess.history().length)game.undo();renderer.reset();sync();maybeAI();};
$('save').onclick=()=>{try{localStorage.setItem('grandmaster-save',JSON.stringify({game:game.serialize(),mode,side,level}));toast('Partie sauvegardée sur cet appareil.');}catch{toast('Le navigateur ne permet pas la sauvegarde locale.');}};
$('restore').onclick=()=>{try{const raw=localStorage.getItem('grandmaster-save');if(!raw){toast('Aucune partie sauvegardée sur cet appareil.');return;}const data=JSON.parse(raw);const verified=new GameSession();verified.restore(data.game);cancelEngine();game.restore(data.game);mode=data.mode==='local'?'local':'ai';side=data.side==='b'?'b':'w';level=Math.max(1,Math.min(10,Number(data.level)||4));$('side').value=side;$('difficulty').value=level;$('level-label').textContent=`Niveau ${level}`;$('mode-ai').classList.toggle('active',mode==='ai');$('mode-local').classList.toggle('active',mode==='local');renderer.reset();renderer.flipped=side==='b';sync();maybeAI();toast('Votre bataille a repris.');}catch{toast('Impossible de lire cette sauvegarde.');}};
$('export').onclick=()=>{const blob=new Blob([game.chess.pgn()],{type:'application/x-chess-pgn'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='grandmaster-battle.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Partie exportée au format PGN.');};
for(const name of ['moves','analysis'])$(name+'-tab').onclick=()=>{for(const n of ['moves','analysis']){$(n+'-view').hidden=n!==name;$(n+'-tab').classList.toggle('selected',n===name);$(n+'-tab').setAttribute('aria-selected',String(n===name));}if(name==='analysis')$('fen').value=game.chess.fen();};
$('analyze').onclick=async()=>{if(game.busy||thinking||analysisPending){toast('Attendez la fin du coup en cours.');return;}analysisPending=true;const token=++request,fen=game.chess.fen();$('analysis-result').textContent='Stockfish analyse la position…';try{const r=await engine.search(fen,10,true);if(token!==request)return;analysisPending=false;const match=r.info.match(/score (cp|mate) (-?\d+)/),score=match?match[1]==='mate'?`Mat en ${Math.abs(Number(match[2]))}`:`${(Number(match[2])/100*(game.chess.turn()==='w'?1:-1)).toFixed(2)} pions · point de vue blanc`:'Évaluation indisponible';$('analysis-result').textContent=`${score}. Coup conseillé : ${r.move}.`;maybeAI();}catch(e){if(token===request){analysisPending=false;$('analysis-result').textContent=e.message;}}};
$('load-fen').onclick=()=>{try{const fen=$('fen').value.trim();const test=new GameSession();test.reset(fen);reset(fen);toast('Position chargée.');}catch{toast('Position FEN invalide.');}};
$('settings-open').onclick=()=>$('settings').showModal();$('animation-mode').onchange=e=>{settings.mode=e.target.value;if(settings.mode==='off')renderer?.skip();};$('combat-speed').oninput=e=>settings.speed=Number(e.target.value);$('volume').oninput=e=>sound.volume=Number(e.target.value);$('particles').oninput=e=>settings.particles=Number(e.target.value);$('piece-labels').onchange=e=>settings.labels=e.target.checked;$('reduced').checked=settings.reduced;$('reduced').onchange=e=>settings.reduced=e.target.checked;
$('promotion').addEventListener('cancel',e=>{e.preventDefault();toast('Choisissez une promotion pour terminer le coup.');});
// All thirty legal attacker/defender classes can be tried without altering chess rules.
for(const type of PIECE_ORDER){
 const attack=document.createElement('option');attack.value=type;attack.textContent=names[type];$('demo-attacker').append(attack);
 if(type!=='k'){const defence=attack.cloneNode(true);$('demo-defender').append(defence);}
}
function demoDescription(){const duel=getDuel($('demo-attacker').value,$('demo-defender').value);$('demo-description').textContent=`${duel.name} · ${duel.defence.name}`;}
$('demo-attacker').onchange=demoDescription;$('demo-defender').onchange=demoDescription;
$('demo').onclick=()=>{demoDescription();$('duel-demo').showModal();};
$('demo-close').onclick=()=>$('duel-demo').close();
$('demo-play').onclick=()=>{
 if(!renderer)return;
 const attacker=$('demo-attacker').value,defender=$('demo-defender').value;
 const {fen,from,to}=createDuelPosition(attacker,defender);
 $('duel-demo').close();cancelEngine();mode='local';$('mode-ai').classList.remove('active');$('mode-local').classList.add('active');
 reset(fen);commit({from,to});
};
$('info-close').onclick=()=>$('info').close();document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>{const view=btn.dataset.view;if(view==='play')return;$('info-title').textContent=view==='collection'?'Deux royaumes, douze destins.':'L’art de commander.';if(view==='guide'){$('info-content').innerHTML='<h3>Votre premier mouvement</h3><p>Sélectionnez un personnage, puis une case marquée pour jouer un coup légal. Vous pouvez aussi utiliser les flèches et Entrée sur l’échiquier. Les blancs commencent.</p><h3>Un duel d’esprits</h3><p>Le roi doit échapper à toute attaque. Quand aucun coup ne peut le sauver, c’est échec et mat. Les combats illustrent les captures : leur résultat est toujours celui des règles officielles.</p><h3>Votre rythme, votre bataille</h3><p>Jouez contre Stockfish sur 10 niveaux ou à deux sur le même appareil. Les horloges de 10 minutes démarrent après le premier coup et sont suspendues pendant les animations. Passez un combat avec le bouton de l’échiquier.</p><h3>Gardez votre histoire</h3><p>Sauvegardez sur cet appareil, exportez le PGN ou chargez une position FEN dans Analyse. Les paramètres permettent d’accélérer les animations, de régler les particules et le son.</p>';}else{$('info-content').innerHTML='<p>Six silhouettes, six façons de combattre. Chaque personnage conserve le nom et le symbole de sa pièce d’échecs.</p><div class="character-grid"></div>';const grid=$('info-content').querySelector('.character-grid');for(const color of ['w','b'])for(const type of PIECE_ORDER){
 const card=document.createElement('div'),strong=document.createElement('strong'),role=document.createElement('small');
 strong.textContent=`${PIECES[type].glyph} ${names[type]}`;role.textContent=`${PIECES[type].role} · ${color==='w'?'Blancs':'Noirs'}`;
 card.append(portrait(type,color),strong,role);grid.append(card);
 }}$('info').showModal();});
// Read-only inspection hook for integration diagnostics, no alternate game state.
window.grandmaster={game,get renderer(){return renderer;},get thinking(){return thinking;}};

$('board').addEventListener('pointermove',e=>{if(!renderer||e.pointerType==='touch')return;const r=$('board').getBoundingClientRect();inspect(renderer.at((e.clientX-r.left)*900/r.width,(e.clientY-r.top)*900/r.height));});
$('board').addEventListener('pointerleave',()=>inspect(game.selected));
