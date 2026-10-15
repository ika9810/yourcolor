"""Local research screening, not an Android implementation or clinical validation.

Assets live outside Git. --cache points to the pinned downloads from the report.
Author demo numerical feature code is executed locally by extract_features.cjs.
The PIL resize and Python MediaPipe adapter are disclosed reproduction differences.
"""
import argparse
import base64
import io
import json
import os
import pathlib
import subprocess
import time

os.environ.setdefault('GLOG_minloglevel', '2')
import mediapipe as mp
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageEnhance, ImageOps

SEASONS = ['spring', 'summer', 'autumn', 'winter']
MEAN = np.array([.485, .456, .406], dtype=np.float32)
STD = np.array([.229, .224, .225], dtype=np.float32)


class Evaluation:
    def __init__(self, cache):
        self.cache = cache
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        def session(name):
            return ort.InferenceSession(str(cache/'models'/name), options,
                                        providers=['CPUExecutionProvider'])
        self.eff = session('efficientnet.onnx')
        self.rf = session('personal_color_ai.onnx')
        self.parse = session('face_parsing.onnx')
        self.mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True, max_num_faces=1, refine_landmarks=True,
            min_detection_confidence=.5, min_tracking_confidence=.5)
        self.names = json.loads((cache/'models/feature_names.json').read_text())
        self.classes = json.loads((cache/'models/model_metadata.json').read_text())['classes']
        self.js = subprocess.Popen([
            'node', str(pathlib.Path(__file__).with_name('extract_features.cjs')),
            str(cache/'sources/mr4-app.js')], stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, text=True, bufsize=1)

    def efficient(self, img):
        # Six fixed views exactly as in the model author's public demo.
        w, h = img.size
        side = min(w, h)
        img = img.crop(((w-side)//2, (h-side)//2, (w+side)//2, (h+side)//2))
        probabilities = []
        for size in [256, 232, 280]:
            resized = img.resize((size, size), Image.Resampling.BILINEAR)
            left = int(round((size-224)/2))
            crop = resized.crop((left, left, left+224, left+224))
            for view in [crop, ImageOps.mirror(crop)]:
                x = (np.asarray(view, dtype=np.float32)/255-MEAN)/STD
                y = self.eff.run(None, {'image':x.transpose(2,0,1)[None]})[0][0]
                y = np.exp(y-y.max()); probabilities.append(y/y.sum())
        return np.mean(probabilities, axis=0)

    def features(self, img):
        w, h = img.size
        scale = min(1., 512/max(w,h))
        w, h = int(np.floor(w*scale+.5)), int(np.floor(h*scale+.5))
        img = img.resize((w,h), Image.Resampling.BILINEAR)
        rgb = np.asarray(img)
        resized = np.asarray(img.resize((512,512), Image.Resampling.BILINEAR),dtype=np.float32)
        x = ((resized/255-MEAN)/STD).transpose(2,0,1)[None]
        logits = self.parse.run(None,{self.parse.get_inputs()[0].name:x})[0]
        mask512 = logits[0].argmax(axis=0).astype(np.uint8)
        mh,mw = mask512.shape
        yi = np.minimum(mh-1,np.floor(np.arange(h)*mh/h+.5).astype(int))
        xi = np.minimum(mw-1,np.floor(np.arange(w)*mw/w+.5).astype(int))
        mask = mask512[yi[:,None],xi]
        result = self.mesh.process(rgb)
        landmarks = None
        if result.multi_face_landmarks:
            landmarks = [dict(x=p.x,y=p.y) for p in result.multi_face_landmarks[0].landmark]
        request = dict(W=w,H=h,landmarks=landmarks,
            buf=base64.b64encode(np.asarray(img.convert('RGBA')).tobytes()).decode(),
            mask=base64.b64encode(mask.tobytes()).decode())
        self.js.stdin.write(json.dumps(request)+'\n'); self.js.stdin.flush()
        response = self.js.stdout.readline()
        if not response: raise RuntimeError('Feature worker exited')
        return json.loads(response)

    def rf_predict(self, features):
        x = np.array([[features[n] for n in self.names]],dtype=np.float32)
        label, probabilities = self.rf.run(None,{'float_input':x})
        probs = probabilities[0]
        summed = np.array([sum(p for c,p in zip(self.classes,probs)
                               if c.lower().startswith(season+'_')) for season in SEASONS])
        return dict(pred=self.classes[int(label[0])].split('_')[0].lower(),
                    sub_pred=self.classes[int(label[0])],
                    sum_pred=SEASONS[int(summed.argmax())],probs=probs.tolist(),
                    season_probs=summed.tolist())

    def run(self, img):
        start = time.perf_counter(); eff = self.efficient(img)
        eff_ms = (time.perf_counter()-start)*1000
        start = time.perf_counter(); features = self.features(img)
        feature_ms = (time.perf_counter()-start)*1000
        out = dict(efficientnet=dict(pred=SEASONS[int(eff.argmax())],probs=eff.tolist(),ms=eff_ms),
                   extraction=features,feature_ms=feature_ms)
        if 'features' in features:
            start=time.perf_counter(); out['personal_color_ai']=self.rf_predict(features['features'])
            out['personal_color_ai']['ms']=(time.perf_counter()-start)*1000
        return out

    def close(self):
        self.mesh.close(); self.js.stdin.close(); self.js.wait(timeout=10)


def variants(img):
    yield 'brightness_90', ImageEnhance.Brightness(img).enhance(.9)
    yield 'brightness_110', ImageEnhance.Brightness(img).enhance(1.1)
    a = np.asarray(img,dtype=np.float32)
    for name,gains in [('warm_4pct',[1.04,1.,.96]),('cool_4pct',[.96,1.,1.04])]:
        yield name, Image.fromarray(np.clip(a*gains,0,255).astype(np.uint8))
    buf=io.BytesIO(); img.save(buf,format='JPEG',quality=75);buf.seek(0)
    yield 'jpeg_75', Image.open(buf).convert('RGB')


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--cache',type=pathlib.Path,required=True)
    parser.add_argument('--limit',type=int,default=0)
    parser.add_argument('--stability-per-season',type=int,default=30)
    parser.add_argument('--shards',type=int,default=1)
    parser.add_argument('--shard-index',type=int,default=0)
    args=parser.parse_args()
    paths=sorted((args.cache/'data/test').glob('*/*.png'))
    if args.limit: paths=paths[:args.limit]
    # Select 30 per coarse season BEFORE reading any predictions.
    rng=np.random.default_rng(20261010)
    selected=set()
    for season in SEASONS:
        group=[p for p in paths if p.parent.name.startswith(season+'_')]
        chosen=rng.choice(len(group),min(args.stability_per_season,len(group)),replace=False)
        selected.update(str(group[i]) for i in chosen)
    plan=dict(seed=20261010,images=len(paths),stability_images=sorted(selected),
              variants=['brightness_90','brightness_110','warm_4pct','cool_4pct','jpeg_75'],
              rf_noise=.03,rf_weather=dict(uv_index=5,cloud_cover=30,sun_angle=45,ambient=.6),
              rf_baseline='author demo auto formula; no ethnicity inference',
              warning='Screening only: unknown training overlap, subjective labels, masked celebrity photos, synthetic perturbations are not actual recaptures')
    suffix='smoke' if args.limit else 'full'
    if args.shards>1:
        suffix=f'part-{args.shard_index}'
        paths=paths[args.shard_index::args.shards]
        existing=args.cache/'full-results.jsonl'
        completed={json.loads(line)['path'] for line in existing.read_text().splitlines()} if existing.exists() else set()
        paths=[p for p in paths if str(p.relative_to(args.cache/'data')) not in completed]
    (args.cache/f'{suffix}-protocol.json').write_text(json.dumps(plan,indent=2))
    ev=Evaluation(args.cache)
    output=args.cache/f'{suffix}-results.jsonl'
    with output.open('w') as handle:
        for i,path in enumerate(paths):
            img=Image.open(path).convert('RGB')
            item=dict(path=str(path.relative_to(args.cache/'data')),label=path.parent.name.split('_')[0])
            item.update(ev.run(img))
            if str(path) in selected:
                item['variants']={name:ev.run(image) for name,image in variants(img)}
            if 'personal_color_ai' in item:
                features=item['extraction']['features'].copy()
                # Sweep the entire documented random noise range (not a real noise measurement).
                item['noise_sweep']=[ev.rf_predict(dict(features,noise_level=float(value)))
                                     for value in np.linspace(.010001,.049999,21)]
            handle.write(json.dumps(item)+'\n');handle.flush()
            if i%20==0 or i+1==len(paths):
                print(json.dumps(dict(done=i+1,total=len(paths),last_path=item['path'],
                     eff=item['efficientnet']['pred'],rf=item.get('personal_color_ai',{}).get('pred'))),flush=True)
    ev.close()
    print('SAVED',output,flush=True)


if __name__=='__main__': main()
