const socket=io(),$=id=>document.getElementById(id),canvas=$("table"),ctx=canvas.getContext("2d");
const W=900,H=500,R=10,pockets=[[45,45],[450,40],[855,45],[45,455],[450,460],[855,455]];
let state=null,code=null,balls=[],drag=false,start=null,current=null;
const colors={cue:"#f7f7ef",eight:"#17191d",solid:"#e9b949",stripe:"#4b91d2"};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
socket.on("connect",()=>{$("connection").innerHTML="<i></i> 서버 연결됨";$("connection").classList.add("online")});
socket.on("disconnect",()=>{$("connection").textContent="연결 끊김";$("connection").classList.remove("online")});
socket.on("errorMessage",toast);
socket.on("state",s=>{
 state=s;code=s.code;balls=s.balls.map(b=>({...b}));
 $("lobby").classList.add("hidden");$("game").classList.remove("hidden");$("codeLabel").textContent=code;
 const me=s.players.find(p=>p.id===socket.id),op=s.players.find(p=>p.id!==socket.id);
 $("meName").textContent=me?.name||"나";$("opName").textContent=op?.name||"입장 대기";
 const mine=s.turn===socket.id;
 $("turnLabel").textContent=s.status==="finished"?(s.winner===socket.id?"승리":"패배"):(s.status==="waiting"?"친구 대기":mine?"내 차례":"상대 차례");
 $("turnLabel").className="turn "+(mine&&s.status==="playing"?"my-turn":"");
 $("status").textContent=s.status==="finished"?(s.winner===socket.id?"🎉 승리!":"이번 판은 졌어."):(s.notice||"게임 중");
 $("help").textContent=s.ballInHand===socket.id?"테이블에서 흰 공을 놓을 위치를 선택해.":s.status==="waiting"?"초대 코드를 친구에게 보내줘.":mine?"흰 공을 뒤로 당겼다가 놓으면 쳐져.":"상대가 샷을 준비하고 있어.";
 draw();
});
$("create").onclick=()=>socket.emit("createRoom",$("nickname").value.trim()||"플레이어");
$("join").onclick=()=>{const c=$("roomCode").value.trim().toUpperCase();if(c.length!==6){toast("초대 코드 6자리를 입력해줘.");return}socket.emit("joinRoom",{code:c,name:$("nickname").value.trim()||"플레이어"})};
$("roomCode").addEventListener("input",e=>e.target.value=e.target.value.replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,6));
$("copy").onclick=async()=>{if(!code)return;try{await navigator.clipboard.writeText(code);toast("초대 코드 "+code+" 복사 완료")}catch{toast("초대 코드: "+code)}};
$("reset").onclick=()=>{$("game").classList.add("hidden");$("lobby").classList.remove("hidden");state=null;code=null;drag=false;draw()};
function toast(t){$("toast").textContent=t;$("toast").classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>$("toast").classList.remove("show"),2300)}
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawTable(){
 ctx.clearRect(0,0,W,H);
 const wood=ctx.createLinearGradient(0,0,W,H);wood.addColorStop(0,"#bd8a55");wood.addColorStop(.3,"#63412b");wood.addColorStop(.65,"#9a6840");wood.addColorStop(1,"#3d291f");
 ctx.fillStyle=wood;rr(8,8,884,484,25);ctx.fill();ctx.strokeStyle="#e1b783";ctx.lineWidth=2;rr(12,12,876,476,21);ctx.stroke();
 ctx.fillStyle="#183c2e";rr(25,25,850,450,17);ctx.fill();
 const cloth=ctx.createLinearGradient(0,30,0,470);cloth.addColorStop(0,"#16795a");cloth.addColorStop(.5,"#0d694c");cloth.addColorStop(1,"#084b39");
 ctx.fillStyle=cloth;rr(39,39,822,422,12);ctx.fill();
 ctx.save();ctx.globalAlpha=.07;ctx.strokeStyle="#d4f0d9";ctx.lineWidth=1;for(let x=55;x<855;x+=18){ctx.beginPath();ctx.moveTo(x,48);ctx.lineTo(x,452);ctx.stroke()}ctx.restore();
 ctx.save();ctx.globalAlpha=.22;ctx.strokeStyle="#e3f4e9";ctx.setLineDash([5,7]);ctx.beginPath();ctx.moveTo(245,48);ctx.lineTo(245,452);ctx.stroke();ctx.setLineDash([]);[[245,250],[610,250]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle="#e7f1e8";ctx.fill()});ctx.restore();
 for(let i=0;i<9;i++){const x=105+i*86.25;for(const y of [29,471]){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle="#e7c89c";ctx.fillRect(-3,-3,6,6);ctx.restore()}}
 for(let i=0;i<5;i++){const y=105+i*72.5;for(const x of [29,871]){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle="#e7c89c";ctx.fillRect(-3,-3,6,6);ctx.restore()}}
 pockets.forEach(([x,y])=>{const g=ctx.createRadialGradient(x-4,y-5,2,x,y,23);g.addColorStop(0,"#020706");g.addColorStop(.7,"#070e0c");g.addColorStop(1,"#263a30");ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.strokeStyle="#b18a5d";ctx.lineWidth=2;ctx.stroke()});
}
function drawBall(b){
 if(b.pocketed)return;ctx.save();ctx.shadowColor="#00150d";ctx.shadowBlur=9;ctx.shadowOffsetY=4;
 const g=ctx.createRadialGradient(b.x-4,b.y-5,1,b.x,b.y,R+1),base=colors[b.type]||"#eee";
 if(b.type==="stripe"||b.type==="cue"){g.addColorStop(0,"#fff");g.addColorStop(.7,b.type==="cue"?"#f2f0e8":"#f4f1e8");g.addColorStop(1,"#c9c9c1")}
 else{g.addColorStop(0,"#fff0b2");g.addColorStop(.3,base);g.addColorStop(1,b.type==="eight"?"#030405":"#17202a")}
 ctx.beginPath();ctx.arc(b.x,b.y,R,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();ctx.shadowColor="transparent";ctx.lineWidth=.8;ctx.strokeStyle="#ffffffaa";ctx.stroke();
 if(b.type==="stripe"){ctx.beginPath();ctx.arc(b.x,b.y,6.7,0,Math.PI*2);ctx.fillStyle="#f7f6ed";ctx.fill()}
 if(b.id!==0){ctx.beginPath();ctx.arc(b.x,b.y,4.5,0,Math.PI*2);ctx.fillStyle="#f7f5eb";ctx.fill();ctx.fillStyle="#172019";ctx.font="bold 6px sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(b.id,b.x,b.y+.2)}
 ctx.beginPath();ctx.ellipse(b.x-3.5,b.y-4,2.5,1.4,-.5,0,Math.PI*2);ctx.fillStyle="#ffffff99";ctx.fill();ctx.restore();
}
function drawAim(){
 if(!drag||!start||!current||!state||state.turn!==socket.id)return;
 const cue=balls.find(b=>b.id===0);if(!cue||cue.pocketed)return;
 const dx=start.x-current.x,dy=start.y-current.y,dist=Math.hypot(dx,dy),p=clamp(dist/130,0,1);if(dist<2)return;
 const a=Math.atan2(dy,dx),len=clamp(110+dist*1.8,110,330);ctx.save();ctx.setLineDash([7,8]);ctx.lineWidth=2;ctx.strokeStyle="#fff7d9cc";ctx.beginPath();ctx.moveTo(cue.x,cue.y);ctx.lineTo(cue.x+Math.cos(a)*len,cue.y+Math.sin(a)*len);ctx.stroke();ctx.setLineDash([]);
 ctx.beginPath();ctx.arc(cue.x,cue.y,15,0,Math.PI*2);ctx.strokeStyle="#e9f6d8aa";ctx.lineWidth=1;ctx.stroke();
 rr(330,475,240,9,5);ctx.fillStyle="#071a12";ctx.fill();const pg=ctx.createLinearGradient(330,0,570,0);pg.addColorStop(0,"#8ccf8b");pg.addColorStop(1,"#e5d77a");rr(332,477,236*p,5,3);ctx.fillStyle=pg;ctx.fill();ctx.fillStyle="#e9f4e8";ctx.font="700 10px sans-serif";ctx.textAlign="center";ctx.fillText("POWER",450,468);ctx.restore();
}
function draw(){drawTable();balls.forEach(drawBall);drawAim()}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*W/r.width,y:(e.clientY-r.top)*H/r.height}}
canvas.addEventListener("pointerdown",e=>{if(!state||state.status!=="playing"||state.turn!==socket.id)return;const p=point(e);if(state.ballInHand===socket.id){socket.emit("placeCue",p);return}const cue=balls.find(b=>b.id===0);if(!cue||cue.pocketed||Math.hypot(p.x-cue.x,p.y-cue.y)>25)return;drag=true;start=p;current=p;canvas.setPointerCapture(e.pointerId)});
canvas.addEventListener("pointermove",e=>{if(drag){current=point(e);draw()}});
function release(e){if(!drag)return;drag=false;current=point(e);const dx=start.x-current.x,dy=start.y-current.y,dist=Math.hypot(dx,dy);if(dist>5)socket.emit("shoot",{angle:Math.atan2(dy,dx),power:clamp(dist*.12,1,16)});start=null;current=null;draw()}
canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);draw();
