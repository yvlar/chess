import { PIECES } from './pieces.js';

const ATTACKS = {
 p: {style:'thrust', movement:'march', approach:540, windup:170, frameDuration:85, reach:82, lunge:17, arc:8, weight:2, note:330},
 n: {style:'charge', movement:'gallop', approach:620, windup:190, frameDuration:90, reach:92, lunge:25, arc:25, weight:4, note:220},
 b: {style:'beam', movement:'glide', approach:680, windup:260, frameDuration:100, reach:120, lunge:4, arc:8, weight:1, note:554},
 r: {style:'hammer', movement:'stomp', approach:760, windup:280, frameDuration:115, reach:88, lunge:12, arc:14, weight:8, note:110},
 q: {style:'vortex', movement:'orbit', approach:600, windup:240, frameDuration:95, reach:110, lunge:10, arc:18, weight:3, note:740},
 k: {style:'slash', movement:'royal', approach:640, windup:210, frameDuration:100, reach:84, lunge:14, arc:10, weight:5, note:392},
};
const DEFENCES = {
 p: {style:'shield', name:'Bouclier levé', recoil:13, lift:0, fall:1, tone:.85},
 n: {style:'rear', name:'Monture cabrée', recoil:21, lift:10, fall:.8, tone:1.05},
 b: {style:'ward', name:'Sceau arcanique', recoil:10, lift:8, fall:1.2, tone:1.4},
 r: {style:'brace', name:'Rempart de pierre', recoil:6, lift:0, fall:1.1, tone:.55},
 q: {style:'veil', name:'Voile royal', recoil:17, lift:6, fall:1.3, tone:1.65},
 k: {style:'parry', name:'Garde souveraine', recoil:9, lift:0, fall:1, tone:.75},
};

// Authored ordered matchups: name, lateral feint, impact angle, knockback multiplier.
// The king's defensive entries also support presentation tools; chess never captures a king.
const MATCHUPS = {
 p: [ ['Lances croisées',-6,-.25,1], ['Sous la monture',14,.45,1.2], ['Percée du sceau',-14,-.6,.9], ['La faille du rempart',5,.2,.7], ['Pointe contre sortilège',-20,-.85,1.1], ['Assaut de la garde',9,.65,.8] ],
 n: [ ['Charge du lancier',-10,.35,1.4], ['Joute des chevaliers',16,-.4,1.1], ['Galop brise-sceau',-22,.75,1.3], ['Charge du bastion',7,-.15,.8], ['Le détour du cavalier',24,-.9,1.2], ['Charge de la couronne',-8,.55,1] ],
 b: [ ['Trait perce-bouclier',8,-.3,1], ['Entrave de la monture',-18,.5,1.15], ['Duel des arcanes',20,-.7,.85], ['Rune de fracture',-5,.1,.75], ['Dissipation du voile',25,.95,1.25], ['Sceau contre couronne',-12,-.5,.9] ],
 r: [ ['Marteau du rempart',-8,.2,1.6], ['Séisme sous les sabots',18,-.55,1.4], ['Brise-rune',-16,.8,1.25], ['Choc des bastions',4,0,.8], ['Le poids de la pierre',22,-1,1.5], ['Le siège du trône',-10,.6,1.1] ],
 q: [ ['Couronne contre lance',12,-.2,1.1], ['Spirale des sabots',-24,.6,1.3], ['Éclipse du mage',18,-.8,1.2], ['Érosion du bastion',-7,.15,.85], ['Le miroir des reines',27,1.05,1], ['L’éclipse du trône',-15,-.65,.95] ],
 k: [ ['Lame du souverain',-12,.3,1.2], ['La garde du chevalier',20,-.5,1.1], ['Lame brise-charme',-18,.7,1.05], ['La brèche royale',6,-.1,.75], ['Le serment et le voile',24,-.95,1.15], ['Duel des couronnes',-9,.5,1] ],
};
const ORDER = ['p','n','b','r','q','k'];
export function getDuel(attacker, defender) {
 const attack = ATTACKS[attacker], defence = DEFENCES[defender];
 if (!attack || !defence) throw new Error('Type de combattant inconnu');
 const [name, feint, angle, force] = MATCHUPS[attacker][ORDER.indexOf(defender)];
 return {id:`${attacker}:${defender}`, name, attacker, defender, ...attack,
  defence, feint, angle, force, color:PIECES[attacker].accent,
  recovery:640 + ORDER.indexOf(defender)*24,
  // Both voices contribute to the timbre and pitch of the contact sound.
  sound:{root:attack.note * (1 + ORDER.indexOf(defender)*.045), resonance:attack.note*defence.tone,
   wave:['sine','triangle','sine','sawtooth','sine','triangle'][ORDER.indexOf(attacker)],
   duration:.20 + ORDER.indexOf(defender)*.025},
 };
}
export function getMovement(type) { return ATTACKS[type]; }
export function createDuelPosition(attacker, defender) {
 getDuel(attacker,defender); // Reject unknown types before constructing a position.
 if(defender==='k')throw new Error('Le roi ne peut pas être capturé.');
 const from={p:'e4',n:'e3',b:'b3',r:'d3',q:'b3',k:'e4'}[attacker],to='d5';
 // A reserve pawn prevents the bishop/bishop showcase being an automatic draw.
 const pieces=new Map([['h8','k'],['h7','p'],[to,defender],[from,attacker.toUpperCase()]]);
 if(attacker!=='k')pieces.set('a1','K');
 const ranks=[];
 for(let rank=8;rank>=1;rank--){
  let row='',empty=0;
  for(let file=0;file<8;file++){
   const piece=pieces.get(String.fromCharCode(97+file)+rank);
   if(piece){if(empty)row+=empty;empty=0;row+=piece;}else empty++;
  }
  if(empty)row+=empty;ranks.push(row);
 }
 return {fen:ranks.join('/')+' w - - 0 1',from,to};
}
export const clamp = (n, min=0, max=1) => Math.min(max, Math.max(min,n));
export const ease = n => { const t=clamp(n); return t*t*(3-2*t); };

// Motion is in board units. All effects use the real captured square (en passant included).
export function combatPose(duel, progress, hit, targetTime=0, reduced=false) {
 if (reduced) return {advance:0, side:0, hop:0, recoil:0, targetLift:0, tilt:0};
 const wind = Math.sin(clamp(progress/.5)*Math.PI/2);
 const contact = Math.sin(clamp((progress-.30)/.44)*Math.PI);
 const recoil = Math.sin(clamp(targetTime/420)*Math.PI);
 return {
  advance:duel.lunge*contact - (progress<.32 ? wind*5 : 0),
  side:Math.sin(progress*Math.PI*2)*duel.feint,
  hop:Math.max(0,Math.sin(progress*Math.PI))*duel.arc,
  recoil:hit ? recoil*duel.defence.recoil*duel.force : 0,
  targetLift:hit ? recoil*duel.defence.lift : 0,
  tilt:hit ? recoil*duel.angle*.3 : 0,
 };
}
