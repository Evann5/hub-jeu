"""Guadalajara : la cathédrale, deux flèches jaunes néo-gothiques, coupole, nef en pierre rose."""
import math
from lib import Mesh
from lib_mexique_italie import *

PAL = {'stone': '#D9B07C', 'stone2': '#C99A68', 'trim': '#F0E2C2', 'dark': '#55402F', 'roof': '#A66A4E', 'roof2': '#94593F',
       'y1': '#F2C233', 'y2': '#DDA31C', 'y3': '#F7D663', 'plaza': '#BDB197', 'step': '#EADFC6', 'gold': '#E9B53C', 'glass': '#6C4F3B'}
ZF = 0.48          # plan de la façade
XT = 0.44          # axe des tours


def build():
    m = Mesh(PAL)
    # parvis
    m.box(-0.78, 0.78, 0, 0.035, -0.78, 0.8, 'plaza', skip=('bot',))
    for i in range(3):
        m.box(-0.2-0.04*i, 0.2+0.04*i, 0.035+0.014*i, 0.035+0.014*(i+1), ZF+0.12-0.05*i-0.0, ZF+0.12-0.05*i+0.05, 'step', skip=('bot',))
    # nef : murs, toit à deux pans, bas-côtés
    obox(m, ID, -0.35, 0.35, 0, 0.62, -0.72, ZF-0.02, 'stone', skip=('front',))
    gable(m, ID, -0.37, 0.37, -0.72, ZF-0.02, 0.62, 0.84, 'roof', 'stone', ridge='d', o=0.02)
    for sg in (-1, 1):
        a, b = sorted((sg*0.35, sg*0.56))
        obox(m, ID, a, b, 0, 0.42, -0.66, 0.12, 'stone2', skip=('front',))
        # toit en appentis : un seul pan incliné vers l'extérieur
        pa = (sg*0.35, 0.55, -0.66); pb = (sg*0.35, 0.55, 0.12); pc = (sg*0.57, 0.42, 0.12); pd = (sg*0.57, 0.42, -0.66)
        m.poly([pa, pb, pc, pd], 'roof2', (sg*0.45, 0.0, -0.3))
        m.poly([(sg*0.57, 0.0, -0.66), (sg*0.57, 0.0, 0.12), (sg*0.57, 0.42, 0.12), (sg*0.57, 0.42, -0.66)], 'stone2', (0, 0.2, -0.3))
    # fenêtres hautes des flancs de la nef (côtés)
    for sg in (-1, 1):
        Fs = Fr((sg*0.35, 0), (0, -sg), (sg, 0))
    # tambour et coupole
    cz = -0.2
    lathe(m, 0, cz, [(0.31, 0.58), (0.31, 0.93), (0.33, 0.93), (0.33, 0.97)], 8, lambda k, i: 'stone' if k == 0 else 'trim', rot=math.pi/8)
    for i in range(8):
        a = math.pi/8*2*i+math.pi/4*0.0
        # fenêtre en arc sur chaque pan du tambour
        ang = math.pi/8+2*math.pi*i/8+math.pi/8   # milieu de la face
        mx, mz = (0.31*math.cos(math.pi/8)+0.003)*math.sin(2*math.pi*i/8), (0.31*math.cos(math.pi/8)+0.003)*math.cos(2*math.pi*i/8)
        Fw = Fr((0+mx, cz+mz), (math.cos(2*math.pi*i/8), -math.sin(2*math.pi*i/8)), (math.sin(2*math.pi*i/8), math.cos(2*math.pi*i/8)))
        deco_arch(m, Fw, 0, 0.045, 0.68, 0.82, 0.88, 0.0, 'dark', 3)
    prof = [(0.29, 0.97), (0.27, 1.04), (0.24, 1.12), (0.19, 1.22), (0.12, 1.31), (0.06, 1.38)]
    lathe(m, 0, cz, prof, 8, lambda k, i: 'y1' if (i+k) % 2 == 0 else 'y2', rot=math.pi/8, cap='y1')
    cyl(m, 0, cz, 0.06, 1.38, 1.5, 8, 'trim', 'trim', rot=math.pi/8)
    cone(m, 0, cz, 0.07, 1.5, 1.62, 8, 'y1', rot=math.pi/8)
    cyl(m, 0, cz, 0.012, 1.62, 1.7, 4, 'gold', 'gold')
    # façade centrale
    s0, s1 = -0.29, 0.29
    ops = [(0.0, 0.14, 0.0, 0.3, 0.52), (-0.215, 0.045, 0.0, 0.18, 0.3), (0.215, 0.045, 0.0, 0.18, 0.3)]
    wall_openings(m, ID, s0, s1, 0, 0.95, ZF, ops, 'stone', 'dark', 0.06, k=3, pointed=True)
    deco_rect(m, ID, s0-0.01, s1+0.01, 0.95, 0.99, ZF+0.012, 'trim')
    # fronton triangulaire
    m.poly([(s0, 0.95, ZF), (s1, 0.95, ZF), (0, 1.1, ZF)], 'stone', (0, 0.9, ZF-3))
    deco_poly(m, ID, [(-0.2, 0.97), (0.2, 0.97), (0, 1.07)], ZF+0.003, 'trim')
    deco_arch(m, ID, 0, 0.065, 0.62, 0.76, 0.86, ZF+0.003, 'trim', 3, True)
    deco_arch(m, ID, 0, 0.045, 0.645, 0.76, 0.83, ZF+0.006, 'glass', 3, True)
    for sg in (-1, 1):
        deco_arch(m, ID, sg*0.2, 0.035, 0.6, 0.72, 0.78, ZF+0.003, 'dark', 3, True)
        # pinacle au coin
        cone(m, sg*0.27, ZF-0.03, 0.03, 0.95, 1.1, 4, 'y1', rot=math.pi/4)
    # tours
    for sg in (-1, 1):
        x0, x1 = sorted((sg*0.29, sg*0.59))
        xc = (x0+x1)/2
        zf = ZF
        zb = ZF-0.31
        # fût
        obox(m, ID, x0, x1, 0, 0.78, zb, zf, 'y2', skip=('top',))
        deco_arch(m, ID, xc, 0.03, 0.3, 0.5, 0.58, zf+0.003, 'dark', 3, True)
        deco_arch(m, ID, xc, 0.03, 0.12, 0.22, 0.28, zf+0.003, 'trim', 3, True)
        side = Fr((sg*0.59, 0), (0, -sg), (sg, 0)) if True else None
        # étage des cloches
        xi0, xi1 = x0+0.012, x1-0.012
        obox(m, ID, xi0, xi1, 0.78, 1.2, zb+0.012, zf-0.012, 'y1', skip=())
        for (xs_, ok) in ((xc, True),):
            deco_arch(m, ID, xc-0.052, 0.03, 0.88, 1.02, 1.1, zf-0.012+0.003, 'dark', 3, True)
            deco_arch(m, ID, xc+0.052, 0.03, 0.88, 1.02, 1.1, zf-0.012+0.003, 'dark', 3, True)
        # arcs sur le côté extérieur
        so = Fr((0, 0), (0, 1), (sg, 0))
        dside = sg*(0.59-0.012)
        for zc in (ZF-0.12, ZF-0.2):
            deco_arch(m, so, zc, 0.028, 0.88, 1.02, 1.1, abs(dside)+0.003, 'dark', 3, True)
        # corniche
        obox(m, ID, x0-0.015, x1+0.015, 1.2, 1.26, zb-0.015, zf+0.015, 'trim', top='trim')
        for cxx in (x0+0.0, x1-0.0):
            pass
        for (px_, pz_) in ((x0+0.01, zf), (x1-0.01, zf), (x0+0.01, zb), (x1-0.01, zb)):
            cone(m, px_, pz_, 0.018, 1.26, 1.4, 4, 'y2', rot=math.pi/4)
        # flèche octogonale
        zc = (zf+zb)/2
        prof = [(0.115, 1.26), (0.115, 1.5), (0.13, 1.5), (0.13, 1.54), (0.1, 1.54), (0.098, 1.68), (0.075, 1.9), (0.05, 2.1), (0.028, 2.28), (0.01, 2.42)]
        lathe(m, xc, zc, prof, 8, lambda k, i: ('y3' if k in (1,) and False else ('trim' if k in (2, 3) else ('y1' if (i % 2 == 0) else 'y2'))), rot=math.pi/8)
        for i in range(8):
            ang = 2*math.pi*i/8
            if math.cos(ang) * 0 + math.cos(ang) > -0.1 and math.sin(ang) > -2:
                pass
        # fenêtres du tambour de la flèche
        for i in (0, 2, 6):
            ang = 2*math.pi*i/8
            Fw = Fr((xc+0.1075*math.sin(ang)*1.0+0.0, zc+0.1075*math.cos(ang)), (math.cos(ang), -math.sin(ang)), (math.sin(ang), math.cos(ang)))
            deco_arch(m, Fw, 0, 0.022, 1.32, 1.42, 1.48, 0.0, 'dark', 3, True)
        cyl(m, xc, zc, 0.012, 2.42, 2.5, 4, 'gold', 'gold')
    return m
