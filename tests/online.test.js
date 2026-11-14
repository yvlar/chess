import test from 'node:test';
import assert from 'node:assert/strict';
import {createChessServer} from '../server/index.js';

async function setup(t,options) {
 const server=createChessServer(options);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const controllers=[];
 t.after(async()=>{controllers.forEach(c=>c.abort());server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 async function post(path,token,body={}) {
  return fetch(`${base}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 }
 async function events(token) {
  const controller=new AbortController();controllers.push(controller);
  const response=await fetch(`${base}/api/events?token=${token}`,{signal:controller.signal});
  assert.equal(response.status,200);
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
  return {close:()=>controller.abort(),async next(predicate=()=>true){
   const timeout=setTimeout(()=>controller.abort(),4000);
   try{while(true){
    const end=buffer.indexOf('\n\n');
    if(end>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);if(frame.startsWith('data: ')){const data=JSON.parse(frame.slice(6));if(predicate(data))return data;}continue;}
    const {value,done}=await reader.read();if(done)throw Error('Stream closed');buffer+=decoder.decode(value,{stream:true});
   }}finally{clearTimeout(timeout);}
  }};
 }
 async function join(){const response=await post('join');assert.equal(response.status,200);return (await response.json()).token;}
 return {base,post,events,join};
}

test('automatic matching, authoritative moves, reconnect and resignation',async t=>{
 const {base,post,events,join}=await setup(t);
 assert.equal((await fetch(base)).status,200);
 assert.equal((await fetch(`${base}/api/events?token=unknown`)).status,401);
 const a=await join(),streamA=await events(a);
 assert.equal((await streamA.next()).phase,'waiting');
 const b=await join(),streamB=await events(b);
 const stateA=await streamA.next(s=>s.phase==='playing'),stateB=await streamB.next();
 assert.notEqual(stateA.side,stateB.side);
 const white=stateA.side==='w'?a:b,black=white===a?b:a;
 assert.equal((await post('move',black,{from:'e7',to:'e5',ply:0})).status,409);
 assert.equal((await post('move',white,{from:'e2',to:'e5',ply:0})).status,400);
 assert.equal((await post('move',white,{from:'e2',to:'e4',ply:0})).status,200);
 const movedA=await streamA.next(s=>s.ply===1),movedB=await streamB.next(s=>s.ply===1);
 assert.equal(movedA.game.fen,movedB.game.fen);
 assert.equal((await post('move',white,{from:'e2',to:'e4',ply:0})).status,409);
 streamA.close();
 const resumed=await events(a);
 assert.equal((await resumed.next()).game.fen,movedA.game.fen);
 const third=await join(),streamC=await events(third);
 assert.equal((await streamC.next()).phase,'waiting');
 await post('leave',b);
 assert.match((await resumed.next(s=>s.game.result)).game.result,/Abandon/);
 assert.equal((await fetch(`${base}/api/events?token=${b}`)).status,401);
});

test('cancelled queue entries are removed and disconnected opponents forfeit after grace',async t=>{
 let time=0;
 const {post,events,join}=await setup(t,{now:()=>time,graceMs:100,retentionMs:10000});
 const cancelled=await join(),cancelledStream=await events(cancelled);
 await cancelledStream.next();await post('leave',cancelled);
 const a=await join(),streamA=await events(a);assert.equal((await streamA.next()).phase,'waiting');
 const b=await join(),streamB=await events(b);await streamA.next(s=>s.phase==='playing');await streamB.next();
 streamB.close();await streamA.next(s=>!s.opponentConnected);
 time=200;
 assert.match((await streamA.next(s=>s.game.result)).game.result,/Adversaire déconnecté/);
});

test('online clocks use server time and expired clocks reject moves',async t=>{
 let time=0;
 const {post,events,join}=await setup(t,{now:()=>time});
 const a=await join(),streamA=await events(a);await streamA.next();
 const b=await join(),streamB=await events(b);
 const state=await streamA.next(s=>s.phase==='playing');await streamB.next();
 const white=state.side==='w'?a:b,black=white===a?b:a;
 await post('move',white,{from:'e2',to:'e4',ply:0});
 time=600001;
 assert.equal((await post('move',black,{from:'e7',to:'e5',ply:1})).status,400);
 const ended=await streamA.next(s=>s.game.result);
 assert.equal(ended.game.clocks.b,0);assert.match(ended.game.result,/Temps écoulé/);
});
