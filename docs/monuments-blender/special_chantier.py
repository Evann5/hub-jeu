"""Chantier : une grue à tour jaune (mât en treillis, flèche, contre-flèche, cabine, crochet et poutrelle) et un immeuble en construction."""
import math
from lib import Mesh
from lib_special import *

PAL = {'yel': '#F0B922', 'yel2': '#C68F14', 'glass': '#2F4558', 'dark': '#2E3036', 'conc': '#B9B3A6', 'conc2': '#9E998D', 'slab': '#A9A497',
       'brick': '#B4553A', 'brick2': '#9B4730', 'win': '#2F3E4F', 'net': '#4E9A5B', 'net2': '#3C7F49', 'weight': '#8D8C88', 'cable': '#3A3C42',
       'beam': '#D35B2E', 'rebar': '#5C4A3A', 'sand': '#D9C08A', 'wood': '#B8915A', 'wood2': '#9C7544'}

MX, MZ = -0.5, -0.2        # axe du mât
MW = 0.08                  # demi-largeur du mât
YB, YT = 0.12, 1.9         # pied et sommet du mât
JY = 1.97                  # niveau de la flèche


def truss_mast(m):
    n = 7
    lv = [YB+(YT-YB)*k/n for k in range(n+1)]
    corners = [(MX-MW, MZ-MW), (MX+MW, MZ-MW), (MX+MW, MZ+MW), (MX-MW, MZ+MW)]
    for (x, z) in corners:
        rod(m, (x, YB, z), (x, YT, z), 0.017, 'yel', 4)
    for k in range(n+1):
        for i in range(4):
            a, b = corners[i], corners[(i+1) % 4]
            rod(m, (a[0], lv[k], a[1]), (b[0], lv[k], b[1]), 0.011, 'yel', 3)
    for k in range(n):
        for i in range(4):
            a, b = corners[i], corners[(i+1) % 4]
            if (k+i) % 2 == 0:
                rod(m, (a[0], lv[k], a[1]), (b[0], lv[k+1], b[1]), 0.011, 'yel', 3)
            else:
                rod(m, (b[0], lv[k], b[1]), (a[0], lv[k+1], a[1]), 0.011, 'yel', 3)


def jib(m, x0, x1, y, z, nseg):
    """Treillis triangulaire : un membre haut, deux bas."""
    w, hgt = 0.065, 0.11
    top = lambda x: (x, y+hgt, z)
    bf = lambda x: (x, y, z+w)
    bb = lambda x: (x, y, z-w)
    rod(m, top(x0), top(x1), 0.014, 'yel', 3)
    rod(m, bf(x0), bf(x1), 0.014, 'yel', 3)
    rod(m, bb(x0), bb(x1), 0.014, 'yel', 3)
    xs = [x0+(x1-x0)*k/nseg for k in range(nseg+1)]
    for k in range(nseg):
        a, b = xs[k], xs[k+1]
        if k % 2 == 0:
            rod(m, bf(a), top(b), 0.009, 'yel', 3)
            rod(m, bb(a), top(b), 0.009, 'yel', 3)
        else:
            rod(m, top(a), bf(b), 0.009, 'yel', 3)
            rod(m, top(a), bb(b), 0.009, 'yel', 3)
        rod(m, bf(a), bb(a), 0.008, 'yel', 3)


def build():
    m = Mesh(PAL)
    # ---------- grue ----------
    m.box(MX-0.17, MX+0.17, 0, YB, MZ-0.17, MZ+0.17, 'weight', skip=('bot',))
    truss_mast(m)
    m.box(MX-0.12, MX+0.12, YT, JY-0.02, MZ-0.12, MZ+0.12, 'yel2', skip=('bot',))      # couronne d'orientation
    # cabine, côté +Z de la flèche
    m.box(MX+0.02, MX+0.26, JY-0.02, JY+0.2, MZ+0.05, MZ+0.24, 'yel', skip=('bot',))
    quad_xy(m, MX+0.05, MX+0.23, JY+0.04, JY+0.17, MZ+0.24+0.003, 'glass')
    quad_zy(m, MZ+0.08, MZ+0.21, JY+0.04, JY+0.17, MX+0.26+0.003, 'glass')
    # flèche et contre-flèche
    jib(m, MX-0.02, 0.86, JY, MZ, 11)
    jib(m, -0.88, MX+0.02, JY, MZ, 3)
    m.box(-0.91, -0.7, JY-0.12, JY+0.06, MZ-0.1, MZ+0.1, 'weight', skip=('bot',))
    m.box(-0.91, -0.7, JY-0.12, JY-0.095, MZ-0.1, MZ+0.1, 'conc2', skip=('bot',))
    # pointe de grue et haubans
    apex = (MX, 2.52, MZ)
    rod(m, (MX-0.07, JY+0.01, MZ-0.05), apex, 0.017, 'yel', 4)
    rod(m, (MX+0.07, JY+0.01, MZ+0.05), apex, 0.017, 'yel', 4)
    rod(m, (MX-0.07, JY+0.01, MZ+0.05), apex, 0.017, 'yel', 4)
    rod(m, (MX+0.07, JY+0.01, MZ-0.05), apex, 0.017, 'yel', 4)
    rod(m, apex, (0.62, JY+0.115, MZ), 0.006, 'cable', 3)
    rod(m, apex, (-0.8, JY+0.115, MZ), 0.006, 'cable', 3)
    # chariot, câble, crochet et poutrelle
    hx = 0.46
    m.box(hx-0.06, hx+0.06, JY-0.06, JY-0.0, MZ-0.05, MZ+0.05, 'yel2', skip=())
    rod(m, (hx, JY-0.06, MZ), (hx, 1.4, MZ), 0.006, 'cable', 3)
    m.box(hx-0.035, hx+0.035, 1.34, 1.4, MZ-0.03, MZ+0.03, 'yel2')
    for sx in (-1, 1):
        rod(m, (hx, 1.34, MZ), (hx+sx*0.19, 1.23, MZ), 0.005, 'cable', 3)
    m.box(hx-0.22, hx+0.22, 1.17, 1.23, MZ-0.035, MZ+0.035, 'beam')
    m.box(hx-0.22, hx+0.22, 1.23, 1.245, MZ-0.012, MZ+0.012, 'beam')
    # ---------- immeuble en construction ----------
    bx0, bx1, bz0, bz1 = 0.0, 0.84, -0.5, 0.18
    fl = [0.0, 0.3, 0.6]
    # rez-de-chaussée en briques, fenêtres
    m.box(bx0, bx1, 0, fl[1], bz0, bz1, 'brick', skip=('bot', 'top'))
    for k in range(3):
        xc = bx0+0.16+0.26*k
        quad_xy(m, xc-0.07, xc+0.07, 0.1, 0.22, bz1+0.003, 'win')
    m.box(bx0-0.01, bx1+0.01, fl[1], fl[1]+0.035, bz0-0.01, bz1+0.01, 'slab', skip=('bot',))
    # étage 1 : allège en briques derrière les poteaux
    m.box(bx0+0.01, bx1-0.01, fl[1]+0.035, fl[1]+0.15, bz1-0.05, bz1-0.01, 'brick2', skip=('bot',))
    m.box(bx0-0.01, bx1+0.01, fl[2], fl[2]+0.035, bz0-0.01, bz1+0.01, 'slab', skip=('bot',))
    # poteaux de l'étage 1 (entre dalle 1 et dalle 2) et de l'étage 2 (sans dalle, avec fers en attente)
    cols_xz = [(bx0+0.04, bz1-0.04), (bx1-0.04, bz1-0.04), (bx0+0.04, bz0+0.04), (bx1-0.04, bz0+0.04), ((bx0+bx1)/2, bz1-0.04), ((bx0+bx1)/2, bz0+0.04)]
    for (px, pz) in cols_xz:
        m.box(px-0.03, px+0.03, fl[1]+0.035, fl[2], pz-0.03, pz+0.03, 'conc', skip=('bot', 'top'))
        m.box(px-0.03, px+0.03, fl[2]+0.035, fl[2]+0.3, pz-0.03, pz+0.03, 'conc', skip=('bot',))
        for dx in (-0.012, 0.012):
            rod(m, (px+dx, fl[2]+0.3, pz), (px+dx, fl[2]+0.4, pz), 0.005, 'rebar', 3)
    # murs en briques montés à moitié sur l'étage 2 : fond et côté gauche en escalier
    m.box(bx0+0.06, bx1-0.3, fl[2]+0.035, fl[2]+0.27, bz0+0.01, bz0+0.07, 'brick', skip=('bot',))
    m.box(bx0+0.06, bx0+0.22, fl[2]+0.035, fl[2]+0.2, bz0+0.07, bz1-0.2, 'brick2', skip=('bot',))
    m.box(bx0+0.06, bx0+0.14, fl[2]+0.2, fl[2]+0.26, bz0+0.07, bz0+0.3, 'brick2', skip=('bot',))
    # filet de sécurité vert devant l'étage 2
    quad_xy(m, bx0+0.02, bx1-0.02, fl[2]+0.05, fl[2]+0.29, bz1+0.004, 'net')
    for k in range(1, 7):
        xx = bx0+0.02+(bx1-bx0-0.04)*k/7
        quad_xy(m, xx-0.006, xx+0.006, fl[2]+0.05, fl[2]+0.29, bz1+0.007, 'net2')
    # cage d'ascenseur en béton, plus haute
    m.box(0.58, 0.84, 0, 1.08, bz0+0.0, bz0+0.26, 'conc2', skip=('bot',))
    quad_xy(m, 0.66, 0.76, 0.2, 0.52, bz0+0.26+0.003, 'win')
    # ---------- au sol : tas de sable, palette de briques, planches ----------
    lathe(m, -0.18, 0.5, [(0.24, 0.0), (0.12, 0.09), (0.0, 0.19)], 8, 'sand')
    m.box(0.08, 0.4, 0, 0.1, 0.34, 0.56, 'wood', skip=('bot',))
    m.box(0.08, 0.4, 0.1, 0.2, 0.34, 0.56, 'brick', skip=('bot',))
    for k in range(1, 4):
        xx = 0.08+0.08*k
        quad_xy(m, xx-0.003, xx+0.003, 0.1, 0.2, 0.56+0.002, 'brick2')
    m.box(0.52, 0.84, 0, 0.05, 0.36, 0.5, 'wood2', skip=('bot',))
    m.box(0.52, 0.84, 0.05, 0.1, 0.36, 0.5, 'wood', skip=('bot',))
    return m
