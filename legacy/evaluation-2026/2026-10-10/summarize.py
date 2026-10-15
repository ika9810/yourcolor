"""Aggregate screening results without selecting/tuning either model on the labels."""
import argparse
import collections
import json
import importlib.metadata
import pathlib
import platform
import sys
import numpy as np
import onnxruntime as ort

p=argparse.ArgumentParser();p.add_argument('--cache',type=pathlib.Path,required=True)
p.add_argument('--out',type=pathlib.Path,required=True);args=p.parse_args()
rows=[json.loads(line) for line in (args.cache/'combined-results.jsonl').read_text().splitlines()]
assert len(rows)==912 and len({x['path'] for x in rows})==912
seasons=['spring','summer','autumn','winter']
previous=json.loads(args.out.read_text()) if args.out.exists() else {}
summary={'n':len(rows),'labels':dict(collections.Counter(x['label'] for x in rows)),
         'majority_baseline':max(collections.Counter(x['label'] for x in rows).values())/len(rows),
         'metrics':{},'stability':{},
         'versions':{name:importlib.metadata.version(name) for name in ['numpy','Pillow','onnxruntime','mediapipe','torch','timm']},
         'runtime':{'platform':platform.platform(),'python':sys.version.split()[0],
                    'execution_provider':'CPUExecutionProvider','android_tested':False},
         'limitations':previous.get('limitations',[])}
for model,key,title in [('efficientnet','pred','efficientnet'),('personal_color_ai','pred','personal_color_ai'),('personal_color_ai','sum_pred','personal_color_ai_sum')]:
    valid=[x for x in rows if model in x]
    matrix=[[sum(x['label']==a and x[model][key]==b for x in valid) for b in seasons] for a in seasons]
    cm=np.array(matrix);recall=np.diag(cm)/np.maximum(1,cm.sum(axis=1))
    precision=np.diag(cm)/np.maximum(1,cm.sum(axis=0))
    f1=2*recall*precision/np.maximum(1e-12,recall+precision)
    summary['metrics'][title]=dict(valid=len(valid),correct=int(np.trace(cm)),accuracy=float(np.trace(cm)/len(rows)),
        balanced_accuracy=float(recall.mean()),macro_f1=float(f1.mean()),recall=dict(zip(seasons,recall.tolist())),
        confusion_matrix=matrix,confusion_order=seasons,prediction_counts=dict(collections.Counter(x[model][key] for x in valid)))
    subset=[x for x in valid if 'variants' in x]
    changes=[];by_variant=collections.defaultdict(list)
    original_conf=[];changed_conf=[]
    for x in subset:
        per_image=[]
        for name,v in x['variants'].items():
            if model not in v:continue
            changed=v[model][key]!=x[model][key]
            by_variant[name].append(changed);per_image.append(changed)
        changes.append(any(per_image))
    summary['stability'][title]=dict(images=len(subset),images_with_any_change=sum(changes),
        any_change_rate=float(np.mean(changes)),by_variant={name:dict(n=len(v),changes=sum(v),rate=float(np.mean(v))) for name,v in by_variant.items()})
valid=[x for x in rows if 'personal_color_ai' in x]
summary['extraction']=dict(success=len(valid),failed=len(rows)-len(valid),
    iris_detected=sum(x['extraction'].get('iris_detected',False) for x in rows),
    hair_fallback=sum(x['extraction'].get('hair_fallback',False) for x in rows),
    neck_fallback=sum(x['extraction'].get('neck_fallback',False) for x in rows))
summary['noise_sweep']=dict(n=len(valid),points=21,min=.010001,max=.049999,
    season_changes=sum(len({r['pred'] for r in x['noise_sweep']})>1 for x in valid),
    sub_season_changes=sum(len({r['sub_pred'] for r in x['noise_sweep']})>1 for x in valid),
    summed_season_changes=sum(len({r['sum_pred'] for r in x['noise_sweep']})>1 for x in valid))
options=ort.SessionOptions();options.intra_op_num_threads=1
session=ort.InferenceSession(str(args.cache/'models/personal_color_ai.onnx'),options,providers=['CPUExecutionProvider'])
names=json.loads((args.cache/'models/feature_names.json').read_text())
classes=json.loads((args.cache/'models/model_metadata.json').read_text())['classes']
configs=[dict(uv_index=0,cloud_cover=100,sun_angle=0,ambient_light_condition=.1),
         dict(uv_index=10,cloud_cover=0,sun_angle=75,ambient_light_condition=1.),
         dict(uv_index=5,cloud_cover=30,sun_angle=45,ambient_light_condition=.7)]
all_predictions=[]
for c in configs:
    features=[]
    for x in valid:
        f=dict(x['extraction']['features'],**c)
        f['light_intensity']=f['uv_index']/11*(1-f['cloud_cover']/100)
        features.append([f[n] for n in names])
    labels,probs=session.run(None,{'float_input':np.array(features,dtype=np.float32)})
    all_predictions.append([classes[int(i)].split('_')[0].lower() for i in labels])
summary['weather_sweep']=dict(configurations=configs,n=len(valid),images_with_any_season_change=sum(
    any(pred[i]!=x['personal_color_ai']['pred'] for pred in all_predictions) for i,x in enumerate(valid)))
skin_path=args.cache/'skin-audit-results.json'
if skin_path.exists():
    skin=json.loads(skin_path.read_text());lookup={x['path']:x for x in rows}
    summary['skin_audit']=dict(n=len(skin),correct=sum(x['pred']==x['label'] for x in skin),
        demo_correct_on_same_subset=sum(lookup[x['path']]['efficientnet']['pred']==x['label'] for x in skin),
        changed_from_demo=sum(x['pred']!=lookup[x['path']]['efficientnet']['pred'] for x in skin),
        note='Diagnostic only: skin and nose retained (BiSeNet classes 1,10); exact training mask code is unavailable')
args.out.write_text(json.dumps(summary,indent=2,ensure_ascii=False))
print(json.dumps(summary,indent=2,ensure_ascii=False))
