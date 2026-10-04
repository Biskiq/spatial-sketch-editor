from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
root=Path('/Users/tony/Documents/Biskiq/spatial-sketch-editor')
out=root/'prototypes/spatial-authoring/screens/experience-conformance'
boards=root/'prototypes/integrated-experience-authoring/Design-QAs'
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22)
def pair(a,b,name,left='Original Design-QA board',right='Current product-reachable state',width=1440):
    images=[Image.open(p).convert('RGB') for p in (a,b)]
    images=[im.resize((width,round(im.height*width/im.width)),Image.Resampling.LANCZOS) for im in images]
    canvas=Image.new('RGB',(width*2+20,max(im.height for im in images)+46),'#eeede8')
    draw=ImageDraw.Draw(canvas)
    for x,title,im in [(0,left,images[0]),(width+20,right,images[1])]:
        draw.text((x+10,12),title,fill='#202422',font=font);canvas.paste(im,(x,46))
    canvas.save(out/(name+'.jpg'),quality=94,subsampling=0)
    return canvas
mapping=[
 ('qa-1-ordinary','Museum Piano Hall Tour Editor.png'),
 ('qa-2-overview','Museum Tour Planner Interface.png'),
 ('qa-3-occurrence','Museum Guide Planning Dashboard.png'),
 ('qa-4-route','Museum Floorplan Route Editor.png'),
 ('qa-5-coordination','Museum Hall Tour Dashboard Mockup.png'),
 ('qa-6-precise','Under the Lid_ Hall Tour Editor.png'),
 ('qa-6-outside','Museum Camera View Editor.png'),
 ('qa-3-scope','Museum Tour Editor Interface.png')]
for state,board in mapping:pair(boards/board,out/(state+'.png'),state+'-board-pair')
for a,b,name in [('qa-1-ordinary','qa-2-overview','transition-set-overview'),('qa-2-overview','qa-3-occurrence','transition-overview-occurrence'),('qa-4-route','qa-5-coordination','transition-route-coordination'),('qa-6-precise','qa-6-visitor','transition-precision-preview')]:
    pair(out/(a+'.png'),out/(b+'.png'),name,left=a,right=b)
thumbs=[]
for state,board in mapping[:6]:
    im=Image.open(out/(state+'-board-pair.jpg'));im.thumbnail((1600,600),Image.Resampling.LANCZOS);thumbs.append(im)
gallery=Image.new('RGB',(1600,sum(im.height for im in thumbs)+50),'#eeede8')
y=0
for im in thumbs:gallery.paste(im,(0,y));y+=im.height
gallery.save(out/'six-state-review.jpg',quality=94)
print('Eight full-board pairs, four required transition pairs, six-state gallery saved.')
