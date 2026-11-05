"""Bénarès (Inde) : les ghats, grand escalier de pierre qui descend vers le Gange, temple à tour en pointe, palais ocre, parasols, barques."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'water': '#3E8FB5', 'foam': '#E4F1F3', 'step': '#E9D8AE', 'step2': '#CDB482', 'wall': '#DDA66A', 'wall_l': '#F2D29C', 'temple': '#E8833A',
       'temple_l': '#F8DFA8', 'gold': '#E2B440', 'wood': '#7C5A3A', 'um1': '#EAB53A', 'um2': '#D8503E', 'boat': '#C9552E', 'boat2': '#2F6FB0',
       'recess': '#4B3226', 'white': '#F4F1EA'}

W, N, D, RISE, ZF = 0.88, 9, 0.078, 0.065, 0.5

def step_y(k):
    return 0.04+RISE*(k+1)

def y_at(z):
    k = int((ZF-z)/D)
    return step_y(max(0, min(N-1, k)))

def boat(m, cx, cz, rot, L, col, deck):
    s = len(m.faces)
    hull(m, [(-L/2, 0.03, 0.03, 0.075), (-L*0.25, 0.07, 0.025, 0.07), (L*0.2, 0.07, 0.025, 0.07), (L/2, 0.012, 0.05, 0.11)], col, deck)
    m.box(-L*0.15, L*0.12, 0.07, 0.12, -0.05, 0.05, 'white', skip=('bot',))
    xform(m, lambda p: move(cx, 0, cz)(rot_y(rot)(p)), s)

def build():
    m = Mesh(PAL)
    # fleuve et escalier
    m.box(-W, W, 0.0, 0.03, ZF, 0.88, 'water', skip=('bot', 'nz'))
    for (x0, z0, w) in ((-0.7, 0.58, 0.45), (0.1, 0.8, 0.5)):
        m.box(x0, x0+w, 0.03, 0.035, z0, z0+0.03, 'foam', skip=('bot',))
    for k in range(N):
        zf = ZF-D*k; zb = zf-D; y1 = step_y(k); yp = 0.0 if k == 0 else step_y(k-1)
        m.box(-W, W, 0.0, y1, zb, zf, 'step2', skip=('bot', 'nz', 'pz', 'top'))
        m.poly([(-W, y1, zb), (W, y1, zb), (W, y1, zf), (-W, y1, zf)], 'step', (0, y1-1, (zb+zf)/2))
        m.poly([(-W, yp, zf), (W, yp, zf), (W, y1, zf), (-W, y1, zf)], 'step2', (0, (yp+y1)/2, zf-1))
    top = step_y(N-1)
    zz = ZF-D*N
    m.box(-W, W, 0.0, top, -W, zz, 'step2', skip=('bot', 'pz', 'top'))
    m.poly([(-W, top, -W), (W, top, -W), (W, top, zz), (-W, top, zz)], 'step', (0, top-1, 0))
    # palais ocre à gauche, avec ses fenêtres et deux coupoles
    m.box(-W, -0.1, top, top+0.5, -W, -0.5, 'wall', skip=('bot',))
    m.box(-W-0.02, -0.08, top+0.46, top+0.52, -W, -0.48, 'wall_l', skip=('bot',))
    for r in range(2):
        for k in range(5):
            x = -0.8+0.145*k
            window(m, -0.5+0.001, x, top+0.07+0.2*r, top+0.21+0.2*r-0.02, 0.04, 'recess', 'wall_l', True, 1)
    for x in (-0.65, -0.3):
        cyl(m, x, -0.7, top+0.52, top+0.62, 0.07, 'wall_l', n=8)
        dome(m, x, -0.7, top+0.62, 0.09, 0.1, 8, 'temple_l', rows=2)
        cone(m, x, -0.7, top+0.72, top+0.8, 0.012, 'gold', n=4, cap_bot=False)
    # petit temple à tour (shikhara)
    tx, tz = 0.45, -0.55
    m.box(tx-0.2, tx+0.2, top, top+0.16, tz-0.2, tz+0.2, 'temple_l', skip=('bot',))
    m.box(tx-0.17, tx+0.17, top+0.16, top+0.3, tz-0.17, tz+0.17, 'temple', skip=('bot',))
    front(m, tz+0.17+0.003, arch2d(tx, top+0.16, top+0.22, top+0.27, 0.05, 4), 'recess')
    ys = top+0.3
    for i, (h, w0, w1) in enumerate(((0.2, 0.17, 0.14), (0.18, 0.14, 0.115), (0.16, 0.115, 0.09), (0.14, 0.09, 0.065))):
        tbox(m, tx, tz, ys, ys+h, w0, w0, w1, w1, 'temple' if i % 2 == 0 else 'temple_l')
        ys += h
    cyl(m, tx, tz, ys, ys+0.05, 0.085, 'temple_l', n=8)
    cyl(m, tx, tz, ys+0.05, ys+0.08, 0.05, 'temple', n=8)
    sphere(m, tx, ys+0.12, tz, 0.035, 'gold', n=6, rows=3)
    cone(m, tx, tz, ys+0.14, ys+0.26, 0.012, 'gold', n=4, cap_bot=False)
    # parasols plantés sur les marches
    for (x, z, c) in ((-0.55, 0.12, 'um1'), (0.1, 0.28, 'um2'), (0.6, 0.0, 'um1'), (-0.1, -0.1, 'um2')):
        y = y_at(z)
        cyl(m, x, z, y, y+0.2, 0.012, 'wood', n=4)
        cone(m, x, z, y+0.17, y+0.27, 0.1, c, n=8)
    # barques
    boat(m, -0.42, 0.72, 8, 0.5, 'boat', 'wood')
    boat(m, 0.4, 0.66, -14, 0.46, 'boat2', 'wood')
    return m
