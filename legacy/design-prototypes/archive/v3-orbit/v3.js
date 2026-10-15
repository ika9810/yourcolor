'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const W=960,H=1200,canvas=(w=W,h=H)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const copy=value=>JSON.parse(JSON.stringify(value)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const assets=JSON.parse($('asset-data').textContent),projects={};
const titles={flow:'FLOW / 01',orbit:'ORBIT / 02',echo:'ECHO / 03'};
let active='portrait',picking=false,comparison=false,gesture=null,frame=0,brushMode='keep',brushSize=60,worker=null,jobId=0,importId=0;
const jobs=new Map(),P=()=>projects[active],S=()=>P().state;
const point=(x,y)=>({x,y}),mix=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
function initial(key){return {effect:key==='custom'?null:key==='portrait'?'orbit':'flow',amount:65,x:0,y:0,background:key==='flower'?'paper':'ink',source:{x:.5,y:key==='portrait'?.55:key==='car'?.78:key==='flower'?.26:.55},subject:true,strokes:[]}}
function prepare(key,img){
 const base=canvas(),c=base.getContext('2d');c.fillStyle='#e2e1d8';c.fillRect(0,0,W,H);
 let bounds={x:0,y:0,w:W,h:H};
 if(key==='custom'){
  const scale=Math.min(W/img.width,H/img.height);bounds={x:(W-img.width*scale)/2,y:(H-img.height*scale)/2,w:img.width*scale,h:img.height*scale};
  c.drawImage(img,bounds.x,bounds.y,bounds.w,bounds.h);
 }else{
  // Only sample placement uses its existing alpha. Every editable mask is inferred.
  const temp=canvas(img.width,img.height),t=temp.getContext('2d');t.drawImage(img,0,0);
  const rgba=t.getImageData(0,0,temp.width,temp.height).data;
  let minX=img.width,minY=img.height,maxX=0,maxY=0;
  for(let y=0;y<img.height;y+=3)for(let x=0;x<img.width;x+=3)if(rgba[(y*img.width+x)*4+3]>25){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
  minX=Math.max(0,minX-3);minY=Math.max(0,minY-3);maxX=Math.min(img.width,maxX+4);maxY=Math.min(img.height,maxY+4);
  const bw=maxX-minX,bh=maxY-minY,r=Math.min(W*(key==='car'?.88:.75)/bw,H*.88/bh);
  const dw=bw*r,dh=bh*r,dx=(W-dw)/2,dy=key==='car'?H*.92-dh:H-dh;
  c.drawImage(img,minX,minY,bw,bh,dx,dy,dw,dh);
 }
 return {key,base,bounds,pixels:c.getImageData(0,0,W,H).data,state:initial(key),fg:canvas(),mask:canvas(),protected:canvas(),tint:canvas(),maskStamp:null,maskReady:false,status:'idle',elapsed:0,history:[],future:[],interacted:false};
}
function startSegmentation(p=P()){
 if(!p||['queued','loading','running'].includes(p.status))return;
 const input=canvas(320,320);input.getContext('2d').drawImage(p.base,0,0,320,320);
 const pixels=input.getContext('2d').getImageData(0,0,320,320).data,id=++jobId;p.status='queued';
 try{
  if(!worker){worker=new Worker('./src/segment-worker.mjs',{type:'module'});worker.onmessage=({data})=>{
   const job=jobs.get(data.id);if(!job)return;const p=job.project;
   if(data.status==='ready'){
    clearTimeout(job.timer);jobs.delete(data.id);const a=new Uint8ClampedArray(data.alpha),small=canvas(320,320),ctx=small.getContext('2d'),im=ctx.createImageData(320,320);
    for(let i=0;i<a.length;i++){im.data[i*4]=im.data[i*4+1]=im.data[i*4+2]=255;im.data[i*4+3]=a[i]}
    ctx.putImageData(im,0,0);const f=p.fg.getContext('2d');f.clearRect(0,0,W,H);f.drawImage(small,0,0,W,H);
    p.maskReady=true;p.maskStamp=null;p.status='ready';p.elapsed=data.elapsed;
    if(P()===p){sync();queue();renderThumbnails();if($('mask-dialog').open)renderMask()}
   }else if(data.status==='error'){
    clearTimeout(job.timer);jobs.delete(data.id);p.status='error';console.warn('Subject segmentation:',data.message);if(P()===p){sync();toast('피사체를 찾지 못했어요. 보정 버튼에서 다시 시도해주세요')}
   }else{p.status=data.status;if(P()===p)sync()}
  };worker.onerror=()=>workerFailure();}
  const timer=setTimeout(workerFailure,90000);jobs.set(id,{project:p,timer});worker.postMessage({id,pixels:pixels.buffer},[pixels.buffer]);
 }catch(error){p.status='error';console.warn(error)}
 if(P()===p)sync();
}
function workerFailure(){for(const {project,timer}of jobs.values()){clearTimeout(timer);project.status='error'}jobs.clear();worker?.terminate();worker=null;sync();toast('분리를 완료하지 못했어요. 피사체 버튼에서 다시 시도해주세요')}
function updateMask(p){
 const stamp=JSON.stringify(p.state.strokes);if(stamp===p.maskStamp)return;p.maskStamp=stamp;
 const c=p.mask.getContext('2d');c.clearRect(0,0,W,H);c.globalCompositeOperation='source-over';c.drawImage(p.fg,0,0);
 for(const stroke of p.state.strokes){c.globalCompositeOperation=stroke.mode==='erase'?'destination-out':'source-over';c.strokeStyle=c.fillStyle='#fff';c.lineWidth=stroke.size;c.lineCap='round';c.lineJoin='round';c.beginPath();stroke.points.forEach((pt,i)=>i?c.lineTo(pt.x,pt.y):c.moveTo(pt.x,pt.y));c.stroke();if(stroke.points.length===1){c.beginPath();c.arc(stroke.points[0].x,stroke.points[0].y,stroke.size/2,0,Math.PI*2);c.fill()}}
 c.globalCompositeOperation='source-over';const f=p.protected.getContext('2d');f.clearRect(0,0,W,H);f.globalCompositeOperation='source-over';f.drawImage(p.base,0,0);f.globalCompositeOperation='destination-in';f.drawImage(p.mask,0,0);f.globalCompositeOperation='source-over';
 const t=p.tint.getContext('2d');t.clearRect(0,0,W,H);t.globalCompositeOperation='source-over';t.drawImage(p.mask,0,0);t.globalCompositeOperation='source-in';t.fillStyle='#9c90ed';t.fillRect(0,0,W,H);t.globalCompositeOperation='source-over';
}
function rgb(p,u){const s=p.state.source,xx=clamp(Math.round((s.x+(u-.5)*.7)*W),0,W-1),yy=clamp(Math.round(s.y*H),0,H-1),i=(yy*W+xx)*4;return [p.pixels[i],p.pixels[i+1],p.pixels[i+2]]}
function color(v,light=1){return `rgb(${v.map(n=>clamp(Math.round(n*light+(light>1?(light-1)*72:0)),0,255)).join(' ')})`}
function material(ctx,p,u,top=0,bottom=H){
 const col=rgb(p,u),g=ctx.createLinearGradient(0,top,W*.34,bottom);
 [[0,.60],[.19,1.1],[.29,1.65],[.35,.91],[.52,.48],[.64,1.15],[.76,1.55],[1,.64]].forEach(([at,light])=>g.addColorStop(at,color(col,light)));return g;
}
function cubic(p,t){const m=1-t;return point(m*m*m*p[0].x+3*m*m*t*p[1].x+3*m*t*t*p[2].x+t*t*t*p[3].x,m*m*m*p[0].y+3*m*m*t*p[1].y+3*m*t*t*p[2].y+t*t*t*p[3].y)}
function flowGeometry(s){
 const bx=s.x*230,by=s.y*160,k=s.amount/100;
 const first=[point(1060+bx,1280),point(290+bx,1100+by),point(-290+bx,140+by),point(530+bx,150+by)];
 const second=[first[3],point(1220-bx,120-by),point(720-bx,760+by),point(370-bx,520+by)];
 const pts=[];for(let j=0;j<=96;j++){const t=j/96;pts.push(cubic(t<.56?first:second,t<.56?t/.56:(t-.56)/.44))}
 return pts.map((pt,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(96,i+1)],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,t=i/96;
  const width=(75+k*165)*(.50+.5*Math.sin(t*Math.PI))*(.65+.35*Math.cos(t*4.4+s.x));return {pt,n:point(-dy/len,dx/len),width};});
}
function flow(ctx,p){const points=flowGeometry(p.state),N=170;
 for(let i=0;i<N;i++){const u=i/N,v=(i+1.2)/N;ctx.fillStyle=material(ctx,p,(i+.5)/N);ctx.beginPath();
  points.forEach(({pt,n,width},j)=>{const q=point(pt.x+n.x*(u-.5)*width*2,pt.y+n.y*(u-.5)*width*2);j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});
  for(let j=points.length-1;j>=0;j--){const {pt,n,width}=points[j];ctx.lineTo(pt.x+n.x*(v-.5)*width*2,pt.y+n.y*(v-.5)*width*2)}ctx.closePath();ctx.fill();
 }
}
function orbitPoint(s,u,angle){
 const k=s.amount/100,rx=250+210*k+(u-.5)*155,ry=150+120*k+(u-.5)*88;
 const rotation=-.32+s.x*.9,cx=W*.5+s.x*75,cy=H*.49+s.y*215;
 const x=rx*Math.cos(angle),y=ry*Math.sin(angle);return point(cx+x*Math.cos(rotation)-y*Math.sin(rotation),cy+x*Math.sin(rotation)+y*Math.cos(rotation));
}
function orbit(ctx,p,front){const s=p.state,N=155,K=70,start=front?0:Math.PI,end=front?Math.PI:Math.PI*2;
 for(let i=0;i<N;i++){const u=i/N,v=(i+1.2)/N;ctx.fillStyle=material(ctx,p,(i+.5)/N,100,1000);ctx.beginPath();for(let j=0;j<=K;j++){const q=orbitPoint(s,u,start+(end-start)*j/K);j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)}for(let j=K;j>=0;j--){const q=orbitPoint(s,v,start+(end-start)*j/K);ctx.lineTo(q.x,q.y)}ctx.closePath();ctx.fill();}
}
function echo(ctx,p){
 const s=p.state,k=s.amount/100,count=7,dir=s.x*1.25-.6,lift=s.y*.9-.16;
 for(let i=count;i>=1;i--){const t=i/count,scale=1-t*.33,angle=dir*t*.68,dx=Math.sin(dir*t*1.55)*W*.61*k,dy=(lift*t-.05)*H*k;
  ctx.save();ctx.translate(W*.5+dx,H*.77+dy);ctx.rotate(angle);ctx.scale(scale,scale);ctx.globalAlpha=.15+(1-t)*.64;ctx.drawImage(p.protected,-W*.5,-H*.77);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.12*(1-t);ctx.drawImage(p.tint,-W*.5,-H*.77);ctx.restore();
 }
}
const grain=canvas(128,128);{
 const ctx=grain.getContext('2d'),data=ctx.createImageData(128,128);let seed=719;
 for(let i=0;i<data.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=seed>>>24;data.data[i]=data.data[i+1]=data.data[i+2]=value;data.data[i+3]=28}ctx.putImageData(data,0,0);
}
function draw(target,p,original=false){
 const ctx=target.getContext('2d'),s=p.state;ctx.save();ctx.clearRect(0,0,target.width,target.height);ctx.scale(target.width/W,target.height/H);
 if(original||!s.effect){ctx.drawImage(p.base,0,0);ctx.restore();return}
 const ink=s.background==='ink';ctx.fillStyle=ink?'#101613':'#e7e2d5';ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(W*.45,H*.4,25,W*.5,H*.45,W*.76);glow.addColorStop(0,ink?'#35493a':'#fcf8ec');glow.addColorStop(1,ink?'#101613':'#ddd6c6');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);
 const hasMask=p.maskReady||s.strokes.length>0;updateMask(p);
 if(s.background==='photo'||!hasMask)ctx.drawImage(p.base,0,0);
 else if(!s.subject)ctx.drawImage(p.protected,0,0);
 if(s.effect==='flow')flow(ctx,p);
 else if(s.effect==='orbit')orbit(ctx,p,false);
 else if(s.effect==='echo'&&hasMask)echo(ctx,p);
 if(hasMask&&s.subject)ctx.drawImage(p.protected,0,0);
 if(s.effect==='orbit')orbit(ctx,p,true);
 ctx.globalAlpha=.25;ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,W,H);ctx.restore();
}
function queue(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render()})}
function render(){if(!P())return;const started=performance.now();draw($('art'),P(),comparison||picking);$('art').dataset.renderMs=(performance.now()-started).toFixed(1);if($('mask-dialog').open)renderMask();}
function renderThumbnails(){const p=P();if(!p)return;for(const key of ['flow','orbit','echo']){const preview={...p,state:{...p.state,effect:key,x:0,y:0}};draw($('thumb-'+key),preview)}}
function sync(){
 if(!P())return;const p=P(),s=p.state,busy=['queued','loading','running'].includes(p.status);
 $$('[data-project]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.project===active));$$('[data-effect]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.effect===s.effect));$$('[data-background]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.background===s.background));
 $('amount').value=s.amount;$('amount-value').value=s.amount;$('amount').style.setProperty('--fill',(s.amount-15)/85*100+'%');$('amount').disabled=!s.effect;
 $('stage').classList.toggle('light',s.background!=='ink'||!s.effect||picking||comparison);$('stage').classList.toggle('picking',picking);$('stage').classList.toggle('interacted',p.interacted||picking||comparison||!s.effect);
 $('art-label').textContent=comparison||picking||!s.effect?'ORIGINAL / YOUR PHOTO':titles[s.effect];$('art-number').textContent=s.effect?'STUDY 0'+(['flow','orbit','echo'].indexOf(s.effect)+1)+' / '+s.effect.toUpperCase():'YOUR ORIGINAL';
 $('undo').disabled=!p.history.length;$('redo').disabled=!p.future.length;$('reset').disabled=!s.effect;
 $('compare').setAttribute('aria-pressed',comparison);$('pick-color').setAttribute('aria-pressed',picking);$('pick-color').textContent=picking?'색을 고를 곳을 눌러주세요':'색 위치 바꾸기 ↗';$('pick-color').disabled=s.effect==='echo'||!s.effect;
 $('drag-hint').textContent=picking?'사진에서 마음에 드는 색을 톡 눌러주세요.':!s.effect?'아래에서 먼저 느낌을 골라주세요.':s.effect==='echo'?'끌어주는 방향으로 잔상이 퍼져요.':s.effect==='orbit'?'끌어서 궤도의 기울기와 위치를 바꿔요.':'끌어서 색의 흐름을 바꿔요.';
 $('touch-surface').setAttribute('aria-valuenow',Math.round(s.x*100));$('touch-surface').setAttribute('aria-valuetext',`좌우 ${Math.round(s.x*100)}, 상하 ${Math.round(s.y*100)}`);
 $('model-status').textContent=busy?(p.status==='loading'?'피사체 준비 중…':'피사체 찾는 중…'):p.status==='error'?'분리 재시도 ↗':p.maskReady?'✓ 피사체 · 다듬기':'피사체 선택 ↗';$('model-status').dataset.status=p.status;
 $('mask-status').textContent=busy?'이 기기에서 피사체를 찾고 있어요.':p.status==='error'?'분리에 실패했어요. 다시 찾거나 직접 칠해주세요.':p.maskReady?`피사체 선택 완료 · ${(p.elapsed/1000).toFixed(1)}초`:'보호할 영역을 칠해주세요.';
 $('detect').disabled=busy;$('subject-toggle').setAttribute('aria-checked',s.subject);$('subject-toggle').lastElementChild.textContent=s.subject?'켜짐':'꺼짐';
 const y=s.source.y*H,a=clamp((s.source.x-.35)*W,0,W),b=clamp((s.source.x+.35)*W,0,W);
 $('source-guide').innerHTML=picking?`<path d="M${a} ${y}H${b}" stroke="#fff" stroke-width="5"/><circle cx="${s.source.x*W}" cy="${y}" r="20" fill="#e3f7ca" stroke="#273927" stroke-width="3"/>`:'';
}
function remember(before){const p=P();if(JSON.stringify(before)===JSON.stringify(p.state))return;p.history.push(before);if(p.history.length>30)p.history.shift();p.future=[];sync();queue()}
function mutate(fn){const before=copy(S());fn(S());remember(before)}
function selectProject(key){if(!projects[key])return;finishGesture();active=key;picking=comparison=false;sync();render();renderThumbnails();if(P().status==='idle')startSegmentation()}
function chooseEffect(effect){picking=comparison=false;mutate(s=>{s.effect=effect;s.x=s.y=0});P().interacted=false;sync();queue()}
function coords(e,element){const r=element.getBoundingClientRect();return point(clamp((e.clientX-r.left)/r.width*W,0,W),clamp((e.clientY-r.top)/r.height*H,0,H))}
$('touch-surface').onpointerdown=e=>{if(!P()||!S().effect||e.button>0)return;e.preventDefault();comparison=false;const pt=coords(e,$('touch-surface'));gesture={kind:picking?'pick':'art',id:e.pointerId,before:copy(S()),origin:pt};$('touch-surface').setPointerCapture(e.pointerId);if(picking){S().source={x:pt.x/W,y:pt.y/H};sync();queue()}else{P().interacted=true;sync()}};
$('touch-surface').onpointermove=e=>{if(!gesture||gesture.id!==e.pointerId)return;const pt=coords(e,$('touch-surface'));if(gesture.kind==='pick')S().source={x:pt.x/W,y:pt.y/H};else{S().x=clamp(gesture.before.x+(pt.x-gesture.origin.x)/(W*.4),-1,1);S().y=clamp(gesture.before.y+(pt.y-gesture.origin.y)/(H*.4),-1,1)}sync();queue()};
function finishGesture(cancel=false){if(!gesture)return;const g=gesture;gesture=null;if(cancel){P().state=g.before;sync();queue()}else{remember(g.before);if(g.kind==='pick'){picking=false;P().interacted=true;sync();queue();renderThumbnails()}}}
$('touch-surface').onpointerup=()=>finishGesture();$('touch-surface').onpointercancel=()=>finishGesture(true);$('touch-surface').onlostpointercapture=()=>finishGesture();
$('touch-surface').onkeydown=e=>{if(!S().effect||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const dx=e.key==='ArrowRight'?.08:e.key==='ArrowLeft'?-.08:0,dy=e.key==='ArrowDown'?.08:e.key==='ArrowUp'?-.08:0;P().interacted=true;mutate(s=>{if(picking){s.source.x=clamp(s.source.x+dx*.2,0,1);s.source.y=clamp(s.source.y+dy*.2,0,1)}else{s.x=clamp(s.x+dx,-1,1);s.y=clamp(s.y+dy,-1,1)}})};
$$('[data-project]').forEach(b=>b.onclick=()=>selectProject(b.dataset.project));$$('[data-effect]').forEach(b=>b.onclick=()=>chooseEffect(b.dataset.effect));$$('[data-background]').forEach(b=>b.onclick=()=>{mutate(s=>s.background=b.dataset.background);renderThumbnails()});
let rangeBefore=null;$('amount').onpointerdown=()=>rangeBefore=copy(S());$('amount').oninput=e=>{if(!rangeBefore)rangeBefore=copy(S());S().amount=+e.target.value;P().interacted=true;sync();queue()};function finishRange(){if(rangeBefore){remember(rangeBefore);rangeBefore=null;renderThumbnails()}}$('amount').onchange=finishRange;$('amount').onpointerup=finishRange;$('amount').onblur=finishRange;$('amount').onpointercancel=finishRange;
$('pick-color').onclick=()=>{picking=!picking;comparison=false;sync();queue()};$('compare').onclick=()=>{comparison=!comparison;picking=false;sync();queue()};
$('undo').onclick=()=>{const p=P();if(!p.history.length)return;p.future.push(copy(p.state));p.state=p.history.pop();sync();queue();renderThumbnails()};$('redo').onclick=()=>{const p=P();if(!p.future.length)return;p.history.push(copy(p.state));p.state=p.future.pop();sync();queue();renderThumbnails()};$('reset').onclick=()=>mutate(s=>{s.x=s.y=0;s.amount=65});
function renderMask(){const p=P();updateMask(p);const c=$('mask-canvas').getContext('2d');c.save();c.clearRect(0,0,480,600);c.scale(.5,.5);c.filter='grayscale(1)';c.globalAlpha=.45;c.drawImage(p.base,0,0);c.filter='none';c.globalAlpha=1;c.drawImage(p.protected,0,0);c.globalAlpha=.33;c.drawImage(p.tint,0,0);c.restore()}
$('model-status').onclick=()=>{$('mask-dialog').showModal();sync();renderMask()};$('detect').onclick=()=>startSegmentation();
$('brush-keep').onclick=()=>setBrush('keep');$('brush-erase').onclick=()=>setBrush('erase');function setBrush(mode){brushMode=mode;$('brush-keep').setAttribute('aria-pressed',mode==='keep');$('brush-erase').setAttribute('aria-pressed',mode==='erase')}
$('brush-size').oninput=e=>brushSize=+e.target.value;$('brush-clear').onclick=()=>{mutate(s=>s.strokes=[]);renderMask()};$('subject-toggle').onclick=()=>mutate(s=>s.subject=!s.subject);
let maskGesture=null;$('mask-touch').onpointerdown=e=>{if(e.button>0)return;e.preventDefault();maskGesture={id:e.pointerId,before:copy(S())};$('mask-touch').setPointerCapture(e.pointerId);S().strokes.push({mode:brushMode,size:brushSize,points:[coords(e,$('mask-touch'))]});S().subject=true;renderMask();queue()};
$('mask-touch').onpointermove=e=>{if(!maskGesture||e.pointerId!==maskGesture.id)return;const pt=coords(e,$('mask-touch')),pts=S().strokes.at(-1).points,last=pts.at(-1);if(Math.hypot(pt.x-last.x,pt.y-last.y)>3)pts.push(pt);renderMask();queue()};
function finishMask(cancel=false){if(!maskGesture)return;const before=maskGesture.before;maskGesture=null;if(cancel){P().state=before;sync();queue()}else remember(before);renderThumbnails()}
$('mask-touch').onpointerup=()=>finishMask();$('mask-touch').onpointercancel=()=>finishMask(true);$('mask-touch').onlostpointercapture=()=>finishMask();
$$('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$$('dialog').forEach(d=>{d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}});
$('save-open').onclick=()=>{draw($('save-canvas'),P());$('save-dialog').showModal()};$('about-open').onclick=()=>$('about').showModal();$('font').onchange=e=>document.documentElement.style.setProperty('--font',e.target.value);
$('import-photo').onclick=()=>$('file-input').click();$('file-input').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>30*1024*1024){toast('30MB 이하의 JPG, PNG, WebP를 골라주세요');e.target.value='';return}const token=++importId;
 try{const decoded=await createImageBitmap(file,{imageOrientation:'from-image'}),r=Math.min(1,1600/Math.max(decoded.width,decoded.height)),small=canvas(Math.round(decoded.width*r),Math.round(decoded.height*r));small.getContext('2d').drawImage(decoded,0,0,small.width,small.height);decoded.close();if(token!==importId)return;
 projects.custom=prepare('custom',small);let b=document.querySelector('[data-project=custom]');if(!b){b=document.createElement('button');b.dataset.project='custom';b.setAttribute('aria-label','내 사진 선택');b.innerHTML='<img alt="내가 가져온 사진"><span>내 사진</span>';b.onclick=()=>selectProject('custom');$('photo-list').append(b)}b.querySelector('img').src=small.toDataURL('image/jpeg',.8);selectProject('custom');toast('사진을 가져왔어요. 아래에서 느낌을 골라보세요');
 }catch(error){console.warn(error);toast('사진을 열지 못했어요. 다른 JPG나 PNG로 시도해주세요')}finally{e.target.value=''}
};
$('download').onclick=()=>{draw($('save-canvas'),P());$('save-canvas').toBlob(blob=>{if(!blob){toast('이미지를 만들지 못했어요');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`yourcolor-${S().effect||'original'}-${Date.now()}.jpg`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('JPG 저장을 요청했어요')},'image/jpeg',.95)};
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3000)}
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!['INPUT','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$(e.shiftKey?'redo':'undo').click()}});
function logo(){
 // A single scan column of the colored 'o' is stretched inside the word.
 // The letter's bowl stays open; the word keeps its baseline and silhouette.
 const art=canvas(1080,180),c=art.getContext('2d');
 const font='800 142px Wanted';c.font=font;c.textBaseline='alphabetic';c.fillStyle='#23232b';
 const baseline=140,prefix='yourc',suffix='lor';c.fillText(prefix,8,baseline);
 const x=8+c.measureText(prefix).width+4;
 const glyph=canvas(100,180),g=glyph.getContext('2d');g.font=font;g.fillStyle='#fff';g.fillText('o',0,baseline);
 const colors=[[0,'#6631b5'],[.06,'#e6a0ba'],[.12,'#803994'],[.18,'#ef6d40'],[.25,'#e49b4a'],[.34,'#37243f'],[.52,'#e86030'],[.65,'#f6b273'],[.76,'#70356d'],[.82,'#ef502f'],[.88,'#ec9873'],[.94,'#b22f67'],[1,'#65339a']];
 const gradient=g.createLinearGradient(0,baseline-83,0,baseline+1);colors.forEach(([at,color])=>gradient.addColorStop(at,color));
 g.globalCompositeOperation='source-in';g.fillStyle=gradient;g.fillRect(0,0,100,180);g.globalCompositeOperation='source-over';
 const cut=Math.round(c.measureText('o').width/2),stretch=64;
 c.drawImage(glyph,0,0,cut,180,x,0,cut,180);
 c.imageSmoothingEnabled=false;c.drawImage(glyph,cut,0,1,180,x+cut,0,stretch,180);c.imageSmoothingEnabled=true;
 c.drawImage(glyph,cut,0,100-cut,180,x+cut+stretch,0,100-cut,180);
 const after=x+c.measureText('o').width+stretch+1;c.fillText(suffix,after,baseline);
 const width=after+c.measureText(suffix).width+10;
 for(const target of $$('.logo')){
  target.width=Math.ceil(width);target.height=160;const t=target.getContext('2d');t.drawImage(art,0,-10);
 }
}

Promise.all(Object.entries(assets).map(async([key,url])=>{const img=new Image();img.src=url;await img.decode();projects[key]=prepare(key,img);$('photo-'+key).src=url})).then(async()=>{await document.fonts.load('800 142px Wanted');logo();sync();render();renderThumbnails();startSegmentation();document.body.dataset.ready='true'}).catch(error=>{console.error(error);toast('샘플을 불러오지 못했어요')});
