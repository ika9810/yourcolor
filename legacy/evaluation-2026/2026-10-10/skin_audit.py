"""Diagnostic preprocessing alternative, not an exact training-pipeline reproduction.

The EfficientNet card says skin masking; its public demo does not implement it.
On the preselected 120-image balanced subset, retain parser classes skin + nose.
This probes sensitivity to that discrepancy. Do not treat it as a tuned benchmark.
"""
import argparse
import json
import pathlib
import numpy as np
import onnxruntime as ort
from PIL import Image
from compare import Evaluation, MEAN, STD, SEASONS

p=argparse.ArgumentParser()
p.add_argument('--cache',type=pathlib.Path,required=True)
args=p.parse_args()
options=ort.SessionOptions();options.intra_op_num_threads=2;options.inter_op_num_threads=1
session=lambda name:ort.InferenceSession(str(args.cache/'models'/name),options,providers=['CPUExecutionProvider'])
parser=session('face_parsing.onnx')
ev=Evaluation.__new__(Evaluation);ev.eff=session('efficientnet.onnx')
protocol=json.loads((args.cache/'full-protocol.json').read_text())
results=[]
for i,filename in enumerate(protocol['stability_images']):
    path=pathlib.Path(filename);img=Image.open(path).convert('RGB')
    x=(np.asarray(img.resize((512,512),Image.Resampling.BILINEAR),dtype=np.float32)/255-MEAN)/STD
    y=parser.run([parser.get_outputs()[0].name],{parser.get_inputs()[0].name:x.transpose(2,0,1)[None]})[0]
    mask=y[0].argmax(axis=0)
    w,h=img.size;mh,mw=mask.shape
    yi=np.minimum(mh-1,np.floor(np.arange(h)*mh/h+.5).astype(int))
    xi=np.minimum(mw-1,np.floor(np.arange(w)*mw/w+.5).astype(int))
    mask=mask[yi[:,None],xi]
    keep=np.isin(mask,[1,10])
    rgb=np.asarray(img).copy();rgb[~keep]=0
    probs=ev.efficient(Image.fromarray(rgb))
    results.append(dict(path=str(path.relative_to(args.cache/'data')),label=path.parent.name.split('_')[0],
        pred=SEASONS[int(probs.argmax())],probs=probs.tolist(),skin_fraction=float(keep.mean())))
    if i%20==0:print('SKIN_AUDIT',i+1,len(protocol['stability_images']),flush=True)
(args.cache/'skin-audit-results.json').write_text(json.dumps(results,indent=2))
print('SKIN_AUDIT_DONE',sum(x['pred']==x['label'] for x in results),len(results),flush=True)
