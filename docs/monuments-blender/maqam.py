"""Alger : le Maqam Echahid, trois grandes palmes de béton qui se rejoignent au sommet, sur un socle, flamme au centre."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'lawn': '#7DB45A', 'lawn2': '#5E9A48', 'step': '#D9D3C4', 'step2': '#B9B2A1', 'c1': '#F1EDE2', 'c2': '#DCD6C6',
       'c3': '#9D978A', 'flame': '#F0742B', 'flame2': '#F7B733', 'path': '#E8DDBE'}
Y0 = 0.3
H = 2.0
NS = 9


def blade(m, th, cols):
    """Une palme : lame en losange qui part du socle, bombe vers le milieu et se resserre au sommet."""
    rings = []
    ux, uz = math.cos(th), math.sin(th)       # direction radiale
    tx, tz = -uz, ux                          # direction tangente
    for s in range(NS):
        t = s/(NS-1)
        y = Y0 + H*t
        r = 0.24 + 0.14*t**1.4
        w = 0.07 + 0.2*math.sin(math.pi*min(1.0, t*0.9+0.08))**0.8*(1-0.45*t*t)   # demi-largeur
        e = 0.06*(1-0.6*t)                                                         # demi-épaisseur
        c = (r*ux, y, r*uz)
        rings.append([(c[0]+tx*w, y, c[2]+tz*w), (c[0]+ux*e, y, c[2]+uz*e), (c[0]-tx*w, y, c[2]-tz*w), (c[0]-ux*e, y, c[2]-uz*e)])
    for k in range(NS-1):
        ra, rb = rings[k], rings[k+1]
        ref = centroid(list(ra)+list(rb))
        for i, col in enumerate(cols):
            j = (i+1) % 4
            m.poly([ra[i], ra[j], rb[j], rb[i]], col, ref)
    m.poly(rings[0], 'c3', centroid(rings[1]))
    m.poly(rings[-1], 'c2', centroid(rings[-2]))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'lawn', skip=('bot',))
    cyl(m, 0, 0, 0.05, 0.12, 0.85, 'path', n=8, rot=math.pi/8)
    cyl(m, 0, 0, 0.12, 0.2, 0.72, 'step', n=8, rot=math.pi/8, col_top='step2')
    cyl(m, 0, 0, 0.2, Y0, 0.52, 'step', n=8, rot=math.pi/8, col_top='step2')
    blade(m, math.pi/2, ('c1', 'c2', 'c3', 'c3'))
    blade(m, math.pi/2+2*math.pi/3, ('c2', 'c3', 'c3', 'c2'))
    blade(m, math.pi/2+4*math.pi/3, ('c1', 'c1', 'c2', 'c3'))
    # flamme du souvenir au pied des palmes
    cyl(m, 0, 0, Y0, Y0+0.16, 0.06, 'flame', r1=0.0, n=6, bot=True)
    cyl(m, 0, 0, Y0, Y0+0.09, 0.035, 'flame2', r1=0.0, n=6)
    return m
