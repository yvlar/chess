import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {Chess} from '../dist/vendor/chess.js';
test('shipped Stockfish WASM initializes via browser-worker UCI and returns a legal move', {timeout:15000},async()=>{
 const script=readFileSync(new URL('../dist/vendor/stockfish.js',import.meta.url),'utf8');
 const bytes=readFileSync(new URL('../dist/vendor/stockfish.wasm',import.meta.url));
 const output=[];let success,fail;
 const result=new Promise((res,rej)=>{success=res;fail=rej;});
 const context={importScripts(){},console,WebAssembly,performance,TextDecoder,TextEncoder,Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,ArrayBuffer,DataView,Math,Date,Promise,setTimeout,clearTimeout,URL,fetch:async()=>new Response(bytes,{headers:{'Content-Type':'application/wasm'}}),location:{origin:'https://example.test',pathname:'/vendor/stockfish.js',href:'https://example.test/vendor/stockfish.js',hash:''},postMessage(line){output.push(line);if(line.includes('uciok'))setTimeout(()=>context.onmessage({data:'isready'}),0);if(line.includes('readyok')){setTimeout(()=>{context.onmessage({data:'position startpos'});context.onmessage({data:'go movetime 120'});},0);}if(line.includes('bestmove'))success(line.match(/bestmove ([a-h][1-8][a-h][1-8][qrbn]?)/)[1]);},onmessage:null};context.self=context;
 vm.createContext(context);vm.runInContext(script,context);context.onmessage({data:'uci'});
 const move=await result;
 const chess=new Chess();assert.ok(chess.moves({verbose:true}).some(m=>m.from+m.to+(m.promotion||'')===move));assert.ok(output.some(s=>s.includes('Stockfish')));assert.ok(output.some(s=>s.includes('Skill Level')));
});
