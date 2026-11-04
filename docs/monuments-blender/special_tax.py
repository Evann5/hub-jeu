"""Impôts et taxe de séjour : un petit coffre ouvert plein d'or, des piles de pièces, un parchemin scellé."""
import math
from lib import Mesh
from lib_special import *

PAL = {'wood': '#8C5E3B', 'wood2': '#744C2F', 'wood3': '#A47448', 'iron': '#3B3D45', 'iron2': '#54575F', 'gold': '#DDAA2E', 'gold2': '#C4902A',
       'gold3': '#EDC24C', 'goldtop': '#F4CE5B', 'goldemb': '#D3A02B', 'inside': '#4A3220', 'paper': '#EEE5C9', 'ink': '#4A4F59', 'seal': '#B8312B',
       'lock': '#E3B73E'}


def coin_stack(m, cx, cz, n, r=0.17, th=0.052, nside=8, rot0=0.0):
    for k in range(n):
        y0 = k*th
        rot = rot0+(k % 3)*0.17
        edge = 'gold' if k % 2 == 0 else 'gold2'
        if k % 5 == 4:
            edge = 'gold3'
        cyl(m, cx, cz, r, y0, y0+th, nside, edge, cap='goldtop' if k < n-1 else 'goldtop', rot=rot)
    # médaillon en relief sur la dernière pièce
    yt = n*th
    disc(m, cx, yt+0.003, cz, r*0.62, nside, 'goldemb', rot0+((n-1) % 3)*0.17)
    disc(m, cx, yt+0.006, cz, r*0.3, nside, 'gold3', rot0+((n-1) % 3)*0.17)


def build():
    m = Mesh(PAL)
    # ---------- coffre ----------
    x0, x1, z0, z1, h = -0.9, -0.15, -0.5, 0.12, 0.4
    m.box(x0, x1, 0, h, z0, z1, 'wood', skip=('bot', 'top'))
    # planches (traits sombres) et bandes de fer
    for k in range(1, 4):
        xs = x0+(x1-x0)*k/4
        quad_xy(m, xs-0.006, xs+0.006, 0.03, h-0.02, z1+0.002, 'wood2')
    for xb in (x0+0.08, x1-0.08):
        quad_xy(m, xb-0.035, xb+0.035, 0.0, h, z1+0.004, 'iron')
    quad_xy(m, x0, x1, 0.0, 0.05, z1+0.003, 'wood2')
    # cadre du dessus et fond sombre
    m.box(x0, x1, h-0.03, h, z0, z1, 'wood3', skip=('bot', 'top'))
    m.poly([(x0, h-0.04, z0), (x1, h-0.04, z0), (x1, h-0.04, z1), (x0, h-0.04, z1)], 'inside', (0, h-5, 0))
    for (a, b, c, d) in ((x0, x1, z1-0.04, z1), (x0, x1, z0, z0+0.04), (x0, x0+0.04, z0, z1), (x1-0.04, x1, z0, z1)):
        quad_xz(m, a, b, c, d, h, 'wood3')
    # lock
    quad_xy(m, (x0+x1)/2-0.04, (x0+x1)/2+0.04, h-0.15, h-0.04, z1+0.008, 'lock')
    # tas d'or dans le coffre : un fond bombé et des pièces inclinées par-dessus
    cxm, czm = (x0+x1)/2, (z0+z1)/2
    blob(m, cxm, h-0.06, czm+0.02, 0.3, 0.17, 0.2, 'gold2', 0, ymin=h-0.07)
    coins = [(-0.22, 0.05, 0.06, 18, 0.4), (-0.06, 0.1, 0.1, -20, 0.0), (0.1, 0.06, 0.04, 25, -0.3), (0.24, 0.02, 0.07, -10, 0.2),
             (-0.14, 0.16, -0.02, 30, 0.5), (0.02, 0.2, 0.0, -35, -0.2), (0.17, 0.15, 0.02, 15, 0.3), (-0.26, 0.12, -0.04, -25, 0.1),
             (0.0, 0.05, 0.14, 8, 0.0), (0.2, 0.09, -0.1, 40, -0.4), (-0.12, 0.08, -0.1, -15, 0.6), (-0.02, 0.24, 0.03, 20, 0.0)]
    for (dx, dy, dz, tilt, yaw) in coins:
        ctr = (cxm+dx, h-0.03+dy, czm+dz)
        t, yw = math.radians(tilt), yaw
        ax = (math.sin(t)*math.cos(yw), math.cos(t), math.sin(t)*math.sin(yw))
        a_ = tuple(ctr[i]-ax[i]*0.014 for i in range(3)); b_ = tuple(ctr[i]+ax[i]*0.014 for i in range(3))
        tube(m, a_, b_, 0.095, 0.095, 7, 'gold3' if (dx+dz) > 0 else 'gold', (False, True), capcol='goldtop')
    # couvercle ouvert (voûte), charnière à l'arrière, basculé de 105 degrés
    R, T = 0.31, 0.03
    cz = (z0+z1)/2
    nseg = 6
    lid = Mesh(PAL)
    outer = [(cz+R*math.cos(math.pi*k/nseg), h+R*math.sin(math.pi*k/nseg)*0.95) for k in range(nseg+1)]
    inner = [(cz+(R-T)*math.cos(math.pi*k/nseg), h+(R-T)*math.sin(math.pi*k/nseg)*0.95) for k in range(nseg+1)]
    for k in range(nseg):
        a, b = outer[k], outer[k+1]
        lid.poly([(x0, a[1], a[0]), (x1, a[1], a[0]), (x1, b[1], b[0]), (x0, b[1], b[0])], 'wood', (cxm, h, cz))
        a, b = inner[k], inner[k+1]
        fc = (cxm, 0.5*(a[1]+b[1]), 0.5*(a[0]+b[0]))
        lid.poly([(x0, a[1], a[0]), (x1, a[1], a[0]), (x1, b[1], b[0]), (x0, b[1], b[0])], 'inside', (2*fc[0]-cxm, 2*fc[1]-h, 2*fc[2]-cz))
    for k in (0, nseg):       # tranches libres du couvercle (bord avant et bord de la charnière)
        lid.poly([(x0, outer[k][1], outer[k][0]), (x1, outer[k][1], outer[k][0]), (x1, inner[k][1], inner[k][0]), (x0, inner[k][1], inner[k][0])], 'wood3', (cxm, h+1, cz+(1 if k == 0 else -1)*R))
    for sx, xx in ((-1, x0), (1, x1)):
        for k in range(nseg):
            lid.poly([(xx, outer[k][1], outer[k][0]), (xx, outer[k+1][1], outer[k+1][0]), (xx, inner[k+1][1], inner[k+1][0]), (xx, inner[k][1], inner[k][0])],
                     'wood3', (xx-sx*1, h, cz))
    # bandes de fer sur le dessus
    for xb in (x0+0.08, x1-0.08):
        for k in range(nseg):
            a, b = outer[k], outer[k+1]
            lid.poly([(xb-0.035, a[1]+0.003, a[0]), (xb+0.035, a[1]+0.003, a[0]), (xb+0.035, b[1]+0.003, b[0]), (xb-0.035, b[1]+0.003, b[0])], 'iron', (cxm, h, cz))
    xform(lid, rot_x(-100, h, z0))
    m.faces += lid.faces
    # ---------- piles de pièces ----------
    coin_stack(m, 0.27, 0.34, 10, rot0=0.1)
    coin_stack(m, 0.68, 0.1, 7, rot0=0.3)
    coin_stack(m, 0.47, -0.28, 13, rot0=0.0)
    coin_stack(m, 0.0, 0.46, 4, rot0=0.2)
    # pièce posée contre la grande pile
    # pièce à plat devant
    cyl(m, 0.68, 0.46, 0.17, 0.0, 0.052, 8, 'gold2', cap='goldtop')
    disc(m, 0.68, 0.055, 0.46, 0.1, 8, 'goldemb')
    # pièce debout, face au joueur
    sx_, sy_, sz_ = 0.1, 0.17, -0.22
    tube(m, (sx_, sy_, sz_-0.026), (sx_, sy_, sz_+0.026), 0.17, 0.17, 8, 'gold2', (True, True), capcol='goldtop', rot=math.pi/8)
    for (rr, c, dz) in ((0.1, 'goldemb', 0.003), (0.05, 'gold3', 0.006)):
        m.poly([(sx_+rr*math.cos(math.pi/8+k*math.pi/4), sy_+rr*math.sin(math.pi/8+k*math.pi/4), sz_+0.026+dz) for k in range(8)], c, (sx_, sy_, sz_-1))
    # ---------- parchemin scellé ----------
    pz = 0.2
    m.poly([(-0.85, 0.01, pz+0.0), (-0.45, 0.01, pz+0.0), (-0.45, 0.01, pz+0.3), (-0.85, 0.01, pz+0.3)], 'paper', (-0.65, -1, pz))
    for k in range(4):
        zz = pz+0.05+0.055*k
        quad_xz(m, -0.8, -0.5 if k < 3 else -0.62, zz, zz+0.02, 0.013, 'ink')
    disc(m, -0.52, 0.016, pz+0.255, 0.04, 8, 'seal')
    return m
