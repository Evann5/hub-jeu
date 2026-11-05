"""Alger : le Maqam Echahid, trois grandes palmes de béton identiques, réunies en un seul sommet, sur un socle octogonal à marches ;
flamme du souvenir au pied, portes sombres dans le socle. Passe 2 (05/11/2026) : trois palmes égales qui convergent (avant : une lame et deux fines),
parvis beige, détails du socle."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#E3D2A8', 'step': '#E2DACA', 'step2': '#C3B9A3', 'c1': '#F4EFE3', 'c2': '#D5CCB8', 'c3': '#A59E8E', 'flame': '#F0742B', 'flame2': '#F7B733',
       'path': '#D8C99E', 'dark': '#4D463C'}
Y0 = 0.36
H = 2.0
NS = 11


def blade(m, th):
    """Une palme : feuille pointue qui part du socle vers l'extérieur, se redresse et se referme sur l'axe au sommet. Les trois sont identiques."""
    rings = []
    ux, uz = math.cos(th), math.sin(th)
    tx, tz = -uz, ux
    for s in range(NS):
        t = s/(NS-1)
        y = Y0+H*t
        r = 0.02+0.47*(1-t)**1.05
        w = 0.012+0.06*(1-t)+0.13*math.sin(math.pi*t**0.8)**0.9
        e = 0.05*(1-0.55*t)
        c = (r*ux, y, r*uz)
        rings.append([(c[0]+tx*w, y, c[2]+tz*w), (c[0]+ux*e, y, c[2]+uz*e), (c[0]-tx*w, y, c[2]-tz*w), (c[0]-ux*e, y, c[2]-uz*e)])
    for k in range(NS-1):
        ra, rb = rings[k], rings[k+1]
        ref = centroid(list(ra)+list(rb))
        for i, col in enumerate(('c1', 'c1', 'c2', 'c2')):
            j = (i+1) % 4
            m.poly([ra[i], ra[j], rb[j], rb[i]], col, ref)
    m.poly(rings[0], 'c3', centroid(rings[1]))
    m.poly(rings[-1], 'c2', centroid(rings[-2]))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'ground', skip=('bot',))
    cyl(m, 0, 0, 0.05, 0.12, 0.85, 'path', n=8, rot=math.pi/8)
    cyl(m, 0, 0, 0.12, 0.22, 0.72, 'step', n=8, rot=math.pi/8, col_top='step2')
    cyl(m, 0, 0, 0.22, Y0, 0.54, 'step', n=8, rot=math.pi/8, col_top='step2')
    # portes sombres en arc dans le socle, sur les quatre faces
    for a in range(4):
        ang = a*math.pi/2
        r = 0.72*math.cos(math.pi/8)+0.004
        for u in (-0.12, 0.12):
            px, pz = math.cos(ang), math.sin(ang)
            tx, tz = -pz, px
            pts = []
            for (du, dy) in ((-0.06, 0.12), (0.06, 0.12), (0.06, 0.19), (0.0, 0.22), (-0.06, 0.19)):
                pts.append((r*px+tx*(u+du), dy, r*pz+tz*(u+du)))
            m.poly(pts, 'dark', (0, 0.15, 0))
            m.poly(pts[::-1], 'dark', (r*px*3, 0.15, r*pz*3)) if False else None
    for k in range(3):
        blade(m, -math.pi/2+2*math.pi*k/3)
    cyl(m, 0, 0, Y0, Y0+0.16, 0.06, 'flame', r1=0.0, n=6, bot=True)
    cyl(m, 0, 0, Y0, Y0+0.09, 0.035, 'flame2', r1=0.0, n=6)
    return m
