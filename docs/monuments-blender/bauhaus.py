"""Tel-Aviv (Israël) : immeuble blanc Bauhaus, coin arrondi, bandeaux de balcons, cage d'escalier vitrée, auvent de boutique."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'pave': '#CFC9BC', 'road': '#4B4E55', 'line': '#F4F1E6', 'white': '#F7F3EA', 'slab': '#E3DDCD', 'glass': '#2F5D82', 'glass_l': '#7FB0CE',
       'awn': '#E85D4A', 'roofc': '#D9D3C3', 'trunk': '#8A5E3A', 'leaf': '#2E9E4E', 'leaf2': '#4CBF63', 'shrub': '#3E8E45'}

CX, CZ, HW, HD = -0.1, -0.12, 0.46, 0.34
RS = [0.34, 0.0, 0.0, 0.0]          # un seul coin arrondi : avant droite
FL, FH = 5, 0.38                    # nombre d'étages, hauteur d'étage
Y0 = 0.04


def outline(d, rs=RS):
    return rrect(CX, CZ, HW+d, HD+d, [r+d if r >= 0.05 else 0.0 for r in rs], n=4)


def build():
    m = Mesh(PAL)
    plate(m, 'pave', 0.04)
    m.box(-H, H, 0.04, 0.046, 0.52, 0.88, 'road', skip=('bot',))
    for x in (-0.6, -0.2, 0.2, 0.6):
        m.box(x-0.07, x+0.07, 0.046, 0.05, 0.69, 0.71, 'line', skip=('bot',))
    for k in range(FL):
        yb = Y0+k*FH
        prism_xz(m, outline(0.07), yb, yb+0.045, 'slab', 'slab')                 # dalle de balcon qui déborde
        wall_band(m, outline(0.0), yb+0.045, yb+FH, 'white')                       # mur
        wall_band(m, outline(0.008), yb+0.12 if k else yb+0.09, yb+0.31, 'glass')  # ruban de fenêtres
    yt = Y0+FL*FH
    prism_xz(m, outline(0.07), yt, yt+0.045, 'slab', 'roofc')
    # toit : acrotère
    wall_band(m, outline(0.06), yt+0.045, yt+0.1, 'white')
    # cage d'escalier vitrée, devant à gauche, plus haute que le toit
    tx0, tx1, tz0, tz1 = CX-HW, CX-HW+0.2, CZ+HD-0.04, CZ+HD+0.13
    m.box(tx0, tx1, Y0, yt+0.2, tz0, tz1, 'white', skip=('bot',))
    m.box(tx0-0.015, tx1+0.015, yt+0.2, yt+0.235, tz0-0.015, tz1+0.015, 'slab', skip=('bot',))
    xm = (tx0+tx1)/2
    for (y0, y1) in ((0.3, yt-0.05), (yt+0.0, yt+0.16)):
        m.poly([(xm-0.035, y0, tz1+0.004), (xm+0.035, y0, tz1+0.004), (xm+0.035, y1, tz1+0.004), (xm-0.035, y1, tz1+0.004)], 'glass_l', (xm, y0, 0))
    # auvent de boutique au rez-de-chaussée
    m.box(CX-0.28, CX+0.22, Y0+0.28, Y0+0.32, CZ+HD, CZ+HD+0.16, 'awn', skip=('bot',))
    # palmiers de trottoir et buissons
    palm(m, 0.56, 0.4, 0.75, 0.04, 'trunk', 'leaf', 'leaf2', y0=0.04, fronds=6, flen=0.26)
    palm(m, -0.66, 0.42, 0.6, -0.05, 'trunk', 'leaf', 'leaf2', y0=0.04, fronds=6, flen=0.22)
    for x in (0.1, 0.32):
        blob(m, x, 0.1, 0.38, 0.1, 0.07, 0.08, 'shrub', n=6, lats=(0, 40, 75))
    return m
