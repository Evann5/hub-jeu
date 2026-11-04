"""Télex : une machine à dépêches de bureau sur son caisson, clavier, rouleau, feuille qui sort et ruban de papier."""
import math
from lib import Mesh
from lib_special import *

PAL = {'cab': '#56626E', 'cab2': '#6A7782', 'top': '#3F4750', 'body': '#D8D0BB', 'body2': '#BFB69F', 'dark': '#2E3036', 'key': '#EDE7D3',
       'keyf': '#2F3138', 'paper': '#F5F1E4', 'ink': '#2E3640', 'red': '#C73A33', 'amber': '#E7A92E', 'green': '#4FA05A', 'brass': '#B98E3C',
       'tape': '#EADFB9', 'roller': '#3A3C44', 'grey': '#8D9299'}

XW = 0.62       # demi-largeur de la machine


def build():
    m = Mesh(PAL)
    # ---------- caisson ----------
    m.box(-0.64, 0.64, 0, 0.46, -0.42, 0.42, 'cab', skip=('bot', 'top'))
    m.box(-0.69, 0.69, 0.46, 0.52, -0.47, 0.47, 'top', skip=('bot',))
    for (x0, x1) in ((-0.58, -0.04), (0.04, 0.58)):
        quad_xy(m, x0, x1, 0.07, 0.4, 0.42+0.003, 'cab2')
        xm = (x0+x1)/2
        quad_xy(m, xm-0.06, xm+0.06, 0.31, 0.34, 0.42+0.007, 'brass')
    # ---------- corps ----------
    Y0 = 0.52
    m.box(-XW, XW, Y0, Y0+0.27, -0.34, 0.34, 'body', skip=('bot',))
    quad_xy(m, -XW, XW, Y0, Y0+0.03, 0.34+0.002, 'body2')
    # pente du clavier : coin (z, y)
    ys0, ys1 = Y0+0.27, Y0+0.27+0.17
    zf, zb = 0.34, 0.02
    slope = lambda z: ys0+(zf-z)/(zf-zb)*(ys1-ys0)
    m.poly([(-XW, ys0, zf), (XW, ys0, zf), (XW, ys1, zb), (-XW, ys1, zb)], 'dark', (0, ys0-1, 0.2))
    for sx in (-1, 1):
        m.poly([(sx*XW, Y0+0.27, zf), (sx*XW, ys1, zb), (sx*XW, Y0+0.27, zb)], 'body', (0, 0.6, 0.1))
    # touches : 4 rangées
    rows = [(11, 0.30), (11, 0.235), (10, 0.17), (9, 0.105)]
    for (nk, z) in rows:
        kw = 0.092
        x0 = -(nk*kw)/2
        for i in range(nk):
            xa = x0+i*kw+0.008; xb = x0+(i+1)*kw-0.008
            y = slope(z)
            ya = y+0.028
            za, zb2 = z-0.026, z+0.026
            m.poly([(xa, ya, za), (xb, ya, za), (xb, ya, zb2), (xa, ya, zb2)], 'key', (0.5*(xa+xb), ya-1, z))
            m.poly([(xa, y-0.004, zb2), (xb, y-0.004, zb2), (xb, ya, zb2), (xa, ya, zb2)], 'keyf', (0.5*(xa+xb), ya, zb2-1))
    # barre d'espacement
    ysp = slope(0.043)
    m.poly([(-0.25, ysp+0.025, 0.02), (0.25, ysp+0.025, 0.02), (0.25, ysp+0.025, 0.07), (-0.25, ysp+0.025, 0.07)], 'key', (0, 0, 0.045))
    # ---------- bloc arrière et rouleau ----------
    HY0, HY1 = ys1, ys1+0.2
    m.box(-0.5, 0.5, Y0+0.27, HY1, -0.34, 0.02, 'body', skip=('bot', 'top'))
    m.box(-0.52, 0.52, HY1, HY1+0.03, -0.36, 0.04, 'body2', skip=('bot',))
    # voyants
    for k, c in enumerate(('red', 'amber', 'green')):
        cx = -0.24+0.12*k
        pts = [(cx+0.032*math.cos(a*math.pi/4), HY0+0.09+0.032*math.sin(a*math.pi/4), 0.022) for a in range(8)]
        m.poly(pts, c, (cx, HY0+0.09, 0))
    quad_xy(m, 0.14, 0.42, HY0+0.06, HY0+0.12, 0.022, 'dark')
    # rouleau
    RY, RZ = HY1+0.1, -0.12
    tube(m, (-0.55, RY, RZ), (0.55, RY, RZ), 0.07, 0.07, 10, 'roller', (False, False))
    for sx in (-1, 1):
        tube(m, (sx*0.55, RY, RZ), (sx*0.62, RY, RZ), 0.1, 0.1, 10, 'grey', (True, True))
    # ---------- feuille ----------
    pz0, py0 = -0.08, RY+0.06
    p1 = (-0.37, 0.37)
    sheet = [(pz0, py0), (-0.15, py0+0.62), (-0.1, py0+0.76)]     # (z, y) : monte en arrière puis se courbe vers l'avant
    for k in range(len(sheet)-1):
        (za, ya), (zb_, yb) = sheet[k], sheet[k+1]
        quad = [(p1[0], ya, za), (p1[1], ya, za), (p1[1], yb, zb_), (p1[0], yb, zb_)]
        flat2(m, quad, 'paper', (0, (ya+yb)/2, 5))
    # lignes de texte, sur la face avant de la première partie
    (za, ya), (zb_, yb) = sheet[0], sheet[1]
    for k in range(9):
        t = 0.1+k*0.095
        y = ya+(yb-ya)*t; z = za+(zb_-za)*t+0.004
        x0 = -0.31; x1 = 0.31 - (0.12 if k % 3 == 2 else 0.0) - (0.08 if k == 8 else 0)
        h = 0.016
        col = 'red' if k == 0 else 'ink'
        if k == 0:
            x1 = 0.12
        slope_z = (zb_-za)/(yb-ya)
        m.poly([(x0, y, z), (x1, y, z), (x1, y+h, z+slope_z*h), (x0, y+h, z+slope_z*h)], col, (0, y, z-1))
    # guide-papier
    m.box(-0.45, 0.45, RY+0.04, RY+0.075, -0.07, -0.03, 'dark', skip=('bot',))
    # ---------- ruban de papier perforé ----------
    ys = [0.78, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.012]
    xs = [0.64, 0.74, 0.78, 0.74, 0.8, 0.88, 0.86, 0.9, 0.95]
    w = 0.06
    zt = 0.2
    for k in range(len(ys)-1):
        m.poly([(xs[k]-w, ys[k], zt), (xs[k]+w, ys[k], zt), (xs[k+1]+w, ys[k+1], zt), (xs[k+1]-w, ys[k+1], zt)], 'tape', (xs[k], ys[k], zt-1))
        if k % 2 == 0:
            xm = 0.5*(xs[k]+xs[k+1]); ym = 0.5*(ys[k]+ys[k+1])
            m.poly([(xm-0.012, ym-0.012, zt+0.003), (xm+0.012, ym-0.012, zt+0.003), (xm+0.012, ym+0.012, zt+0.003), (xm-0.012, ym+0.012, zt+0.003)], 'ink', (xm, ym, zt-1))
    return m
