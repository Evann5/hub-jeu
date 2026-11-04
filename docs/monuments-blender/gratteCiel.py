"""Hô Chi Minh-Ville (Vietnam) : la tour Bitexco, bourgeon de lotus de verre, héliport en saillie, flèche."""
import math
from lib import Mesh
from lib_vietnam_japon import *

PAL = {'glass': '#4B6F8E', 'glass_l': '#7FA3BF', 'glass_d': '#2F4A63', 'steel': '#C3CBD1', 'plaza': '#BDB8AE',
       'podium': '#8F9194', 'pad': '#D6D4CC', 'ring': '#E3B341', 'dark': '#3A3F46'}

N = 16
# (hauteur, demi-largeur, décalage en z) de la silhouette en bourgeon
PROFILE = [(0.22, 0.36, 0.0), (0.55, 0.375, 0.0), (0.95, 0.37, 0.0), (1.35, 0.35, 0.0), (1.75, 0.32, 0.0), (2.15, 0.29, 0.0),
           (2.55, 0.26, -0.01), (2.85, 0.215, -0.04), (3.10, 0.155, -0.07), (3.26, 0.085, -0.09), (3.34, 0.03, -0.095)]

def ring_at(p, k=1.0):
    y, r, dz = p
    return [(r*math.cos(2*math.pi*i/N), y, dz+r*0.9*math.sin(2*math.pi*i/N)) for i in range(N)]

def build():
    m = Mesh(PAL)
    # esplanade et socle
    m.box(-0.88, 0.88, 0, 0.03, -0.88, 0.88, 'plaza', skip=('bot',))
    tbox(m, 0, 0, 0.03, 0.12, 0.62, 0.62, 0.56, 0.56, 'podium')
    tbox(m, 0, 0, 0.12, 0.22, 0.46, 0.46, 0.40, 0.40, 'glass_d')
    # corps : anneaux, bandes alternées (étages)
    rings = [ring_at(p) for p in PROFILE]
    for k in range(len(rings)-1):
        m.band(rings[k], rings[k+1], 'glass' if k % 2 == 0 else 'glass_l', (0, PROFILE[k][0], PROFILE[k][2]))
    # deux nervures d'acier sur la face avant
    for s in (-1, 1):
        for k in range(len(PROFILE)-3):
            def pt(p):
                y, r, dz = p
                a = math.radians(90 - s*38)
                return (1.012*r*math.cos(a), y, dz+0.9*1.012*r*math.sin(a))
            m.beam(pt(PROFILE[k]), pt(PROFILE[k+1]), 0.028, 'steel')
    # héliport : disque en saillie sur la face avant, deux jambes de force
    ya, zc, rp = 2.36, 0.47, 0.30
    cyl(m, 0, zc, ya-0.06, ya, 0.27, 'steel', 0.30, n=16, caps=(True, False))
    cyl(m, 0, zc, ya, ya+0.04, rp, 'pad', n=16, caps=(False, True))
    m.poly(circle(0, zc, ya+0.044, 0.25, 16), 'ring', (0, 0, zc))
    m.poly(circle(0, zc, ya+0.048, 0.22, 16), 'pad', (0, 0, zc))
    for dx in (-0.07, 0.07):
        m.box(dx-0.012, dx+0.012, ya+0.05, ya+0.052, zc-0.12, zc+0.12, 'ring')
    m.box(-0.07, 0.07, ya+0.05, ya+0.052, zc-0.012, zc+0.012, 'ring')
    for sx in (-1, 1):
        m.beam((sx*0.13, 1.90, 0.22), (sx*0.17, ya-0.05, zc-0.05), 0.035, 'steel')
    m.beam((0, 1.90, 0.27), (0, ya-0.05, zc), 0.05, 'steel')
    # flèche
    spire(m, 0, -0.095, 3.30, 3.62, 0.025, 'steel', 0.006)
    return m
