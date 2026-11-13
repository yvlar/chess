import { Chess } from '../vendor/chess.js';
export const START_FEN = new Chess().fen();
export class GameSession {
 constructor(){this.generation=0;this.reset();}
 reset(fen=START_FEN){const next=new Chess(fen);this.chess=next;this.generation++;this.animation=null;this.selected=null;this.result=null;this.clocks={w:600000,b:600000};return this;}
 get busy(){return !!this.animation;}
 play(input){if(this.busy||this.result||this.chess.isGameOver())return null;const before=this.chess.board().flat().filter(Boolean).map(p=>({...p}));let move;try{move=this.chess.move(input);}catch{return null;}if(!move)return null;const captureSquare=move.isEnPassant()?move.to[0]+move.from[1]:move.to;this.animation={move,before,captureSquare,generation:this.generation};this.selected=null;return this.animation;}
 finish(){this.animation=null;}
 undo(){this.generation++;this.animation=null;this.selected=null;this.result=null;return this.chess.undo();}
 tick(ms){if(!this.busy&&!this.result&&!this.chess.isGameOver()&&this.chess.history().length){let c=this.chess.turn();this.clocks[c]=Math.max(0,this.clocks[c]-ms);if(!this.clocks[c])this.result=this.chess.board().flat().filter(p=>p&&p.color!==c&&p.type!=='k').length===0?'Partie nulle · le camp adverse ne peut pas mater':`Temps écoulé · ${c==='w'?'les noirs':'les blancs'} gagnent`;}}
 serialize(){return {version:1,pgn:this.chess.pgn(),initialFen:this.chess.getHeaders().FEN||START_FEN,fen:this.chess.fen(),clocks:this.clocks,result:this.result};}
 restore(data){if(data.version!==1)throw Error('Format de sauvegarde inconnu');const next=new Chess(data.initialFen||START_FEN);if(data.pgn)next.loadPgn(data.pgn);if(next.fen()!==data.fen)throw Error('Sauvegarde incohérente');if(!['w','b'].every(c=>Number.isFinite(data.clocks[c])&&data.clocks[c]>=0))throw Error('Horloges invalides');this.reset(next.fen());this.chess=next;this.clocks={...data.clocks};this.result=data.result||null;}
}
export class AnimationController {
 constructor(meta,name,onEvent=()=>{}){this.meta=meta;this.name=name;this.elapsed=0;this.onEvent=onEvent;this.fired=new Set();}
 update(dt){const a=this.meta.animations[this.name];this.elapsed+=dt;for(const [f,event] of Object.entries(a.events||{})){if(this.elapsed>=Number(f)*a.frameDuration&&!this.fired.has(f)){this.fired.add(f);this.onEvent(event);}}return this.done;}
 get frame(){const a=this.meta.animations[this.name];return a.loop?Math.floor(this.elapsed/a.frameDuration)%a.frames:Math.min(a.frames-1,Math.floor(this.elapsed/a.frameDuration));}
 get done(){const a=this.meta.animations[this.name];return !a.loop&&this.elapsed>=a.frames*a.frameDuration;}
}
export class StockfishEngine {
 constructor(onStatus=()=>{}){this.worker=null;this.serial=0;this.onStatus=onStatus;}
 cancel(){this.serial++;this.worker?.terminate();this.worker=null;clearTimeout(this.timer);if(this.pendingReject){const reject=this.pendingReject;this.pendingReject=null;reject(new DOMException('Recherche annulée','AbortError'));}}
 async search(fen,level=4,analysis=false){this.cancel();const serial=this.serial;this.onStatus('loading');return new Promise((resolve,reject)=>{this.pendingReject=reject;let ready=false,started=false,lastInfo='';const worker=this.worker=new Worker(new URL('../vendor/stockfish.js',import.meta.url));const timeout=this.timer=setTimeout(()=>{if(this.serial===serial){this.pendingReject=null;this.cancel();this.onStatus('error');reject(Error('Le moteur ne répond pas. Réessayez ou jouez à deux.'));}},20000);const fail=()=>{clearTimeout(timeout);if(serial===this.serial){this.pendingReject=null;this.cancel();this.onStatus('error');reject(Error('Stockfish indisponible. Le mode à deux reste accessible.'));}};worker.onerror=fail;worker.onmessage=({data})=>{if(serial!==this.serial)return;for(const line of String(data).split('\n')){if(line.includes('uciok')){worker.postMessage('setoption name Hash value 16');worker.postMessage(`setoption name Skill Level value ${Math.round((level-1)*20/9)}`);worker.postMessage('isready');}if(line.includes('readyok')&&!started){ready=true;started=true;this.onStatus('thinking');worker.postMessage(`position fen ${fen}`);worker.postMessage(`go movetime ${analysis?1800:150+level*100}`);}if(line.startsWith('info depth'))lastInfo=line;if(ready&&line.startsWith('bestmove')){clearTimeout(timeout);this.pendingReject=null;this.onStatus('ready');resolve({move:line.split(' ')[1],info:lastInfo,fen,serial});}}};worker.postMessage('uci');});}
}
