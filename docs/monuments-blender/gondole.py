"""Venise : un canal, un pont en arc, des palais à fenêtres gothiques, un campanile, une gondole noire."""
import math
from lib import Mesh
from lib_mexique_italie import *

PAL = {'quay': '#CDBFA6', 'quay2': '#A99B82', 'water': '#3E9096', 'water2': '#58AEAD',
       'pA': '#DB8E7B', 'pB': '#EAD39F', 'pD': '#E2B867', 'pE': '#E8CDB8', 'trim': '#F6EEDB', 'dark': '#43362F', 'glass': '#3A3B46',
       'roof': '#B5573C', 'roof2': '#A24A33', 'brick': '#B9532F', 'brick2': '#A5472A', 'copper': '#6FA891',
       'hull': '#1E1B20', 'hull2': '#2C2830', 'gold': '#D8AE45', 'ferro': '#C9CFD4', 'seat': '#B32B2F', 'stripe': '#F1ECE0', 'blue': '#2D4C8A',
       'skin': '#E0B48A', 'straw': '#E7CF93', 'wood': '#8A6842', 'stone': '#BDB09A', 'stone2': '#AA9D88'}
YQ = 0.14      # niveau des quais
YW = 0.06      # niveau de l'eau
ZB = -0.36     # façade des palais (rive du fond)
CZ0, CZ1 = -0.2, 0.35


def facade(m, x0, x1, h, col, n_win, ground, floors=2, zback=-0.74):
    y1 = YQ+h
    obox(m, ID, x0, x1, YQ, y1, zback, ZB, col, skip=('top',))
    # corniche et toit
    obox(m, ID, x0-0.01, x1+0.01, y1, y1+0.035, zback-0.01, ZB+0.02, 'trim', top='roof2')
    hip(m, ID, x0+0.02, x1-0.02, zback+0.05, ZB-0.03, y1+0.035, y1+0.09, 'roof', rl=max(0, (x1-x0)-0.2))
    w = (x1-x0)/n_win
    # rez-de-chaussée : portes d'eau
    for i in range(ground):
        sc = x0+(x1-x0)*(i+0.5)/ground
        deco_arch(m, ID, sc, 0.05, YQ, YQ+0.12, YQ+0.17, ZB+0.003, 'dark', 3)
    deco_rect(m, ID, x0, x1, YQ+0.2, YQ+0.222, ZB+0.003, 'trim')
    # piano nobile : fenêtres gothiques, balcon
    ynb = YQ+0.27
    for i in range(n_win):
        sc = x0+w*(i+0.5)
        deco_arch(m, ID, sc, 0.036, ynb, ynb+0.1, ynb+0.16, ZB+0.003, 'trim', 2, True)
        deco_arch(m, ID, sc, 0.026, ynb+0.01, ynb+0.1, ynb+0.145, ZB+0.006, 'glass', 2, True)
    obox(m, ID, x0+0.01, x1-0.01, ynb-0.02, ynb, ZB, ZB+0.03, 'trim')
    if floors > 1 and h > 0.5:
        for i in range(n_win):
            sc = x0+w*(i+0.5)
            deco_arch(m, ID, sc, 0.02, ynb+0.27, ynb+0.34, ynb+0.37, ZB+0.003, 'glass', 2)
            deco_rect(m, ID, sc-0.028, sc+0.028, ynb+0.255, ynb+0.262, ZB+0.003, 'trim')


def bridge(m):
    zc, hw = -0.28, 0.07            # axe du pont (z) et demi-largeur du tablier
    sc, ahw = 0.44, 0.12            # centre et demi-portée de l'arche (x)
    spring, apex = 0.10, 0.285
    top = [(sc-0.25, 0.17), (sc-0.15, 0.25), (sc, 0.37), (sc+0.15, 0.25), (sc+0.25, 0.17)]
    def ytop(s):
        for i in range(len(top)-1):
            if top[i][0]-1e-9 <= s <= top[i+1][0]+1e-9:
                return top[i][1]+(top[i+1][1]-top[i][1])*(s-top[i][0])/(top[i+1][0]-top[i][0])
    arch = arch_pts(sc, ahw, spring, apex, 6)
    ss = sorted(set([round(t[0], 5) for t in top]+[round(a[0], 5) for a in arch]))
    def ybot(s):
        if sc-ahw-1e-6 <= s <= sc+ahw+1e-6:
            for i in range(len(arch)-1):
                if arch[i][0]-1e-9 <= s <= arch[i+1][0]+1e-9:
                    a, b = arch[i], arch[i+1]
                    return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0]) if b[0] != a[0] else a[1]
        return YQ-0.02
    for sg in (-1, 1):
        F = Fr((0, zc+sg*hw), (1, 0), (0, sg))
        P = F.P
        for i in range(len(ss)-1):
            a, b = ss[i], ss[i+1]
            m.poly([P(a, ybot(a), 0), P(b, ybot(b), 0), P(b, ytop(b), 0), P(a, ytop(a), 0)], 'stone', P(0.0, 0.2, -3))
        for i in range(len(top)-1):
            a, b = top[i], top[i+1]
            m.poly([P(a[0], a[1], 0.0), P(b[0], b[1], 0.0), P(b[0], b[1]+0.035, 0.0), P(a[0], a[1]+0.035, 0.0)], 'trim', P(0, 0.1, -3))
    for i in range(len(top)-1):
        a, b = top[i], top[i+1]
        m.poly([(a[0], a[1]+0.035, zc-hw), (b[0], b[1]+0.035, zc-hw), (b[0], b[1]+0.035, zc+hw), (a[0], a[1]+0.035, zc+hw)], 'quay', (sc, 0, zc))
    for i in range(len(arch)-1):
        a, b = arch[i], arch[i+1]
        m.poly([(a[0], a[1], zc-hw), (b[0], b[1], zc-hw), (b[0], b[1], zc+hw), (a[0], a[1], zc+hw)], 'stone2', (sc, 5, zc))


def gondola(m, bx, bz, ang):
    F = rot_frame(bx, bz, ang)
    P = F.P
    L = 0.9
    N = 10
    rings = []
    for k in range(N):
        t = k/(N-1)
        s = -L/2+L*t
        sheer = 0.035+0.095*max(0.0, (t-0.72)/0.28)**2+0.05*max(0.0, (0.18-t)/0.18)**2
        w = 0.068*(1-abs(2*t-1)**3.2)**0.55+0.005
        yg = YW-0.012+sheer
        rings.append([P(s, yg, -w), P(s, YW-0.02, -0.55*w), P(s, YW-0.028, 0), P(s, YW-0.02, 0.55*w), P(s, yg, w)])
    ref = P(0, YW+0.02, 0)
    for k in range(N-1):
        ra, rb = rings[k], rings[k+1]
        for i in range(4):
            m.poly([ra[i], ra[i+1], rb[i+1], rb[i]], 'hull' if i in (1, 2) else 'hull2', ref)
        m.poly([ra[0], rb[0], rb[4], ra[4]], 'hull2', P(0, -3, 0))
    # étrave et poupe : fermeture
    m.poly(rings[0], 'hull', P(0.5, YW, 0))
    m.poly(rings[-1], 'hull', P(-0.5, YW, 0))
    # le fer de proue
    yb = rings[-1][0][1]
    sb = L/2
    fer = [(sb-0.012, yb-0.01), (sb+0.03, yb+0.02), (sb+0.03, yb+0.2), (sb+0.012, yb+0.17), (sb+0.012, yb+0.13), (sb-0.005, yb+0.1), (sb-0.012, yb+0.06)]
    m.poly([P(s, y, 0) for (s, y) in fer], 'ferro', P(0, 0.1, -3))
    m.poly([P(s, y, 0) for (s, y) in fer], 'ferro', P(0, 0.1, 3))
    # banquette rouge et dossier
    yd = YW+0.026
    obox(m, F, -0.1, 0.08, yd, yd+0.022, -0.036, 0.036, 'seat', top='seat')
    obox(m, F, -0.1, -0.085, yd+0.022, yd+0.075, -0.036, 0.036, 'seat', top='seat')
    # plat-bord doré (liseré)
    # gondolier
    gs = -L/2+0.09
    ys = YW+0.045
    obox(m, F, gs-0.012, gs+0.012, ys, ys+0.06, -0.012, 0.012, 'dark')
    px, pz = F.P(gs, 0, 0)[0], F.P(gs, 0, 0)[2]
    lathe(m, px, pz, [(0.021, ys+0.06), (0.021, ys+0.083), (0.021, ys+0.1), (0.019, ys+0.125)], 6, lambda k, i: 'blue' if k == 1 else 'stripe', cap='stripe')
    blob(m, px, ys+0.15, pz, 0.016, 0.017, 0.016, 'skin', 0)
    cyl(m, px, pz, 0.03, ys+0.168, ys+0.173, 8, 'straw', 'straw')
    cyl(m, px, pz, 0.014, ys+0.173, ys+0.186, 6, 'straw', 'straw')
    # rame
    a = F.P(gs-0.01, ys+0.1, 0.03); b = F.P(gs-0.1, YW-0.01, 0.11)
    m.beam(a, b, 0.008, 'wood', caps=True)
    a2 = F.P(gs-0.005, ys+0.12, 0.02)
    # fourcole


def build():
    m = Mesh(PAL)
    SX0, SX1 = 0.30, 0.58          # petit canal qui remonte entre deux palais
    obox(m, ID, -0.9, SX0, 0, YQ, -0.76, CZ0, 'quay', skip=('l', 'r'))
    obox(m, ID, SX1, 0.9, 0, YQ, -0.76, CZ0, 'quay', skip=('l', 'r'))
    obox(m, ID, -0.9, 0.9, 0, YQ, CZ1, 0.76, 'quay', skip=('l', 'r'))
    for sg in (-1, 1):
        x = sg*0.9
        for (z0_, z1_, y1_) in ((-0.76, CZ0, YQ), (CZ0, CZ1, YW), (CZ1, 0.76, YQ)):
            m.poly([(x, 0, z0_), (x, 0, z1_), (x, y1_, z1_), (x, y1_, z0_)], 'quay2', (0, 0.05, 0))
    m.poly([(-0.9, YW, CZ0), (-0.9, YW, CZ1), (0.9, YW, CZ1), (0.9, YW, CZ0)][::-1], 'water', (0, 0, 0))
    m.poly([(SX0, YW, -0.76), (SX0, YW, CZ0), (SX1, YW, CZ0), (SX1, YW, -0.76)], 'water', (0, 0, 0))
    m.poly([(SX0, 0, -0.76), (SX1, 0, -0.76), (SX1, YQ, -0.76), (SX0, YQ, -0.76)], 'quay2', (0, 0.05, 0))
    facade(m, -0.88, -0.36, 0.7, 'pA', 4, 2)
    facade(m, -0.36, SX0, 0.86, 'pB', 5, 3)
    facade(m, SX1, 0.88, 0.62, 'pD', 3, 2)
    cx0, cx1, cz0, cz1 = -0.2, -0.04, -0.7, -0.54
    CHT = 1.3
    obox(m, ID, cx0, cx1, YQ, CHT, cz0, cz1, 'brick', skip=('top',))
    xcc = (cx0+cx1)/2
    zcc = (cz0+cz1)/2
    for (F, dd) in ((Fr((xcc, 0), (1, 0), (0, 1)), cz1), (Fr((0, zcc), (0, -1), (1, 0)), cx1), (Fr((0, zcc), (0, 1), (-1, 0)), -cx0)):
        deco_rect(m, F, -0.07, 0.07, 0.62, 0.64, dd+0.003, 'trim')
        deco_arch(m, F, 0, 0.012, 0.75, 0.8, 0.83, dd+0.003, 'dark', 2)
        deco_arch(m, F, 0, 0.012, 0.95, 1.0, 1.03, dd+0.003, 'dark', 2)
        deco_rect(m, F, -0.07, 0.07, 1.05, 1.07, dd+0.003, 'trim')
        for sx in (-0.045, 0.0, 0.045):
            deco_arch(m, F, sx, 0.016, 1.1, 1.17, 1.21, dd+0.003, 'dark', 3)
    obox(m, ID, cx0-0.012, cx1+0.012, CHT, CHT+0.04, cz0-0.012, cz1+0.012, 'trim', top='trim')
    hip(m, ID, cx0, cx1, cz0, cz1, CHT+0.04, CHT+0.28, 'copper', o=0.012)
    cyl(m, xcc, zcc, 0.01, CHT+0.28, CHT+0.36, 4, 'gold', 'gold')
    bridge(m)
    gondola(m, -0.2, 0.09, 6)
    for (px, pz) in ((-0.62, -0.1), (-0.54, -0.1), (0.3, 0.3)):
        lathe(m, px, pz, [(0.016, YW-0.02), (0.016, 0.12), (0.016, 0.17), (0.016, 0.22), (0.0, 0.235)], 5, lambda k, i: 'blue' if k in (0, 2) else 'stripe', rot=0.3)
    for sx in (-0.5, 0.2):
        m.box(sx-0.012, sx+0.012, YQ, YQ+0.2, 0.62-0.012, 0.62+0.012, 'dark', skip=('bot',))
        m.box(sx-0.03, sx+0.03, YQ+0.2, YQ+0.26, 0.62-0.03, 0.62+0.03, 'gold', skip=('bot',))
    return m
