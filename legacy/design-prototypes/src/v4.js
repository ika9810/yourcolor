// UI study shell. The pixel-stretch and local segmentation engine is retained.
const fontNames={Pretendard:'프리텐다드',SUIT:'SUIT',Paperlogy:'페이퍼로지'};
let currentScreen='home',currentTool='stretch',uiReady=false;
const reviewCopies=new Map();
function setMode(mode){
 $('flow-board').dataset.mode=mode;document.body.classList.toggle('live-mode',mode==='live');
 $('overview-mode').setAttribute('aria-pressed',mode==='overview');$('live-mode').setAttribute('aria-pressed',mode==='live');
 $$('[data-step]').forEach(el=>el.classList.toggle('active',el.dataset.step===currentScreen));
 if(uiReady){queue();refreshExport()}
}
function showScreen(screen,live=true){
 currentScreen=screen;if(live)setMode('live');
 $$('[data-step]').forEach(el=>el.classList.toggle('active',el.dataset.step===screen));
 $$('[data-jump]').forEach(el=>{if(el.closest('.flow-nav'))el.setAttribute('aria-current',el.dataset.jump===screen?'step':'false')});
 if(screen==='edit'&&P()){if(!S().effect)setTool('shape');sync();render();renderThumbnails()}
 if(screen==='export'&&P())refreshExport();
 if(live)window.scrollTo({top:0,behavior:'instant'});
}
function setTool(tool){
 if(tool==='subject'){$('mask-dialog').showModal();sync();renderMask();return}
 currentTool=tool;
 for(const key of ['stretch','shape','background'])$('panel-'+key).hidden=key!==tool;
 $$('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===tool));
 if(tool==='shape'&&P())renderThumbnails();
}
function applyFont(value,persist=true){
 if(!Object.hasOwn(fontNames,value))value='Paperlogy';
 document.documentElement.style.setProperty('--font',value);document.body.dataset.font=value;
 $('font').value=value;$('chosen-font').textContent=fontNames[value];
 $$('[data-font]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.font===value));
 if(persist)try{localStorage.setItem('yourcolor-v4-font-confirmed',value)}catch{}
}
function refreshExport(){if(P())draw($('save-canvas'),P())}
function demoState(key){
 const s=initial(key);
 if(key==='car')s.length=100;
 if(key==='portrait'){s.effect='fan';s.direction='up';s.amount=48;s.length=100}
 if(key==='flower'){s.effect='curve';s.direction='down';s.amount=44;s.length=100}
 return s;
}
function renderReview(){
 for(const key of ['portrait','car','flower']){
  const p=projects[key];if(!p)continue;
  const stamp=`${p.status}:${p.elapsed}`;let item=reviewCopies.get(key);
  if(!item||item.stamp!==stamp){item={stamp,p:{...p,state:demoState(key),mask:canvas(),protected:canvas(),tint:canvas(),maskStamp:null,stripStamp:null}};reviewCopies.set(key,item)}
  $$(`[data-preview="${key}"]`).forEach(c=>{draw(c,item.p);c.dataset.previewReady=p.maskReady?'true':'false'});
 }
 if(P())refreshExport();
}
const oldSelectProject=selectProject;
selectProject=function(key){oldSelectProject(key);if(uiReady){
 if(key==='custom'){
  const b=document.querySelector('[data-project="custom"]');b.classList.add('sample-card');
  const img=b.querySelector('img');if(!b.querySelector('.sample-art')){const frame=document.createElement('div');frame.className='sample-art';b.prepend(frame);frame.append(img)}
 }
 showScreen('edit');setTool(S().effect?'stretch':'shape')
}};
const oldRender=render;
render=function(){oldRender();if(uiReady&&($('flow-board').dataset.mode==='overview'||currentScreen==='export'))refreshExport()};
$('overview-mode').onclick=()=>setMode('overview');$('live-mode').onclick=()=>showScreen(currentScreen);
$$('[data-jump]').forEach(b=>b.onclick=()=>showScreen(b.dataset.jump));
$$('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$$('[data-demo]').forEach(b=>b.onclick=()=>{if(!uiReady)return;const key=b.dataset.demo;selectProject(key);mutate(s=>Object.assign(s,demoState(key)));renderThumbnails();setTool('stretch')});
$$('[data-font-open]').forEach(b=>b.onclick=()=>$('fonts-dialog').showModal());
$$('[data-font]').forEach(b=>b.onclick=()=>applyFont(b.dataset.font));$('font').onchange=e=>applyFont(e.target.value);
$('save-open').onclick=()=>showScreen('export');
function initializeV4(){
 uiReady=true;let font='Paperlogy';try{font=localStorage.getItem('yourcolor-v4-font-confirmed')||font}catch{}applyFont(font,false);
 setMode(window.innerWidth>=1200?'overview':'live');showScreen('home',false);renderReview();
 for(const p of Object.values(projects))if(p.status==='idle')startSegmentation(p);
 document.body.dataset.uiReady='true';
}
