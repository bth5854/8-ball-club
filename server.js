const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const crypto=require("crypto");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static("public"));
const rooms=new Map(), W=900,H=500;
const R=10, FRICTION=.992, STOP=.055, POCKETS=[[45,45],[450,40],[855,45],[45,455],[450,460],[855,455]];
const code=()=>crypto.randomBytes(3).toString("hex").toUpperCase();
function rack(){
 const b=[{id:0,x:245,y:250,vx:0,vy:0,r:R,type:"cue",pocketed:false}];
 const rows=[[0,0],[1,-.5],[1,.5],[2,-1],[2,0],[2,1],[3,-1.5],[3,-.5],[3,.5],[3,1.5],[4,-2],[4,-1],[4,0],[4,1],[4,2]];
 const ids=[1,9,2,10,8,3,11,4,12,5,13,6,14,7,15];
 rows.forEach(([c,y],i)=>{const id=ids[i];b.push({id,x:610+c*18,y:250+y*20,vx:0,vy:0,r:R,type:id===8?"eight":id<8?"solid":"stripe",pocketed:false})});
 return b;
}
function stopped(b){return b.every(x=>x.pocketed||(Math.abs(x.vx)<STOP&&Math.abs(x.vy)<STOP))}
function snapshot(r){return {code:r.code,players:r.players.map(id=>({id,name:r.names[id]})),balls:r.balls,turn:r.turn,status:r.status,winner:r.winner,groups:r.groups,ballInHand:r.ballInHand,notice:r.notice};}
function send(r){io.to(r.code).emit("state",snapshot(r))}
function roomFor(socket){for(const r of rooms.values())if(r.players.includes(socket.id))return r;return null}
function simulateShot(r, shooter, angle, power){
 let cue=r.balls.find(b=>b.id===0); cue.vx=Math.cos(angle)*power;cue.vy=Math.sin(angle)*power;
 const before=r.balls.map(b=>({...b})), pocketed=[];
 let steps=0;
 const tick=()=>{
  let moving=false;
  for(const b of r.balls){
   if(b.pocketed)continue;
   b.x+=b.vx;b.y+=b.vy;b.vx*=FRICTION;b.vy*=FRICTION;
   if(Math.hypot(b.vx,b.vy)<STOP){b.vx=0;b.vy=0}else moving=true;
   if(b.x<R+38){b.x=R+38;b.vx=Math.abs(b.vx)*.88}
   if(b.x>W-R-38){b.x=W-R-38;b.vx=-Math.abs(b.vx)*.88}
   if(b.y<R+38){b.y=R+38;b.vy=Math.abs(b.vy)*.88}
   if(b.y>H-R-38){b.y=H-R-38;b.vy=-Math.abs(b.vy)*.88}
   for(const [px,py] of POCKETS){if(Math.hypot(b.x-px,b.y-py)<21){b.pocketed=true;b.vx=b.vy=0;pocketed.push(b.id);break}}
  }
  for(let i=0;i<r.balls.length;i++)for(let j=i+1;j<r.balls.length;j++){
   const a=r.balls[i],b=r.balls[j];if(a.pocketed||b.pocketed)continue;
   let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>0&&d<2*R){const nx=dx/d,ny=dy/d,ov=(2*R-d)/2;a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){a.vx-=rel*nx;a.vy-=rel*ny;b.vx+=rel*nx;b.vy+=rel*ny}}
  }
  steps++;
  if(moving&&steps<1800){setTimeout(tick,16); if(steps%3===0)send(r);return}
  finish();
 };
 function finish(){
  const cueScratch=pocketed.includes(0);
  const objPocketed=pocketed.filter(id=>id>0);
  const eight=objPocketed.includes(8);
  let myGroup=r.groups[shooter], opponent=r.players.find(id=>id!==shooter);
  let foul=cueScratch;
  if(!r.assigned){
   const first=objPocketed.find(id=>id!==8);
   if(first){r.groups[shooter]=first<8?"solid":"stripe";r.groups[opponent]=first<8?"stripe":"solid";r.assigned=true;myGroup=r.groups[shooter]}
  }
  const ownPocketed=objPocketed.filter(id=>id!==8&&(!myGroup|| (myGroup==="solid"?id<8:id>8)));
  const remaining=r.balls.filter(b=>!b.pocketed&&b.id!==0&&b.id!==8&&(!myGroup||(myGroup==="solid"?b.id<8:b.id>8))).length;
  if(eight){
   if(remaining===0&&!cueScratch){r.status="finished";r.winner=shooter;r.notice="마지막 8번 공을 넣었어! 승리!"}
   else {r.status="finished";r.winner=opponent;r.notice="그룹 공을 다 넣기 전에 8번 공을 넣었어."}
  }else if(cueScratch){
   cue.pocketed=false;cue.x=245;cue.y=250;cue.vx=cue.vy=0;r.ballInHand=opponent;r.turn=opponent;r.notice="파울! 흰 공이 빠져 상대에게 공 배치권이 넘어갔어."
  }else{
   r.turn=ownPocketed.length>0?shooter:opponent;r.notice=ownPocketed.length>0?"자기 공을 넣었어. 한 번 더!":"상대 차례야.";
  }
  r.balls.forEach(b=>{b.vx=0;b.vy=0});
  send(r);
 }
 tick();
}
io.on("connection",socket=>{
 socket.on("createRoom",name=>{
  const c=code(),r={code:c,players:[socket.id],names:{[socket.id]:String(name||"플레이어 1").slice(0,12)},balls:rack(),turn:socket.id,status:"waiting",winner:null,groups:{},assigned:false,ballInHand:null,notice:"친구가 입장하면 게임이 시작돼."};
  rooms.set(c,r);socket.join(c);send(r);
 });
 socket.on("joinRoom",({code:c,name})=>{
  const r=rooms.get(String(c||"").toUpperCase());
  if(!r)return socket.emit("errorMessage","방 코드를 찾을 수 없어.");
  if(r.players.length>=2)return socket.emit("errorMessage","이미 두 명이 플레이 중이야.");
  r.players.push(socket.id);
  r.names[socket.id]=String(name||"플레이어 2").slice(0,12);

// 참가자도 Socket.IO 방에 입장
  socket.join(r.code);

  r.status="playing";
  r.notice="게임 시작! 흰 공을 당겨서 쳐 봐.";
  send(r);});
 socket.on("shoot",({angle,power})=>{
  const r=roomFor(socket);if(!r||r.status!=="playing"||r.turn!==socket.id||r.ballInHand)return;
  if(!Number.isFinite(angle)||!Number.isFinite(power))return;
  simulateShot(r,socket.id,angle,Math.max(1,Math.min(16,power)));
 });
 socket.on("placeCue",({x,y})=>{
  const r=roomFor(socket);if(!r||r.ballInHand!==socket.id||r.turn!==socket.id)return;
  x=Math.max(65,Math.min(835,Number(x)));y=Math.max(65,Math.min(435,Number(y)));
  const cue=r.balls[0];
  const overlap=r.balls.some(b=>b.id!==0&&!b.pocketed&&Math.hypot(b.x-x,b.y-y)<21);
  if(overlap)return socket.emit("errorMessage","다른 공과 겹치지 않는 곳에 놓아줘.");
  cue.x=x;cue.y=y;cue.pocketed=false;r.ballInHand=null;r.notice="흰 공을 배치했어. 이제 쳐 봐!";send(r);
 });
 socket.on("disconnect",()=>{
  const r=roomFor(socket);if(!r)return;
  r.players=r.players.filter(id=>id!==socket.id);
  if(!r.players.length)rooms.delete(r.code);
  else{r.status="waiting";r.turn=r.players[0];r.notice="상대가 나갔어. 방은 대기 상태야.";send(r)}
 });
});
const PORT=process.env.PORT||3000;server.listen(PORT, "0.0.0.0", () => {
 console.log("Pool server on " + PORT);
});