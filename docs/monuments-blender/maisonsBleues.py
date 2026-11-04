"""Chefchaouen : une ruelle en escalier entre des maisons bleues, pots de fleurs orange."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'b1': '#2F7FD6', 'b2': '#4C9BE8', 'b3': '#78B8EE', 'b4': '#2268B8', 'b5': '#9CCBF0',
    'wh': '#F1F4F6', 'tread': '#BFD8EC', 'riser': '#8DB8DD', 'win': '#15315E', 'door': '#5A3A25',
    'door2': '#1B4A98', 'pot': '#E5782A', 'plant': '#4F8D3B', 'flower': '#F2A33A', 'roof': '#E4EEF5',
    'ground': '#B5C4CC', 'roofa': '#A9D2F2', 'roofb': '#CFE5F6', 'roofc': '#C9573A', 'dark': '#22406F',
}
Y0 = 0.04
ROOF = ['roofa', 'roofb', 'roofc']
SD = 0.14          # profondeur d'une marche
RISE = 0.065
NB = 5
BD = 0.28          # profondeur d'un bloc de maisons
Z_FRONT = 0.70

def step_top(j): return Y0+RISE*(j+1)
def floor_at(i): return Y0+0.13*(i+1)       # niveau moyen du pied du bloc i

def build():
    m = Mesh(PAL)
    # ---------- escalier ----------
    for j in range(2*NB):
        z1 = Z_FRONT-SD*j
        m.box(-0.2, 0.2, Y0, step_top(j), z1-SD, z1, 'riser', skip=('bot', 'top', 'nx', 'px') if j == 2*NB-1 else ('bot', 'top', 'nz', 'nx', 'px'))
        m.box(-0.2, 0.2, step_top(j)-0.001, step_top(j), z1-SD, z1, 'tread', skip=('bot', 'nz', 'pz', 'nx', 'px'))
    # ---------- maisons ----------
    HL = [0.55, 0.62, 0.50, 0.66, 0.72]
    HR = [0.60, 0.50, 0.66, 0.55, 0.64]
    CL = ['b1', 'b3', 'b4', 'b2', 'b1']
    CR = ['b3', 'b2', 'b1', 'b5', 'b4']
    boxes = []
    for i in range(NB):
        z1 = Z_FRONT-BD*i; z0 = z1-BD
        for (x0, x1, h, col, side) in ((-0.7, -0.2, HL[i], CL[i], 'L'), (0.2, 0.7, HR[i], CR[i], 'R')):
            ytop = floor_at(i)+h
            b = B(x0, x1, Y0, ytop, z0, z1)
            box(m, b, col, skip=('bot', 'top'))
            m.box(x0-0.01, x1+0.01, ytop-0.012, ytop+0.012, z0-0.01, z1+0.01, 'wh', skip=('bot', 'top'))
            m.poly([(x0-0.01, ytop+0.012, z0-0.01), (x1+0.01, ytop+0.012, z0-0.01), (x1+0.01, ytop+0.012, z1+0.01), (x0-0.01, ytop+0.012, z1+0.01)], ROOF[(i+(side == 'R')) % 3], (0, 0, 0))
            boxes.append((i, side, b, h))
    # ---------- passage voûté au-dessus de la ruelle ----------
    zb1 = Z_FRONT-SD*6; zb0 = Z_FRONT-SD*8
    ytop = floor_at(3)+0.34
    bridge = B(-0.2, 0.2, Y0, ytop, zb0, zb1)
    m.box(-0.2, 0.2, ytop-0.001, ytop, zb0, zb1, 'wh', skip=('bot', 'nx', 'px', 'nz', 'pz'))
    m.box(-0.2, 0.2, Y0, ytop, zb0, zb1, 'b2', skip=('bot', 'top', 'nz', 'pz'))
    yf, yb = step_top(6)-0.004, step_top(7)-0.004
    for (zz, yfl, face) in ((zb1, yf, 'pz'), (zb0, yb, 'nz')):
        hw, vs = 0.12, yfl+0.17
        outline = round_arch(0, yfl, vs, hw, 6)
        sgn = 1 if face == 'pz' else -1
        mp = (lambda u, v, zz=zz, sgn=sgn: (sgn*u, v, zz))
        poly = [(-0.2, yfl)] + outline + [(0.2, yfl), (0.2, ytop), (-0.2, ytop)]
        face2d(m, poly, mp, 'b2', (0, 0.5, zz + sgn*-1))
    arch_f = round_arch(0, yf, yf+0.17, 0.12, 6)
    arch_b = round_arch(0, yb, yb+0.17, 0.12, 6)
    for i in range(len(arch_f)-1):
        a, b_ = arch_f[i], arch_f[i+1]
        c, d = arch_b[i], arch_b[i+1]
        p = [(a[0], a[1], zb1), (b_[0], b_[1], zb1), (d[0], d[1], zb0), (c[0], c[1], zb0)]
        cen = centroid(p)
        m.poly(p, 'dark', (cen[0]*2, cen[1]*2-(yf+0.06), cen[2]))   # normale vers l'intérieur du passage
    # ---------- fenêtres, portes ----------
    for (i, side, b, h) in boxes:
        face_alley = 'px' if side == 'L' else 'nx'
        fl = floor_at(i)
        # porte à plein cintre sur le mur de la ruelle
        u = 0.0
        d_w = 0.055
        yb0 = fl-0.06
        dcol = 'door2' if (i % 2 == 0) else 'door'
        decal(m, b, face_alley, round_arch(0.04 if side == 'L' else -0.04, yb0, yb0+0.1, d_w+0.012, 4), 'wh', 0.003)
        decal(m, b, face_alley, round_arch(0.04 if side == 'L' else -0.04, yb0, yb0+0.1, d_w, 4), dcol, 0.006)
        # fenêtres de la ruelle (deux niveaux)
        for k, vv in enumerate((fl+0.2, fl+0.4)):
            if vv+0.1 > b.y1-0.03:
                continue
            for uu in (-0.07, 0.07):
                decal(m, b, face_alley, rect(uu-0.036, uu+0.036, vv, vv+0.105), 'wh', 0.003)
                decal(m, b, face_alley, rect(uu-0.027, uu+0.027, vv+0.009, vv+0.096), 'win', 0.006)
        # face avant (vers +z) : une fenêtre et un auvent
        vv = max(b.y0, floor_at(i-1)+HL[i-1] if side == 'L' and i > 0 else (floor_at(i-1)+HR[i-1] if i > 0 else 0)) + 0.06
        if i == 0:
            vv = fl+0.12
        if vv+0.11 < b.y1-0.03:
            cx = -0.18 if side == 'L' else 0.18
            for uu in (-0.1, 0.1) if (b.x1-b.x0) > 0.4 else (0.0,):
                decal(m, b, 'pz', rect(uu-0.036, uu+0.036, vv, vv+0.105), 'wh', 0.003)
                decal(m, b, 'pz', rect(uu-0.027, uu+0.027, vv+0.009, vv+0.096), 'win', 0.006)
    # ---------- pots de fleurs ----------
    for (j, sd) in ((0, 1), (1, -1), (3, 1), (4, -1), (5, 1), (6, -1), (8, 1), (9, -1), (2, 1), (7, 1)):
        z = Z_FRONT-SD*j-SD/2
        pot(m, 0.15*sd, step_top(j), z, 0.065, 'pot', 'plant', 'flower')
    for (i, side, b, h) in boxes:
        if i in (0, 1, 3):
            xx = b.x0+0.07 if side == 'R' else b.x1-0.07
            pot(m, xx, b.y1+0.012, b.z1-0.07, 0.065, 'pot', 'plant', 'flower')
    # petits volumes sur les toits
    for (i, side, bb, h) in boxes:
        if i == 4 and side == 'L':
            m.box(bb.x0+0.06, bb.x0+0.2, bb.y1+0.012, bb.y1+0.12, bb.z0+0.05, bb.z0+0.2, 'b5', skip=('bot',))
        if i == 3 and side == 'R':
            m.box(bb.x1-0.2, bb.x1-0.07, bb.y1+0.012, bb.y1+0.1, bb.z0+0.04, bb.z0+0.16, 'wh', skip=('bot',))
    # rotation de l'ensemble pour qu'un mur de la ruelle se voie de face
    n0 = len(m.faces)
    m.box(-0.72, 0.72, 0.0, Y0, -0.72, 0.72, 'ground', skip=('bot',))
    xform(m, rot_y(-16))
    return m
    # ---------- sol ----------

