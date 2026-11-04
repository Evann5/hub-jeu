"""Oaxaca : la place à arcades, façades vives, église en pierre verte, kiosque, fanions."""
import math
from lib import Mesh
from lib_mexique_italie import *

PAL = {'plaza': '#E4D3AE', 'plaza2': '#CDB487', 'arc': '#F0E0BC', 'back': '#5A3F33', 'glass': '#35302F', 'frame': '#FBF3DE',
       'g1': '#86AB8E', 'g2': '#6E9577', 'g3': '#A5C4AA', 'roof': '#9DBBA3', 'trimg': '#C4D9C4',
       'pink': '#D8447C', 'ochre': '#EDB63A', 'teal': '#2FA9B2', 'orange': '#EE7A2E', 'red': '#C6362F', 'blue': '#5C6FC6',
       'cornice': '#F6EBD0', 'roofflat': '#B98764', 'trunk': '#6B4A34', 'leaf': '#4E8F45', 'leaf2': '#3C7A3A',
       'kiosk': '#EADBB6', 'kroof': '#B65F45', 'gold': '#E9B53C', 'shut': '#2E7C6E', 'p1': '#E83E6B', 'p2': '#F7C531', 'p3': '#2FB6A8', 'p4': '#F58A2D', 'p5': '#6C57C9',
       'rope': '#5B4636'}
WALLS = [('pink', 'ochre', 'teal'), ('orange', 'red', 'blue')]
ZW = -0.30        # plan des façades du fond
XP = 0.52         # façades de la place


def storey(m, F, a, c, col, y0=0.30, y1=0.78, d0=-0.33):
    obox(m, F, a, c, y0, y1, d0, 0.0, col, top='roofflat')
    n = 2
    for w in range(n):
        sc = a+(c-a)*(w+0.5)/n
        window(m, F, sc, 0.024, y0+0.12, y0+0.38, 0.0, 'glass', 'frame', fm=0.007)
        obox(m, F, sc-0.04, sc+0.04, y0+0.09, y0+0.108, 0.0, 0.04, 'frame')


def row_arcade(m, F, a, c, narc, cols, depth=0.33):
    L = c-a
    ops = [(a+L*(i+0.5)/narc, min(0.056, L/narc*0.32), 0.0, 0.17, 0.235) for i in range(narc)]
    wall_openings(m, F, a, c, 0, 0.30, 0.0, ops, 'arc', 'back', 0.07, k=4)
    obox(m, F, a, c, 0, 0.30, -depth, -0.07, 'arc', skip=('front', 'l', 'r', 'top'))
    nb = len(cols)
    for b in range(nb):
        storey(m, F, a+L*b/nb, a+L*(b+1)/nb, cols[b], d0=-depth)
    obox(m, F, a-0.005, c+0.005, 0.78, 0.82, -depth-0.02, 0.03, 'cornice', top='roofflat')
    obox(m, F, a-0.005, c+0.005, 0.30, 0.325, -depth-0.02, 0.03, 'cornice', top='cornice')


def build():
    m = Mesh(PAL)
    m.box(-0.89, 0.89, 0, 0.04, -0.89, 0.66, 'plaza', skip=('bot',))
    poly_floor(m, [(math.cos(2*math.pi*i/8+math.pi/8)*0.27, 0.2+math.sin(2*math.pi*i/8+math.pi/8)*0.27) for i in range(8)], 0.044, 'plaza2')
    zf = ZW
    # ailes colorées du fond (arcade + étage)
    FW = Fr((0, zf), (1, 0), (0, 1))
    row_arcade(m, FW, -0.89, -0.40, 3, ['pink', 'ochre'], depth=0.40)
    row_arcade(m, FW, 0.40, 0.89, 3, ['orange', 'teal'], depth=0.40)
    # église (centre)
    obox(m, ID, -0.30, 0.30, 0, 0.62, -0.88, zf, 'g1', skip=('front',))
    gable(m, ID, -0.32, 0.32, -0.88, zf, 0.62, 0.78, 'roof', 'g1', ridge='d', o=0.015)
    lathe(m, 0, -0.58, [(0.2, 0.62), (0.2, 0.86), (0.215, 0.86), (0.215, 0.89)], 8, lambda k, i: 'g2' if k == 0 else 'trimg', rot=math.pi/8)
    lathe(m, 0, -0.58, [(0.19, 0.89), (0.175, 0.97), (0.14, 1.04), (0.09, 1.1), (0.035, 1.14)], 8, lambda k, i: 'g3' if i % 2 == 0 else 'roof', rot=math.pi/8, cap='g3')
    cyl(m, 0, -0.58, 0.012, 1.14, 1.22, 4, 'gold', 'gold')
    wall_openings(m, ID, -0.17, 0.17, 0, 0.78, zf, [(0.0, 0.085, 0.0, 0.24, 0.40)], 'g1', 'back', 0.06, k=4)
    obox(m, ID, -0.17, 0.17, 0, 0.78, zf-0.08, zf, 'g1', skip=('front', 'top'))
    deco_rect(m, ID, -0.17, 0.17, 0.78, 0.82, zf+0.012, 'trimg')
    m.poly([(-0.17, 0.82, zf), (0.17, 0.82, zf), (0.17, 0.9, zf), (0.0, 0.98, zf), (-0.17, 0.9, zf)], 'g1', (0, 0.5, zf-3))
    deco_rect(m, ID, -0.12, 0.12, 0.56, 0.74, zf+0.003, 'g3')
    deco_arch(m, ID, 0, 0.045, 0.6, 0.68, 0.72, zf+0.006, 'back', 3)
    deco_rect(m, ID, -0.13, -0.11, 0.0, 0.5, zf+0.004, 'trimg'); deco_rect(m, ID, 0.11, 0.13, 0.0, 0.5, zf+0.004, 'trimg')
    deco_rect(m, ID, -0.15, 0.15, 0.4, 0.43, zf+0.004, 'trimg')
    for sg in (-1, 1):
        a, b = sorted((sg*0.17, sg*0.40))
        xc = (a+b)/2
        obox(m, ID, a, b, 0, 0.8, zf-0.28, zf, 'g1', skip=('top',))
        deco_arch(m, ID, xc, 0.03, 0.34, 0.5, 0.58, zf+0.003, 'back', 3)
        deco_rect(m, ID, a, b, 0.62, 0.64, zf+0.005, 'trimg')
        obox(m, ID, a+0.01, b-0.01, 0.8, 0.84, zf-0.27, zf-0.01, 'trimg', top='trimg')
        obox(m, ID, a+0.03, b-0.03, 0.84, 1.06, zf-0.25, zf-0.03, 'g2', top='g2')
        deco_arch(m, ID, xc, 0.035, 0.89, 0.96, 1.0, zf-0.03+0.003, 'back', 3)
        obox(m, ID, a+0.02, b-0.02, 1.06, 1.1, zf-0.26, zf-0.02, 'trimg', top='trimg')
        zc = zf-0.14
        lathe(m, xc, zc, [(0.095, 1.1), (0.09, 1.16), (0.07, 1.21), (0.04, 1.25), (0.0, 1.28)], 8, lambda k, i: 'g3' if i % 2 == 0 else 'roof', rot=math.pi/8)
        cyl(m, xc, zc, 0.008, 1.28, 1.34, 4, 'gold', 'gold')
    # kiosque
    kz = 0.2
    cyl(m, 0, kz, 0.17, 0.044, 0.09, 8, 'kiosk', 'kiosk', rot=math.pi/8)
    for i in range(8):
        a = 2*math.pi*i/8+math.pi/8
        cyl(m, 0.135*math.cos(a), kz+0.135*math.sin(a), 0.014, 0.09, 0.2, 4, 'arc', 'arc', rot=math.pi/4)
    cyl(m, 0, kz, 0.17, 0.2, 0.22, 8, 'cornice', 'cornice', rot=math.pi/8)
    lathe(m, 0, kz, [(0.17, 0.22), (0.12, 0.27), (0.05, 0.31), (0.0, 0.33)], 8, lambda k, i: 'kroof' if i % 2 == 0 else 'g3', rot=math.pi/8)
    cyl(m, 0, kz, 0.008, 0.33, 0.4, 4, 'gold', 'gold')
    # lauriers
    for (x, z) in ((-0.46, 0.5), (0.46, 0.5), (-0.5, -0.02), (0.5, -0.02)):
        tree(m, x, z, 0.3, 0.1, 'trunk', 'leaf', 0.04, 'leaf2')
    # deux mâts et une guirlande de fanions
    for sx in (-0.7, 0.7):
        cyl(m, sx, 0.46, 0.012, 0.04, 0.62, 5, 'rope', 'gold')
    zz = 0.46
    N = 14
    xs0, xs1 = -0.7, 0.7
    for i in range(N):
        t0, t1 = i/N, (i+1)/N
        x0 = xs0+(xs1-xs0)*t0; x1 = xs0+(xs1-xs0)*t1
        sag = lambda t: 0.6-0.09*math.sin(math.pi*t)
        y0_, y1_ = sag(t0), sag(t1)
        col = ['p1', 'p2', 'p3', 'p4', 'p5'][i % 5]
        pts = [(x0, y0_, zz), (x1, y1_, zz), ((x0+x1)/2, (y0_+y1_)/2-0.075, zz)]
        m.poly(pts, col, ((x0+x1)/2, (y0_+y1_)/2, zz-3))
        m.poly(pts, col, ((x0+x1)/2, (y0_+y1_)/2, zz+3))
    return m
