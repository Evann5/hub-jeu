"""Contrôle : une tour de contrôle d'aéroport (fût, vigie vitrée), son terminal, un radar, une manche à air et trois cônes orange."""
import math
from lib import Mesh
from lib_special import *

PAL = {'wall': '#D9D5CA', 'wall2': '#C4C0B4', 'roof': '#6B6E78', 'wht': '#F1EFE8', 'glass': '#2C5873', 'glass2': '#4C88A9', 'dark': '#2D2F37',
       'red': '#C9382F', 'orange': '#EF7B1F', 'orange2': '#D4650F', 'pole': '#B7BBC2', 'grey': '#9A9DA6'}

TX, TZ = -0.62, -0.05      # axe de la tour
SCALE = 0.94


def cone_traffic(m, cx, cz, s=1.0):
    m.box(cx-0.14*s, cx+0.14*s, 0, 0.03*s, cz-0.14*s, cz+0.14*s, 'orange2', skip=('bot',))
    prof = [(0.1*s, 0.03*s), (0.082*s, 0.14*s), (0.066*s, 0.2*s), (0.05*s, 0.29*s), (0.03*s, 0.37*s), (0.0, 0.4*s)]
    cols = ['orange', 'wht', 'orange', 'wht', 'orange']
    lathe(m, cx, cz, prof, 8, None, math.pi/8, lambda k, i: cols[k])


def build():
    m = Mesh(PAL)
    # ---------- terminal ----------
    m.box(-1.2, 0.38, 0, 0.42, -0.42, 0.36, 'wall', skip=('bot', 'top'))
    m.box(-1.24, 0.42, 0.42, 0.48, -0.46, 0.4, 'roof', skip=('bot',))
    quad_xy(m, -1.05, 0.24, 0.17, 0.31, 0.36+0.003, 'glass')
    for k in range(8):
        x = -1.05+k*(1.29/7)
        quad_xy(m, x-0.01, x+0.01, 0.17, 0.31, 0.36+0.005, 'wall2')
    quad_xy(m, -1.2, 0.38, 0.0, 0.05, 0.36+0.002, 'wall2')
    m.box(-0.1, 0.28, 0.34, 0.37, 0.3, 0.52, 'wht', skip=('bot',))       # marquise d'entrée
    # ---------- fût ----------
    rot = math.pi/8
    shaft = [(0.3, 0.48), (0.22, 0.7), (0.18, 1.1), (0.165, 1.78)]
    lathe(m, TX, TZ, shaft, 8, 'wht', rot)
    for (yy, r) in ((0.9, 0.19), (1.2, 0.18), (1.5, 0.172)):
        ap = r*math.cos(math.pi/8)
        quad_xy(m, TX-0.045, TX+0.045, yy, yy+0.14, TZ+ap+0.004, 'dark')
    # ---------- vigie : verre incliné vers l'extérieur, toit petit pour qu'on la voie d'en haut ----------
    cyl(m, TX, TZ, 0.3, 1.78, 1.84, 8, 'wht', cap='wht', rot=rot, r1=0.31, capbot='wall2')
    G0, G1, Y0, Y1 = 0.25, 0.34, 1.84, 2.34
    lathe(m, TX, TZ, [(G0, Y0), (G1, Y1)], 8, None, rot, lambda k, i: 'glass' if i % 2 == 0 else 'glass2')
    for i in range(8):
        a = rot+2*math.pi*i/8
        pa = (TX+G0*math.cos(a), Y0, TZ+G0*math.sin(a)); pb = (TX+G1*math.cos(a), Y1, TZ+G1*math.sin(a))
        rod(m, pa, pb, 0.014, 'wht', 4)
    cyl(m, TX, TZ, 0.355, 2.34, 2.4, 8, 'wht', cap='wht', rot=rot)
    lathe(m, TX, TZ, [(0.375, 2.4), (0.3, 2.43), (0.1, 2.48)], 8, 'roof', rot, cap='roof')
    cyl(m, TX, TZ, 0.014, 2.48, 2.64, 5, 'dark')
    blob(m, TX, 2.64, TZ, 0.028, 0.028, 0.028, 'red', 0)
    # ---------- radar sur le toit du terminal ----------
    rx, rz = 0.05, -0.18
    cyl(m, rx, rz, 0.025, 0.48, 0.84, 6, 'grey')
    m.box(rx-0.24, rx+0.24, 0.84, 0.89, rz-0.015, rz+0.015, 'grey', skip=('bot',))
    m.box(rx-0.24, rx+0.24, 0.89, 0.94, rz-0.015, rz+0.015, 'wht', skip=('bot',))
    m.box(rx-0.04, rx+0.04, 0.82, 0.86, rz-0.04, rz+0.04, 'dark')
    # ---------- manche à air ----------
    wx, wz = 0.78, -0.3
    cyl(m, wx, wz, 0.02, 0, 1.0, 6, 'pole')
    cyl(m, wx, wz, 0.06, 0, 0.04, 8, 'grey', cap='grey')
    seg = [(0.1, 0.085, 'orange'), (0.085, 0.07, 'wht'), (0.07, 0.055, 'orange'), (0.055, 0.04, 'wht')]
    x = wx
    for k, (r0, r1, c) in enumerate(seg):
        tube(m, (x, 0.93-k*0.02, wz), (x+0.1, 0.93-(k+1)*0.02-0.005, wz), r0, r1, 6, c)
        x += 0.1
    # ---------- cônes ----------
    cone_traffic(m, 0.78, 0.62, 1.0)
    cone_traffic(m, 1.06, 0.5, 1.0)
    cone_traffic(m, 0.92, 0.88, 1.0)
    return m
