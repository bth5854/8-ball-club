const socket=io(),$=id=>document.getElementById(id),canvas=$("table"),ctx=canvas.getContext("2d");
const W=900,H=500,R=10,pockets=[[45,45],[450,40],[855,45],[45,455],[450,460],[855,455]];
let state=null,code=null,balls=[],drag=false,start=null,current=null;
const color={cue:"#f5f2e9",eight:"#151719",solid:"#e8bd48",stripe:"#4b91d2"};
socket.on("connect",()=>$("connection").innerHTML="<i></i> 서버 연결됨");
socket.on("disconnect",()=>$("connection").textContent="연결 끊김");
socket.on("errorMessage",toast);
socket.on("state",s=>{state=s;code=s.code;balls=s.balls.map(b=>({...b}));$("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("codeLabel").textContent=code;const me=s.players.find(p=>p.id===socket.id),op=s.players.find(p=>p.id!==socket.id);$("meName").textContent=me?.name||"나";$("opName").textContent=op?.name||"입장 대기";const my=s.turn===socket.id;$("turnLabel").textContent=s.status==="finished"?(s.winner===socket.id?"승리":"패배"):(s.status==="waiting"?"친구 대기":my?"내 차례":"상대 차례");$("status").textContent=s.status==="finished"?(s.winner===socket.id?"🎉 승리!":"이번 판은 졌어."):(s.notice||"게임 중");$("help").textContent=s.ballInHand===socket.id?"테이블에서 흰 공을 놓을 위치를 선택해.":s.status==="waiting"?"초대 코드를 친구에게 보내줘.":my?"흰 공을 뒤로 당겼다가 놓으면 쳐져.":"상대가 샷을 준비하고 있어.";draw()});
$("create").onclick=()=>socket.emit("createRoom",$("nickname").value.trim()||"플레이어");
$("join").onclick=()=>socket.emit("joinRoom",{code:$("roomCode").value,name:$("nickname").value.trim()||"플레이어"});
$("copy").onclick=()=>{if(navigator.clipboard)navigator.clipboard.writeText(code);toast("초대 코드 "+code+" 복사 완료")};
$("reset").onclick=()=>{$("game").classList.add("hidden");$("lobby").classList.remove("hidden");state=null;code=null};
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");setTimeout(()=>$("toast").classList.remove("show"),2300)}
function draw(){
 ctx.clearRect(0,0,W,H);const g=ctx.createLinearGradient(0,30,0,470);g.addColorStop(0,"#18714f");g.addColorStop(1,"#0d5038");ctx.fillStyle=g;ctx.fillRect(30,30,840,440);
 ctx.strokeStyle="#8a6945";ctx.lineWidth=4;ctx.strokeRect(35,35,830,430);
 pockets.forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,20,0,Math.PI*2);ctx.fillStyle="#080d0b";ctx.fill();ctx.beginPath();ctx.arc(x-3,y-4,13,0,Math.PI*2);ctx.fillStyle="#101714";ctx.fill()});
 balls.forEach(b=>{if(b.pocketed)return;ctx.save();ctx.shadowColor="#06110b";ctx.shadowBlur=5;ctx.shadowOffsetY=2;ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fillStyle=color[b.type]||"#eee";ctx.fill();ctx.shadowColor="transparent";ctx.lineWidth=1;ctx.strokeStyle="#ffffffa8";ctx.stroke();if(b.type==="stripe"){ctx.beginPath();ctx.arc(b.x,b.y,6.2,0,Math.PI*2);ctx.fillStyle="#f5f5ef";ctx.fill()}if(b.id!==0){ctx.beginPath();ctx.arc(b.x,b.y,4,0,Math.PI*2);ctx.fillStyle="#f7f4e9";ctx.fill();ctx.fillStyle="#18201c";ctx.font="bold 6px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(b.id,b.x,b.y)}ctx.restore()});
 if(drag&&start&&current){const cue=balls[0];if(cue&&!cue.pocketed){const dx=start.x-current.x,dy=start.y-current.y;ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+dx*1.8,cue.y+dy*1.8);ctx.strokeStyle="#f6e3b9";ctx.lineWidth=3;ctx.stroke();const p=Math.min(1,Math.hypot(dx,dy)/130);ctx.fillStyle="#d5e99a";ctx.fillRect(50,480,130*p,5)}}
}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener("pointerdown",e=>{if(!state||state.status!=="playing"||state.turn!==socket.id)return;const p=point(e);if(state.ballInHand===socket.id){socket.emit("placeCue",p);return}const cue=balls[0];if(!cue||cue.pocketed||Math.hypot(p.x-cue.x,p.y-cue.y)>24)return;drag=true;start=p;current=p;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(drag){current=point(e);draw()}});
canvas.addEventListener("pointerup",e=>{if(!drag)return;drag=false;current=point(e);const dx=start.x-current.x,dy=start.y-current.y,dist=Math.hypot(dx,dy);if(dist>5)socket.emit("shoot",{angle:Math.atan2(dy,dx),power:Math.min(16,dist*.12)});draw()});
draw();
