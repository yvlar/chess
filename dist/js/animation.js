import { AnimationController } from './game.js';
import { PIECES } from './pieces.js';
import { getDuel, getMovement, combatPose, clamp, ease } from './combat.js';

export class SpriteSheetLoader {
 constructor(){this.cache=new Map();}
 async load(){
  this.meta=await fetch('assets/sprites/atlas.json').then(r=>{if(!r.ok)throw Error('Métadonnées absentes');return r.json();});
  await Promise.all(['w','b'].flatMap(c=>Object.keys(PIECES).map(async p=>{
   const i=new Image();i.src=`assets/sprites/${c}${p}.png`;await i.decode();this.cache.set(c+p,i);
  })));
  return this;
 }
}
export class SpriteRenderer {
 constructor(loader){this.loader=loader;}
 draw(ctx,p,x,y,size,state='idle',elapsed=0,opacity=1,pose={}){
  const m=this.loader.meta,a=m.animations[state]||m.animations.idle;
  const frame=a.loop?Math.floor(elapsed/a.frameDuration)%a.frames:Math.min(a.frames-1,Math.floor(elapsed/a.frameDuration));
  const height=size*m.frameHeight/m.frameWidth;
  ctx.save();ctx.globalAlpha=clamp(opacity);ctx.translate(x,y);ctx.rotate(pose.tilt||0);ctx.scale(pose.facing||1,1);
  ctx.drawImage(this.loader.cache.get(p.color+p.type),frame*m.frameWidth,a.row*m.frameHeight,m.frameWidth,m.frameHeight,
   -size*m.anchor.x,-height*m.anchor.y,size,height);ctx.restore();
 }
}
export class ParticleSystem {
 constructor(){this.items=[];}
 emit(x,y,color,amount=22,shape='spark',angle=0){
  for(let i=0;i<Math.min(60,Math.max(0,amount));i++){
   const a=angle+(Math.random()-.5)*Math.PI*2,s=35+Math.random()*100;
   const life=350+Math.random()*400;
   this.items.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life,max:life,color,shape,size:2+Math.random()*3});
  }
 }
 update(dt){this.items=this.items.filter(p=>p.life>0);for(const p of this.items){p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=70*dt/1000;p.life-=dt;}}
 draw(ctx){
  ctx.save();
  for(const p of this.items){
   ctx.globalAlpha=clamp(p.life/p.max);ctx.fillStyle=p.color;
   if(p.shape==='rune'){ctx.beginPath();ctx.moveTo(p.x,p.y-p.size);ctx.lineTo(p.x+p.size,p.y);ctx.lineTo(p.x,p.y+p.size);ctx.lineTo(p.x-p.size,p.y);ctx.closePath();ctx.fill();}
   else ctx.fillRect(p.x,p.y,p.size,p.shape==='stone'?p.size:p.size*.5);
  }
  ctx.restore();
 }
}
export class SoundManager {
 constructor(){this.enabled=false;this.volume=.35;}
 unlock(){
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio)return;
  if(!this.context)this.context=new Audio();
  this.context.resume().catch(()=>{});
 }
 tone(frequency,end,duration,wave='sine',gain=1,delay=0){
  const ctx=this.context,o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+delay;
  o.type=wave;o.frequency.setValueAtTime(frequency,now);o.frequency.exponentialRampToValueAtTime(Math.max(25,end),now+duration);
  g.gain.setValueAtTime(.0001,now);g.gain.linearRampToValueAtTime(this.volume*.12*gain,now+.012);
  g.gain.exponentialRampToValueAtTime(.0001,now+duration);
  o.connect(g);g.connect(ctx.destination);o.start(now);o.stop(now+duration+.02);
  o.onended=()=>{o.disconnect();g.disconnect();};
 }
 play(kind='move',duel){
  if(!this.enabled||this.volume<=0)return;this.unlock();if(!this.context)return;
  if(duel&&kind==='impact'){
   const s=duel.sound;this.tone(s.root,s.root*.24,s.duration,s.wave,1);
   this.tone(s.resonance*2,s.resonance,s.duration*.85,'triangle',.65,.025);
  }else if(duel&&kind==='attack'){
   this.tone(duel.sound.root*.6,duel.sound.root*1.8,.16,'sine',.45);
  }else if(kind==='check')this.tone(660,440,.3,'sine');
  else this.tone(380,240,.13,'sine',.65);
 }
}

export class CombatAnimator {
 constructor(loader,transaction,onImpact,onCue=()=>{}){
  this.transaction=transaction;this.phase='MOVING';this.elapsed=0;this.targetTime=0;this.hit=false;this.done=false;
  this.duel=transaction.move.captured?getDuel(transaction.move.piece,transaction.move.captured):null;
  this.movement=getMovement(transaction.move.piece);this.movingTime=this.movement.approach;this.onCue=onCue;
  const duration=this.duel?.frameDuration||loader.meta.animations.attack.frameDuration;
  this.meta={...loader.meta,animations:{...loader.meta.animations,attack:{...loader.meta.animations.attack,frameDuration:duration}}};
  this.attack=new AnimationController(this.meta,'attack',()=>{this.hit=true;onImpact(this.duel);});
 }
 duration(){
  if(this.phase==='MOVING')return this.movingTime;
  if(this.phase==='ANTICIPATING')return this.duel.windup;
  if(this.phase==='ATTACKING')return this.meta.animations.attack.frames*this.meta.animations.attack.frameDuration;
  return this.duel?this.duel.recovery:this.transaction.move.promotion?680:120;
 }
 update(dt){
  // Consume overshoot so throttled/fast frames cannot skip an impact or delay a phase.
  let remaining=Math.max(0,dt);
  while(remaining>0&&!this.done){
   const step=Math.min(remaining,this.duration()-this.elapsed);
   if(this.phase==='ATTACKING'){
    const before=this.attack.elapsed;this.attack.update(step);
    const impact=Number(Object.keys(this.meta.animations.attack.events)[0])*this.meta.animations.attack.frameDuration;
    this.targetTime+=Math.max(0,this.attack.elapsed-Math.max(before,impact));
   }else if(this.hit)this.targetTime+=step;
   this.elapsed+=step;remaining-=step;
   if(this.elapsed>=this.duration()){
    if(this.phase==='MOVING')this.phase=this.duel?'ANTICIPATING':'RECOVERING';
    else if(this.phase==='ANTICIPATING'){this.phase='ATTACKING';this.onCue('attack',this.duel);}
    else if(this.phase==='ATTACKING')this.phase='RECOVERING';
    else {this.done=true;break;}
    this.elapsed=0;
   }
  }
 }
 get progress(){return clamp(this.elapsed/this.movingTime);}
 get attackProgress(){return clamp(this.attack.elapsed/(this.meta.animations.attack.frames*this.meta.animations.attack.frameDuration));}
}

export class BoardRenderer {
 constructor(canvas,session,loader,settings,sound){
  this.canvas=canvas;this.ctx=canvas.getContext('2d');this.session=session;this.loader=loader;this.sprites=new SpriteRenderer(loader);
  this.settings=settings;this.sound=sound;this.particles=new ParticleSystem();this.flipped=false;this.lastMove=null;this.animator=null;
  this.shake=0;this.time=0;this.keyboard=null;this.mateTime=0;this.onFinish=()=>{};
  this.resize=()=>{const rect=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(rect.width*dpr);canvas.height=canvas.width;};
  this.observer=new ResizeObserver(this.resize);this.observer.observe(canvas);this.resize();
 }
 squarePoint(square){let col=square.charCodeAt(0)-97,row=8-Number(square[1]);if(this.flipped){col=7-col;row=7-row;}return {x:100+col*100,y:100+row*100};}
 at(x,y){let c=Math.floor((x-50)/100),r=Math.floor((y-50)/100);if(c<0||c>7||r<0||r>7)return null;if(this.flipped){c=7-c;r=7-r;}return String.fromCharCode(97+c)+(8-r);}
 start(tx){
  this.lastMove=tx.move;this.particles.items=[];
  this.animator=new CombatAnimator(this.loader,tx,duel=>{
   const p=this.squarePoint(tx.captureSquare);
   if(!this.settings.reduced)this.particles.emit(p.x,p.y-20,duel.color,Math.round(28*this.settings.particles),
    duel.defender==='r'?'stone':['b','q'].includes(duel.defender)?'rune':'spark',duel.angle);
   this.sound.play('impact',duel);if(!this.settings.reduced)this.shake=duel.weight;
  },(kind,duel)=>this.sound.play(kind,duel));
  if(tx.move.promotion&&!this.settings.reduced){const p=this.squarePoint(tx.move.to);this.particles.emit(p.x,p.y,'#f7e4a2',35*this.settings.particles,'rune');}
  if(this.settings.mode==='off')this.skip();
 }
 skip(){if(!this.animator&&!this.session.busy)return;this.animator=null;this.session.finish();this.particles.items=[];this.onFinish();}
 reset(){this.animator=null;this.lastMove=null;this.particles.items=[];this.mateTime=0;this.shake=0;}
 update(dt){
  this.time+=dt;this.shake=Math.max(0,this.shake-dt*.035);this.particles.update(dt);
  if(this.session.chess.isCheckmate()&&!this.animator)this.mateTime+=dt;
  if(this.animator){
   if(this.settings.mode==='off'){this.skip();return;}
   this.animator.update(dt*(this.settings.mode==='fast'?2.5:1)*this.settings.speed);
   if(this.animator.done)this.skip();
  }
 }
 drawBoard(ctx){
  ctx.fillStyle='#222c20';ctx.fillRect(0,0,900,900);
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   const x=50+c*100,y=50+r*100;ctx.fillStyle=(r+c)%2?'#45523e':'#9ca786';ctx.fillRect(x,y,100,100);
   const grd=ctx.createLinearGradient(x,y,x+100,y+100);grd.addColorStop(0,'#ffffff09');grd.addColorStop(1,'#0000000c');
   ctx.fillStyle=grd;ctx.fillRect(x,y,100,100);ctx.strokeStyle='#17271b15';ctx.strokeRect(x+.5,y+.5,99,99);
  }
  ctx.fillStyle='#c6ceb6';ctx.font='15px Georgia';ctx.textAlign='center';
  for(let i=0;i<8;i++){
   ctx.fillText(String.fromCharCode(97+(this.flipped?7-i:i)),100+i*100,879);
   ctx.fillText(String.fromCharCode(97+(this.flipped?7-i:i)),100+i*100,22);
   ctx.fillText(String(this.flipped?i+1:8-i),25,106+i*100);ctx.fillText(String(this.flipped?i+1:8-i),875,106+i*100);
  }
 }
 highlight(ctx,sq,color,outline=false){
  const p=this.squarePoint(sq);ctx.fillStyle=color;ctx.fillRect(p.x-50,p.y-50,100,100);
  if(outline){ctx.strokeStyle='#edd58d';ctx.lineWidth=2;ctx.strokeRect(p.x-47,p.y-47,94,94);}
 }
 actors(){
  const a=this.animator,tx=a?.transaction,visuals=[];
  const pieces=tx?tx.before:this.session.chess.board().flat().filter(Boolean);
  const castle=tx&&(tx.move.isKingsideCastle()||tx.move.isQueensideCastle());
  const rookSquare=castle?(tx.move.isKingsideCastle()?'h':'a')+tx.move.from[1]:null;
  for(const p of pieces){
   if(tx&&(p.square===tx.move.from||(tx.move.captured&&p.square===tx.captureSquare)||p.square===rookSquare))continue;
   visuals.push({...p,...this.squarePoint(p.square),state:'idle',elapsed:this.time});
  }
  if(!a)return visuals;
  const from=this.squarePoint(tx.move.from),to=this.squarePoint(tx.move.to),target=this.squarePoint(tx.captureSquare);
  const dx=target.x-from.x,dy=target.y-from.y,distance=Math.hypot(dx,dy)||1;
  const ux=dx/distance,uy=dy/distance,duel=a.duel,reduced=this.settings.reduced;
  const reach=duel?Math.min(duel.reach,distance*.65):0;
  const stop={x:target.x-ux*reach,y:target.y-uy*reach};
  const walk=ease(a.progress),recovery=ease(a.elapsed/(duel?520:1));
  let x,y,hop=0;
  if(a.phase==='MOVING'){
   x=from.x+((duel?stop:to).x-from.x)*walk;y=from.y+((duel?stop:to).y-from.y)*walk;
   if(!reduced){
    const sin=Math.sin(a.progress*Math.PI),movement=a.movement.movement;
    hop=movement==='gallop'?sin*48:movement==='glide'?sin*12:Math.abs(Math.sin(a.progress*Math.PI*4))*(movement==='stomp'?5:3);
    if(movement==='orbit'){x+=-uy*sin*14;y+=ux*sin*14;}
   }
  }else if(a.phase==='RECOVERING'){
   x=stop.x+(to.x-stop.x)*recovery;y=stop.y+(to.y-stop.y)*recovery;
  }else {x=stop.x;y=stop.y;}
  const facing=duel?(target.x>=x?1:-1):(to.x===from.x?(tx.move.color==='w'?1:-1)*(this.flipped?-1:1):Math.sign(to.x-from.x));
  let pose={advance:0,side:0,hop:0,recoil:0,targetLift:0,tilt:0};
  if(duel&&a.phase==='ATTACKING')pose=combatPose(duel,a.attackProgress,a.hit,a.targetTime,reduced);
  const anticipation=duel&&a.phase==='ANTICIPATING'&&!reduced?Math.sin(a.elapsed/duel.windup*Math.PI):0;
  x+=ux*(pose.advance-anticipation*7)-uy*pose.side;y+=uy*(pose.advance-anticipation*7)+ux*pose.side;
  hop+=pose.hop;
  let state=a.phase==='MOVING'?'walk':a.phase==='ATTACKING'?'attack':a.phase==='ANTICIPATING'?'guard':duel?'victory':'idle';
  if(tx.move.promotion&&a.phase==='RECOVERING')state='special';
  const attackElapsed=a.attack.elapsed*this.loader.meta.animations.attack.frameDuration/(duel?.frameDuration||85);
  visuals.push({color:tx.move.color,type:tx.move.promotion&&a.phase==='RECOVERING'?tx.move.promotion:tx.move.piece,
   x,y:y-hop,state,elapsed:a.phase==='ATTACKING'?attackElapsed:a.elapsed,facing,attacker:true,groundY:y});
  if(duel){
   const victim=tx.before.find(p=>p.square===tx.captureSquare);
   const deathDuration=this.loader.meta.animations.death.frames*this.loader.meta.animations.death.frameDuration;
   const reactionTime=200,deathTime=Math.max(0,a.targetTime-reactionTime)*duel.defence.fall;
   if(victim&&(!a.hit||deathTime<deathDuration)){
    // Recoil continues into recovery instead of snapping the defeated actor back.
    const response=combatPose(duel,a.attackProgress,a.hit,a.targetTime,reduced);
    const guardTime=a.phase==='ANTICIPATING'?a.elapsed:a.phase==='ATTACKING'?a.attack.elapsed:0;
    const guardHop=!a.hit&&!reduced?Math.sin(clamp(guardTime/350)*Math.PI)*duel.defence.lift:0;
    visuals.push({...victim,x:target.x+ux*response.recoil,y:target.y+uy*response.recoil-response.targetLift-guardHop,
     facing:-facing,tilt:response.tilt,state:!a.hit?(a.phase==='MOVING'?'idle':'guard'):a.targetTime<reactionTime?'hit':'death',
     elapsed:!a.hit?guardTime:a.targetTime<reactionTime?a.targetTime:deathTime,
     opacity:a.hit?1-clamp((deathTime-400)/(deathDuration-400)):1,defender:true});
   }
  }
  if(castle){
   const ks=tx.move.isKingsideCastle(),rf=this.squarePoint(rookSquare),rt=this.squarePoint((ks?'f':'d')+tx.move.from[1]);
   const progress=a.phase==='MOVING'?walk:1;
   visuals.push({color:tx.move.color,type:'r',x:rf.x+(rt.x-rf.x)*progress,y:rf.y,
    facing:Math.sign(rt.x-rf.x),state:progress<1?'walk':'idle',elapsed:a.elapsed});
  }
  return visuals;
 }
 drawEffects(ctx){
  const a=this.animator,d=a?.duel;if(!d||this.settings.reduced||this.settings.mode==='off')return;
  if(a.phase!=='ANTICIPATING'&&a.phase!=='ATTACKING'&&!(a.hit&&a.targetTime<440))return;
  const actors=this.actors(),attacker=actors.find(p=>p.attacker),victim=this.squarePoint(a.transaction.captureSquare);
  const x=attacker.x,y=attacker.y-30,tx=victim.x,ty=victim.y-30;
  const angle=Math.atan2(ty-y,tx-x),p=a.attackProgress,burst=1-clamp(a.targetTime/440);
  const wind=a.phase==='ANTICIPATING'?Math.sin(a.elapsed/d.windup*Math.PI):0;
  ctx.save();ctx.strokeStyle=d.color;ctx.fillStyle=d.color;ctx.lineCap='round';
  // The defender's ward uses its own class silhouette before contact.
  if(!a.hit){
   ctx.globalAlpha=.25+wind*.4;ctx.lineWidth=2;ctx.beginPath();
   const defence=d.defence.style;
   if(defence==='ward'||defence==='veil'){
    ctx.ellipse(tx,ty,35+wind*7,45,0,0,Math.PI*2);
   }else if(defence==='brace'){
    ctx.moveTo(tx-30,ty+30);ctx.lineTo(tx-36,ty-35);ctx.lineTo(tx+32,ty-35);ctx.lineTo(tx+30,ty+30);
   }else ctx.arc(tx,ty,35,angle+Math.PI*.6,angle+Math.PI*1.4);
   ctx.stroke();
  }
  if(a.phase==='ATTACKING'){
   ctx.globalAlpha=Math.sin(p*Math.PI)*.85;ctx.lineWidth=4;
   if(d.style==='beam'){
    const travel=clamp(p/.5);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(tx-x)*travel,y+(ty-y)*travel);ctx.stroke();
    ctx.lineWidth=1;ctx.beginPath();ctx.arc(x+(tx-x)*travel,y+(ty-y)*travel,9,0,Math.PI*2);ctx.stroke();
   }else if(d.style==='vortex'){
    for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(tx,ty,24+p*20,40,angle+p*Math.PI+i*Math.PI/3,0,Math.PI*1.3);ctx.stroke();}
   }else if(d.style==='hammer'){
    ctx.beginPath();ctx.arc(x,y+30,48,angle-Math.PI*.8+p,angle+p*.6);ctx.stroke();
   }else if(d.style==='slash'){
    ctx.beginPath();ctx.ellipse(tx,ty,40,28,angle+d.angle,Math.PI+p,Math.PI*2+p);ctx.stroke();
   }else {
    ctx.beginPath();ctx.moveTo(x-10*Math.cos(angle),y-10*Math.sin(angle));ctx.lineTo(tx,ty);ctx.stroke();
    if(d.style==='charge'){ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x-35*Math.cos(angle),y+12);ctx.lineTo(tx-10*Math.cos(angle),ty+12);ctx.stroke();}
   }
  }
  if(a.hit&&burst>0){
   ctx.globalAlpha=burst*.8;ctx.lineWidth=3*burst;ctx.beginPath();
   ctx.ellipse(tx,ty+25,15+(1-burst)*55,8+(1-burst)*25,d.angle,0,Math.PI*2);ctx.stroke();
   if(d.style==='hammer'){
    for(let i=0;i<5;i++){const r=d.angle+i*Math.PI*2/5;ctx.beginPath();ctx.moveTo(tx,ty+25);ctx.lineTo(tx+Math.cos(r)*(1-burst)*65,ty+25+Math.sin(r)*(1-burst)*30);ctx.stroke();}
   }
  }
  ctx.restore();
 }
 drawActor(ctx,p,transaction){
  let state=p.state,elapsed=p.elapsed;
  if(!transaction&&this.session.chess.isCheckmate()){
   if(p.color===this.session.chess.turn()&&p.type==='k'){state='death';elapsed=Math.min(500,this.mateTime);}
   else if(p.color!==this.session.chess.turn()){state='victory';elapsed=this.time%680;}
  }
  const footY=(p.groundY??p.y)+32;
  ctx.save();ctx.globalAlpha=p.opacity??1;
  ctx.fillStyle=p.color==='w'?'#f9edc44d':'#211e3fcc';ctx.strokeStyle=p.color==='w'?'#f0d29e':'#bc9bcf';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(p.x,footY,PIECES[p.type].size*.29,9,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.restore();
  const frozen=this.settings.mode==='off'||this.settings.reduced;
  // Reduced effects retains capture timing but stops oscillating sprite loops.
  const staticLoop=frozen&&['idle','walk','guard','victory','special'].includes(state);
  this.sprites.draw(ctx,p,p.x,p.y+32,PIECES[p.type].size,state,staticLoop?0:elapsed,p.opacity??1,
   {facing:p.facing??(p.color==='w'?1:-1)*(this.flipped?-1:1),tilt:this.settings.reduced?0:p.tilt});
  if(this.settings.labels!==false){
   ctx.save();ctx.globalAlpha=p.opacity??1;ctx.fillStyle=p.color==='w'?'#f4ecd3':'#20263c';ctx.strokeStyle=PIECES[p.type].accent;ctx.lineWidth=1.5;
   ctx.beginPath();ctx.arc(p.x+32,footY-2,13,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.fillStyle=p.color==='w'?'#152b2b':'#f4ecd3';ctx.font='22px "DejaVu Sans",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
   ctx.fillText(PIECES[p.type].glyph,p.x+32,footY-1);ctx.restore();
  }
 }
 draw(){
  const ctx=this.ctx,n=this.canvas.width;ctx.setTransform(n/900,0,0,n/900,0,0);ctx.clearRect(0,0,900,900);ctx.save();
  if(this.shake&&!this.settings.reduced)ctx.translate(Math.sin(this.time)*this.shake,Math.cos(this.time)*this.shake);
  this.drawBoard(ctx);
  if(this.lastMove){this.highlight(ctx,this.lastMove.from,'#e2cf6426');this.highlight(ctx,this.lastMove.to,'#e2cf6444');}
  if(this.session.selected)this.highlight(ctx,this.session.selected,'#e0c46b66',true);
  if(this.keyboard)this.highlight(ctx,this.keyboard,'#dfc98522',true);
  if(this.session.chess.isCheck()){
   const king=this.session.chess.board().flat().find(p=>p&&p.type==='k'&&p.color===this.session.chess.turn());
   const alpha=this.settings.reduced ? .3 : .28+Math.sin(this.time/250)*.1;
   if(king)this.highlight(ctx,king.square,`rgba(185,65,64,${alpha})`,true);
  }
  if(this.session.selected&&!this.session.busy){
   for(const m of this.session.chess.moves({square:this.session.selected,verbose:true})){
    const p=this.squarePoint(m.to);ctx.fillStyle='#203c26aa';ctx.strokeStyle='#f3df9e99';ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(p.x,p.y,m.captured?42:11,0,Math.PI*2);m.captured?ctx.stroke():ctx.fill();
   }
  }
  const visuals=this.actors();visuals.sort((a,b)=>(a.groundY??a.y)-(b.groundY??b.y)||Number(!!a.attacker)-Number(!!b.attacker));
  for(const p of visuals)this.drawActor(ctx,p,this.animator?.transaction);
  this.drawEffects(ctx);this.particles.draw(ctx);ctx.restore();
 }
}
