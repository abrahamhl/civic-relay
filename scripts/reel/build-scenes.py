from PIL import Image, ImageDraw, ImageFont
import subprocess, os
S=os.environ.get("REEL_WORK","."); F=S+'/frames'; O=S+'/scenes'; os.makedirs(O,exist_ok=True)
FB='/usr/share/fonts/opentype/inter/Inter-Bold.otf'; FR='/usr/share/fonts/opentype/inter/Inter-Regular.otf'
CORAL=(255,119,86); ICE=(145,215,232)
scenes=[
 ('a1','Cuando la red se apaga…','Los desastres destruyen la ruta, no a todos los dispositivos cercanos.'),
 ('b1','Civic Relay · OEP','Plataforma europea de continuidad de comunicaciones en emergencias.'),
 ('a3','De Arnhem a San Martín','Escenario SIMULADO de custodia y reenvío de un mensaje.'),
 ('a2','Si no hay ruta, el mensaje espera','Almacenar → buscar ruta → reenviar → confirmar con ACK del receptor.'),
 ('m00','Mission Control 3D','Globo interactivo, sectores y escenarios en tiempo real (modelo).'),
 ('m03','Cámaras abiertas, privacidad por defecto','Mosaico activado de serie. Catálogos públicos DGT y Rijkswaterstaat.'),
 ('a4','20 módulos · 8 escenarios','Visión maestra CR-VM-2026-10-25: del aviso temprano a la confirmación.'),
 ('c1','Del terremoto al acuse de recepción','Laboratorio científico: criptografía, cola persistente y evidencia.'),
 ('c2','Cada afirmación, con su nivel de evidencia','Implementado · Simulado · En investigación · Sin permisos.'),
 ('a5','810 escenarios virtuales · 12.150 invariantes','Verificación automática reproducible. No es evidencia de campo.'),
 ('p03','Código abierto · MIT · IA declarada','Desarrollo asistido por IA con revisión humana y CI público.'),
 ('a1','Buscamos validación física y socios','Pruebas con móviles reales · piloto con Protección Civil · financiación.'),
]
def font(p,s): return ImageFont.truetype(p,s)
for i,(img,t,sub) in enumerate(scenes,1):
    im=Image.open(f'{F}/{img}.png').convert('RGB').resize((1920,1080))
    # dim for legibility
    ov=Image.new('RGBA',(1920,1080),(0,0,0,0)); d=ImageDraw.Draw(ov)
    d.rectangle([0,0,1920,1080],fill=(5,9,12,70))
    d.rectangle([0,690,1920,1080],fill=(5,9,12,0))
    # lower third
    d.rectangle([80,770,1840,930],fill=(5,9,12,235)); d.rectangle([80,770,92,930],fill=CORAL+(255,))
    d.text((120,790),t,font=font(FB,58),fill=(242,244,244,255))
    d.text((120,868),sub,font=font(FR,32),fill=ICE+(255,))
    # top tag
    d.rectangle([80,60,610,112],fill=CORAL+(255,)); d.text((100,70),'CIVIC RELAY · INFORME',font=font(FB,30),fill=(5,9,12,255))
    d.text((1840-0,70),f'{i:02d}/12',font=font(FB,30),fill=(242,244,244,255),anchor='ra')
    # ticker
    d.rectangle([0,990,1920,1080],fill=(5,9,12,250))
    d.text((80,1013),'SIMULACIÓN · LABORATORIO DE INVESTIGACIÓN · TRL ≈ 3 · NO ES UN SERVICIO DE EMERGENCIAS · NO USAR EN EMERGENCIAS REALES',font=font(FB,26),fill=CORAL+(255,))
    ov.save(f'{O}/o{i:02d}.png'); im.save(f'{O}/s{i:02d}.png')
    # ken burns 5.5s (fade overlap 0.5s)
    z='zoompan=z=\'min(1.0+0.0006*on,1.12)\':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=165:s=1920x1080:fps=30'
    subprocess.run(['ffmpeg','-y','-loglevel','error','-loop','1','-i',f'{O}/s{i:02d}.png','-loop','1','-i',f'{O}/o{i:02d}.png','-filter_complex','[0]'+z+'[z];[z][1]overlay,format=yuv420p','-t','5.5',f'{O}/s{i:02d}.mp4'],check=True)
