# Renders the Campaigns hub pictures art/menu/contingency.webp (Ithaca I from orbit, from art/globe) and
# art/menu/missions.webp (the Command Base, a Worker and its first objective, from the game's own art).
# Run: python3 tools/menu_icons.py . art/menu
import sys, numpy as np
from PIL import Image, ImageDraw, ImageFilter
REPO = sys.argv[1]; OUT = sys.argv[2]
S = 640  # render at 2x, save 320
# ---------- Contingency: the planet from orbit ----------
tex = np.asarray(Image.open(REPO+'/art/globe/ithaca-2048.webp').convert('RGBA')).astype(np.float32)/255
cl = np.asarray(Image.open(REPO+'/art/globe/ithaca-clouds.webp').convert('L').resize((2048,1024))).astype(np.float32)/255
TH, TW = tex.shape[:2]
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
cx, cy, R = S*0.47, S*0.53, S*0.40
nx = (xx-cx)/R; ny = (yy-cy)/R; r2 = nx*nx+ny*ny; inside = r2 <= 1
nz = np.sqrt(np.clip(1-r2, 0, 1))
lon0, lat0 = np.radians(-128), np.radians(14)
# rotate view: point (nx,-ny,nz) in view space -> world
x, y, z = nx, -ny, nz
cl0, sl0 = np.cos(lat0), np.sin(lat0)
y2 = y*cl0 + z*sl0; z2 = -y*sl0 + z*cl0
lat = np.arcsin(np.clip(y2, -1, 1)); lon = np.arctan2(x, z2) + lon0
u = ((lon/np.pi+1)/2 % 1)*(TW-1); v = (0.5-lat/np.pi)*(TH-1)
ui, vi = u.astype(int), np.clip(v.astype(int), 0, TH-1)
col = tex[vi, ui, :3]; land = tex[vi, ui, 3]; cld = cl[vi, ui]
L = np.array([-0.55, 0.55, 0.63]); L /= np.linalg.norm(L)
ndl = nx*L[0] + (-ny)*L[1] + nz*L[2]
light = np.clip(ndl*1.1+0.08, 0.03, 1.15)
col = col*light[...,None]
col = col*(1-cld[...,None]*0.75) + cld[...,None]*0.85*np.clip(light,0.05,1)[...,None]
# glint on sea
h = L + np.array([0,0,1.0]); h /= np.linalg.norm(h)
spec = np.clip(nx*h[0]+(-ny)*h[1]+nz*h[2], 0, 1)**60 * (1-land) * 0.6
col = col + spec[...,None]
# limb haze
haze = (1-nz)**3
col = col*(1-haze[...,None]*0.5) + np.array([0.35,0.6,1.0])*haze[...,None]*0.55*np.clip(light+0.2,0,1)[...,None]
img = np.zeros((S,S,3), np.float32)
rng = np.random.RandomState(7)
for _ in range(260):
    sx, sy = rng.randint(0,S), rng.randint(0,S); b = rng.rand()**3
    img[sy, sx] = b
img = np.where(inside[...,None], col, img)
# halo
d = np.sqrt(r2)
halo = np.clip(1-(d-1)/0.09, 0, 1)*(d>1)
img = img + np.array([0.3,0.55,1.0])*(halo**2)[...,None]*0.7
# Argos
mx, my, mr = S*0.82, S*0.17, S*0.075
mnx = (xx-mx)/mr; mny = (yy-my)/mr; m2 = mnx**2+mny**2; mi = m2 <= 1
mnz = np.sqrt(np.clip(1-m2,0,1))
noise = Image.effect_noise((S,S), 40).filter(ImageFilter.GaussianBlur(2))
nz_ = np.asarray(noise).astype(np.float32)/255
mc = (0.55+0.25*(nz_-0.5))*np.clip((mnx*L[0]+(-mny)*L[1]+mnz*L[2])*1.1+0.05,0.03,1.1)
img = np.where(mi[...,None], mc[...,None]*np.array([1,0.98,0.95]), img)
img = np.clip(img,0,1)
Image.fromarray((img*255).astype(np.uint8)).resize((320,320), Image.LANCZOS).save(OUT+'/contingency.webp', quality=86)
# ---------- Missions: a first order on the ground ----------
g = Image.open(REPO+'/art/tiles/ground.webp').convert('RGB').resize((S,S))
canvas = g.convert('RGBA')
dr = ImageDraw.Draw(canvas, 'RGBA')
# soft vignette
v = Image.new('L',(S,S),0); vd = ImageDraw.Draw(v); vd.ellipse((S*0.0,S*0.0,S*1.0,S*1.0), fill=255); v = v.filter(ImageFilter.GaussianBlur(90))
dark = Image.new('RGBA',(S,S),(10,12,20,200)); canvas = Image.composite(canvas, Image.alpha_composite(canvas, dark), v)
dr = ImageDraw.Draw(canvas, 'RGBA')
lander = Image.open(REPO+'/art/buildings/lander@0.webp').convert('RGBA').resize((360,360), Image.LANCZOS)
canvas.alpha_composite(lander, (-110, 250))
# objective: a glowing cyan target ring up-right, and a dashed route to it
tx, ty = int(S*0.74), int(S*0.30)
glow = Image.new('RGBA',(S,S),(0,0,0,0)); gd = ImageDraw.Draw(glow)
for rr,a in ((62,60),(50,110)): gd.ellipse((tx-rr,ty-rr*0.62,tx+rr,ty+rr*0.62), outline=(56,212,255,a), width=10)
glow = glow.filter(ImageFilter.GaussianBlur(8)); canvas.alpha_composite(glow)
dr = ImageDraw.Draw(canvas, 'RGBA')
dr.ellipse((tx-52,ty-32,tx+52,ty+32), outline=(120,230,255,255), width=6)
dr.ellipse((tx-20,ty-12,tx+20,ty+12), fill=(56,212,255,200))
# chevron above the ring
dr.polygon([(tx-22,ty-92),(tx+22,ty-92),(tx,ty-56)], fill=(255,211,107,255))
# dashed route from the worker to the ring
wx, wy = int(S*0.50), int(S*0.60)
pts = [(wx, wy), (int(S*0.62), int(S*0.44)), (tx-30, ty+30)]
for (x0,y0),(x1,y1) in zip(pts, pts[1:]):
    n = int(np.hypot(x1-x0,y1-y0)//18)
    for k in range(n):
        if k%2: continue
        a0, a1 = k/n, min(1,(k+1)/n)
        dr.line((x0+(x1-x0)*a0, y0+(y1-y0)*a0, x0+(x1-x0)*a1, y0+(y1-y0)*a1), fill=(56,212,255,230), width=7)
worker = Image.open(REPO+'/art/bots/worker@0-f0.webp').convert('RGBA').resize((150,150), Image.LANCZOS).rotate(40, expand=True, resample=Image.BICUBIC)
canvas.alpha_composite(worker, (wx-worker.width//2, wy-worker.height//2))
canvas.convert('RGB').resize((320,320), Image.LANCZOS).save(OUT+'/missions.webp', quality=86)
