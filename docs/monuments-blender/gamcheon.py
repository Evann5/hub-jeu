"""Busan (Corée du Sud) : village de Gamcheon, maisons aux couleurs vives en gradins sur la colline, escalier en zigzag."""
import math
from lib import Mesh
from lib_ico import *

HC = ['#F2C24B', '#E8574A', '#4DA8DA', '#69C27B', '#F29B4B', '#D96BA0', '#8E7CC3', '#F4F0E4', '#3FB5A8']
RC = ['#6D8EA0', '#C9573A', '#4B6E8A', '#8A5A44', '#E9E1CF']
PAL = {'sea': '#2F86C2', 'shallow': '#6BC0D8', 'hill': '#C9B48A', 'hill2': '#B49B70', 'stair': '#EFE7D4', 'win': '#2D3E55', 'tree': '#4E9A45', 'trunk': '#7A5236',
       'hull': '#F4F0E6', 'hull2': '#E8574A'}
for i, c in enumerate(HC):
    PAL['h%d' % i] = c
for i, c in enumerate(RC):
    PAL['r%d' % i] = c

NR = 5
ZC = [0.36-0.27*r for r in range(NR)]
GY = [0.07+0.2*r for r in range(NR)]
SX = [0.3, -0.3, 0.3, -0.3, 0.3]            # position de l'escalier à chaque palier


def build():
    m = Mesh(PAL)
    plate(m, 'sea', 0.04)
    m.box(-H, H, 0.04, 0.05, 0.5, 0.64, 'shallow', skip=('bot',))
    k = 0
    for r in range(NR):
        zc, gy = ZC[r], GY[r]
        m.box(-H, H, 0.0, gy, zc-0.135, zc+0.135, 'hill', skip=('bot',))
        # escalier : ruban clair qui monte d'un palier à l'autre
        ylow = 0.05 if r == 0 else GY[r-1]+0.012
        m.box(SX[r]-0.05, SX[r]+0.05, ylow, gy+0.014, zc-0.135, zc+0.14, 'stair', skip=('bot',))
        # maisons de la rangée
        x = -0.84+0.04*(r % 3)
        while True:
            w = 0.16+0.12*noise(k, r, 1)
            h = 0.13+0.15*noise(k, r, 2)
            if x+w > 0.84:
                break
            if x+w > SX[r]-0.07 and x < SX[r]+0.07:
                x = SX[r]+0.07
                continue
            ci = (k*4+r*3) % len(HC)
            ri = (k*3+r) % len(RC)
            house(m, x, x+w, zc-0.1, zc+0.11, gy+0.0, h, 'h%d' % ci, 'r%d' % ri, 'win', pitched=(k % 3 == 1), rh=0.06)
            x += w+0.035
            k += 1
    # arbres entre les rangées
    for (x, z, r) in ((-0.8, 0.27, 0), (0.82, 0.0, 1), (-0.78, -0.55, 3), (0.8, -0.3, 2)):
        gy = GY[r]
        m.beam((x, gy, z), (x, gy+0.1, z), 0.03, 'trunk')
        blob(m, x, gy+0.18, z, 0.09, 0.09, 0.09, 'tree', n=6, lats=(-40, 15, 60))
    # barques au pied de la colline
    for (x, c) in ((-0.5, 'hull2'), (0.4, 'hull')):
        m.box(x, x+0.2, 0.05, 0.09, 0.66, 0.74, c, skip=('bot',))
    return m
