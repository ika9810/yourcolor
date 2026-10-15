'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const W=960,H=1200,canvas=(w=W,h=H)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const copy=value=>JSON.parse(JSON.stringify(value)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const assets=JSON.parse($('asset-data').textContent),projects={};
const titles={straight:'PIXEL STRETCH / 01',fan:'PIXEL STRETCH / 02',curve:'PIXEL STRETCH / 03'};
let active='car',picking=false,comparison=false,gesture=null,frame=0,brushMode='keep',brushSize=60,worker=null,jobId=0,importId=0;
const jobs=new Map(),P=()=>projects[active],S=()=>P().state;
const point=(x,y)=>({x,y});
const directions={up:{label:'위로',angle:0},down:{label:'아래로',angle:180},left:{label:'왼쪽으로',angle:-90},right:{label:'오른쪽으로',angle:90}};
function axes(s){const horizontal=s.direction==='left'||s.direction==='right';return {horizontal,cross:horizontal?H:W,depth:horizontal?W:H}}
// Work in a single coordinate system: u runs along the sampled line;
// v is the distance inward from the edge towards which the pixels stretch.
function toLocal(pt,s){switch(s.direction){case 'down':return point(pt.x,H-pt.y);case 'left':return point(pt.y,pt.x);case 'right':return point(pt.y,W-pt.x);default:return pt}}
function toWorld(pt,s){switch(s.direction){case 'down':return point(pt.x,H-pt.y);case 'left':return point(pt.y,pt.x);case 'right':return point(W-pt.y,pt.x);default:return pt}}
function sourceDepth(s){return toLocal(point(s.source.x*W,s.source.y*H),s).y}
function setSourceDepth(s,depth){const a=axes(s),pos=toLocal(point(s.source.x*W,s.source.y*H),s),world=toWorld(point(pos.x,clamp(depth,a.depth*.03,a.depth*.98)),s);s.source={x:world.x/W,y:world.y/H}}

function initial(key){return {effect:key==='custom'?null:'straight',amount:0,length:86,direction:'up',x:0,background:'photo',source:{x:.5,y:key==='portrait'?.51:key==='car'?.68:key==='flower'?.35:.55},subject:true,strokes:[]}}
function prepare(key,img){
 const base=canvas(),c=base.getContext('2d');c.fillStyle='#e2e1d8';c.fillRect(0,0,W,H);
 // Fill the 4:5 artwork without letterboxing or distorting the source photo.
 // Segmentation and pixel sampling use this same crop so their coordinates agree.
 const scale=Math.max(W/img.width,H/img.height),bounds={x:(W-img.width*scale)/2,y:(H-img.height*scale)/2,w:img.width*scale,h:img.height*scale};
 c.drawImage(img,bounds.x,bounds.y,bounds.w,bounds.h);
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
    if(P()===p){sync();queue();renderThumbnails();if($('mask-dialog').open)renderMask()}if(typeof renderReview==='function')renderReview();
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
 c.globalCompositeOperation='source-over';p.maskPixels=c.getImageData(0,0,W,H).data;p.maskRevision=(p.maskRevision||0)+1;const f=p.protected.getContext('2d');f.clearRect(0,0,W,H);f.globalCompositeOperation='source-over';f.drawImage(p.base,0,0);f.globalCompositeOperation='destination-in';f.drawImage(p.mask,0,0);f.globalCompositeOperation='source-over';
 const t=p.tint.getContext('2d');t.clearRect(0,0,W,H);t.globalCompositeOperation='source-over';t.drawImage(p.mask,0,0);t.globalCompositeOperation='source-in';t.fillStyle='#9c90ed';t.fillRect(0,0,W,H);t.globalCompositeOperation='source-over';
}
// Extract a real horizontal row or vertical column, preserving source order
// and transparent gaps in the mask. Direction changes never rerun the model.
function sourceStrip(p){
 updateMask(p);const s=p.state,a=axes(s),index=clamp(Math.round(a.horizontal?s.source.x*W:s.source.y*H),1,a.depth-1);
 const stamp=`${a.horizontal?'column':'row'}:${index}:${s.direction}:${p.maskRevision}`;
 if(p.stripStamp===stamp)return p.strip;
 p.stripStamp=stamp;let left=a.cross,right=-1;
 const pixel=i=>(a.horizontal?i*W+index:index*W+i)*4;
 if(p.maskReady||s.strokes.length){
  for(let u=0;u<a.cross;u++)if(p.maskPixels[pixel(u)+3]>96){left=Math.min(left,u);right=u}
 }
 if(right-left<3){p.strip=null;return null}
 const width=right-left+1,strip=canvas(width,1),ctx=strip.getContext('2d'),data=ctx.createImageData(width,1);
 for(let u=0;u<width;u++){
  const i=pixel(left+u),j=u*4;
  data.data[j]=p.pixels[i];data.data[j+1]=p.pixels[i+1];data.data[j+2]=p.pixels[i+2];
  data.data[j+3]=clamp((p.maskPixels[i+3]-64)/128,0,1)*255;
 }
 const y=s.direction==='down'||s.direction==='right'?a.depth-index:index;
 ctx.putImageData(data,0,0);p.strip={image:strip,left,right,width,y,cx:(left+right)/2};return p.strip;
}
function sectionAt(s,strip,t){
 const amount=s.amount/100,spread=s.effect==='straight'?0:amount*(s.effect==='fan'?1.6:1.05);
 const expand=s.effect==='fan'?t*t*(3-2*t):t;
 const width=strip.width*(1+spread*expand),length=strip.y*s.length/100;
 const shift=s.effect==='curve'?(Math.sin(t*Math.PI*.7)*axes(s).cross*.24+s.x*axes(s).cross*.28*t)*amount:0;
 return {x:strip.cx+shift-width/2,y:strip.y-length*t,width};
}
function stretch(ctx,p){
 const strip=sourceStrip(p);if(!strip)return;const s=p.state,length=strip.y*s.length/100;
 ctx.save();ctx.imageSmoothingEnabled=false;
 switch(s.direction){case 'down':ctx.transform(1,0,0,-1,0,H);break;case 'left':ctx.transform(0,1,1,0,0,0);break;case 'right':ctx.transform(0,1,-1,0,W,0);break}

 if(s.effect==='straight')ctx.drawImage(strip.image,strip.left,strip.y-length,strip.width,length+1);
 else{
  // A row-by-row warp keeps the bottom row exactly attached to the sampled pixels.
  const rows=Math.ceil(length);
  for(let row=0;row<rows;row++){const q=sectionAt(s,strip,row/rows);ctx.drawImage(strip.image,q.x,q.y-length/rows,q.width,length/rows+1)}
 }
 ctx.restore();
}
function syncGuide(){
 const p=P(),s=p.state,strip=sourceStrip(p),svg=$('source-guide'),a=axes(s);
 if(comparison||!s.effect){svg.innerHTML='';return}
 const y=strip?.y??sourceDepth(s),left=strip?.left??a.cross*.25,right=strip?.right??a.cross*.75,cx=strip?.cx??a.cross*.5;
 const start=toWorld(point(left,y),s),end=toWorld(point(right,y),s),root=toWorld(point(cx,y),s);
 const line=`<path d="M${start.x} ${start.y}L${end.x} ${end.y}" stroke="#101810" stroke-width="7"/><path d="M${start.x} ${start.y}L${end.x} ${end.y}" stroke="#dff5bf" stroke-width="3" stroke-dasharray="8 6"/><circle cx="${root.x}" cy="${root.y}" r="17" fill="#dff5bf" stroke="#263320" stroke-width="3"/>`;
 if(picking){const lx=clamp(root.x,130,W-130),ly=clamp(root.y+52,115,H-70);svg.innerHTML=line+`<rect x="${lx-120}" y="${ly-25}" width="240" height="44" rx="22" fill="#172113db"/><text x="${lx}" y="${ly+4}" text-anchor="middle" fill="#f5ffe8" font-size="25" stroke="none">피사체의 색을 선택</text>`;return}
 if(!strip){svg.innerHTML='';return}
 const tip=sectionAt(s,strip,1),tipWorld=toWorld(point(tip.x+tip.width/2,tip.y),s),tx=clamp(tipWorld.x,34,W-34),ty=clamp(tipWorld.y,90,H-70);
 svg.innerHTML=line+`<path d="M${root.x} ${root.y}L${tx} ${ty}" stroke="#ffffff66" stroke-width="2" stroke-dasharray="6 10"/><circle cx="${tx}" cy="${ty}" r="29" fill="#f2f6e8" stroke="#152315" stroke-width="2"/><path d="M0 12V-12m-8 8 8-8 8 8" transform="translate(${tx} ${ty}) rotate(${directions[s.direction].angle})" stroke="#263320" stroke-width="3"/>`;
 svg.dataset.direction=s.direction;svg.dataset.sourceX=root.x.toFixed(0);svg.dataset.sourceY=root.y.toFixed(0);svg.dataset.sourceStart=left.toFixed(0);svg.dataset.sourceEnd=right.toFixed(0);svg.dataset.tipX=tipWorld.x.toFixed(0);svg.dataset.tipY=tipWorld.y.toFixed(0);
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
 if(hasMask)stretch(ctx,p);
 if(hasMask&&s.subject)ctx.drawImage(p.protected,0,0);
 ctx.globalAlpha=.25;ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,W,H);ctx.restore();
}
function queue(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render()})}
function render(){if(!P())return;const started=performance.now();draw($('art'),P(),comparison||picking);$('art').dataset.renderMs=(performance.now()-started).toFixed(1);if($('mask-dialog').open)renderMask();}
function renderThumbnails(){const p=P();if(!p)return;for(const key of ['straight','fan','curve']){const preview={...p,state:{...p.state,effect:key,amount:key==='straight'?0:65,x:0}};draw($('thumb-'+key),preview)}}
function sync(){
 if(!P())return;const p=P(),s=p.state,busy=['queued','loading','running'].includes(p.status);
 $$('[data-project]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.project===active));$$('[data-effect]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.effect===s.effect));$$('[data-background]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.background===s.background));
 $('amount').value=s.amount;$('amount-value').value=Math.round(s.amount);$('amount').style.setProperty('--fill',s.amount+'%');$('amount').disabled=!s.effect||s.effect==='straight';$('amount-label').textContent=s.effect==='curve'?'휘어지는 정도':'끝부분 펼침';
 $('length').value=s.length;$('length-value').value=Math.round(s.length);$('length').style.setProperty('--fill',s.length+'%');$('length').disabled=!s.effect;
 $$('button[data-direction]').forEach(b=>{b.setAttribute('aria-pressed',b.dataset.direction===s.direction);b.disabled=!s.effect});
 $('stage').dataset.axis=axes(s).horizontal?'horizontal':'vertical';
 $('stage').classList.toggle('light',s.background!=='ink'||!s.effect||picking||comparison);$('stage').classList.toggle('picking',picking);$('stage').classList.toggle('interacted',p.interacted||picking||comparison||!s.effect);
 $('art-label').textContent=comparison||picking||!s.effect?'ORIGINAL / YOUR PHOTO':titles[s.effect];$('art-number').textContent=s.effect?'STUDY 0'+(['straight','fan','curve'].indexOf(s.effect)+1)+' / '+s.effect.toUpperCase():'YOUR ORIGINAL';
 $('undo').disabled=!p.history.length;$('redo').disabled=!p.future.length;$('reset').disabled=!s.effect;
 $('compare').setAttribute('aria-pressed',comparison);$('pick-color').setAttribute('aria-pressed',picking);$('pick-color').textContent=picking?'시작선 선택 완료 ✓':'시작선 바꾸기 ↗';$('pick-color').disabled=!s.effect;
 const strip=sourceStrip(p);
 $('drag-hint').textContent=picking?'피사체에서 색을 가져올 선을 골라주세요.':!s.effect?'모양을 고른 뒤 방향을 선택해보세요.':!strip&&p.maskReady?'시작선을 피사체 위로 옮겨주세요.':`화살표는 길이 · 연두색 점은 시작선. ${axes(s).horizontal?'좌우':'위아래'}로 끌어요.`;
 $('touch-surface').setAttribute('aria-valuenow',Math.round(s.length));$('touch-surface').setAttribute('aria-valuetext',`${directions[s.direction].label} 늘린 길이 ${Math.round(s.length)}%`);
 $('touch-surface').setAttribute('aria-orientation',axes(s).horizontal?'horizontal':'vertical');$('touch-surface').setAttribute('aria-label',`사진을 ${directions[s.direction].label} 끌어 스트레치 길이 조절`);
 $('model-status').textContent=busy?(p.status==='loading'?'피사체 준비 중…':'피사체 찾는 중…'):p.status==='error'?'분리 재시도 ↗':p.maskReady?'✓ 피사체 · 다듬기':'피사체 선택 ↗';$('model-status').dataset.status=p.status;
 $('mask-status').textContent=busy?'이 기기에서 피사체를 찾고 있어요.':p.status==='error'?'분리에 실패했어요. 다시 찾거나 직접 칠해주세요.':p.maskReady?`피사체 선택 완료 · ${(p.elapsed/1000).toFixed(1)}초`:'보호할 영역을 칠해주세요.';
 $('detect').disabled=busy;$('subject-toggle').setAttribute('aria-checked',s.subject);$('subject-toggle').lastElementChild.textContent=s.subject?'켜짐':'꺼짐';
 syncGuide();
}
function remember(before){const p=P();if(JSON.stringify(before)===JSON.stringify(p.state))return;p.history.push(before);if(p.history.length>30)p.history.shift();p.future=[];sync();queue()}
function mutate(fn){const before=copy(S());fn(S());remember(before)}
function selectProject(key){if(!projects[key])return;finishGesture();active=key;picking=comparison=false;sync();render();renderThumbnails();if(P().status==='idle')startSegmentation()}
function chooseEffect(effect){picking=comparison=false;mutate(s=>{s.effect=effect;s.x=0;s.amount=effect==='straight'?0:65});P().interacted=false;sync();queue()}
function coords(e,element){const r=element.getBoundingClientRect();return point(clamp((e.clientX-r.left)/r.width*W,0,W),clamp((e.clientY-r.top)/r.height*H,0,H))}
$('touch-surface').onpointerdown=e=>{
 if(!P()||!S().effect||e.button>0)return;e.preventDefault();comparison=false;
 const pt=coords(e,$('touch-surface')),local=toLocal(pt,S()),strip=sourceStrip(P()),onSource=strip&&Math.hypot(local.x-strip.cx,local.y-strip.y)<55;
 gesture={kind:picking?'pick':onSource?'source':'art',id:e.pointerId,before:copy(S()),origin:local};$('touch-surface').setPointerCapture(e.pointerId);
 if(picking)S().source={x:clamp(pt.x/W,.03,.98),y:clamp(pt.y/H,.03,.98)};
 P().interacted=true;sync();queue();
};
$('touch-surface').onpointermove=e=>{
 if(!gesture||gesture.id!==e.pointerId)return;const pt=coords(e,$('touch-surface')),local=toLocal(pt,S());
 if(gesture.kind==='pick')S().source={x:clamp(pt.x/W,.03,.98),y:clamp(pt.y/H,.03,.98)};
 else if(gesture.kind==='source'){
  const before=gesture.before,depth=sourceDepth(before),tip=depth*(1-before.length/100);
  setSourceDepth(S(),depth+local.y-gesture.origin.y);
  S().length=clamp((1-tip/Math.max(1,sourceDepth(S())))*100,0,100);
 }else{S().length=clamp(gesture.before.length-(local.y-gesture.origin.y)/Math.max(1,sourceDepth(S()))*100,0,100);if(S().effect==='curve')S().x=clamp(gesture.before.x+(local.x-gesture.origin.x)/(axes(S()).cross*.4),-1,1)}
 sync();queue();
};
function finishGesture(cancel=false){if(!gesture)return;const g=gesture;gesture=null;if(cancel){P().state=g.before;sync();queue()}else{remember(g.before);if(g.kind==='pick'){picking=false;P().interacted=true;sync();queue()}renderThumbnails()}}
$('touch-surface').onpointerup=()=>finishGesture();$('touch-surface').onpointercancel=()=>finishGesture(true);$('touch-surface').onlostpointercapture=()=>finishGesture();
$('touch-surface').onkeydown=e=>{
 if(!S().effect||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
 const dx=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0,dy=e.key==='ArrowDown'?1:e.key==='ArrowUp'?-1:0;P().interacted=true;
 mutate(s=>{if(picking){s.source.x=clamp(s.source.x+dx*.016,.03,.98);s.source.y=clamp(s.source.y+dy*.016,.03,.98)}else{
  const origin=toLocal(point(0,0),s),move=toLocal(point(dx,dy),s);s.length=clamp(s.length-(move.y-origin.y)*4,0,100);if(s.effect==='curve')s.x=clamp(s.x+(move.x-origin.x)*.08,-1,1);
 }})
};
$$('button[data-direction]').forEach(b=>b.onclick=()=>{finishGesture();picking=comparison=false;mutate(s=>{s.direction=b.dataset.direction;s.x=0});sync();queue();renderThumbnails()});
$$('[data-project]').forEach(b=>b.onclick=()=>selectProject(b.dataset.project));$$('[data-effect]').forEach(b=>b.onclick=()=>chooseEffect(b.dataset.effect));$$('[data-background]').forEach(b=>b.onclick=()=>{mutate(s=>s.background=b.dataset.background);renderThumbnails()});
let rangeBefore=null;
for(const key of ['amount','length']){
 $(key).onpointerdown=()=>rangeBefore=copy(S());$(key).oninput=e=>{if(!rangeBefore)rangeBefore=copy(S());S()[key]=+e.target.value;P().interacted=true;sync();queue()};
 $(key).onchange=finishRange;$(key).onpointerup=finishRange;$(key).onblur=finishRange;$(key).onpointercancel=finishRange;
}
function finishRange(){if(rangeBefore){remember(rangeBefore);rangeBefore=null;renderThumbnails()}}
$('pick-color').onclick=()=>{picking=!picking;comparison=false;sync();queue()};$('compare').onclick=()=>{comparison=!comparison;picking=false;sync();queue()};
$('undo').onclick=()=>{const p=P();if(!p.history.length)return;p.future.push(copy(p.state));p.state=p.history.pop();sync();queue();renderThumbnails()};$('redo').onclick=()=>{const p=P();if(!p.future.length)return;p.history.push(copy(p.state));p.state=p.future.pop();sync();queue();renderThumbnails()};$('reset').onclick=()=>mutate(s=>{s.x=0;s.length=86;s.amount=s.effect==='straight'?0:65});
function renderMask(){const p=P();updateMask(p);const c=$('mask-canvas').getContext('2d');c.save();c.clearRect(0,0,480,600);c.scale(.5,.5);c.filter='grayscale(1)';c.globalAlpha=.45;c.drawImage(p.base,0,0);c.filter='none';c.globalAlpha=1;c.drawImage(p.protected,0,0);c.globalAlpha=.33;c.drawImage(p.tint,0,0);c.restore()}
$('model-status').onclick=()=>{$('mask-dialog').showModal();sync();renderMask()};$('detect').onclick=()=>startSegmentation();
$('brush-keep').onclick=()=>setBrush('keep');$('brush-erase').onclick=()=>setBrush('erase');function setBrush(mode){brushMode=mode;$('brush-keep').setAttribute('aria-pressed',mode==='keep');$('brush-erase').setAttribute('aria-pressed',mode==='erase')}
$('brush-size').oninput=e=>brushSize=+e.target.value;$('brush-clear').onclick=()=>{mutate(s=>s.strokes=[]);renderMask()};$('subject-toggle').onclick=()=>mutate(s=>s.subject=!s.subject);
let maskGesture=null;$('mask-touch').onpointerdown=e=>{if(e.button>0)return;e.preventDefault();maskGesture={id:e.pointerId,before:copy(S())};$('mask-touch').setPointerCapture(e.pointerId);S().strokes.push({mode:brushMode,size:brushSize,points:[coords(e,$('mask-touch'))]});S().subject=true;renderMask();queue()};
$('mask-touch').onpointermove=e=>{if(!maskGesture||e.pointerId!==maskGesture.id)return;const pt=coords(e,$('mask-touch')),pts=S().strokes.at(-1).points,last=pts.at(-1);if(Math.hypot(pt.x-last.x,pt.y-last.y)>3)pts.push(pt);renderMask();queue()};
function finishMask(cancel=false){if(!maskGesture)return;const before=maskGesture.before;maskGesture=null;if(cancel){P().state=before;sync();queue()}else remember(before);renderThumbnails()}
$('mask-touch').onpointerup=()=>{finishMask();syncGuide()};$('mask-touch').onpointercancel=()=>finishMask(true);$('mask-touch').onlostpointercapture=()=>finishMask();
$$('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$$('dialog').forEach(d=>{d.onclick=e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}});
$('save-open').onclick=()=>{draw($('save-canvas'),P());$('save-dialog').showModal()};$('about-open').onclick=()=>$('about').showModal();$('font').onchange=e=>document.documentElement.style.setProperty('--font',e.target.value);
$('import-photo').onclick=()=>$('file-input').click();$('file-input').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>30*1024*1024){toast('30MB 이하의 JPG, PNG, WebP를 골라주세요');e.target.value='';return}const token=++importId;
 try{const decoded=await createImageBitmap(file,{imageOrientation:'from-image'}),r=Math.min(1,1600/Math.max(decoded.width,decoded.height)),small=canvas(Math.round(decoded.width*r),Math.round(decoded.height*r));small.getContext('2d').drawImage(decoded,0,0,small.width,small.height);decoded.close();if(token!==importId)return;
 projects.custom=prepare('custom',small);let b=document.querySelector('[data-project=custom]');if(!b){b=document.createElement('button');b.dataset.project='custom';b.setAttribute('aria-label','내 사진 선택');b.innerHTML='<img alt="내가 가져온 사진"><span>내 사진</span>';b.onclick=()=>selectProject('custom');$('photo-list').append(b)}b.querySelector('img').src=small.toDataURL('image/jpeg',.8);selectProject('custom');toast('사진을 가져왔어요. 모양과 방향을 골라 늘려보세요');
 }catch(error){console.warn(error);toast('사진을 열지 못했어요. 다른 JPG나 PNG로 시도해주세요')}finally{e.target.value=''}
};
$('download').onclick=()=>{draw($('save-canvas'),P());$('save-canvas').toBlob(blob=>{if(!blob){toast('이미지를 만들지 못했어요');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`yourcolor-${S().effect||'original'}-${Date.now()}.jpg`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('JPG 다운로드를 요청했어요')},'image/jpeg',.95)};
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

Promise.all(Object.entries(assets).map(async([key,url])=>{const img=new Image();img.src=url;await img.decode();projects[key]=prepare(key,img);$('photo-'+key).src=url})).then(async()=>{await document.fonts.load('800 142px Wanted');logo();sync();render();renderThumbnails();startSegmentation();document.body.dataset.ready='true';initializeV4()}).catch(error=>{console.error(error);toast('샘플을 불러오지 못했어요')});
