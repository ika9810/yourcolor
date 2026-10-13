#!/usr/bin/env python3
"""Layout checks on an emulator, not Samsung/LG hardware certification.
Run after assembleDebug/assembleDebugAndroidTest. Restores display settings.
"""
import json, os, pathlib, subprocess, sys
root=pathlib.Path(__file__).resolve().parents[1]
adb=pathlib.Path(os.environ.get('ANDROID_HOME', pathlib.Path.home()/'Library/Android/sdk'))/'platform-tools/adb'
serial=sys.argv[1] if len(sys.argv)>1 else 'emulator-5554'
out=root/'app/build/outputs/device-proofs';out.mkdir(parents=True,exist_ok=True)
def run(*args):
 p=subprocess.run([str(adb),'-s',serial,*map(str,args)],capture_output=True,text=True,check=True)
 return p.stdout
if not serial.startswith('emulator-'):raise SystemExit('Use an emulator serial; this script does not change a physical phone.')
original_size=run('shell','wm','size');original_density=run('shell','wm','density');original_font=run('shell','settings','get','system','font_scale').strip()
profiles=[('s26-ultra',1440,3120,560,1.0),('flip8-main',1080,2520,420,1.0),('fold8-cover',1248,1972,480,1.0),('fold8-main',2448,1848,400,1.0),('fold8-portrait',1848,2448,400,1.0),('fold8-ultra-main',2256,2504,400,1.0),('flip8-cover-layout-only',948,1048,360,1.0),('s26-ultra-large-text',1440,3120,560,1.3)]
results=[]
try:
 run('install','-r',root/'app/build/outputs/apk/debug/app-debug.apk')
 run('install','-r',root/'app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk')
 for name,w,h,density,font in profiles:
  run('shell','wm','size',f'{w}x{h}');run('shell','wm','density',density);run('shell','settings','put','system','font_scale',font)
  log=run('shell','am','instrument','-w','-e','class','com.robotics.yourcolor.DeviceLayoutTest','-e','profile',name,'com.robotics.yourcolor.dev.test/androidx.test.runner.AndroidJUnitRunner')
  (out/f'{name}.txt').write_text(log)
  passed='OK (1 test)' in log
  results.append(dict(profile=name,pixels=[w,h],testDensity=density,fontScale=font,passed=passed))
  print(name, 'PASS' if passed else 'FAIL',flush=True)
  run('pull',f'/sdcard/Android/data/com.robotics.yourcolor.dev/files/device-proofs/{name}',out)
finally:
 size=next((x.split(': ')[1] for x in original_size.splitlines() if x.startswith('Override size:')),'reset')
 density=next((x.split(': ')[1] for x in original_density.splitlines() if x.startswith('Override density:')),'reset')
 run('shell','wm','size',size);run('shell','wm','density',density)
 if original_font in ('null',''):run('shell','settings','delete','system','font_scale')
 else:run('shell','settings','put','system','font_scale',original_font)
 (out/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
if not all(r['passed'] for r in results):sys.exit(1)
