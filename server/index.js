import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, extname, sep} from 'node:path';
import {GameSession} from '../dist/js/game.js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.json':'application/json', '.wasm':'application/wasm', '.gz':'application/gzip'};

// One process owns the queue and games. No accounts or external services required.
export function createChessServer({graceMs = 30000, retentionMs = 300000, now = Date.now} = {}) {
 const players = new Map(), rooms = new Set(), queue = new Set();
 function snapshot(player) {
  const room = player.room;
  return room ? {phase:'playing', side:player.side, game:room.game.serialize(), ply:room.game.chess.history().length,
   opponentConnected:!!room.players.find(p=>p!==player).stream} : {phase:'waiting'};
 }
 function send(player) {player.stream?.write(`data: ${JSON.stringify(snapshot(player))}\n\n`);}
 function broadcast(room) {for (const player of room.players) send(player);}
 function tick(room) {const time = now(); room.game.tick(Math.max(0,time-room.updated)); room.updated=time;}
 function match(player) {
  if (player.room || !player.stream) return;
  for (const other of queue) {
   if (other === player || !other.stream || other.room) continue;
   queue.delete(other); queue.delete(player);
   const pair = Math.random()<.5 ? [other,player] : [player,other];
   const room = {game:new GameSession(), players:pair, updated:now()}; rooms.add(room);
   pair.forEach((p,i)=>{p.room=room;p.side=i?'b':'w';}); broadcast(room); return;
  }
  queue.add(player); send(player);
 }
 function leave(player) {
  queue.delete(player); players.delete(player.token);
  if (player.room) {
   const room=player.room; tick(room);
   if (!room.game.result && !room.game.chess.isGameOver()) room.game.result=`Abandon · ${player.side==='w'?'les noirs':'les blancs'} gagnent`;
   broadcast(room);
  }
  player.stream?.end(); player.stream=null;
 }
 const timer=setInterval(()=>{
  for (const room of rooms) {tick(room);broadcast(room);if(room.players.every(p=>!players.has(p.token)))rooms.delete(room);}
  for (const player of players.values()) {
   if (player.stream) continue;
   const elapsed=now()-player.disconnected;
   if (elapsed>=graceMs && player.room && !player.room.game.result && !player.room.game.chess.isGameOver()) {
    player.room.game.result=`Adversaire déconnecté · ${player.side==='w'?'les noirs':'les blancs'} gagnent`;broadcast(player.room);
   }
   if (elapsed>=retentionMs) leave(player);
  }
 },1000);
 timer.unref();
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try {
   if (url.pathname.startsWith('/api/')) {
    // Only our own origin may create sessions or submit moves.
    if (req.headers.origin && new URL(req.headers.origin).host!==req.headers.host) return json(403,{error:'Origine refusée.'});
    if (req.method==='POST' && url.pathname==='/api/join') {
     if(players.size>=2000)return json(503,{error:'Serveur complet. Réessayez plus tard.'});
     const token=randomUUID(); players.set(token,{token,stream:null,room:null,disconnected:now()});return json(200,{token});
    }
    const token=req.method==='GET'?url.searchParams.get('token'):req.headers.authorization?.replace(/^Bearer /,'');
    const player=players.get(token);
    if (!player) return json(401,{error:'Session expirée. Relancez la recherche.'});
    if(req.method==='GET' && url.pathname==='/api/events') {
     res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
     player.stream?.end(); player.stream=res;
     req.on('close',()=>{if(player.stream===res){player.stream=null;player.disconnected=now();queue.delete(player);if(player.room)broadcast(player.room);}});
     if(player.room){tick(player.room);broadcast(player.room);}else match(player);
     return;
    }
    if(req.method==='GET' && url.pathname==='/api/session')return json(200,{ok:true});
    if(req.method==='POST' && url.pathname==='/api/leave'){leave(player);return json(200,{ok:true});}
    if(req.method==='POST' && url.pathname==='/api/move') {
     let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return json(413,{error:'Requête trop longue.'});}
     let input;try{input=JSON.parse(body);}catch{return json(400,{error:'Requête invalide.'});}
     const room=player.room;
     if(!room)return json(409,{error:'En attente d’un adversaire.'});
     tick(room);
     if(room.game.chess.turn()!==player.side || input.ply!==room.game.chess.history().length)return json(409,{error:'Ce n’est pas votre tour. La position a été actualisée.'});
     if(!room.game.play({from:input.from,to:input.to,promotion:input.promotion||'q'}))return json(400,{error:'Coup illégal ou partie terminée.'});
     room.game.finish();broadcast(room);return json(200,{ok:true});
    }
    return json(404,{error:'Route inconnue.'});
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
   const file=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);return res.end();}
   const data=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(req.method==='HEAD'?undefined:data);
  } catch(error) {if(!res.headersSent)json(error.code==='ENOENT'?404:400,{error:'Requête impossible.'});else res.end();}
 });
 server.on('close',()=>clearInterval(timer));
 return server;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const port=Number(process.env.PORT)||8080;
 createChessServer().listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`Grandmaster: http://localhost:${port}`));
}
