"""Ghardaïa : la ville du M'Zab. Vrais anneaux de maisons cubiques pastel serrées autour de la colline (une rue radiale sombre entre chaque maison),
la mosquée blanche au sommet et son minaret pointu à quatre éperons, quelques palmiers de l'oasis aux coins.
Passe 2 (05/11/2026) : l'ancien amas de cubes ocre est remplacé par quatre terrasses concentriques de maisons-secteurs."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#C79A5C', 'core': '#5E3720',
       'o1': '#E8A33F', 'o2': '#D77F3C', 'o3': '#F0C27C', 'o4': '#E2917E', 'o5': '#E9B35E',
       'roofA': '#F2D498', 'roofB': '#E6BE80', 'blue': '#2F9FB0', 'dark': '#4A3426',
       'min': '#F6DFAE', 'min2': '#B86A33', 'mintop': '#9E3F25', 'white': '#FBF3E0',
       'trunk': '#7B5530', 'leaf': '#4E8A3C', 'leaf2': '#6BA64A'}

HOUSE = ['o1', 'o4', 'o3', 'o2', 'o5', 'o3']
# (rayon extérieur, rayon intérieur, nombre de maisons, hauteur du sol de la terrasse)
RINGS = [(0.86, 0.66, 15, 0.05), (0.64, 0.47, 12, 0.21), (0.45, 0.31, 9, 0.37), (0.29, 0.18, 6, 0.53)]


def house(m, a0, a1, r_in, r_out, y0, y1, col, k):
    pts = [(r_out*math.cos(a0), r_out*math.sin(a0)), (r_out*math.cos(a1), r_out*math.sin(a1)),
           (r_in*math.cos(a1), r_in*math.sin(a1)), (r_in*math.cos(a0), r_in*math.sin(a0))]
    prism(m, pts, y0, y1, col, 'roofA' if k % 2 == 0 else 'roofB')
    # fenêtre sombre (et porte bleue une fois sur trois) sur la face tournée vers l'extérieur
    am = (a0+a1)/2
    c = (r_out*math.cos(am), r_out*math.sin(am))
    t = (-math.sin(am), math.cos(am))
    w = (a1-a0)*r_out*0.13
    off = 0.004
    ox, oz = c[0]+math.cos(am)*off, c[1]+math.sin(am)*off
    ref = (c[0]-math.cos(am), (y0+y1)/2, c[1]-math.sin(am))
    hh = y1-y0
    if k % 3 == 0:
        m.poly([(ox-t[0]*w, y0, oz-t[1]*w), (ox+t[0]*w, y0, oz+t[1]*w), (ox+t[0]*w, y0+hh*0.5, oz+t[1]*w), (ox-t[0]*w, y0+hh*0.5, oz-t[1]*w)], 'blue', ref)
    else:
        yw = y1-hh*0.45
        m.poly([(ox-t[0]*w, yw, oz-t[1]*w), (ox+t[0]*w, yw, oz+t[1]*w), (ox+t[0]*w, yw+hh*0.22, oz+t[1]*w), (ox-t[0]*w, yw+hh*0.22, oz-t[1]*w)], 'dark', ref)


def build():
    m = Mesh(PAL)
    rg = rnd(11)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'ground', skip=('bot',))
    for ri, (ro, rin, n, yf) in enumerate(RINGS):
        # noyau sombre : remplit les rues entre les maisons
        cyl(m, 0, 0, 0.05, yf+0.05, ro-0.01, 'core', n=24, col_top='core')
        step = 2*math.pi/n
        gap = 0.07 if ri == 0 else 0.09
        for i in range(n):
            a0 = i*step+ri*0.21+gap*step*0.5
            a1 = (i+1)*step+ri*0.21-gap*step*0.5
            hh = 0.15+0.1*next(rg)
            house(m, a0, a1, rin, ro-0.005, 0.05, yf+hh, HOUSE[(i+ri*2) % len(HOUSE)], i)
    # plateforme et mosquée au sommet
    ytop = 0.53+0.22
    cyl(m, 0, 0, ytop-0.01, ytop+0.03, 0.2, 'roofA', n=12, col_top='roofA')
    m.box(-0.18, 0.18, ytop+0.03, ytop+0.2, -0.18, 0.18, 'white', skip=('bot',))
    m.box(-0.2, 0.2, ytop+0.2, ytop+0.23, -0.2, 0.2, 'min2', skip=('bot',))
    for u in (-0.09, 0.09):
        decal(m, 'pz', u-0.03, u+0.03, ytop+0.07, ytop+0.16, 0.171, 'dark')
    # minaret du M'Zab : tour effilée à quatre éperons d'angle, lanterne et pointe
    y0 = ytop+0.23
    cx = cz = 0.0
    tbox(m, cx, cz, y0, y0+1.0, 0.18, 0.18, 0.1, 0.1, 'min', col_top='min')
    for yy, k in ((y0+0.28, 0.82), (y0+0.56, 0.64)):
        w = 0.18-(0.18-0.1)*(yy-y0)/1.0+0.014
        m.box(cx-w, cx+w, yy, yy+0.035, cz-w, cz+w, 'min2', skip=('bot',))
    decal(m, 'pz', -0.025, 0.025, y0+0.1, y0+0.25, 0.18+0.003, 'dark')
    decal(m, 'pz', -0.02, 0.02, y0+0.38, y0+0.5, 0.18-(0.18-0.1)*0.44+0.003, 'dark')
    decal(m, 'pz', -0.015, 0.015, y0+0.66, y0+0.76, 0.18-(0.18-0.1)*0.71+0.003, 'dark')
    # lanterne carrée + toit pointu
    yl = y0+1.0
    m.box(-0.12, 0.12, yl, yl+0.05, -0.12, 0.12, 'min2', skip=('bot',))
    tbox(m, cx, cz, yl+0.05, yl+0.2, 0.085, 0.085, 0.105, 0.105, 'min', col_top='min')
    m.box(-0.13, 0.13, yl+0.2, yl+0.235, -0.13, 0.13, 'min2', skip=('bot',))
    pyr(m, cx, cz, 0.1, 0.1, yl+0.235, 0.45, 'mintop')
    for sx in (-1, 1):
        for sz in (-1, 1):
            pyr(m, cx+sx*0.12, cz+sz*0.12, 0.032, 0.032, yl+0.235, 0.18, 'min2')
    # palmiers de l'oasis aux coins
    for (x, z, h, ln) in ((-0.7, 0.7, 0.44, 0.03), (0.72, 0.68, 0.38, -0.03), (-0.72, -0.7, 0.36, 0.03), (0.7, -0.72, 0.42, -0.03)):
        palm(m, x, z, h, 'trunk', 'leaf', 'leaf2', y0=0.05, lean=ln, fronds=6, flen=0.17, tw=0.03)
    return m
