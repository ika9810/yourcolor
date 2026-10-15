"""Build the HTML prototype. Serve legacy/design-prototypes/ to load its local segmentation worker, runtime and model."""
from pathlib import Path
import base64,json
root=Path(__file__).resolve().parent
src=root/'src'
def data(path,mime):
    return 'data:'+mime+';base64,'+base64.b64encode((root/'assets'/path).read_bytes()).decode()
fonts=[('Wanted','WantedSansVariable.woff2','100 1000'),('SUIT','SUIT-Variable.woff2','100 900'),('Paperlogy','Paperlogy-4Regular.woff2','400'),('Paperlogy','Paperlogy-6SemiBold.woff2','600'),('Paperlogy','Paperlogy-7Bold.woff2','700')]
css='\n'.join('@font-face{font-family:'+name+';src:url("'+data(path,'font/woff2')+'");font-weight:'+weight+';font-display:swap}' for name,path,weight in fonts)
assets={key:data(path,'image/png') for key,path in [('car','orange-coupe.png'),('portrait','editorial-portrait.png'),('flower','calla-lily.png')]}
html=(src/'v2.html').read_text().replace('/*__FONTS__*/',css).replace('/*__CSS__*/',(src/'v2.css').read_text()).replace('/*__ASSETS__*/',json.dumps(assets)).replace('/*__JS__*/',(src/'v2.js').read_text())
licenses='\n\n'.join((root/'assets'/name).read_text() for name in ['WantedSans-LICENSE.txt','SUIT-LICENSE.txt','Paperlogy-LICENSE.txt'])
html=html.replace('</body>','<script type="text/plain" id="bundled-font-licenses">'+licenses+'</script></body>')
(root/'yourcolor-design-v2.html').write_text(html)
print('Built yourcolor-design-v2.html:',len(html.encode()),'bytes')
