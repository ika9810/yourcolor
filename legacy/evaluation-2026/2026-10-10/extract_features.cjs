// Evaluation only. Execute the inspected numerical functions from the author's
// pinned public demo without its UI, network calls, geolocation or model loader.
const fs = require('node:fs');
const vm = require('node:vm');
const readline = require('node:readline');
const source = fs.readFileSync(process.argv[2], 'utf8');
function between(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error('Pinned source structure changed');
  return source.slice(a, b);
}
const context = vm.createContext({console: {log() {}}, request: null});
vm.runInContext(`
const PARSE_CLASS={BACKGROUND:0,SKIN:1,L_BROW:2,R_BROW:3,L_EYE:4,R_EYE:5,EYE_G:6,L_EAR:7,R_EAR:8,EAR_R:9,NOSE:10,MOUTH:11,U_LIP:12,L_LIP:13,NECK:14,NECK_L:15,CLOTH:16,HAIR:17,HAT:18};
const ETHNICITY_BASELINES={};
let userEthnicity='auto',lastExtract=null;
let colorOverride={face:null,hair:null,eye:null,body:null};
let manualRegions={skin:null,hair:null,eye:null,neck:null};
let weatherData={uv_index:5,cloud_cover:30,sun_angle:45,ambient:.6};
${between('function rgbToLab(', 'function drawDebugOverlay(')}
${between('function buildFeatureObject(', 'function sampleRectLab(')}
function extract(request) {
  const {buf,mask,W,H,landmarks}=request;
  Math.random=()=>0.5; // Fixed midpoint; stochastic sensitivity tested separately.
  const classCounts=new Array(19).fill(0);
  for (const label of mask) classCounts[label]++;
  if(classCounts[1]<50) return {error:'insufficient_skin',classCounts};
  const faceLab=sampleMaskedLab(buf,mask,W,H,[1],[16,18,12,13,11,2,3,4,5,6],{erodeBoundary:true,trimDeltaE:15,region:'skin'});
  const hairLab=classCounts[17]>30 ? sampleMaskedLab(buf,mask,W,H,[17],[18],{erodeBoundary:true,trimDeltaE:25,region:'hair'}) : {L:30,a:3,b:5,count:0};
  const neckLab=classCounts[14]>20 ? sampleMaskedLab(buf,mask,W,H,[14],[16,17],{erodeBoundary:true,trimDeltaE:18,region:'neck'}) : {...faceLab,L:faceLab.L-4};
  const eyeLab=landmarks ? sampleLandmarksLab(buf,landmarks,[468,469,470,471,472,473,474,475,476,477],W,H,5,'eye') : {L:35,a:2,b:3};
  return {features:buildFeatureObject({faceLab,hairLab,neckLab,eyeLab,buf,W,H,mask,classCounts}),classCounts,iris_detected:!!landmarks,hair_fallback:classCounts[17]<=30,neck_fallback:classCounts[14]<=20};
}`,context,{timeout:10000});
const input=readline.createInterface({input:process.stdin});
input.on('line',line=>{
  try {
    const request=JSON.parse(line);
    request.buf=new Uint8Array(Buffer.from(request.buf,'base64'));
    request.mask=new Uint8Array(Buffer.from(request.mask,'base64'));
    context.request=request;
    const result=vm.runInContext('extract(request)',context,{timeout:10000});
    process.stdout.write(JSON.stringify(result)+'\n');
  } catch(error) { process.stdout.write(JSON.stringify({error:String(error)})+'\n'); }
});
