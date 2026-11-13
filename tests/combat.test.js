import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GameSession} from '../dist/js/game.js';
import {CombatAnimator,BoardRenderer,SoundManager,SpriteRenderer} from '../dist/js/animation.js';
import {createDuelPosition,getDuel,combatPose} from '../dist/js/combat.js';
import {PIECE_ORDER} from '../dist/js/pieces.js';
const meta=JSON.parse(readFileSync(new URL('../dist/assets/sprites/atlas.json',import.meta.url)));
const pairs=PIECE_ORDER.flatMap(a=>PIECE_ORDER.filter(d=>d!=='k').map(d=>[a,d]));
function sessionFor(a,d){const position=createDuelPosition(a,d),game=new GameSession();game.reset(position.fen);const tx=game.play({from:position.from,to:position.to});assert.ok(tx,`${a}:${d} is a legal capture`);return {game,tx};}
function rendererFor(game,reduced=false){return new BoardRenderer({width:900,getContext(){return {};},getBoundingClientRect(){return {width:900};}},game,{meta,cache:new Map()},{mode:'full',speed:1,particles:1,reduced,labels:true},{play(){}});}

test('all 30 legal matchups have distinct motion, names and two-voice sound signatures',()=>{
 const names=new Set(),motions=new Set(),sounds=new Set();
 for(const [a,d] of pairs){
  const {tx}=sessionFor(a,d),duel=getDuel(a,d);assert.equal(tx.move.piece,a);assert.equal(tx.move.captured,d);
  names.add(duel.name);motions.add(JSON.stringify([duel.style,duel.defence.style,duel.feint,duel.angle,duel.force]));sounds.add(JSON.stringify(duel.sound));
  for(const progress of [0,.25,.5,.75,1])for(const n of Object.values(combatPose(duel,progress,true,100)))assert.ok(Number.isFinite(n));
 }
 assert.equal(names.size,30);assert.equal(motions.size,30);assert.equal(sounds.size,30);
 assert.throws(()=>createDuelPosition('q','k'),/roi/);
});

test('each matchup contacts on its sprite impact frame exactly once, independent of frame rate',()=>{
 for(const [attacker,defender] of pairs){
  const {game,tx}=sessionFor(attacker,defender),fen=game.chess.fen();let hits=0,cues=0;
  const a=new CombatAnimator({meta},tx,()=>hits++,()=>cues++);
  a.update(a.movingTime);assert.equal(a.phase,'ANTICIPATING');a.update(a.duel.windup);assert.equal(a.phase,'ATTACKING');
  a.update(a.duel.frameDuration*4-1);assert.equal(hits,0);a.update(1);assert.equal(hits,1);assert.equal(a.targetTime,0);
  a.update(10000);assert.equal(hits,1);assert.equal(cues,1);assert.ok(a.done);assert.equal(game.chess.fen(),fen);
  let largeHits=0;const large=new CombatAnimator({meta},tx,()=>largeHits++);large.update(10000);assert.ok(large.done);assert.equal(largeHits,1);
  assert.equal(large.targetTime,a.targetTime);
 }
});

test('en passant battle targets the actual pawn square, then the attacker lands on the legal destination',()=>{
 global.window={devicePixelRatio:1};global.ResizeObserver=class{observe(){}};
 try{
  for(const flipped of [false,true]){
   const game=new GameSession();for(const move of ['e4','a6','e5','d5']){game.play(move);game.finish();}
   const renderer=rendererFor(game);renderer.flipped=flipped;const tx=game.play('exd6');renderer.start(tx);
   const a=renderer.animator;renderer.update(a.movingTime+a.duel.windup);const victim=renderer.actors().find(p=>p.defender);
   assert.deepEqual({x:victim.x,y:victim.y},renderer.squarePoint('d5'));
   a.update(a.duel.frameDuration*8+a.duel.recovery-1);const actor=renderer.actors().find(p=>p.attacker);
   assert.equal(actor.x,renderer.squarePoint('d6').x);assert.equal(actor.y,renderer.squarePoint('d6').y);
   renderer.update(1);assert.equal(game.busy,false);assert.equal(game.chess.get('d5'),undefined);assert.equal(game.chess.get('d6').type,'p');
  }
 }finally{delete global.window;delete global.ResizeObserver;}
});

test('reduced effects suppress spatial choreography, particles and shake; skipping settles any matchup',()=>{
 global.window={devicePixelRatio:1};global.ResizeObserver=class{observe(){}};
 try{
  for(const [attacker,defender] of pairs){
   const {game,tx}=sessionFor(attacker,defender),fen=game.chess.fen(),renderer=rendererFor(game,true);renderer.start(tx);
   const a=renderer.animator;renderer.update(a.movingTime+a.duel.windup+a.duel.frameDuration*4+20);
   assert.equal(renderer.particles.items.length,0);assert.equal(renderer.shake,0);
   assert.ok(Object.values(combatPose(a.duel,.5,true,100,true)).every(n=>n===0));
   renderer.skip();assert.equal(game.busy,false);assert.equal(game.chess.fen(),fen);
  }
 }finally{delete global.window;delete global.ResizeObserver;}
});

test('castling keeps two moving actors and all promotions switch to the selected sprite',()=>{
 global.window={devicePixelRatio:1};global.ResizeObserver=class{observe(){}};
 try{
  for(const san of ['O-O','O-O-O']){
   const game=new GameSession();game.reset('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const renderer=rendererFor(game);
   renderer.start(game.play(san));renderer.update(200);const actors=renderer.actors();assert.equal(actors.length,6);
   assert.equal(actors.filter(p=>p.color==='w'&&p.state==='walk').length,2);
   renderer.update(10000);assert.equal(game.busy,false);
  }
  for(const promotion of ['q','r','b','n']){
   const game=new GameSession();game.reset('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');const renderer=rendererFor(game);
   renderer.start(game.play({from:'a7',to:'a8',promotion}));renderer.update(renderer.animator.movingTime);
   assert.equal(renderer.actors().find(p=>p.attacker).type,promotion);assert.equal(renderer.actors().find(p=>p.attacker).state,'special');
   renderer.update(10000);assert.equal(game.chess.get('a8').type,promotion);
  }
 }finally{delete global.window;delete global.ResizeObserver;}
});

test('sprite anchors and horizontal mirroring use the metadata for any state length',()=>{
 const draws=[],transforms=[],ctx=new Proxy({drawImage(...args){draws.push(args);},translate(...v){transforms.push(['translate',...v]);},scale(...v){transforms.push(['scale',...v]);}},{get:(o,k)=>o[k]||(()=>{})});
 const short={...meta,animations:{idle:{...meta.animations.idle,frames:3,loop:false}}};
 new SpriteRenderer({meta:short,cache:new Map([['wp',{}]])}).draw(ctx,{color:'w',type:'p'},100,200,80,'idle',10000,1,{facing:-1});
 assert.equal(draws[0][1],2*meta.frameWidth);assert.equal(draws[0][6],-90);assert.deepEqual(transforms,[['translate',100,200],['scale',-1,1]]);
});

test('sound mute avoids creating an audio context; each impact produces both class voices',()=>{
 const tones=[];const sound=new SoundManager();sound.unlock=()=>{sound.context={};};sound.tone=(...args)=>tones.push(args);
 sound.play('impact',getDuel('r','b'));assert.equal(tones.length,0);sound.enabled=true;sound.volume=0;sound.play('impact',getDuel('r','b'));assert.equal(tones.length,0);
 sound.volume=.35;sound.play('impact',getDuel('r','b'));assert.equal(tones.length,2);assert.notEqual(tones[0][0],tones[1][0]);
});
