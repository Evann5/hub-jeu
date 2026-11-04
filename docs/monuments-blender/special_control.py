"""Contrôle : une tour de contrôle trapue à grosse vigie vitrée, posée sur un terminal bas. Rien d'autre."""
import math
from lib import Mesh
from lib_special import *

PAL = {'wall': '#D9D5CA', 'wall2': '#C4C0B4', 'roof': '#6B6E78', 'wht': '#F1EFE8', 'glass': '#2A5F80', 'glass2': '#7CC0DC', 'dark': '#2D2F37',
       'red': '#D03A30', 'orange': '#EF7B1F', 'grey': '#9A9DA6'}

TX, TZ = -0.6, -0.05       # axe de la tour
SCALE = 0.95


def build():
    m = Mesh(PAL)
    # ---------- terminal bas et large ----------
    m.box(-1.2, 1.2, 0, 0.36, -0.45, 0.4, 'wall', skip=('bot', 'top'))
    m.box(-1.25, 1.25, 0.36, 0.44, -0.5, 0.45, 'wall2', skip=('bot',))
    quad_xy(m, -1.1, -0.3, 0.1, 0.28, 0.4+0.003, 'glass')
    quad_xy(m, 0.0, 1.1, 0.1, 0.28, 0.4+0.003, 'glass')
    quad_xy(m, -1.2, 1.2, 0.0, 0.05, 0.4+0.002, 'orange')
    # ---------- fût ----------
    rot = math.pi/8
    shaft = [(0.42, 0.4), (0.3, 0.8), (0.27, 1.15)]
    lathe(m, TX, TZ, shaft, 8, 'wht', rot)
    for yy in (0.85, 1.12):
        ap = (0.3-0.04*(yy-0.8)/0.7*1.0)*math.cos(math.pi/8)
        quad_xy(m, TX-0.07, TX+0.07, yy, yy+0.16, TZ+ap+0.004, 'dark')
    # bande rouge sous la vigie
    cyl(m, TX, TZ, 0.27, 1.15, 1.22, 8, 'red', cap='red', rot=rot, r1=0.4, capbot='wall2')
    # ---------- vigie : grosse, verre incliné vers l'extérieur ----------
    G0, G1, Y0, Y1 = 0.4, 0.5, 1.22, 2.15
    lathe(m, TX, TZ, [(G0, Y0), (G1, Y1)], 8, None, rot, lambda k, i: 'glass' if i % 2 == 0 else 'glass2')
    for i in range(8):
        a = rot+2*math.pi*i/8
        pa = (TX+G0*math.cos(a), Y0, TZ+G0*math.sin(a)); pb = (TX+G1*math.cos(a), Y1, TZ+G1*math.sin(a))
        rod(m, pa, pb, 0.035, 'wht', 4)
    cyl(m, TX, TZ, 0.54, 2.15, 2.21, 8, 'wht', cap='wht', rot=rot)
    lathe(m, TX, TZ, [(0.4, 2.21), (0.34, 2.29), (0.1, 2.36)], 8, 'roof', rot, cap='roof')
    cyl(m, TX, TZ, 0.025, 2.36, 2.55, 5, 'dark')
    blob(m, TX, 2.57, TZ, 0.05, 0.05, 0.05, 'red', 0)
    return m
