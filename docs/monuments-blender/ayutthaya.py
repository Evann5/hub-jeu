"""Ayutthaya (Thaïlande) : tours de brique en ruine (prangs aux sommets éboulés), mur percé, herbe et un grand arbre."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'grass': '#88B35C', 'brick': '#B95C3F', 'brick_d': '#8F4330', 'brick_l': '#D07C58', 'stone': '#CDC5B3', 'dark': '#3A2A26', 'moss': '#6E9A4C',
       'trunk': '#7A5A3C', 'leaf': '#4F8A45', 'leaf2': '#6AA44E', 'gold': '#E5B53A', 'white': '#CF7A56'}

def build():
    m = Mesh(PAL)
    slab(m, 'grass', 0.05)
    # terrasse de brique et marches
    m.box(-0.8, 0.8, 0.05, 0.17, -0.75, 0.45, 'brick_d', skip=('bot',))
    m.box(-0.82, 0.82, 0.14, 0.17, -0.77, 0.47, 'brick_l', skip=('bot',))
    for s in range(3):
        m.box(-0.18, 0.18, 0.05, 0.14-0.04*s, 0.47, 0.47+0.06*(s+1), 'brick', skip=('bot', 'nz'))
    # grande tour centrale (intacte) et deux ruines
    prang(m, 0.0, -0.2, 0.17, 0.3, 1.8, 9, ['brick', 'brick_l', 'brick', 'brick_d'], lip='brick_d', niche='dark', spike='brick_l')
    prang(m, -0.55, 0.12, 0.17, 0.17, 1.1, 8, ['brick', 'brick_l', 'brick_d'], lip='brick_d', niche='dark', spike='brick_l', build=5, rubble='brick_d')
    prang(m, 0.55, 0.1, 0.17, 0.15, 0.9, 8, ['brick_l', 'brick', 'brick_d'], lip='brick_d', niche='dark', spike='brick_l', build=4, rubble='brick')
    # pan de mur ruiné au premier plan, fenêtres vides
    m.box(-0.78, -0.2, 0.17, 0.5, 0.2, 0.3, 'brick', skip=('bot',))
    m.box(-0.8, -0.18, 0.46, 0.5, 0.18, 0.32, 'brick_d', skip=('bot',))
    for x in (-0.65, -0.42):
        front(m, 0.3+0.004, arch2d(x, 0.22, 0.34, 0.42, 0.06, 4), 'dark')
    m.box(-0.2, -0.05, 0.17, 0.3, 0.2, 0.3, 'brick', skip=('bot',))
    m.box(0.2, 0.7, 0.17, 0.26, 0.28, 0.38, 'brick_l', skip=('bot',))
    m.box(0.46, 0.7, 0.26, 0.38, 0.28, 0.38, 'brick', skip=('bot',))
    # briques éboulées et grand arbre
    for (x, z, w) in ((0.3, 0.7, 0.06), (-0.2, 0.62, 0.05), (0.62, 0.68, 0.07), (-0.5, 0.74, 0.05)):
        m.box(x-w, x+w, 0.05, 0.05+w*1.2, z-w, z+w, 'brick_d', skip=('bot',))
    tx, tz = 0.62, -0.55
    cyl(m, tx, tz, 0.17, 0.62, 0.05, 'trunk', 0.035, n=6)
    for (dx, dz, dy, r) in ((0, 0, 0.78, 0.26), (-0.15, 0.08, 0.66, 0.18), (0.14, 0.06, 0.7, 0.19)):
        blob(m, tx+dx, dy, tz+dz, r, r*0.75, r, 'leaf' if dx == 0 else 'leaf2', n=7)
    return m
