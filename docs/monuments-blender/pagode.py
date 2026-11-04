"""Nara (Japon) : la pagode à cinq toits du Kofuku-ji, bois sombre, toits gris-bleu à coins relevés, flèche de bronze."""
import math
from lib import Mesh
from lib_vietnam_japon import *

PAL = {'wood': '#7A4030', 'wood_d': '#4A2A20', 'plaster': '#CDBF9F', 'roof': '#4C525B', 'roof_l': '#697079',
       'stone': '#AAA392', 'stone_d': '#8C8678', 'bronze': '#B8923F', 'dark': '#2B211C'}

HR = [0.60, 0.55, 0.50, 0.45, 0.40]     # demi-largeur des avant-toits
HB = [0.46, 0.41, 0.36, 0.31, 0.26]     # demi-largeur des murs
WH = [0.30, 0.29, 0.28, 0.27, 0.26]     # hauteur des murs
RH = 0.12                               # hauteur des toits

def face_quad(m, hw, y0, y1, xa, xb, col):
    """Même panneau plaqué sur les quatre faces d'un mur carré de demi-largeur hw."""
    d = hw+0.004
    m.poly([(xa, y0, d), (xb, y0, d), (xb, y1, d), (xa, y1, d)], col, (0, (y0+y1)/2, 0))
    m.poly([(xa, y0, -d), (xb, y0, -d), (xb, y1, -d), (xa, y1, -d)], col, (0, (y0+y1)/2, 0))
    m.poly([(d, y0, xa), (d, y0, xb), (d, y1, xb), (d, y1, xa)], col, (0, (y0+y1)/2, 0))
    m.poly([(-d, y0, xa), (-d, y0, xb), (-d, y1, xb), (-d, y1, xa)], col, (0, (y0+y1)/2, 0))

def build():
    m = Mesh(PAL)
    # socle de pierre et marches
    tbox(m, 0, 0, 0, 0.10, 0.76, 0.76, 0.70, 0.70, 'stone')
    tbox(m, 0, 0, 0.10, 0.15, 0.62, 0.62, 0.60, 0.60, 'stone_d')
    for s in range(4):
        m.box(-0.16, 0.16, 0, 0.05+0.025*s, 0.70+0.05*(3-s)-0.05*0, 0.70+0.05*(4-s), 'stone', skip=('bot', 'nz'))
    y = 0.15
    for k in range(5):
        hb, wh = HB[k], WH[k]
        m.box(-hb, hb, y, y+wh, -hb, hb, 'wood', skip=('bot',))
        # poteaux d'angle sombres, panneau de plâtre clair et porte centrale
        for sx in (-1, 1):
            for sz in (-1, 1):
                m.box(sx*hb-0.018 if sx > 0 else sx*hb-0.018, sx*hb+0.018, y, y+wh, sz*hb-0.018, sz*hb+0.018, 'wood_d', skip=('bot',))
        face_quad(m, hb, y+0.03, y+wh-0.05, -hb*0.62, -hb*0.18, 'plaster')
        face_quad(m, hb, y+0.03, y+wh-0.05, hb*0.18, hb*0.62, 'plaster')
        face_quad(m, hb, y+0.03, y+wh-0.06, -hb*0.10, hb*0.10, 'dark')
        m.box(-hb-0.012, hb+0.012, y+wh-0.035, y+wh, -hb-0.012, hb+0.012, 'wood_d', skip=('bot',))
        nxt = HB[k+1]+0.012 if k < 4 else 0.05
        roof(m, 0, 0, y+wh, HR[k], HR[k], RH, 'roof', top=(nxt, nxt), lift=0.04, flare=0.03, cap=(k < 4), col_top='roof_l')
        y += wh+RH
    # flèche (sôrin) : bol, neuf anneaux, flamme
    cyl(m, 0, 0, y, y+0.05, 0.075, 'bronze', 0.045, n=8)
    spire(m, 0, 0, y+0.05, y+0.52, 0.016, 'bronze', 0.016, n=6)
    for i in range(7):
        cyl(m, 0, 0, y+0.12+0.05*i, y+0.14+0.05*i, 0.05-0.003*i, 'bronze', n=8)
    cyl(m, 0, 0, y+0.48, y+0.60, 0.035, 'bronze', 0.0, n=6, caps=(False, False))
    return m
