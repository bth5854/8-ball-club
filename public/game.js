const socket=io({transports:["websocket","polling"],upgrade:true}),$=id=>document.getElementById(id),canvas=$("table"),ctx=canvas.getContext("2d",{alpha:false,desynchronized:true});
const W=900,H=500,R=10,pockets=[[45,45],[450,40],[855,45],[45,455],[450,460],[855,455]],colors={cue:"#f7f7ef",eight:"#17191d",solid:"#e9b949",stripe:"#4b91d2"};
let state=null,code=null,balls=[],drag=false,start=null,current=null,shotLocked=false,raf=0,predicted=null,localMax=false,showPath=true;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const isLocal=["localhost","127.0.0.1","::1"].includes(location.hostname);
if(isLocal){$("localTools").classList.remove("hidden");$("maxPower").addEventListener("change",e=>localMax=e.target.checked);$("showPath").addEventListener("change",e=>{showPath=e.target.checked;scheduleDraw()})}
socket.on("connect",()=>{$("connection").innerHTML="<i></i> 서버 연결됨";$("connection").classList.add("online")});
socket.on("disconnect",()=>{$("connection").textContent="연결 끊김";$("connection").classList.remove("online");shotLocked=false});
socket.on("errorMessage",t=>{shotLocked=false;toast(t)});
socket.on("state",s=>{
 state=s;code=s.code;balls=s.balls.map(b=>({...b}));shotLocked=!!s.shotInProgress;
 $("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("codeLabel").textContent=code;
 const me=s.players.find(p=>p.id===socket.id),op=s.players.find(p=>p.id!==socket.id),mine=s.turn===socket.id;
 $("meName").textContent=me?.name||"나";$("opName").textContent=op?.name||"입장 대기";
 $("turnLabel").textContent=s.status==="finished"?(s.winner===socket.id?"승리":"패배"):(s.status==="waiting"?"친구 대기":s.shotInProgress?"공 이동 중":mine?"내 차례":"상대 차례");
 $("turnLabel").className="turn "+(mine&&s.status==="playing"&&!s.shotInProgress?"my-turn":"");
 $("status").textContent=s.status==="finished"?(s.winner===socket.id?"🎉 승리!":"이번 판은 졌어."):(s.notice||"게임 중");
 const placing=s.ballInHand===socket.id;
 $("guideTitle").textContent=placing?"흰 공 배치 모드":s.shotInProgress?"샷 진행 중":mine?"내 차례 · 샷 준비":"상대 차례";
 $("guideText").textContent=placing?"테이블 안의 빈 곳을 한 번 클릭해 흰 공을 배치해. 배치하면 다시 잡을 수 없어.":s.shotInProgress?"공이 멈출 때까지 기다려 줘. 연속 입력은 잠겨 있어.":s.status==="waiting"?"초대 코드를 친구에게 보내고 입장을 기다려.":mine?"흰 공을 누른 채 뒤로 당겨. 점선은 예상 궤적, 아래 게이지는 타격 파워야.":"상대가 샷을 준비하고 있어. 네 차례가 되면 조준할 수 있어.";
 $("help").textContent=placing?"빈 위치를 한 번 클릭해 흰 공을 놓아줘.":s.status==="waiting"?"초대 코드를 친구에게 보내줘.":mine?"흰 공을 뒤로 당겼다가 놓으면 쳐져.":"상대가 샷을 준비하고 있어.";
 predicted=null;drag=false;scheduleDraw();
});
$("create").onclick=()=>socket.emit("createRoom",$("nickname").value.trim()||"플레이어");
$("join").onclick=()=>{const c=$("roomCode").value.trim().toUpperCase();if(c.length!==6){toast("초대 코드 6자리를 입력해줘.");return}socket.emit("joinRoom",{code:c,name:$("nickname").value.trim()||"플레이어"})};
$("roomCode").addEventListener("input",e=>e.target.value=e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,6));
$("copy").onclick=async()=>{if(!code)return;try{await navigator.clipboard.writeText(code);toast("초대 코드 "+code+" 복사 완료")}catch{toast("초대 코드: "+code)}};
$("reset").onclick=()=>{$("game").classList.add("hidden");$("lobby").classList.remove("hidden");state=null;code=null;drag=false;predicted=null;scheduleDraw()};
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.remove("show"),2300)}
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r)}
// Draw the felt and rails once; subsequent frames only blit this cached layer.
const tableLayer=document.createElement("canvas");tableLayer.width=W;tableLayer.height=H;const tctx=tableLayer.getContext("2d");
function buildTable(){
 const c=tctx;c.clearRect(0,0,W,H);const wood=c.createLinearGradient(0,0,W,H);wood.addColorStop(0,"#bd8a55");wood.addColorStop(.3,"#63412b");wood.addColorStop(.65,"#9a6840");wood.addColorStop(1,"#3d291f");c.fillStyle=wood;rr(c,8,8,884,484,25);c.fill();c.strokeStyle="#e1b783";c.lineWidth=2;rr(c,12,12,876,476,21);c.stroke();c.fillStyle="#183c2e";rr(c,25,25,850,450,17);c.fill();const cloth=c.createLinearGradient(0,30,0,470);cloth.addColorStop(0,"#16795a");cloth.addColorStop(.5,"#0d694c");cloth.addColorStop(1,"#084b39");c.fillStyle=cloth;rr(c,39,39,822,422,12);c.fill();
 c.save();c.globalAlpha=.055;c.strokeStyle="#d4f0d9";for(let x=55;x<855;x+=24){c.beginPath();c.moveTo(x,48);c.lineTo(x,452);c.stroke()}c.restore();c.save();c.globalAlpha=.2;c.strokeStyle="#e3f4e9";c.setLineDash([5,7]);c.beginPath();c.moveTo(245,48);c.lineTo(245,452);c.stroke();c.restore();
 for(let i=0;i<9;i++){const x=105+i*86.25;for(const y of [29,471]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle="#e7c89c";c.fillRect(-3,-3,6,6);c.restore()}}
 for(let i=0;i<5;i++){const y=105+i*72.5;for(const x of [29,871]){c.save();c.translate(x,y);c.rotate(Math.PI/4);c.fillStyle="#e7c89c";c.fillRect(-3,-3,6,6);c.restore()}}
 pockets.forEach(([x,y])=>{const g=c.createRadialGradient(x-4,y-5,2,x,y,23);g.addColorStop(0,"#020706");g.addColorStop(.7,"#070e0c");g.addColorStop(1,"#263a30");c.beginPath();c.arc(x,y,22,0,Math.PI*2);c.fillStyle=g;c.fill();c.strokeStyle="#b18a5d";c.lineWidth=2;c.stroke()});
}buildTable();
function drawBall(b){if(b.pocketed)return;ctx.save();ctx.shadowColor="#00150d";ctx.shadowBlur=5;ctx.shadowOffsetY=2;const g=ctx.createRadialGradient(b.x-4,b.y-5,1,b.x,b.y,R+1),base=colors[b.type]||"#eee";if(b.type==="stripe"||b.type==="cue"){g.addColorStop(0,"#fff");g.addColorStop(.7,b.type==="cue"?"#f2f0e8":"#f4f1e8");g.addColorStop(1,"#c9c9c1")}else{g.addColorStop(0,"#fff0b2");g.addColorStop(.3,base);g.addColorStop(1,b.type==="eight"?"#030405":"#17202a")}ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowColor="transparent";ctx.lineWidth=.8;ctx.strokeStyle="#ffffffaa";ctx.stroke();if(b.type==="stripe"){ctx.beginPath();ctx.arc(b.x,b.y,6.7,0,Math.PI*2);ctx.fillStyle="#f7f6ed";ctx.fill()}if(b.id!==0){ctx.beginPath();ctx.arc(b.x,b.y,4.5,0,Math.PI*2);ctx.fillStyle="#f7f5eb";ctx.fill();ctx.fillStyle="#172019";ctx.font="bold 6px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(b.id,b.x,b.y+.2)}ctx.beginPath();ctx.ellipse(b.x-3.5,b.y-4,2.5,1.4,-.5,0,Math.PI*2);ctx.fillStyle="#ffffff99";ctx.fill();ctx.restore()}
function predict(angle,power){
 const sim=balls.map(b=>({...b})),cue=sim.find(b=>b.id===0);if(!cue||cue.pocketed)return null;cue.vx=Math.cos(angle)*power;cue.vy=Math.sin(angle)*power;
 const cuePath=[],targetPath=[];let firstHit=null,steps=0,pocketed=[];
 for(;steps<420;steps++){
  let moving=false;
  for(const b of sim){if(b.pocketed)continue;b.x+=b.vx;b.y+=b.vy;b.vx*=.992;b.vy*=.992;if(Math.hypot(b.vx,b.vy)<.055){b.vx=0;b.vy=0}else moving=true;if(b.x<48){b.x=48;b.vx=Math.abs(b.vx)*.88}if(b.x>852){b.x=852;b.vx=-Math.abs(b.vx)*.88}if(b.y<48){b.y=48;b.vy=Math.abs(b.vy)*.88}if(b.y>452){b.y=452;b.vy=-Math.abs(b.vy)*.88}for(const [px,py] of pockets){if(Math.hypot(b.x-px,b.y-py)<21){b.pocketed=true;b.vx=b.vy=0;break}}}
  for(let i=0;i<sim.length;i++)for(let j=i+1;j<sim.length;j++){const a=sim[i],b=sim[j];if(a.pocketed||b.pocketed)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>0&&d<20){const nx=dx/d,ny=dy/d,ov=(20-d)/2;a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;if(rel>0){a.vx-=rel*nx;a.vy-=rel*ny;b.vx+=rel*nx;b.vy+=rel*ny}if((a.id===0||b.id===0)&&firstHit===null)firstHit=a.id===0?b.id:a.id}}
  if(steps%4===0){cuePath.push([cue.x,cue.y]);if(firstHit!==null){const target=sim.find(b=>b.id===firstHit);if(target&&!target.pocketed)targetPath.push([target.x,target.y])}}
  if(!moving&&steps>2)break;
 }
 return {cuePath,targetPath,firstHit};
}
function strokePath(points,color,width,dash){if(!points||points.length<2)return;ctx.save();ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dash||[]);ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();ctx.restore()}
function drawAim(){
 if(!drag||!start||!current||!state||state.turn!==socket.id||shotLocked)return;const cue=balls.find(b=>b.id===0);if(!cue||cue.pocketed)return;const dx=start.x-current.x,dy=start.y-current.y,dist=Math.hypot(dx,dy),power=localMax?16:clamp(dist*.12,1,16),p=clamp(dist/130,0,1);if(dist<2)return;
 if(showPath&&predicted){strokePath(predicted.cuePath,"#9af4d0dd",3,[8,6]);strokePath(predicted.targetPath,"#ffd36add",3,[5,5]);if(predicted.firstHit!==null){const target=balls.find(b=>b.id===predicted.firstHit);if(target){ctx.beginPath();ctx.arc(target.x,target.y,15,0,Math.PI*2);ctx.strokeStyle="#ffd36a";ctx.lineWidth=1.5;ctx.stroke()}}}
 const a=Math.atan2(dy,dx),len=clamp(90+dist*1.3,90,230);ctx.save();ctx.setLineDash([5,7]);ctx.lineWidth=1.5;ctx.strokeStyle="#fff7d9bb";ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+Math.cos(a)*len,cue.y+Math.sin(a)*len);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(cue.x,cue.y,15,0,Math.PI*2);ctx.strokeStyle="#e9f6d8aa";ctx.stroke();rr(ctx,330,475,240,9,5);ctx.fillStyle="#071a12";ctx.fill();const pg=ctx.createLinearGradient(330,0,570,0);pg.addColorStop(0,"#8ccf8b");pg.addColorStop(1,"#e5d77a");rr(ctx,332,477,236*p,5,3);ctx.fillStyle=pg;ctx.fill();ctx.fillStyle="#e9f4e8";ctx.font="700 10px sans-serif";ctx.textAlign="center";ctx.fillText("POWER · "+Math.round(power/16*100)+"%",450,468);ctx.restore();
}
function drawPlacement(){if(!state||state.ballInHand!==socket.id)return;ctx.save();ctx.strokeStyle="#a8f4d7aa";ctx.lineWidth=2;ctx.setLineDash([6,6]);rr(ctx,65,65,770,370,10);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle="#d9fff0";ctx.font="bold 13px sans-serif";ctx.textAlign="center";ctx.fillText("빈 곳을 클릭해 흰 공 배치",450,82);ctx.restore()}
function draw(){raf=0;ctx.drawImage(tableLayer,0,0);if(drag)drawAim();drawPlacement();balls.forEach(drawBall)}
function scheduleDraw(){if(!raf)raf=requestAnimationFrame(draw)}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener("pointerdown",e=>{if(!state||state.status!=="playing"||state.turn!==socket.id||shotLocked)return;const p=point(e);if(state.ballInHand===socket.id){socket.emit("placeCue",p);return}const cue=balls.find(b=>b.id===0);if(!cue||cue.pocketed||Math.hypot(p.x-cue.x,p.y-cue.y)>25)return;drag=true;start=p;current=p;predicted=null;canvas.setPointerCapture(e.pointerId);scheduleDraw()});
canvas.addEventListener("pointermove",e=>{if(!drag)return;current=point(e);const dx=start.x-current.x,dy=start.y-current.y,dist=Math.hypot(dx,dy);predicted=dist>5?predict(Math.atan2(dy,dx),localMax?16:clamp(dist*.12,1,16)):null;scheduleDraw()});
function release(e){if(!drag)return;drag=false;const p=point(e),dx=start.x-p.x,dy=start.y-p.y,dist=Math.hypot(dx,dy);if(dist>5&&!shotLocked){shotLocked=true;socket.emit("shoot",{angle:Math.atan2(dy,dx),power:localMax?16:clamp(dist*.12,1,16)})}start=null;current=null;predicted=null;scheduleDraw()}
canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);scheduleDraw();
