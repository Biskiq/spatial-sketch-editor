from pathlib import Path
from math import cos, pi, sqrt
from html import escape

OUT = Path(__file__).parent
INK, FOREST, GREEN, PAPER, LINE = '#1b201c', '#11291f', '#4f8f6c', '#f5f6f4', '#d5dbd5'
GOLD, GOLDINK, SLATE, RED = '#d4ad45', '#74560c', '#56707c', '#7e2718'

def text(x,y,s,size=15,fill=INK,weight=400,anchor='start'):
    return f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" font-weight="{weight}" text-anchor="{anchor}">{escape(str(s))}</text>'
def rect(x,y,w,h,fill='none',stroke='none',r=0,extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" {extra}/>'
def line(x,y,xx,yy,color=LINE,width=1,dash=''):
    return f'<path d="M{x},{y} L{xx},{yy}" fill="none" stroke="{color}" stroke-width="{width}" stroke-dasharray="{dash}"/>'
def poly(ps,fill,stroke='none',sw=1,extra=''):
    return '<polygon points="'+' '.join(f'{x:.2f},{y:.2f}' for x,y in ps)+f'" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" {extra}/>'
def path(d,stroke=INK,width=2,fill='none',extra=''):
    return f'<path d="{d}" stroke="{stroke}" stroke-width="{width}" fill="{fill}" stroke-linejoin="round" stroke-linecap="round" {extra}/>'
def circle(x,y,r,fill,stroke='none',width=1):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{width}"/>'
def button(x,y,w,label,primary=False,active=False):
    return rect(x,y,w,34,FOREST if primary else ('#f3f0e4' if active else '#ffffff'),LINE,5)+text(x+w/2,y+22,label,14,'#ffffff' if primary else INK,500,'middle')
def pill(x,y,label,color=SLATE,w=None):
    w=w or len(label)*7.2+22
    return rect(x,y,w,27,'#ffffff',LINE,4)+text(x+11,y+18,label,12,color,500)

def band(y,c=200,r=100):
    q=abs(y-c)/r
    return 0 if q>=1 else (1+cos(pi*q))/2
def smooth(q):
    q=max(0,min(1,q)); return q*q*(3-2*q)
def bounds(y):
    return -150+190*smooth((y-280)/140),150-110*smooth((y-240)/180)
def shape(x,y,z,edited=False,arc=False):
    if edited: x=-150+(x+150)*(1-.1*band(y))
    if arc:
        ramp=max(0,min(1,(x+150)/270))**3
        radius=140**2/(8*18)+18/2
        displacement=sqrt(max(0,radius**2-z*z))-(radius-18)
        x-=displacement*band(y)*ramp
    return x,y,z
def project(p,ox,oy,scale):
    x,y,z=p; return ox+scale*(x+.62*z),oy+scale*(-y+.26*z)
def body(ox,oy,scale,edited=False,arc=False,selected=False,ghost=False,kept=False,show_change=False):
    pts=[]
    for i in range(29):
        y=i*15; pts.append((bounds(y)[0],y))
    for i in reversed(range(28)):
        y=i*15; pts.append((bounds(y)[1],y))
    near=[project(shape(x,y,-70,edited,arc),ox,oy,scale) for x,y in pts]
    far=[project(shape(x,y,70,edited,arc),ox,oy,scale) for x,y in pts]
    a='<g opacity=".20">' if ghost else '<g>'
    a+=f'<ellipse cx="{ox}" cy="{oy+30}" rx="{190*scale}" ry="{38*scale}" fill="#ccd2c8" opacity=".45"/>'
    a+=poly(far,'#88947d')
    for i in range(len(pts)):
        j=(i+1)%len(pts)
        for iz in range(8):
            z0,z1=-70+140*iz/8,-70+140*(iz+1)/8
            x,y=pts[i]; xx,yy=pts[j]
            ps=[project(shape(px,py,pz,edited,arc),ox,oy,scale) for px,py,pz in [(x,y,z0),(x,y,z1),(xx,yy,z1),(xx,yy,z0)]]
            a+=poly(ps,'#7c8d72' if i<28 else '#667a60')
            if show_change and arc and i>=28 and 100<y<300:
                a+=poly(ps,GREEN,'none',1,'fill-opacity=".28"')
    a+=poly(near,'#a8b39a',GOLD if selected else '#73846d',2 if selected else .6)
    if kept:
        lo,hi=bounds(60)
        ps=[project(shape(-150,0,-70,edited,arc),ox,oy,scale),project(shape(150,0,-70,edited,arc),ox,oy,scale),project(shape(hi,60,-70,edited,arc),ox,oy,scale),project(shape(lo,60,-70,edited,arc),ox,oy,scale)]
        a+=poly(ps,'url(#keep)',SLATE,1)
    a+='</g>'
    return a
def plane(ox,oy,scale,y,fill=False,stroke='#b5a11c',dashed=False):
    ps=[project(p,ox,oy,scale) for p in [(-180,y,-100),(180,y,-100),(180,y,100),(-180,y,100)]]
    return poly(ps,'#f2d000' if fill else 'none',stroke,1.5,('fill-opacity=".10" ' if fill else '')+('stroke-dasharray="5 5"' if dashed else ''))
def floor():
    a=''
    for i in range(-5,6): a+=line(690+i*65,390,690+i*175,750,'#dce1db')
    for y in [455,505,565,640,735]: a+=line(200,y,1380,y,'#dce1db')
    return a
def header(focus=False):
    a=rect(0,76,1440,56,FOREST)
    a+=text(24,112,'biskiq',24,'#f3f4ee',600)
    a+=text(154,110,'World',14,'#dce5dd')
    a+=text(244,110,'Scene  /  Crest  /  Shape' if focus else 'Scene  /  Studio',15,'#ffffff',500)
    if focus: a+=button(1270,87,146,'Return to Scene')
    else: a+=text(1390,110,'Saved locally',12,'#c4d4c8',400,'end')
    return a
def dock(focus=False,ink=False):
    labels=['Select','Ink','Slice','Measure'] if focus else ['Select','Ink','Slice','Eraser','Brush','Measure']
    w=88*len(labels)+20; x=(1440-w)/2
    a=rect(x,747,w,46,FOREST,r=9)
    for i,s in enumerate(labels):
        xx=x+10+i*88
        if (s=='Ink' and ink) or (s=='Select' and not ink): a+=rect(xx,754,83,32,'#f3f0e4',r=5)
        a+=text(xx+41,775,s,13,INK if ((s=='Ink')==ink and s in ['Select','Ink']) else '#e4e9e4',500,'middle')
    return a
def field(x,y,label,value,selected=False):
    return text(x,y,label,12,'#647168')+rect(x,y+10,198,34,'#ffffff',GOLD if selected else LINE,4)+text(x+12,y+32,value,16,INK,500)
def card(kind='scene',edited=False):
    x,y=1162,159
    h={'scene':345,'draft':332,'focus':414,'invalid':414}[kind]
    a=rect(x,y,250,h,'#ffffff',LINE,9)
    a+=text(x+18,y+30,'New shape' if kind=='draft' else 'Crest',21,INK,600)
    a+=text(x+18,y+52,'Native object · only this object',12,'#647168')
    a+=line(x+18,y+68,x+232,y+68)
    if kind=='scene':
        a+=field(x+18,y+95,'Height','420 mm')+field(x+18,y+159,'Width','300 mm')+field(x+18,y+223,'Depth','140 mm')
        a+=button(x+18,y+293,214,'Shape',True)
    elif kind=='draft':
        a+=field(x+18,y+95,'Depth','140 mm',True)+text(x+18,y+165,'Upright sheet',14)+text(x+18,y+190,'Extends behind the drawing',12,'#647168')
        a+=button(x+18,y+216,214,'Flip side')
        a+=button(x+18,y+272,214,'Create shape',True)
    elif not edited:
        a+=field(x+18,y+95,'Slice position','200 mm',True)
        a+=field(x+18,y+165,'Width at slice','300 mm')
        a+=text(x+18,y+236,'Select a contour or draw over it.',12,'#647168')
        a+=line(x+18,y+265,x+232,y+265)
        a+=text(x+18,y+294,'Kept  Base · below 60 mm',12,SLATE,500)
        a+=text(x+18,y+347,'More  ·  Keep part',12,'#647168')
    else:
        a+=field(x+18,y+95,'Edit' if kind=='invalid' else 'Bend','Freehand redraw' if kind=='invalid' else '18 mm',True)
        a+=text(x+18,y+160,'Endpoints stay',13)
        a+=line(x+18,y+178,x+232,y+178)
        a+=text(x+18,y+200,'Reach',12,'#647168')
        a+=button(x+18,y+212,99,'Local',active=True)+button(x+123,y+212,109,'Throughout')
        a+=text(x+18,y+274,'Below / above slice',12,'#647168')+text(x+18,y+300,'100 mm  /  100 mm',16,INK,500)
        a+=line(x+18,y+319,x+232,y+319)+text(x+18,y+345,'Kept  Base · below 60 mm',12,SLATE,500)
        a+=text(x+18,y+381,'More  ·  Keep part',12,'#647168')
    return a
def scene(edited=False,draft=False):
    a=rect(0,132,1440,688,'#f0f2ee')+floor()
    a+=rect(0,132,182,688,'#f5f6f4')+text(22,174,'Studio',19,INK,600)+text(22,218,'Objects',12,'#647168')
    a+=rect(12,232,158,36,'#e7eadf',r=4)+text(24,256,'Crest' if not draft else 'New shape',14,INK,600)
    a+=text(24,296,'Plaque',14,'#647168')
    a+=poly([(950,580),(1037,589),(1037,480),(950,471)],'#d7bba2','#aa907b')+line(993,584,993,635,'#a18e7e',4)
    a+=body(690,687,1.1,edited,edited,not draft,kept=False)
    if draft:
        a+=poly([(458,716),(908,716),(908,190),(458,190)],'#f2d000','#a69931',1,'fill-opacity=".06"')
        a+=pill(470,162,'Upright · sheet stays here',GOLDINK,236)
        a+=button(470,200,94,'Upright',active=True)+button(571,200,74,'Flat')+button(652,200,84,'Face me')
        a+=line(838,494,926,516,'#ffffff',2,'6 4')+circle(838,494,4,'#ffffff')
        a+=pill(858,535,'Depth 140 mm',INK,130)
        a+=rect(433,690,430,39,FOREST,r=6)+text(450,715,'Sketch    Line    Box    Round       Shape on',14,'#f3f4ee')
    else:
        a+=circle(690,685,6,'#ffffff',GOLD,2)+line(690,678,690,633,'#ffffff',2,'4 4')
        a+=line(860,663,860,285,'#ffffff',2,'6 4')+pill(873,401,'Height 420 mm · base stays',INK,226)
        a+=pill(505,180,'Crest · native object',GOLDINK,193)
    a+=header()+card('draft' if draft else 'scene',edited)+dock(ink=draft)
    if edited: a+=pill(346,157,'Same placement · shape updated',GREEN,274)
    return a
def drawing(pending=False,invalid=False):
    x0,y0=75,200
    a=rect(0,132,576,688,'#fafbf9')+line(576,132,576,820,LINE)
    a+=text(28,169,'Drawing',19,INK,600)+text(28,195,'Actual section through the object',12,'#647168')
    for x,label in [(28,'Front'),(119,'Side'),(204,'Top')]: a+=button(x,218,80,label,active=label=='Top')
    a+=pill(28,270,'200 mm above base',INK,195)
    for x in range(37,560,40): a+=line(x,330,x,627,'#e5e9e3')
    for y in range(347,640,40): a+=line(28,y,550,y,'#e5e9e3')
    a+=rect(114,389,307.8 if pending else 342,159.6,'url(#section)','#83937e',1)
    if pending:
        a+=rect(114,389,307.8,159.6,'none','#9aa59b',0,extra='stroke-dasharray="5 5"')
        d='M421.8,389 A165.4267,165.4267 0 0 0 421.8,548.6' if not invalid else 'M421.8,389 Q-240,468.8 421.8,548.6'
        a+=path('M421.8,389 H114 V548.6 H421.8',INK,2)
        a+=path(d,RED if invalid else GOLD,3,extra='stroke-dasharray="7 4"' if invalid else '')
        a+=circle(421.8,389,5,'#ffffff',INK,1.5)+circle(421.8,548.6,5,'#ffffff',INK,1.5)
        if invalid:
            a+=circle(114,448,6,'#ffffff',RED,2)+circle(114,490,6,'#ffffff',RED,2)
        a+=text(110,603,'Dashed: accepted shape',12,'#647168')
        a+=text(110,626,'Proposed stretch',12,RED if invalid else GOLDINK)
    else: a+=rect(114,389,342,159.6,'none',INK)
    a+=line(114,353,456 if not pending else 421.8,353,INK,1)
    a+=line(114,346,114,360,INK)+line(456 if not pending else 421.8,346,456 if not pending else 421.8,360,INK)
    a+=text(270,338,'Accepted: 270 mm' if invalid else ('270 mm' if pending else '300 mm'),15,INK,500,'middle')
    a+=line(486,389,486,548.6,INK)+text(497,473,'140',13,INK)
    a+=line(28,676,85,676,INK,2)+text(28,700,'50 mm',12,'#647168')
    a+=text(28,737,'Ink on the contour to replace a stretch.',13,'#647168')
    return a
def focused(pending=False,invalid=False,clean=False):
    a=rect(0,132,1440,688,'#eef1eb')
    a+=poly([(1050,650),(1138,665),(1138,465),(1050,450)],'#bfc8bb','none',1,'opacity=".32"')
    a+=text(644,169,'Object in its Scene',19,INK,600)
    a+=pill(644,190,'Context visible · cannot be selected',SLATE,294)
    a+=body(857,684,.92,edited=pending or clean,arc=pending and not invalid,selected=True,kept=True,show_change=pending and not invalid)
    if pending:
        a+=plane(857,684,.92,100,False,GREEN,True)+plane(857,684,.92,300,False,GREEN,True)
        a+=poly([project(p,857,684,.92) for p in [(170,100,-75),(170,300,-75),(170,300,75),(170,100,75)]],GREEN,'none',1,'fill-opacity=".14"')
    a+=plane(857,684,.92,200,True)
    a+=line(1061,667,1061,314,INK,1.5)+circle(1061,487,6,GOLD)
    if pending:
        a+=circle(1061,570,5,'#ffffff',GREEN,2)+circle(1061,405,5,'#ffffff',GREEN,2)
        a+=text(1075,410,'300',12,GREEN)+text(1075,492,'200',12,GOLDINK)+text(1075,575,'100',12,GREEN)
    else:
        a+=text(1075,319,'420',12,INK)+text(1075,492,'200',12,GOLDINK)+text(1075,672,'0',12,INK)
    a+=pill(681,679,'Base kept · below 60 mm',SLATE,224)
    a+=drawing(pending,invalid)+header(True)+card('invalid' if invalid else 'focus',edited=pending)+dock(True,ink=pending)
    if pending:
        a+=rect(626,702,508,42,'#ffffff',LINE,6)
        if invalid:
            a+=text(640,727,'Contour crosses itself. Redraw this stretch.',12,RED,500)
        else:
            a+=text(640,727,'Local change · base and upper body stay',12,GREEN,500)
        a+=button(1162,702,112,'Discard')
        if invalid: a+=rect(1283,702,125,34,'#e3e6e1',r=5)+text(1345,724,'Apply',14,'#8b948c',500,'middle')
        else: a+=button(1283,702,125,'Apply',True)
    return a

def write(name,title,subtitle,content):
    defs='''<defs><pattern id="section" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M-2,10 L10,-2 M8,12 L12,8" stroke="#cfdbca" stroke-width="1"/></pattern><pattern id="keep" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#dce5e8" fill-opacity=".55"/><path d="M-2,9 L9,-2 M7,11 L11,7" stroke="#56707c" stroke-width=".8"/></pattern></defs>'''
    s=f'<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="850" viewBox="0 0 1440 850" role="img" aria-label="{escape(title)}"><style>text{{font-family:Arial,Helvetica,sans-serif}}path,polygon{{stroke-linejoin:round}}</style>{defs}'
    s+=rect(0,0,1440,850,'#ffffff')+text(22,30,title,23,INK,600)+text(22,55,subtitle,14,'#647168')+content
    s+=text(22,841,'Biskiq · Shape focus UX specification · illustrative state, not an implemented screen',11,'#647168')+'</svg>'
    (OUT/f'{name}.svg').write_text(s)

write('01-create','1. Start in the Scene','A visible upright sheet establishes orientation. A closed outline previews one separate body.',scene(draft=True))
write('02-scene','2. Compose directly','The selected object exposes proportions progressively. Shape opens precision without replacing the object.',scene())
write('03-focus','3. Enter Shape focus','One selected identity, one actual section, and the same object in a quieter spatial context.',focused())
write('04-redraw','4. Review the reach of a redraw','The old contour, proposed contour, affected band and kept base remain visible together.',focused(pending=True))
write('05-refusal','5. Keep invalid work editable','A crossing contour is refused. The accepted body remains visible; Apply cannot commit the attempt.',focused(pending=True,invalid=True))
write('06-return','6. Return to the Scene','The camera, selection, placement and appearance return. The accepted shape is already the same object.',scene(edited=True))
print('Wrote six SVG visual states.')
