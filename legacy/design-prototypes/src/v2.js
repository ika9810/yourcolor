'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const W=960,H=1200, assetData=JSON.parse($('asset-data').textContent);
const projects={}, names={car:'Orange drive',portrait:'Blue muse',flower:'In bloom',custom:'My photo'};
let active='car',tool='warp',comparison=false,frame=0,gesture=null,brushMode='keep',brushSize=70,screen='editor',maskPreview=false;
let segmentWorker, segmentSerial=0;
const segmentJobs=new Map();
const copy=v=>JSON.parse(JSON.stringify(v)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const canvas=(w=W,h=H)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
const P=()=>projects[active], S=()=>P().state;
const point=(x,y)=>({x,y}),mix=(a,b,t)=>point(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);
function bezier(p,t){const m=1-t;return point(m*m*m*p[0].x+3*m*m*t*p[1].x+3*m*t*t*p[2].x+t*t*t*p[3].x,m*m*m*p[0].y+3*m*m*t*p[1].y+3*m*t*t*p[2].y+t*t*t*p[3].y)}
function recipe(s,kind){const a=copy(s.a),b=copy(s.b);s.preset=kind;s.spread=140;
 if(kind==='fan'){s.left=[a,point(300,670),point(160,340),point(-60,-45)];s.right=[b,point(690,690),point(820,290),point(1050,-45)];}
 if(kind==='wave'){s.left=[a,point(-260,540),point(950,410),point(150,-20)];s.right=[b,point(100,560),point(1510,320),point(980,-20)];}
 if(kind==='ribbon'){s.left=[a,point(-460,230),point(60,-340),point(940,320)];s.right=[b,point(120,780),point(290,80),point(940,630)];}
 if(kind==='straight'){s.left=[a,point(a.x,a.y*.67),point(a.x,a.y*.33),point(a.x,-20)];s.right=[b,point(b.x,b.y*.67),point(b.x,b.y*.33),point(b.x,-20)];}
}
function initial(key){let a,b;if(key==='car'){a=point(165,947);b=point(827,998);}else if(key==='portrait'){a=point(245,782);b=point(722,843);}else if(key==='flower'){a=point(345,439);b=point(646,524);}else{a=point(240,650);b=point(720,650)}const s={a,b,left:[],right:[],preset:'fan',spread:140,subject:true,strokes:[],axis:'horizontal'};recipe(s,key==='portrait'?'ribbon':key==='flower'?'wave':'fan');return s}
function prepare(key,img){const base=canvas(),fg=canvas(),ctx=base.getContext('2d'),f=fg.getContext('2d');
 const colors={car:'#e8e4db',portrait:'#dce3ef',flower:'#e9ded3',custom:'#eeeef0'};ctx.fillStyle=colors[key]||colors.custom;ctx.fillRect(0,0,W,H);
 if(key==='car'){const ww=840,hh=ww/img.width*img.height;f.drawImage(img,65,740,ww,hh);ctx.save();ctx.filter='blur(18px)';ctx.fillStyle='#33292135';ctx.beginPath();ctx.ellipse(485,1110,365,24,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 else if(key==='portrait'){const hh=1040,ww=hh/img.height*img.width;f.drawImage(img,(W-ww)/2+30,245,ww,hh)}
 else if(key==='flower'){const hh=1010,ww=hh/img.height*img.width;f.drawImage(img,(W-ww)/2+4,160,ww,hh)}
 else{const r=Math.min(W/img.width,H/img.height);ctx.drawImage(img,(W-img.width*r)/2,(H-img.height*r)/2,img.width*r,img.height*r)}
 if(key!=='custom')ctx.drawImage(fg,0,0);
 projects[key]={key,base,fg,segmentation:{status:'idle'},pixels:ctx.getImageData(0,0,W,H).data,state:initial(key),history:[],future:[],mask:canvas(),maskStamp:'',protected:canvas()};
}
function detectSubject(p=P()) {
 if(!p || ['queued','loading','running'].includes(p.segmentation.status))return;
 const small=canvas(320,320);small.getContext('2d').drawImage(p.base,0,0,320,320);
 const pixels=small.getContext('2d').getImageData(0,0,320,320).data;
 const id=++segmentSerial;p.segmentation={status:'queued',id};
 try {
  if(!segmentWorker){
   segmentWorker=new Worker('./src/segment-worker.mjs',{type:'module'});
   segmentWorker.onmessage=({data})=>{
    const job=segmentJobs.get(data.id);if(!job)return;const project=job.project;
    if(data.status==='ready'){
     clearTimeout(job.timer);segmentJobs.delete(data.id);
     const alpha=new Uint8ClampedArray(data.alpha),mask=canvas(320,320),ctx=mask.getContext('2d'),image=ctx.createImageData(320,320);
     for(let i=0;i<alpha.length;i++){image.data[i*4]=image.data[i*4+1]=image.data[i*4+2]=255;image.data[i*4+3]=alpha[i]}
     ctx.putImageData(image,0,0);const f=project.fg.getContext('2d');f.clearRect(0,0,W,H);f.drawImage(mask,0,0,W,H);
     project.maskStamp=null;project.segmentation={status:'ready',elapsed:data.elapsed,coverage:data.coverage};
     // Brush edits and the user's layer toggle survive an asynchronous result.
     if(P()===project){sync();queue();toast('피사체를 찾았어요 · 피사체 탭에서 영역을 확인하세요')}
    }else if(data.status==='error'){
     clearTimeout(job.timer);segmentJobs.delete(data.id);project.segmentation={status:'error'};
     console.warn('Subject segmentation:',data.message);if(P()===project){sync();queue();toast('피사체를 찾지 못했어요. 다시 시도하거나 브러시로 선택해주세요')}
    }else{project.segmentation.status=data.status;if(P()===project)sync()}
   };
   segmentWorker.onerror=()=>failSegmentation('모델을 실행하지 못했어요');
  }
  const timer=setTimeout(()=>failSegmentation('처리가 오래 걸려 중단했어요'),90000);
  segmentJobs.set(id,{project:p,timer});segmentWorker.postMessage({id,pixels:pixels.buffer},[pixels.buffer]);
 }catch(error){p.segmentation={status:'error'};console.warn(error)}
 if(P()===p)sync();
}
function failSegmentation(message){
 for(const {project,timer} of segmentJobs.values()){clearTimeout(timer);project.segmentation={status:'error'}}
 segmentJobs.clear();segmentWorker?.terminate();segmentWorker=null;sync();toast(message+' · 다시 찾기를 눌러주세요');
}
function segmentationUI(){
 const state=P().segmentation,status=state.status,busy=['queued','loading','running'].includes(status);
 const text=status==='ready'?`피사체 선택됨 · ${(state.elapsed/1000).toFixed(1)}초`:status==='loading'?'기기 내 모델 준비 중…':status==='queued'?'피사체 분석 대기 중…':status==='running'?'사진에서 피사체 찾는 중…':status==='error'?'인식 실패 · 다시 찾거나 직접 칠해주세요':'아직 피사체를 찾지 않았어요';
 $('mask-note').textContent=text;$('mask-note').dataset.status=status;
 $('detect-subject').disabled=busy;$('detect-subject').textContent=busy?'찾는 중…':status==='ready'?'다시 찾기':'피사체 찾기';
 $('mask-preview').setAttribute('aria-pressed',maskPreview);
 $('segment-status').hidden=false;$('segment-status').textContent=busy?text:status==='ready'?'✓ 피사체 선택됨':status==='error'?'피사체 인식 재시도':'피사체 찾기';
 $('segment-status').dataset.status=status;
}
function drawMaskPreview(target,p){
 updateMask(p);const c=target.getContext('2d');c.save();c.clearRect(0,0,target.width,target.height);c.scale(target.width/W,target.height/H);
 c.filter='grayscale(1)';c.globalAlpha=.42;c.drawImage(p.base,0,0);c.globalAlpha=1;c.filter='none';c.drawImage(p.protected,0,0);
 const tint=canvas(),t=tint.getContext('2d');t.drawImage(p.mask,0,0);t.globalCompositeOperation='source-in';t.fillStyle='#6556f0';t.fillRect(0,0,W,H);
 c.globalAlpha=.28;c.drawImage(tint,0,0);c.restore();
}
function sampleColor(p,u){const s=p.state,pt=mix(s.a,s.b,u),x=clamp(Math.round(pt.x),0,W-1),y=clamp(Math.round(pt.y),0,H-1),i=(y*W+x)*4;return `rgb(${p.pixels[i]} ${p.pixels[i+1]} ${p.pixels[i+2]})`}
function drawWarp(ctx,p){const s=p.state,N=280,K=60,ls=[],rs=[];for(let j=0;j<=K;j++){ls.push(bezier(s.left,j/K));rs.push(bezier(s.right,j/K));}for(let i=0;i<N;i++){const u=i/N,v=Math.min(1,(i+1.35)/N);ctx.fillStyle=sampleColor(p,(i+.5)/N);ctx.beginPath();for(let j=0;j<=K;j++){const q=mix(ls[j],rs[j],u);j?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)}for(let j=K;j>=0;j--){const q=mix(ls[j],rs[j],v);ctx.lineTo(q.x,q.y)}ctx.closePath();ctx.fill()}}
function updateMask(p){const stamp=JSON.stringify(p.state.strokes);if(stamp===p.maskStamp)return;p.maskStamp=stamp;const c=p.mask.getContext('2d');c.clearRect(0,0,W,H);c.globalCompositeOperation='source-over';c.drawImage(p.fg,0,0);c.globalCompositeOperation='source-in';c.fillStyle='#fff';c.fillRect(0,0,W,H);for(const stroke of p.state.strokes){c.globalCompositeOperation=stroke.mode==='erase'?'destination-out':'source-over';c.strokeStyle='#fff';c.fillStyle='#fff';c.lineWidth=stroke.size;c.lineCap='round';c.lineJoin='round';c.beginPath();stroke.points.forEach((pt,i)=>i?c.lineTo(pt.x,pt.y):c.moveTo(pt.x,pt.y));c.stroke();if(stroke.points.length===1){c.beginPath();c.arc(stroke.points[0].x,stroke.points[0].y,stroke.size/2,0,Math.PI*2);c.fill()}}c.globalCompositeOperation='source-over';const f=p.protected.getContext('2d');f.clearRect(0,0,W,H);f.globalCompositeOperation='source-over';f.drawImage(p.base,0,0);f.globalCompositeOperation='destination-in';f.drawImage(p.mask,0,0);f.globalCompositeOperation='source-over'}
function draw(target,p,original=false){const c=target.getContext('2d');c.save();c.clearRect(0,0,target.width,target.height);c.scale(target.width/W,target.height/H);c.drawImage(p.base,0,0);if(!original){drawWarp(c,p);if(p.state.subject){updateMask(p);c.drawImage(p.protected,0,0)}}c.restore()}
function queue(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;render()})}
function render(){const p=P();if(!p)return;if(tool==='mask'&&maskPreview&&!comparison)drawMaskPreview($('editor-canvas'),p);else draw($('editor-canvas'),p,comparison||tool==='source');draw($('export-canvas'),p);drawStrip();drawHandles();$('undo').disabled=!p.history.length;$('redo').disabled=!p.future.length;$('undo').title='실행 취소 '+p.history.length+'단계';$('redo').title='다시 실행 '+p.future.length+'단계';document.querySelectorAll('[data-project]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.project===active));$('project-name').textContent=names[active];$('canvas-tag').textContent=comparison?'ORIGINAL':tool==='source'?'COLOR PICK':tool==='mask'?'SUBJECT MASK':'FREE WARP';}
function drawStrip(){const c=$('strip-preview').getContext('2d');for(let i=0;i<512;i++){c.fillStyle=sampleColor(P(),i/511);c.fillRect(i,0,1,30)}}
function handle(pt,id,label,small=false){const r=small?11:14;return `<g data-point="${id}" role="slider" tabindex="0" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pt.x/W*100)}" aria-valuetext="가로 ${Math.round(pt.x/W*100)}%, 세로 ${Math.round(pt.y/H*100)}%"><circle class="hit" cx="${pt.x}" cy="${pt.y}" r="45"/><circle class="dot" cx="${pt.x}" cy="${pt.y}" r="${r}"/></g>`}
function drawHandles(){const el=$('handles'),s=S();if(comparison){el.innerHTML='';return}if(tool==='source'){const mid=mix(s.a,s.b,.5);el.innerHTML=`<path class="boundary" d="M${s.a.x} ${s.a.y}L${s.b.x} ${s.b.y}"/>${handle(s.a,'a','색선 시작점')}${handle(s.b,'b','색선 끝점')}${handle(mid,'line','색선 전체 이동',true)}`;return}if(tool==='mask'){el.innerHTML='';return}let str='';for(const side of ['left','right']){const pts=s[side];str+=`<path class="control-line" d="M${pts.map(p=>p.x+' '+p.y).join('L')}"/><path class="boundary" d="M${pts[0].x} ${pts[0].y}C${pts.slice(1).map(p=>p.x+' '+p.y).join(' ')}"/>`;pts.forEach((p,i)=>{const display=point(clamp(p.x,25,W-25),clamp(p.y,30,H-30));str+=handle(display,side+i,`${side==='left'?'왼쪽':'오른쪽'} 변형점 ${i+1}`,i===1||i===2)})}el.innerHTML=str}
function remember(before=copy(S())){const p=P();if(JSON.stringify(before)===JSON.stringify(p.state))return;p.history.push(before);if(p.history.length>40)p.history.shift();p.future=[];sync();queue()}
function mutate(fn){const before=copy(S());fn(S());remember(before)}
function sync(){if(!P())return;const s=S();$$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',s.preset===b.dataset.preset));$('spread').value=s.spread;$('spread-value').value=Math.round(s.spread)+'%';const pos=Math.round((s.axis==='horizontal'?(s.a.y+s.b.y)/2/H:(s.a.x+s.b.x)/2/W)*100);$('source-pos').value=pos;$('source-value').value=pos+'%';$('subject-toggle').setAttribute('aria-checked',s.subject);$('source-axis').textContent=s.axis==='horizontal'?'세로로 뽑기 ↻':'가로로 뽑기 ↻';segmentationUI();$$('input[type=range]').forEach(r=>r.style.setProperty('--fill',(r.value-r.min)/(r.max-r.min)*100+'%'))}
function setTool(value){if(gesture)finishGesture();tool=value;document.querySelector('.editor-device').classList.toggle('mask-open',tool==='mask');comparison=false;$('compare').setAttribute('aria-pressed',false);$('compare').setAttribute('aria-label','원본 보기');$$('[data-tool]').forEach(b=>b.setAttribute('aria-selected',b.dataset.tool===value));$$('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==value);$('canvas-hint').textContent=value==='warp'?'점을 끌어 선을 휘어보세요':value==='source'?'색선의 양 끝과 가운데를 움직여요':'선택 영역을 확인하고 브러시로 다듬어요';queue()}
function selectProject(key,focus=false){if(!projects[key])return;if(gesture)finishGesture();active=key;comparison=false;setTool('warp');sync();render();if(P().segmentation.status==='idle')detectSubject();if(focus)setFocus(true,'editor')}
function fit(){document.documentElement.style.setProperty('--scale',innerWidth>800&&!document.body.classList.contains('focus')?Math.max(.61,Math.min(1,(innerHeight-150-(!$('font-panel').hidden?155:0))/876)):1)}
function setFocus(on,page='editor'){document.body.classList.toggle('focus',on);$('focus').classList.toggle('selected',on);$('overview').classList.toggle('selected',!on);setScreen(page);fit()}
function setScreen(name){screen=name;$$('[data-page]').forEach(e=>e.classList.toggle('active',e.dataset.page===name));$$('[data-screen]').forEach(e=>e.classList.toggle('selected',e.dataset.screen===name));if(document.body.classList.contains('focus'))window.scrollTo({top:0,behavior:'smooth'});render()}
function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('show'),3200)}
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
const fonts=[{id:'Wanted',name:'Wanted Sans',label:'균형 있는 곡선 · 추천',note:'제안: Wanted Sans. 영문 로고와 한글 제목의 균형이 좋고, 작은 편집 도구도 또렷합니다.',url:'https://noonnu.cc/font_page/1269'},{id:'SUIT',name:'SUIT',label:'단정하고 조용한 UI',note:'SUIT. 화면이 차분하고 간결해집니다. 사진을 가장 앞세우고 싶을 때의 후보입니다.',url:'https://noonnu.cc/font_page/845'},{id:'Paperlogy',name:'페이퍼로지',label:'조형적인 제목',note:'페이퍼로지. 제목의 개성이 가장 강합니다. 작은 도구 글씨는 조금 더 여유가 필요합니다.',url:'https://noonnu.cc/font_page/1456'}];
$('font-options').innerHTML=fonts.map(f=>`<button class="font-card" data-font="${f.id}" style="font-family:${f.id}" aria-pressed="${f.id==='Wanted'}"><span>${f.name} · ${f.label}</span><strong>선을 넘는 색. Aa</strong></button>`).join('');
function selectFont(id){document.documentElement.style.setProperty('--font',id);$$('[data-font]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.font===id));const f=fonts.find(f=>f.id===id);$('font-note').innerHTML=f.note+` <a href="${f.url}" target="_blank" rel="noopener">눈누에서 보기 ↗</a> · 로고는 Wanted Sans 기반으로 고정`}
$$('[data-font]').forEach(b=>b.onclick=()=>selectFont(b.dataset.font));selectFont('Wanted');
$('type-open').onclick=()=>{$('font-panel').hidden=!$('font-panel').hidden;fit()};$('font-close').onclick=()=>{$('font-panel').hidden=true;fit()};
$('overview').onclick=()=>setFocus(false);$('focus').onclick=()=>setFocus(true,'editor');$$('[data-screen]').forEach(b=>b.onclick=()=>setScreen(b.dataset.screen));$('home-back').onclick=()=>setFocus(true,'home');$('edit-back').onclick=$('back-to-edit').onclick=()=>setFocus(true,'editor');$('done').onclick=()=>setFocus(true,'save');$('sample-start').onclick=()=>selectProject(active,true);$$('[data-project]').forEach(b=>b.onclick=()=>selectProject(b.dataset.project,b.classList.contains('art-card')||!!b.closest('.home-samples')));$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));$$('[data-preset]').forEach(b=>b.onclick=()=>mutate(s=>recipe(s,b.dataset.preset)));
$('detect-subject').onclick=()=>detectSubject();$('mask-preview').onclick=()=>{maskPreview=!maskPreview;sync();queue()};$('segment-status').onclick=()=>{setTool('mask');maskPreview=true;sync();if(['idle','error'].includes(P().segmentation.status))detectSubject();queue()};
$('subject-toggle').onclick=()=>mutate(s=>s.subject=!s.subject);$('brush-keep').onclick=()=>setBrush('keep');$('brush-erase').onclick=()=>setBrush('erase');function setBrush(m){brushMode=m;$('brush-keep').setAttribute('aria-pressed',m==='keep');$('brush-erase').setAttribute('aria-pressed',m==='erase')}
$('brush-clear').onclick=()=>mutate(s=>s.strokes=[]);$('brush-size').oninput=e=>{brushSize=+e.target.value;$('brush-value').value=brushSize;sync()};
$('compare').onclick=()=>{comparison=!comparison;$('compare').setAttribute('aria-pressed',comparison);$('compare').setAttribute('aria-label',comparison?'편집 결과 보기':'원본 보기');queue()};
$('reset').onclick=()=>mutate(s=>Object.assign(s,initial(active)));$('undo').onclick=()=>{const p=P();if(!p.history.length)return;p.future.push(copy(p.state));p.state=p.history.pop();sync();queue()};$('redo').onclick=()=>{const p=P();if(!p.future.length)return;p.history.push(copy(p.state));p.state=p.future.pop();sync();queue()};
$('rotate').onclick=()=>mutate(s=>{const center=mix(s.left[0],s.right[0],.5);for(const side of ['left','right'])s[side]=s[side].map(p=>point(clamp(center.x-(p.y-center.y),-350,W+350),clamp(center.y+(p.x-center.x),-350,H+350)));s.preset='custom'});
$('source-axis').onclick=()=>mutate(s=>{const m=mix(s.a,s.b,.5),len=Math.hypot(s.a.x-s.b.x,s.a.y-s.b.y)/2;s.axis=s.axis==='horizontal'?'vertical':'horizontal';s.a=s.axis==='vertical'?point(m.x,clamp(m.y-len,0,H)):point(clamp(m.x-len,0,W),m.y);s.b=s.axis==='vertical'?point(m.x,clamp(m.y+len,0,H)):point(clamp(m.x+len,0,W),m.y);s.left[0]=copy(s.a);s.right[0]=copy(s.b)});
function rangeGesture(id,fn){const el=$(id);let before=null;el.onpointerdown=()=>before=copy(S());el.oninput=()=>{if(!before)before=copy(S());fn(S(),+el.value);sync();queue()};const finish=()=>{if(before){remember(before);before=null}};el.onchange=finish;el.onpointerup=finish;el.onpointercancel=finish;el.onblur=finish}
rangeGesture('spread',(s,v)=>{const prev=s.spread||140,center=mix(s.left[3],s.right[3],.5),ratio=v/prev;for(const side of ['left','right']){s[side][3]=point(center.x+(s[side][3].x-center.x)*ratio,center.y+(s[side][3].y-center.y)*ratio);s[side][2]=point(center.x+(s[side][2].x-center.x)*Math.sqrt(ratio),s[side][2].y)}s.spread=v});
rangeGesture('source-pos',(s,v)=>{const axis=s.axis==='horizontal'?'y':'x',max=axis==='y'?H:W,delta=v/100*max-(s.a[axis]+s.b[axis])/2;s.a[axis]=clamp(s.a[axis]+delta,0,max-1);s.b[axis]=clamp(s.b[axis]+delta,0,max-1);s.left[0]=copy(s.a);s.right[0]=copy(s.b)});
function eventPoint(e){const r=$('handles').getBoundingClientRect();return point(clamp((e.clientX-r.left)/r.width*W,0,W),clamp((e.clientY-r.top)/r.height*H,0,H))}
function movePoint(s,id,pt,origin,before){if(id==='a'||id==='b'){s[id]=pt;s[id==='a'?'left':'right'][0]=copy(pt)}else if(id==='line'){const dx=pt.x-origin.x,dy=pt.y-origin.y;for(const name of ['a','b'])s[name]=point(clamp(before[name].x+dx,0,W),clamp(before[name].y+dy,0,H));s.left[0]=copy(s.a);s.right[0]=copy(s.b)}else{const side=id.startsWith('left')?'left':'right',i=+id.slice(side.length);s[side][i]=point(before[side][i].x+pt.x-origin.x,before[side][i].y+pt.y-origin.y);s.preset='custom'}}
$('handles').onpointerdown=e=>{if(comparison||!P())return;const pt=eventPoint(e),target=e.target.closest('[data-point]');if(tool!=='mask'&&!target)return;e.preventDefault();const before=copy(S());gesture={id:e.pointerId,point:target?.dataset.point,origin:pt,before};$('handles').setPointerCapture(e.pointerId);if(tool==='mask'){S().subject=true;S().strokes.push({mode:brushMode,size:brushSize,points:[pt]});queue()}};
$('handles').onpointermove=e=>{if(!gesture||e.pointerId!==gesture.id)return;e.preventDefault();const pt=eventPoint(e);if(tool==='mask'){const pts=S().strokes.at(-1).points,last=pts.at(-1);if(Math.hypot(pt.x-last.x,pt.y-last.y)>3)pts.push(pt)}else movePoint(S(),gesture.point,pt,gesture.origin,gesture.before);sync();queue()};
function finishGesture(cancel=false){if(!gesture)return;const before=gesture.before;gesture=null;if(cancel){P().state=before;sync();queue()}else remember(before)}
$('handles').onpointerup=()=>finishGesture();$('handles').onpointercancel=()=>finishGesture(true);$('handles').onlostpointercapture=()=>finishGesture();
$('handles').onkeydown=e=>{const target=e.target.closest('[data-point]');if(!target||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const id=target.dataset.point,s=S();let pt;if(id==='line')pt=mix(s.a,s.b,.5);else if(id==='a'||id==='b')pt=s[id];else{const side=id.startsWith('left')?'left':'right';pt=s[side][+id.slice(side.length)]}const origin=copy(pt),step=e.shiftKey?25:5,next=point(pt.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),pt.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));mutate(st=>movePoint(st,id,next,origin,copy(st)));render();$('handles').querySelector(`[data-point="${id}"]`)?.focus()};
$('about').onclick=()=>$('info').showModal();$('info-close').onclick=()=>$('info').close();$('info').onclick=e=>{if(e.target===$('info'))$('info').close()};
$('import-home').onclick=$('import-editor').onclick=()=>$('file-input').click();
$('file-input').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('JPG, PNG, WebP 사진을 선택해주세요');return}if(file.size>30*1024*1024){toast('30MB 이하 사진으로 다시 선택해주세요');return}try{const img=await createImageBitmap(file,{imageOrientation:'from-image',resizeWidth:1600});prepare('custom',img);img.close();names.custom='My photo';let thumb=document.querySelector('[data-project=custom]');if(!thumb){thumb=document.createElement('button');thumb.dataset.project='custom';thumb.setAttribute('aria-label','내 사진 다시 선택');thumb.innerHTML='<canvas width=90 height=110></canvas><span>내 사진</span>';thumb.onclick=()=>selectProject('custom');$('sample-strip').insertBefore(thumb,$('import-editor'));$('sample-strip').classList.add('has-custom')}draw(thumb.querySelector('canvas'),projects.custom,true);selectProject('custom',true);setTool('source');toast('먼저 사진 위에서 늘릴 색선을 골라주세요')}catch(err){toast('이 사진을 열지 못했어요. JPG 또는 PNG로 다시 선택해주세요')}finally{e.target.value=''}};
$('download').onclick=()=>{const out=$('export-canvas');draw(out,P());out.toBlob(blob=>{if(!blob){toast('저장에 실패했어요. 다시 시도해주세요');return}const url=URL.createObjectURL(blob),a=document.createElement('a');const fallback=$('download-fallback');if(fallback.href.startsWith('blob:'))URL.revokeObjectURL(fallback.href);fallback.href=url;fallback.hidden=false;a.href=url;a.download=`yourcolor-${active}-${Date.now()}.jpg`;document.body.append(a);a.click();a.remove();toast('JPG 준비 완료 · 저장되지 않으면 이미지 직접 열기를 눌러주세요')},'image/jpeg',.95)};
window.addEventListener('resize',fit);document.addEventListener('keydown',e=>{if(e.key==='Escape'){comparison=false;$('compare').setAttribute('aria-pressed',false);queue()}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$(e.shiftKey?'redo':'undo').click()}});
Promise.all(Object.entries(assetData).map(async([key,url])=>{const img=new Image();img.src=url;await img.decode();prepare(key,img)})).then(async()=>{await document.fonts.load('800 122px Wanted');logo();for(const key of ['car','portrait','flower']){draw($('hero-'+key),projects[key]);$$(`[data-thumb="${key}"]`).forEach(c=>draw(c,projects[key]))}sync();fit();render();document.body.dataset.ready='true';for(const p of Object.values(projects)){p.fg.getContext('2d').clearRect(0,0,W,H);p.maskStamp=null}detectSubject();queue()}).catch(err=>{console.error(err);toast('샘플 사진을 불러오지 못했어요')});
