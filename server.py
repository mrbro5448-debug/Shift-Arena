import asyncio, json, math, random, secrets, time, os
from pathlib import Path
from aiohttp import web, WSMsgType
ROOT=Path(__file__).parent
R=5
TILES={(q,r):{'q':q,'r':r,'state':'safe'} for q in range(-R,R+1) for r in range(-R,R+1) if max(abs(q),abs(r),abs(-q-r))<=R}
# axial hex centers, pointy top, hex size 1.35
SIZE=1.35
POSITIONS={(q,r):(SIZE*math.sqrt(3)*(q+r/2),SIZE*1.5*r) for q,r in TILES}
SPAWNS=[(7.3*math.cos(i*math.pi/4),7.3*math.sin(i*math.pi/4)) for i in range(8)]
rooms={}

def nearest_tile(x,y):return min(POSITIONS,key=lambda k:(POSITIONS[k][0]-x)**2+(POSITIONS[k][1]-y)**2)
def new_room(code,practice=False):
 room={'code':code,'players':{},'clients':{},'practice':practice,'phase':'lobby','start':0,'tiles':{},'event':-1,'winner':None,'last':time.monotonic(),'host':None};rooms[code]=room;return room

def add_player(room,ws,name,bot=False):
 ids=set(room['players']); pid=next(i for i in range(8) if i not in ids)
 x,y=SPAWNS[pid];p={'id':pid,'name':(name or 'Shifter')[:18],'x':x,'y':y,'alive':True,'jump':0.,'cooldown':0.,'input':[0,0],'bot':bot,'survival':0.,'angle':0.,'disconnect':False}
 room['players'][pid]=p
 if ws:
  room['clients'][ws]=pid
  if room['host'] is None:room['host']=pid
 return pid

def start(room):
 room['phase']='playing';room['start']=time.monotonic();room['tiles']={k:'safe' for k in TILES};room['event']=-1;room['winner']=None
 for p in room['players'].values():
  p['x'],p['y']=SPAWNS[p['id']];p.update(alive=True,jump=0.,cooldown=0.,survival=0.)

def apply_shift(room,step):
 rng=random.Random(17831+step*991)
 active=[k for k,v in room['tiles'].items() if v!='gone']
 # Always preserve center and at least 2/3 of available tiles each wave; no irreversible unsafe tiles in first 2 waves
 candidates=[k for k in active if max(abs(k[0]),abs(k[1]),abs(-k[0]-k[1]))>=max(1,5-step)]
 rng.shuffle(candidates)
 count=min(len(candidates),[9,12,14,16,18][step])
 for k in candidates[:count]:room['tiles'][k]='warning'
 room['collapse_at']=time.monotonic()+2.0

def snapshot(room):
 elapsed=min(60,max(0,time.monotonic()-room['start'])) if room['phase']!='lobby' else 0
 return {'type':'state','code':room['code'],'phase':room['phase'],'time':round(elapsed,1),'players':[{k:v for k,v in p.items() if k in ('id','name','x','y','alive','jump','bot','survival')} for p in room['players'].values()],'tiles':[[q,r,room['tiles'].get((q,r),'safe')] for q,r in TILES], 'winner':room['winner'],'count':len([p for p in room['players'].values() if not p['bot']]),'host':room['host']}

async def broadcast(room):
 msg=json.dumps(snapshot(room))
 for ws in list(room['clients']):
  if not ws.closed:
   try:await ws.send_str(msg)
   except Exception:pass

async def tick_loop(app):
 while True:
  await asyncio.sleep(1/20)
  now=time.monotonic()
  for code,room in list(rooms.items()):
   dt=min(.08,now-room['last']);room['last']=now
   if room['phase']=='playing':
    elapsed=now-room['start']; step=min(4,int(elapsed//10)-1)
    if step>=0 and step>room['event']:
     room['event']=step;apply_shift(room,step)
    if room.get('collapse_at') and now>=room['collapse_at']:
     for k,v in list(room['tiles'].items()):
      if v=='warning':room['tiles'][k]='gone'
     room['collapse_at']=0
    alive=[p for p in room['players'].values() if p['alive']]
    for p in alive:
     if p['bot']:
      safe=[(x,y) for k,(x,y) in POSITIONS.items() if room['tiles'][k]=='safe' and (x*x+y*y)<100]
      if safe:
       target=min(safe,key=lambda pos:(pos[0]-p['x'])**2+(pos[1]-p['y'])**2 + random.random()*2)
       dx,dy=target[0]-p['x'],target[1]-p['y'];mag=math.hypot(dx,dy)
       p['input']=[dx/max(mag,1),dy/max(mag,1)]
       if mag<.5:p['input']=[0,0]
     ix,iy=p['input'];mag=max(1,math.hypot(ix,iy));speed=4.2
     p['x']+=ix/mag*speed*dt;p['y']+=iy/mag*speed*dt
     p['jump']=max(0,p['jump']-dt);p['cooldown']=max(0,p['cooldown']-dt)
     p['survival']=min(60,elapsed)
     tile=nearest_tile(p['x'],p['y']);tx,ty=POSITIONS[tile]
     if math.hypot(p['x'],p['y'])>12.2 or (room['tiles'][tile]=='gone' and p['jump']<=0 and math.hypot(p['x']-tx,p['y']-ty)<1.25):p['alive']=False
    alive=[p for p in room['players'].values() if p['alive']]
    if elapsed>=60 or len(alive)<=1:
     ranked=sorted(room['players'].values(),key=lambda p:(p['alive'],p['survival'],-math.hypot(p['x'],p['y']),-p['id']),reverse=True)
     room['winner']=ranked[0]['id'] if ranked else None;room['phase']='ended'
   await broadcast(room)
   if not room['clients'] and room['phase']!='playing':rooms.pop(code,None)

async def ws_handler(request):
 ws=web.WebSocketResponse(heartbeat=20);await ws.prepare(request)
 room=None;pid=None
 try:
  async for msg in ws:
   if msg.type!=WSMsgType.TEXT:continue
   try:d=json.loads(msg.data)
   except:continue
   typ=d.get('type')
   if typ=='join' and room is None:
    practice=bool(d.get('practice'));code=str(d.get('code','')).upper().strip()[:6]
    if practice:code=secrets.token_hex(3).upper()
    if not code:code=secrets.token_hex(3).upper()
    room=rooms.get(code) or new_room(code,practice)
    if room['phase']!='lobby' or len(room['players'])>=8:
     await ws.send_json({'type':'error','message':'Room full or already playing'});room=None;continue
    pid=add_player(room,ws,str(d.get('name','Player')))
    await ws.send_json({'type':'joined','id':pid,'code':code})
    if practice:
     for i in range(7):add_player(room,None,'BOT '+str(i+1),True)
     start(room)
    elif len(room['players'])==8:
     start(room)
   elif typ=='start' and room is not None and room['phase']=='lobby' and pid==room['host']:
    human_count=sum(not p['bot'] for p in room['players'].values())
    if human_count<2:
     await ws.send_json({'type':'error','message':'Invite at least one friend before starting.'})
    else:
     for i in range(8-len(room['players'])):add_player(room,None,'BOT '+str(i+1),True)
     start(room)
   elif typ=='input' and room is not None and pid in room['players']:
    p=room['players'][pid]
    try:x=float(d.get('x',0));y=float(d.get('y',0))
    except:continue
    if math.isfinite(x) and math.isfinite(y):p['input']=[max(-1,min(1,x)),max(-1,min(1,y))]
    if d.get('jump') and p['alive'] and p['cooldown']<=0:
     p['jump']=.7;p['cooldown']=1.15
   elif typ=='restart' and room is not None and room['phase']=='ended' and room['practice']:
    start(room)
 finally:
  if room is not None:
   room['clients'].pop(ws,None)
   if pid in room['players']:
    if room['phase']=='lobby':
     room['players'].pop(pid,None)
     if room['host']==pid:room['host']=next((i for i,p in room['players'].items() if not p['bot']),None)
    else:room['players'][pid]['alive']=False;room['players'][pid]['disconnect']=True
 return ws

async def root(request):return web.FileResponse(ROOT/'index.html')
async def startup(app):app['loop_task']=asyncio.create_task(tick_loop(app))
async def cleanup(app):app['loop_task'].cancel()
app=web.Application();app.router.add_get('/',root);app.router.add_get('/ws',ws_handler);app.router.add_static('/static',ROOT/'static');app.on_startup.append(startup);app.on_cleanup.append(cleanup)
if __name__=='__main__':
 print('SHIFT ARENA at http://localhost:8765');web.run_app(app,host='0.0.0.0',port=int(os.environ.get('PORT','8765')))
