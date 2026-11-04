"""Porto : le pont Dom-Luís, grande arche de fer à deux tabliers au-dessus du Douro, rives de maisons colorées."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'iron': '#A9B6BF', 'iron2': '#7B8892', 'deck': '#B6BEC4', 'water': '#3F86A3', 'water2': '#6FB0C6', 'rock': '#B9946A', 'rock2': '#9C7A52',
    'h1': '#E8B04B', 'h2': '#D9684A', 'h3': '#F0E0C8', 'h4': '#7FB1C9', 'h5': '#E58FA0', 'h6': '#C7D96B', 'roof': '#B5472F',
    'win': '#3A3F4A', 'grass': '#8AA05A', 'stone': '#D2C6AA',
}
Y0 = 0.04
DECK = 1.26          # niveau du tablier haut
LOW = 0.2            # niveau du tablier bas
ZC = -0.22           # position du pont en z
XS = 0.5             # naissance de l'arche (face interne des rives)

def arch_y(x):
    return 0.17+(DECK-0.06-0.17)*(1-(x/XS)**2)

def house(m, x0, x1, z0, z1, y0, h, col, rc='roof', ridge='x'):
    m.box(x0, x1, y0, y0+h, z0, z1, col, skip=('bot',))
    gable(m, x0-0.01, x1+0.01, z0-0.015, z1+0.015, y0+h, min(0.07, (x1-x0)*0.45), rc, ridge, col)
    b = B(x0, x1, y0, y0+h, z0, z1)
    w = (x1-x0)
    if w > 0.11:
        decal(m, b, 'pz', rect(-0.018, 0.018, y0+h*0.45, y0+h*0.8), 'win', 0.003)

def build():
    m = Mesh(PAL)
    # ---------- fleuve ----------
    m.box(-0.5, 0.5, 0.0, 0.04, -0.88, 0.88, 'water', skip=('bot', 'nx', 'px'))
    for z in (-0.6, -0.15, 0.3, 0.7):
        m.box(-0.35, 0.35, 0.04, 0.044, z, z+0.035, 'water2', skip=('bot',))
    # ---------- rives : terrasses qui descendent vers l'avant ----------
    terr = [(-0.88, -0.5, 0.95), (-0.5, 0.05, DECK-0.02), (0.05, 0.5, 0.76), (0.5, 0.88, 0.4)]
    for sd in (-1, 1):
        xa, xb = (-0.89, -0.5) if sd < 0 else (0.5, 0.89)
        for (z0, z1, top) in terr:
            m.box(xa, xb, 0.0, top, z0, z1, 'rock', skip=('bot',))
            m.poly([(xa, top, z0), (xb, top, z0), (xb, top, z1), (xa, top, z1)], 'stone', (0, 0, 0))
    # ---------- maisons ----------
    cols = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']
    rows = [(0.1, 0.27, 0.76), (0.29, 0.46, 0.76), (0.56, 0.72, 0.4), (0.74, 0.86, 0.4), (-0.86, -0.7, 0.95), (-0.68, -0.52, 0.95)]
    k = 0
    for sd in (-1, 1):
        xs = ((-0.87, -0.71), (-0.67, -0.52)) if sd < 0 else ((0.52, 0.67), (0.71, 0.87))
        for ri, (z0, z1, top) in enumerate(rows):
            for ci, (x0, x1) in enumerate(xs):
                if (ri+ci) % 3 == 2 and ri < 4:
                    continue
                h = 0.11+0.02*((ri*2+ci+k) % 4)
                house(m, x0, x1, z0, z1, top, h, cols[(k*5+ri*2+ci) % 6])
        k += 1
    # ---------- tablier haut ----------
    m.box(-0.89, 0.89, DECK-0.05, DECK, ZC-0.17, ZC+0.17, 'deck', skip=('bot',))
    m.box(-0.89, 0.89, DECK, DECK+0.02, ZC-0.17, ZC-0.14, 'iron2', skip=('bot',))
    m.box(-0.89, 0.89, DECK, DECK+0.02, ZC+0.14, ZC+0.17, 'iron2', skip=('bot',))
    # ---------- tablier bas ----------
    m.box(-0.5, 0.5, LOW-0.04, LOW, ZC-0.16, ZC+0.16, 'deck', skip=('bot',))
    # ---------- arche : deux nervures ----------
    N = 16
    for zz in (ZC-0.12, ZC+0.12):
        pts = [(-XS+2*XS*k/N, arch_y(-XS+2*XS*k/N)) for k in range(N+1)]
        rings = []
        for k, (x, y) in enumerate(pts):
            # épaisseur verticale plus forte aux naissances
            t = 0.075-0.03*(1-abs(x)/XS)*0.0
            th = 0.1+0.06*(abs(x)/XS)
            rings.append([(x, y-th/2, zz-0.035), (x, y-th/2, zz+0.035), (x, y+th/2, zz+0.035), (x, y+th/2, zz-0.035)])
        for k in range(N):
            m.band(rings[k], rings[k+1], 'iron', (pts[k][0], pts[k][1], zz))
        # montants entre tablier bas et haut
        for k in range(-4, 5):
            x = k*0.11
            m.beam((x, LOW, zz), (x, DECK-0.05, zz), 0.03, 'iron2', up=(1, 0, 0))
    # entretoises hautes et basses
    for k in range(-4, 5):
        x = k*0.11
        m.beam((x, LOW+0.03, ZC-0.12), (x, LOW+0.03, ZC+0.12), 0.025, 'iron2', up=(0, 1, 0))
    # piles de naissance
    for sd in (-1, 1):
        m.box(sd*XS-0.06 if sd > 0 else -XS-0.0, sd*XS+0.0 if sd < 0 else XS+0.06, 0.04, 0.26, ZC-0.18, ZC+0.18, 'rock2', skip=('bot',))
    return m
