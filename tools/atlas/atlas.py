import numpy as np, json, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os; OUT=os.path.dirname(os.path.abspath(__file__))+'/out/'; os.makedirs(OUT, exist_ok=True)
W,H=2400,1200
lon=np.linspace(-180,180,W,endpoint=False)+180/W; lat=np.linspace(90,-90,H,endpoint=False)-90/H
LO,LA=np.meshgrid(np.radians(lon),np.radians(lat))
X=np.cos(LA)*np.cos(LO); Y=np.cos(LA)*np.sin(LO); Z=np.sin(LA)
rng=np.random.default_rng(7)
def vnoise(x,y,z,f,seed):
    r=np.random.default_rng(seed); g=r.random((64,64,64))
    x=(x+2)*f; y=(y+2)*f; z=(z+2)*f
    xi=np.floor(x).astype(int); yi=np.floor(y).astype(int); zi=np.floor(z).astype(int)
    xf=x-xi; yf=y-yi; zf=z-zi
    s=lambda t:t*t*(3-2*t); u,v,w=s(xf),s(yf),s(zf)
    def G(a,b,c): return g[(xi+a)%64,(yi+b)%64,(zi+c)%64]
    l=lambda a,b,t:a+(b-a)*t
    return l(l(l(G(0,0,0),G(1,0,0),u),l(G(0,1,0),G(1,1,0),u),v),l(l(G(0,0,1),G(1,0,1),u),l(G(0,1,1),G(1,1,1),u),v),w)
def fbm(x,y,z,f,seed,o=5):
    t=0;a=1;n=0
    for i in range(o): t+=a*vnoise(x,y,z,f*2**i,seed+i); n+=a; a*=0.5
    return t/n
# territories: name, region, lon, lat, radius(deg)
T=[
 ("Pathfinder's Landing","rust",-118,24,26),("Redwash Flats","rust",-152,30,26),("Dustgate","rust",-108,-4,26),("Ironbluff","rust",-145,-6,26),
 ("Passenger Town","green",-86,30,22),("Tallpine","green",-74,56,22),("Stillwater","green",-100,50,20),
 ("Goldleaf","ember",-160,58,22),("Foxford","ember",-128,62,22),
 ("Herdway","grass",-22,20,24),("Ledger Post","grass",2,34,24),("Windsweep","grass",-12,0,24),
 ("the Delta","black",-22,-26,22),("Heron Reach","black",4,-30,22),
 ("Northcap","polar",-80,80,0),("Southcap","polar",80,-80,0),
 ("Ringfall Basin","cinder",80,-30,25),("Ashfield","cinder",112,-42,25),("Cinder Rift","cinder",68,-54,23),
 ("the Terraces","steam",108,14,22),("Geyser Field","steam",80,10,22),
 ("Palm Keys","shoals",-60,-4,13),("Lantern Reef","shoals",-56,-22,13),
 ("Violet Reach","bloom",146,-20,24),("Bloom Edge","bloom",150,12,22),
]
REG={'rust':("THE RUST",(196,92,62)),'green':("GREENREACH",(78,122,64)),'ember':("EMBERWOOD",(186,128,58)),
 'grass':("THE LONG GRASS",(176,156,98)),'black':("BLACKWATER",(70,88,70)),'polar':("THE POLAR CAPS",(228,232,236)),
 'cinder':("CINDERLANDS",(92,86,84)),'steam':("STEAMWELLS",(178,170,132)),'shoals':("THE SHOALS",(214,196,150)),'bloom':("THE BLOOM",(122,84,158))}
def vec(lo,la):
    lo,la=math.radians(lo),math.radians(la); return np.array([math.cos(la)*math.cos(lo),math.cos(la)*math.sin(lo),math.sin(la)])
# warped coordinates
wx=X+0.22*(fbm(X,Y,Z,2.5,11)-0.5); wy=Y+0.22*(fbm(X,Y,Z,2.5,21)-0.5); wz=Z+0.22*(fbm(X,Y,Z,2.5,31)-0.5)
nrm=np.sqrt(wx**2+wy**2+wz**2); wx/=nrm; wy/=nrm; wz/=nrm
best=np.full(X.shape,-9.0); tid=np.full(X.shape,-1); bestang=np.full(X.shape,9.0)
for i,(n,r,lo,la,rad) in enumerate(T):
    if r=='polar': continue
    v=vec(lo,la); d=wx*v[0]+wy*v[1]+wz*v[2]; ang=np.degrees(np.arccos(np.clip(d,-1,1)))
    sc=-ang/rad
    m=sc>best; best[m]=sc[m]; tid[m]=i; bestang[m]=ang[m]
coast=fbm(X,Y,Z,5,41,6)
wt=np.cos(LA)
pole=np.abs(np.degrees(LA))>70
def frac(off):
    L=(best>-1.0-0.9*(coast-0.5)+off)
    return ((L|pole)*wt).sum()/wt.sum()
lo_,hi_=-0.6,0.6
for _ in range(25):
    m_=(lo_+hi_)/2
    if frac(m_)>0.665: lo_=m_
    else: hi_=m_
OFF=lo_
land=(best>-1.0-0.9*(coast-0.5)+OFF)
# shoals: islets only
sh=np.isin(tid,[i for i,t in enumerate(T) if t[1]=='shoals'])
isl=fbm(X,Y,Z,18,51,4)
land&=~sh | ((isl>0.55)&(best>-1.0))
print('land fraction',((land|pole)*wt).sum()/wt.sum())
# poles
pn=np.degrees(LA)>(70+14*(fbm(X,Y,Z,4,61,5)-0.5)); ps=np.degrees(LA)<(-70+14*(fbm(X,Y,Z,4,71,5)-0.5))
iN=[t[0] for t in T].index('Northcap'); iS=[t[0] for t in T].index('Southcap')
tid[pn]=iN; tid[ps]=iS; land|=pn|ps
tid[~land]=-1
# colour
img=np.zeros((H,W,3))
det=fbm(X,Y,Z,14,81,5)
for i,t in enumerate(T):
    c=np.array(REG[t[1]][1],float); m=tid==i
    img[m]=c*(0.82+0.36*det[m])[:,None]
# sea
seaMask=Image.fromarray((land*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))
near=np.asarray(seaMask)/255.0
deep=np.array([28,54,72]); shallow=np.array([52,120,128])
sea=deep+(shallow-deep)*np.clip(near*2.2,0,1)[...,None]
sea*= (0.92+0.16*fbm(X,Y,Z,8,91,3))[...,None]
img[~land]=sea[~land]
# strike belt: craters along a tilted great circle
def beltlat(lo): return 28*np.cos(np.radians(lo+120))
bl=beltlat(lon)
img=np.clip(img,0,255).astype(np.uint8)
im=Image.fromarray(img).convert('RGBA')
ov=Image.new('RGBA',im.size,(0,0,0,0)); d=ImageDraw.Draw(ov)
px=lambda lo,la:((lo+180)/360*W,(90-la)/180*H)
# craters
cr=np.random.default_rng(5)
for k in range(260):
    lo=cr.uniform(-180,180); la=beltlat(lo)+cr.normal(0,6)
    x,y=px(lo,la); i,j=int(x)%W,int(min(max(y,0),H-1))
    if not land[j,i] or tid[j,i] in (iN,iS): continue
    r=cr.uniform(2,9)*(3 if k<6 else 1)
    d.ellipse([x-r,y-r,x+r,y+r],outline=(40,30,28,150),width=2,fill=(0,0,0,40))
im=Image.alpha_composite(im,ov)
# The menu planet's face (art/lore/ithaca-map.webp, read by js/menuplanet.js): the same map, small, unlabelled and with
# no borders: the regions' colours blended softly across their seams (a little darker along them), the coasts a little
# paler, the same craters (drawn twice as wide, so they still show that small). Its alpha holds the colonies' night
# lights: 255 none, 254 down to 225 ever brighter; towns along the coasts and in the territories' hearts, never on the
# ice, few in the Bloom.
def menu_map():
    import scipy.ndimage as nd
    MW,MH=512,256; SS=2  # (drawn at twice the size, then shrunk)
    col=img.astype(float); lm=land.astype(float)
    s=9.0  # (full-size px: about two of the small map's)
    bl=np.stack([nd.gaussian_filter(col[...,c]*lm,s,mode=('nearest','wrap')) for c in range(3)],-1)
    bw=nd.gaussian_filter(lm,s,mode=('nearest','wrap'))[...,None]
    soft=np.where(land[...,None],bl/np.maximum(bw,1e-6),col)
    rid0=np.array([list(REG).index(T[k][1]) if k>=0 else -1 for k in range(-1,len(T))])[tid+1]
    seam=((rid0!=np.roll(rid0,1,1))|(rid0!=np.roll(rid0,1,0)))&land&np.roll(land,1,1)&np.roll(land,1,0)
    ridge=np.clip(nd.gaussian_filter(seam.astype(float),5,mode=('nearest','wrap'))*6,0,1)
    soft*=(1-0.12*ridge)[...,None]
    shore=np.clip(1-nd.distance_transform_edt(land)/7,0,1)*land*~(pn|ps)
    soft+=(np.array([226,204,170])-soft)*(0.3*shore)[...,None]
    big=Image.fromarray(np.clip(soft,0,255).astype(np.uint8)).resize((MW*SS,MH*SS),Image.LANCZOS).convert('RGBA')
    co=Image.new('RGBA',big.size,(0,0,0,0)); cd=ImageDraw.Draw(co); k_=MW*SS/W
    cr=np.random.default_rng(5)  # (the atlas's craters, in the same order)
    for k in range(260):
        lo=cr.uniform(-180,180); la=beltlat(lo)+cr.normal(0,6)
        x,y=px(lo,la); i,j=int(x)%W,int(min(max(y,0),H-1))
        if not land[j,i] or tid[j,i] in (iN,iS): continue
        r=cr.uniform(2,9)*(3 if k<6 else 1)*k_*2.2; x*=k_; y*=k_
        cd.ellipse([x-r,y-r,x+r,y+r],outline=(40,30,28,150),width=SS,fill=(0,0,0,40))
    small=Image.alpha_composite(big,co).convert('RGB').resize((MW,MH),Image.LANCZOS)
    # the lights, on the small map
    sl=np.asarray(Image.fromarray(land.astype(np.uint8)*255).resize((MW,MH),Image.BOX))>127
    st=np.asarray(Image.fromarray((tid+1).astype(np.uint8)).resize((MW,MH),Image.NEAREST)).astype(int)-1
    ice=(st==iN)|(st==iS)
    coast=np.clip(1-(nd.distance_transform_edt(sl)-1)/3,0,1)*sl
    slon=np.linspace(-180,180,MW,endpoint=False)+180/MW; slat=np.linspace(90,-90,MH,endpoint=False)-90/MH
    SLO,SLA=np.meshgrid(np.radians(slon),np.radians(slat))
    P=np.stack([np.cos(SLA)*np.cos(SLO),np.cos(SLA)*np.sin(SLO),np.sin(SLA)],-1)
    heart=np.zeros((MH,MW))
    for n,r,lo,la,rad in T:
        if r=='polar': continue
        ang=np.degrees(np.arccos(np.clip(P@vec(lo,la),-1,1)))
        heart=np.maximum(heart,np.clip(1-ang/(rad*0.45),0,1))
    few={'bloom':0.3,'cinder':0.7,'shoals':0.8}
    rmul=np.ones((MH,MW))
    for k,t_ in enumerate(T): rmul[st==k]=few.get(t_[1],1.0)
    lr=np.random.default_rng(13)
    p=(0.012+0.07*coast+0.09*heart**1.5)*rmul*sl*~ice
    lit=lr.random((MH,MW))<p
    a=np.full((MH,MW),255,np.uint8)
    a[lit]=(254-lr.integers(0,30,lit.sum())).astype(np.uint8)
    dst=os.path.normpath(os.path.join(OUT,'..','..','..','art','lore','ithaca-map.webp'))
    Image.fromarray(np.dstack([np.asarray(small),a]),'RGBA').save(dst,quality=82,method=6,alpha_quality=100,exact=True)
    print('menu map:',dst,'lights',int(lit.sum()),'of',int(sl.sum()),'land texels')
menu_map()
# borders
t=tid
bt=np.zeros(t.shape,bool); br=np.zeros(t.shape,bool)
rid=np.array([list(REG).index(T[k][1]) if k>=0 else -1 for k in range(-1,len(T))])[t+1]
for a,b in [(t[:,1:],t[:,:-1]),(t[1:,:],t[:-1,:])]:
    pass
dt=(t!=np.roll(t,1,1))|(t!=np.roll(t,1,0)); dr=(rid!=np.roll(rid,1,1))|(rid!=np.roll(rid,1,0))
both=land&np.roll(land,1,1)&np.roll(land,1,0)
arr=np.array(im)
arr[dt&both&~dr]=(arr[dt&both&~dr]*0.55).astype(np.uint8)
drm=np.asarray(Image.fromarray((dr&both*1).astype(np.uint8)*255).filter(ImageFilter.MaxFilter(3)))>0
arr[drm&land]=[34,24,22,255]
cm=np.asarray(Image.fromarray(land.astype(np.uint8)*255).filter(ImageFilter.FIND_EDGES))>0
arr[cm]=[230,214,180,255]
im=Image.fromarray(arr)
flat_noLabel=im.copy()
# adjacency
adj=set()
for a,b in [(t,np.roll(t,1,1)),(t[1:],t[:-1])]:
    m=(a>=0)&(b>=0)&(a!=b)
    for p,q in set(zip(a[m].tolist(),b[m].tolist())): adj.add(tuple(sorted((p,q))))
names=[x[0] for x in T]
json.dump({'adj':[[names[p],names[q]] for p,q in sorted(adj)]},open(OUT+'adj.json','w'),indent=0)
np.save(OUT+'tid.npy',tid)
# labels
TOP,BOT=90,330
can=Image.new('RGBA',(W,H+TOP+BOT),(20,24,30,255)); can.paste(im,(0,TOP)); im=can
d=ImageDraw.Draw(im)
F=lambda s,it=False:ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-%s.ttf'%('Italic' if it else 'Regular'),s)
FBs=lambda s:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf',s)
px=lambda lo,la:((lo+180)/360*W,(90-la)/180*H+TOP)
def text(x,y,s,f,fill=(250,240,215,255),sp=0,anchor='mm'):
    if sp: s=(' '*sp).join(s)
    d.text((x+2,y+2),s,font=f,fill=(0,0,0,190),anchor=anchor); d.text((x,y),s,font=f,fill=fill,anchor=anchor)
regpos={'rust':(-128,12),'green':(-86,42),'ember':(-142,70),'grass':(-8,12),'black':(-8,-42),'cinder':(92,-44),'steam':(94,24),'shoals':(-62,3),'bloom':(150,-4)}
for r,(lo,la) in regpos.items(): text(*px(lo,la),REG[r][0],FBs(30),sp=1)
text(*px(-60,84),REG['polar'][0],FBs(28),fill=(50,62,84,255),sp=1); text(*px(120,-85),REG['polar'][0],FBs(28),fill=(50,62,84,255),sp=1)
for n,r,lo,la,rad in T:
    if r=='polar': lo,la={'Northcap':(-110,77),'Southcap':(40,-77)}[n]
    text(*px(lo,la-4.5),n,F(23,True),fill=(255,250,232,255) if r!='polar' else (36,46,66,255))
seas=[("THE WARM SEA",-68,-40),("THE NARROWS",44,-4),("THE LONG SEA",-176,-48),("THE COLD SEA",40,50),("THE GREY SOUND",40,-56)]
for s_,lo,la in seas: text(*px(lo,la),s_,F(32,True),fill=(160,205,212,230),sp=1)
COL={'U':(120,230,255),'P':(255,226,110),'T':(255,240,200),'$':(140,255,170),'x':(255,120,100),'S':(205,175,255),'B':(225,150,255),'o':(255,255,255)}
LM=[('U','Northcap Uplink',-80,74),('U','Lantern Reef Uplink',-56,-18),('U','Stillwater Uplink',-104,54),
 ('P',"the Pathfinder's hull",-116,29),('T','Passenger Town',-84,34),('$','Ledger Post',0,38),('$','Spring Market',76,14),
 ('x','wreck of the Kestrel',-30,-20),('x','wreck of the Ninth Survey',118,-36),('x','wreck of the Halvard',-166,64),
 ('S','the Ring Shard Spire',78,-25),('o','the Long Falls',-74,61),('o','the Stone Forest',-156,35),('o','Glass Lake',-130,82),
 ('o','the Clock Geyser',110,19),('B','the Breach Fields',144,-15)]
for k,label,lo,la in LM:
    x,y=px(lo,la); c=COL[k]
    if k=='U': d.polygon([(x,y-11),(x+9,y),(x,y+11),(x-9,y)],fill=c+(255,),outline=(0,0,0,255))
    elif k=='x': d.line([x-8,y-8,x+8,y+8],fill=c,width=5); d.line([x-8,y+8,x+8,y-8],fill=c,width=5)
    elif k=='$': d.rectangle([x-7,y-7,x+7,y+7],fill=c+(255,),outline=(0,0,0,255),width=2)
    else: d.ellipse([x-7,y-7,x+7,y+7],fill=c+(255,),outline=(0,0,0,255),width=2)
    text(x+13,y,label,F(19),fill=c+(255,),anchor='lm')
pts=[px(lo,beltlat(lo)) for lo in range(-180,181,3)]
for i in range(0,len(pts)-1,2): d.line([pts[i],pts[i+1]],fill=(255,205,140,150),width=3)
text(*px(-178,beltlat(-178)+4),'ringfall belt',F(21,True),fill=(255,212,150,240),anchor='lm')
x,y=px(146,-20); d.ellipse([x-80,y-55,x+80,y+55],outline=(235,175,255,230),width=3)
text(x,y+70,'the Hollow lies beneath',F(20,True),fill=(235,195,255,255))
# header
text(W/2,46,'ITHACA I',FBs(40),fill=(255,232,196,255),sp=1)
text(W-20,46,'Atlas: draft for the owner\'s approval',F(24,True),fill=(200,190,170,255),anchor='rm')
text(20,46,'Pathfinder survey, revised T+31',F(24,True),fill=(200,190,170,255),anchor='lm')
# legend band
y0=H+TOP+30
ax,ay,R=W-200,y0+140,130
d.ellipse([ax-R,ay-R,ax+R,ay+R],fill=(126,126,130,255),outline=(220,220,220,255),width=3)
cr2=np.random.default_rng(3)
for k in range(36):
    a=cr2.uniform(0,6.28); rr=R*math.sqrt(cr2.uniform(0,0.8)); r=cr2.uniform(3,14)
    x,y=ax+rr*math.cos(a),ay+rr*math.sin(a); d.ellipse([x-r,y-r,x+r,y+r],outline=(88,88,92,255),width=2)
x,y=ax-40,ay-30; d.polygon([(x,y-11),(x+9,y),(x,y+11),(x-9,y)],fill=COL['U']+(255,),outline=(0,0,0,255))
text(x+13,y,'Lunar Relay',F(19),fill=COL['U']+(255,),anchor='lm'); text(ax+20,ay+55,'Silent Crater',F(20,True))
text(ax,y0-6,'ARGOS, the moon',FBs(24)); text(ax-R-20,ay+R-10,'reached by orbit only · no Murmur',F(18,True),anchor='rm')
items=[('U','Uplink (a fifth is dealt per run in Contingency)'),('$','Trade Post (neutral)'),('P',"the Pathfinder's hull"),('T','Passenger Town, the empty town'),
 ('x','wreck of a failed landing (a log to recover)'),('S','fallen Ring shard'),('B','breaches into the Hollow'),('o','named place')]
for i,(k,lab) in enumerate(items):
    x=60+(i//4)*760; y=y0+40+(i%4)*52; c=COL[k]
    if k=='U': d.polygon([(x,y-11),(x+9,y),(x,y+11),(x-9,y)],fill=c+(255,),outline=(0,0,0,255))
    elif k=='x': d.line([x-8,y-8,x+8,y+8],fill=c,width=5); d.line([x-8,y+8,x+8,y-8],fill=c,width=5)
    elif k=='$': d.rectangle([x-7,y-7,x+7,y+7],fill=c+(255,),outline=(0,0,0,255),width=2)
    else: d.ellipse([x-7,y-7,x+7,y+7],fill=c+(255,),outline=(0,0,0,255),width=2)
    text(x+20,y,lab,F(24),anchor='lm')
d.line([1560,y0+20,1560,y0+240],fill=(90,90,90,255),width=2)
text(1000,y0+272,'thin lines: Contingency territories · thick lines: regions · dashed: the ringfall belt (strike sites cluster under it)',F(20,True),fill=(190,185,170,255),anchor='mm')
im.convert('RGB').save(OUT+'ithaca-atlas.png')
flat_noLabel.convert('RGB').save(OUT+'tex.png')
print(len(adj))
