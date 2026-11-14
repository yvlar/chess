export function savedOnlineToken(){try{return sessionStorage.getItem('grandmaster-online');}catch{return null;}}
function saveToken(token){try{if(token)sessionStorage.setItem('grandmaster-online',token);else sessionStorage.removeItem('grandmaster-online');}catch{}}
export class OnlineMatch {
 constructor(onState,onConnection) {this.onState=onState;this.onConnection=onConnection;this.generation=0;this.connected=false;this.pending=false;}
 async post(path,body,token=this.token) {
  const response=await fetch(`/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),keepalive:path==='leave'});
  if(!response.ok){let message='Le serveur en ligne est indisponible. Lancez le site avec npm start.';try{message=(await response.json()).error||message;}catch{}throw Error(message);}
  return response.json();
 }
 async start() {
  this.stop();const generation=this.generation;
  this.onConnection('Connexion au serveur…');
  try {
   const saved=savedOnlineToken();
   const token=saved || (await this.post('join')).token;
   if(generation!==this.generation){if(!saved)this.post('leave',{},token).catch(()=>{});return;}
   this.token=token;saveToken(token);
   const events=this.events=new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
   events.onopen=()=>{this.connected=true;this.onConnection('');};
   events.onmessage=event=>{if(generation===this.generation)this.onState(JSON.parse(event.data));};
   events.onerror=()=>{this.connected=false;this.onConnection('Connexion perdue · reconnexion en cours…');};
   // EventSource retries transient failures. A rejected session needs a new search.
   this.check=setInterval(async()=>{if(this.connected)return;try{const r=await fetch(`/api/session?token=${encodeURIComponent(token)}`);if(r.status===401 && generation===this.generation){this.stop(true);this.onConnection('Session expirée · cliquez sur Rechercher une partie.');}}catch{}},5000);
  }catch(error){if(generation===this.generation)this.onConnection(error.message);}
 }
 async move(move,ply) {
  if(this.pending||!this.connected)return;
  this.pending=true;
  try{await this.post('move',{...move,ply});}finally{this.pending=false;}
 }
 stop(leave=false) {
  this.generation++;clearInterval(this.check);this.events?.close();this.events=null;this.connected=false;this.pending=false;
  if(leave && this.token){this.post('leave').catch(()=>{});saveToken(null);}
  this.token=null;
 }
}
