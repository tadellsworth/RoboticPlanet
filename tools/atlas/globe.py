import numpy as np, math
from PIL import Image, ImageDraw
import os; D=os.path.dirname(os.path.abspath(__file__))+'/out/'
tex=np.asarray(Image.open(D+'tex.png').convert('RGB')).astype(float); H,W,_=tex.shape
N=560; out=Image.new('RGB',(N*3+80,N+120),(8,10,16)); dr=ImageDraw.Draw(out)
for k,(lon0,lat0) in enumerate([(-125,15),(-30,0),(110,-15)]):
    y,x=np.mgrid[0:N,0:N]; u=(x-N/2)/(N/2*0.92); v=-(y-N/2)/(N/2*0.92); r2=u*u+v*v; m=r2<=1
    z=np.sqrt(np.clip(1-r2,0,1))
    la0=math.radians(lat0)
    # rotate view
    yy=v*math.cos(la0)+z*math.sin(la0); zz=-v*math.sin(la0)+z*math.cos(la0)
    lat=np.arcsin(np.clip(yy,-1,1)); lon=np.arctan2(u,zz)+math.radians(lon0)
    lon=(lon+math.pi)%(2*math.pi)-math.pi
    tx=((lon+math.pi)/(2*math.pi)*W).astype(int)%W; ty=np.clip(((math.pi/2-lat)/math.pi*H).astype(int),0,H-1)
    col=tex[ty,tx]; light=np.clip(0.25+0.85*(u*-0.5+v*0.35+z*0.8),0.15,1.1)
    img=np.zeros((N,N,3)); img[m]=(col[m]*light[m][:,None])
    rim=(r2>0.93)&m; img[rim]=img[rim]*0.7+np.array([120,160,190])*0.3
    out.paste(Image.fromarray(np.clip(img,0,255).astype(np.uint8)),(20+k*(N+20),20),Image.fromarray((m*255).astype(np.uint8)))
    dr.text((20+k*(N+20)+N/2,N+60),['The Rust and Greenreach','The Warm Sea, the Shoals and the Long Grass','Cinderlands and the Bloom'][k],fill=(230,220,200),anchor='mm',font=__import__('PIL.ImageFont',fromlist=['x']).truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',30))
out.save(D+'ithaca-globe.png')
