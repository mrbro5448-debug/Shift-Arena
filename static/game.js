const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');let W=0,H=0,scale=1,state=null,myId=-1,ws=null,phase='menu',room='',input={x:0,y:0},jumpQueued=false,localPractice=false,keys={};
const $=id=>document.getElementById(id),show=(id,on)=>$(id).classList.toggle('hidden',!on);
function resize(){W=canvas.width=innerWidth*devicePixelRatio;H=canvas.height=innerHeight*devicePixelRatio;scale=Math.min(W/30,H/22)}addEventListener('resize',resize);resize();
function connect(practice){localPractice=practice;show('menu',false);show('result',false);$('error').textContent='';const protocol=location.protocol==='https:'?'wss':'ws';ws=new WebSocket(`${protocol}://${location.host}/ws`);ws.onopen=()=>ws.send(JSON.stringify({type:'join',practice,name:$('name').value,code:$('code').value}));ws.onmessage=e=>{let d=JSON.parse(e.data);if(d.type==='error'){if(phase==='lobby'){$('lobbyHint').textContent=d.message}else{show('menu',true);$('error').textContent=d.message}return}if(d.type==='joined'){myId=d.id;room=d.code;return}if(d.type==='state'){state=d;setPhase(d.phase);$('timer').textContent=Math.max(0,Math.ceil(60-d.time));$('players').textContent=d.players.filter(p=>p.alive).length+' ALIVE';$('roomCode').textContent='ROOM '+d.code;$('lobbyCode').textContent=d.code;$('lobbyCount').textContent=d.count+' / 8 PLAYERS';$('lobbyNames').textContent=d.players.filter(p=>!p.bot).map(p=>(p.id===d.host?'★ ':'')+p.name).join(' · ');show('startMatch',d.phase==='lobby'&&myId===d.host&&d.count>=2);$('lobbyHint').textContent=myId===d.host?(d.count>=2?'Ready! Start when your friends have joined.':'Invite at least one friend to start.'):'Waiting for the room host to start…';if(d.phase==='playing')$('status').textContent=d.suddenDeath?'⚡ SUDDEN DEATH':d.laser?.warning?'⚠ LASER INCOMING':d.tiles.some(t=>t[2]==='warning')?'⚠ DANGER ZONES':'SURVIVE THE SHIFT';if(d.phase==='ended'){let win=d.players.find(p=>p.id===d.winner);$('resultTitle').textContent=d.winner===myId?'VICTORY!':'ELIMINATED';$('resultText').textContent='Winner: '+(win?.name||'Unknown')+' · '+d.time.toFixed(0)+' seconds';}}};ws.onclose=()=>{if(phase!=='ended'){show('menu',true);$('error').textContent='Disconnected. Rejoin to play.';setPhase('menu')}}}
function setPhase(p){if(phase===p)return;if(p!=='playing'&&typeof resetTouch==='function')resetTouch();phase=p;show('menu',p==='menu');show('lobby',p==='lobby');show('result',p==='ended');show('hud',p==='playing');show('controls',p==='playing');show('rotate',p==='playing');$('again').textContent=localPractice?'PLAY AGAIN':'NEW ONLINE ROOM'}
$('startMatch').onclick=()=>{if(ws?.readyState===1)ws.send(JSON.stringify({type:'start'}))};$('practice').onclick=()=>connect(true);$('online').onclick=()=>connect(false);$('again').onclick=()=>{if(localPractice&&ws?.readyState===1){ws.send(JSON.stringify({type:'restart'}))}else{ws?.close();connect(false)}};$('home').onclick=()=>{ws?.close();state=null;setPhase('menu')};
function send(){if(ws?.readyState===1&&phase==='playing'){let x=input.x+(keys.ArrowRight||keys.d?1:0)-(keys.ArrowLeft||keys.a?1:0),y=input.y+(keys.ArrowDown||keys.s?1:0)-(keys.ArrowUp||keys.w?1:0);ws.send(JSON.stringify({type:'input',x,y,jump:jumpQueued}));jumpQueued=false}}setInterval(send,50);
addEventListener('keydown',e=>{keys[e.key]=true;if(e.code==='Space'){jumpQueued=true;e.preventDefault()}});addEventListener('keyup',e=>keys[e.key]=false);
// Mobile Controls 2.0: pointer-safe floating thumb tracking, deadzone, and reliable jump taps.
const zone=$('stickZone'),base=$('stickBase'),knob=$('stickKnob'),jumpButton=$('jump');
let stickPointer=null,stickCenter=null,stickRadius=44;
const deadzone=.12;
function positionStick(e){
 if(!stickCenter)return;
 const dx=e.clientX-stickCenter.x,dy=e.clientY-stickCenter.y;
 const dist=Math.hypot(dx,dy),normalized=Math.min(1,dist/stickRadius);
 const magnitude=normalized<=deadzone?0:(normalized-deadzone)/(1-deadzone);
 const ux=dist?dx/dist:0,uy=dist?dy/dist:0;
 input.x=ux*magnitude;input.y=uy*magnitude;
 const displacement=Math.min(dist,stickRadius);
 knob.style.transform=`translate3d(${ux*displacement}px,${uy*displacement}px,0)`;
 zone.classList.toggle('active',magnitude>0);
}
function releaseStick(e){
 if(stickPointer===null||(e&&e.pointerId!==stickPointer))return;
 if(zone.hasPointerCapture?.(stickPointer))zone.releasePointerCapture(stickPointer);
 stickPointer=null;stickCenter=null;input.x=0;input.y=0;
 knob.style.transform='translate3d(0,0,0)';zone.classList.remove('active');
}
zone.addEventListener('pointerdown',e=>{
 if(stickPointer!==null||phase!=='playing')return;
 e.preventDefault();stickPointer=e.pointerId;
 const rect=base.getBoundingClientRect();
 stickCenter={x:rect.left+rect.width/2,y:rect.top+rect.height/2};
 stickRadius=Math.max(24,rect.width*.47);
 zone.setPointerCapture(e.pointerId);positionStick(e);
},{passive:false});
zone.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer){e.preventDefault();positionStick(e)}},{passive:false});
zone.addEventListener('pointerup',releaseStick);
zone.addEventListener('pointercancel',releaseStick);
zone.addEventListener('lostpointercapture',releaseStick);
function queueJump(e){
 if(phase!=='playing')return;
 e.preventDefault();jumpQueued=true;
 jumpButton.classList.add('pressed');
}
jumpButton.addEventListener('pointerdown',queueJump,{passive:false});
for(const event of ['pointerup','pointercancel','lostpointercapture'])jumpButton.addEventListener(event,()=>jumpButton.classList.remove('pressed'));
// Release stuck movement when a tab is hidden or loses focus.
function resetTouch(){releaseStick();jumpButton.classList.remove('pressed');input.x=0;input.y=0;keys={}}
addEventListener('blur',resetTouch);
document.addEventListener('visibilitychange',()=>{if(document.hidden)resetTouch()});
// Prevent touch gestures from scrolling/zooming during play.
for(const el of [zone,jumpButton])el.addEventListener('contextmenu',e=>e.preventDefault());
// Visual upgrade: purely client-side. Multiplayer and physics remain server-authoritative.
const SQ=Math.sqrt(3), TAU=Math.PI*2;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const particles=[],trails=new Map(),tileHistory=new Map();
let lastFrame=0,lastPhase='',lastSecond=-1,shake=0,flash=0,ambient=[];
const palette=['#4cf4f0','#bb83ff','#ff6dba','#ffc979'];
function pos(q,r){return [1.35*SQ*(q+r/2),1.35*1.5*r]}
function screen(x,y){return [W/2+x*scale,H*.52+y*scale*.72]}
function glow(color,blur){ctx.shadowColor=color;ctx.shadowBlur=blur*devicePixelRatio}
function poly(x,y,r,fill,stroke,line=1.5){ctx.beginPath();for(let i=0;i<6;i++){const a=Math.PI/3*i+Math.PI/6,X=x+r*Math.cos(a),Y=y+r*.72*Math.sin(a);i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)}ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=line*devicePixelRatio;ctx.stroke()}}
function burst(x,y,color,count=13){if(reducedMotion)return;for(let i=0;i<count&&particles.length<220;i++){let a=Math.random()*TAU,v=45+Math.random()*160;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.45+Math.random()*.6,max:1,size:1.3+Math.random()*3.3,color})}}
function bg(t){const g=ctx.createRadialGradient(W*.5,H*.47,5,W*.5,H*.47,Math.max(W,H)*.72);g.addColorStop(0,'#182250');g.addColorStop(.48,'#0c1533');g.addColorStop(1,'#030713');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 ctx.save();ctx.globalAlpha=.16;ctx.strokeStyle='#5263ac';ctx.lineWidth=devicePixelRatio;const step=Math.max(32,scale*2.1);for(let x=(t*.004)%step;x<W;x+=step){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<H;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore();
 if(!ambient.length||ambient.length!==55)ambient=Array.from({length:55},(_,i)=>({x:Math.random(),y:Math.random(),r:.5+Math.random()*1.7,phase:Math.random()*7}));ctx.save();for(let a of ambient){ctx.globalAlpha=.14+.2*(.5+.5*Math.sin(t*.001+a.phase));ctx.fillStyle='#a5baff';ctx.beginPath();ctx.arc(a.x*W,a.y*H,a.r*devicePixelRatio,0,TAU);ctx.fill()}ctx.restore();
 const cx=W/2,cy=H*.52;ctx.save();ctx.translate(cx,cy);ctx.rotate(t*.000035);for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(0,0,scale*(15+i*.6),scale*(11+i*.45),0,0,TAU);ctx.strokeStyle=i===0?'#44e9ec20':'#9976f514';ctx.lineWidth=(1+i*.6)*devicePixelRatio;ctx.stroke()}ctx.restore()}
function renderTiles(t){const tiles=state?.tiles||Array.from({length:11},(_,i)=>i-5).flatMap(q=>Array.from({length:11},(_,i)=>i-5).filter(r=>Math.max(Math.abs(q),Math.abs(r),Math.abs(-q-r))<=5).map(r=>[q,r,'safe']));
 for(const [q,r,status] of tiles){const key=q+','+r,old=tileHistory.get(key),[x,y]=pos(q,r),[sx,sy]=screen(x,y),rad=1.35*scale*.95; if(old==='warning'&&status==='gone')burst(sx,sy,'#ff628c',9);tileHistory.set(key,status);
 poly(sx,sy+Math.max(5,scale*.17),rad,'#060c1d','#1a2241',1);
 if(status==='gone'){poly(sx,sy,rad*.94,'#050b1a','#25264a',1);continue}
 const warn=status==='warning',pulse=.5+.5*Math.sin(t*.014+q+r),edge=warn?'#ff648a':'#3b7fcd',base=warn?(pulse>.5?'#7c294d':'#52223f'):'#172c56';
 ctx.save();glow(edge,warn?17:5);poly(sx,sy,rad,base,edge,warn?2.5:1.4);ctx.restore();
 poly(sx,sy,rad*.78,null,warn?'#ff9baf66':'#5ccce72e',.7);
 if(!warn){ctx.beginPath();ctx.moveTo(sx-rad*.25,sy-rad*.28);ctx.lineTo(sx+rad*.2,sy-rad*.28);ctx.strokeStyle='#91d7ff20';ctx.lineWidth=1.2*devicePixelRatio;ctx.stroke()}
 }
 const [cx,cy]=screen(0,0);ctx.save();glow('#ad7aff',25);ctx.beginPath();ctx.ellipse(cx,cy,scale*.8,scale*.58,0,0,TAU);ctx.strokeStyle='#ad8aff';ctx.lineWidth=2.5*devicePixelRatio;ctx.stroke();ctx.restore()}
function renderPlayers(t,dt){const ps=state?.players||[];const seen=new Set();for(const p of ps){if(!p.alive)continue;seen.add(p.id);const [x,y]=screen(p.x,p.y),me=p.id===myId,color=me?'#4ffbe0':p.bot?'#ffb968':palette[p.id%palette.length],jump=p.jump>0?Math.sin((.7-p.jump)/.7*Math.PI)*scale*.6:0;
 let trail=trails.get(p.id)||[];if(!reducedMotion&&(!trail.length||Math.hypot(x-trail[trail.length-1].x,y-trail[trail.length-1].y)>scale*.15)){trail.push({x,y,age:0});if(trail.length>9)trail.shift()}trail.forEach(a=>a.age+=dt);trail=trail.filter(a=>a.age<.45);trails.set(p.id,trail);
 ctx.save();trail.forEach((a,i)=>{ctx.globalAlpha=.12*(1-a.age/.45)*(i+1)/9;ctx.beginPath();ctx.arc(a.x,a.y-jump,scale*.34,0,TAU);ctx.fillStyle=color;ctx.fill()});ctx.restore();
 ctx.save();ctx.beginPath();ctx.ellipse(x,y+scale*.25,scale*.45,scale*.18,0,0,TAU);ctx.fillStyle='#02050fbb';ctx.fill();ctx.restore();
 ctx.save();glow(color,me?28:16);ctx.beginPath();ctx.arc(x,y-jump,scale*.43,0,TAU);const grad=ctx.createRadialGradient(x-scale*.15,y-jump-scale*.19,scale*.03,x,y-jump,scale*.5);grad.addColorStop(0,'#ffffff');grad.addColorStop(.18,color);grad.addColorStop(1,me?'#168f93':'#6449a1');ctx.fillStyle=grad;ctx.fill();ctx.lineWidth=(me?3:1.5)*devicePixelRatio;ctx.strokeStyle=me?'#e7ffff':'#ffffffb0';ctx.stroke();ctx.restore();
 ctx.save();ctx.textAlign='center';ctx.font=`700 ${Math.max(11,scale*.25)}px system-ui`;ctx.lineWidth=3*devicePixelRatio;ctx.strokeStyle='#040818';ctx.strokeText(p.name,x,y-jump-scale*.7);ctx.fillStyle=me?'#b9fff6':'#f3f4ff';ctx.fillText(p.name,x,y-jump-scale*.7);ctx.restore();
 if(me){ctx.save();ctx.beginPath();ctx.ellipse(x,y+scale*.25,scale*.62,scale*.28,0,0,TAU);ctx.strokeStyle='#6effed80';ctx.lineWidth=1.6*devicePixelRatio;ctx.stroke();ctx.restore()}}
 for(const id of trails.keys())if(!seen.has(id))trails.delete(id)}
function renderLaser(t){
 const l=state?.laser;if(!l||phase!=='playing')return;
 const a=l.angle,c=Math.cos(a),sn=Math.sin(a),length=11.4;
 const [x1,y1]=screen(-c*length,-sn*length),[x2,y2]=screen(c*length,sn*length);
 ctx.save();ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);
 ctx.strokeStyle=l.warning?'#ffb24c':'#ff497e';ctx.lineWidth=(l.warning?4:9)*devicePixelRatio;
 ctx.globalAlpha=l.warning?.45+.3*Math.sin(t*.02):.65;glow(l.warning?'#ffc268':'#ff3477',25);ctx.stroke();
 if(l.active){ctx.globalAlpha=.95;ctx.lineWidth=2.3*devicePixelRatio;ctx.strokeStyle='#ffe3f1';ctx.stroke()}
 ctx.restore();
}
function renderParticles(dt){ctx.save();ctx.globalCompositeOperation='lighter';for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.96;p.vy*=.96;ctx.globalAlpha=Math.min(1,p.life*1.5);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*devicePixelRatio,0,TAU);ctx.fill()}ctx.restore()}
function overlay(t){if(phase!=='playing'||!state)return;const remaining=60-state.time,warning=state.tiles.some(tile=>tile[2]==='warning');if(warning){const alpha=.05+.04*(.5+.5*Math.sin(t*.025));ctx.fillStyle=`rgba(255,50,105,${alpha})`;ctx.fillRect(0,0,W,H)}if(state.suddenDeath){ctx.save();ctx.textAlign='center';ctx.font=`900 ${Math.max(15,scale*.36)}px system-ui`;ctx.fillStyle='#ff6c9b';ctx.shadowColor='#ff3d6b';ctx.shadowBlur=16;ctx.fillText('⚡ SUDDEN DEATH',W/2,H*.115);ctx.restore()}if(remaining<=10){ctx.save();ctx.font=`900 ${Math.max(12,scale*.33)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ff7da8';ctx.shadowColor='#ff4b86';ctx.shadowBlur=15;ctx.fillText('FINAL SECONDS',W/2,H*.13);ctx.restore()}const me=state.players.find(p=>p.id===myId);if(me&&!me.alive){ctx.save();ctx.font=`900 ${Math.max(20,W*.026)}px system-ui`;ctx.fillStyle='#ff9bb5';ctx.textAlign='center';ctx.shadowColor='#e84677';ctx.shadowBlur=15;ctx.fillText('ELIMINATED · WATCH THE FINAL',W/2,H*.2);ctx.restore()}}
function draw(t){const dt=Math.min(.05,Math.max(0,(t-lastFrame)/1000||.016));lastFrame=t;ctx.clearRect(0,0,W,H);bg(t);if(phase!==lastPhase){if(phase==='playing'){tileHistory.clear();trails.clear();flash=.35}lastPhase=phase}
 ctx.save();if(shake>0&&!reducedMotion){ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);shake*=.88;if(shake<.3)shake=0}renderTiles(t);renderLaser(t);renderPlayers(t,dt);renderParticles(dt);ctx.restore();overlay(t);
 if(flash>0){ctx.fillStyle=`rgba(110,250,255,${Math.min(.13,flash*.22)})`;ctx.fillRect(0,0,W,H);flash=Math.max(0,flash-dt)}
 requestAnimationFrame(draw)}requestAnimationFrame(draw);
