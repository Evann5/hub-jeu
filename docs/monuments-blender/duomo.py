"""Florence : Santa Maria del Fiore, coupole de Brunelleschi (tuiles rouges, nervures blanches), façade à bandes, campanile."""
import math
from lib import Mesh, lerp
from lib_mexique_italie import *

SCALE = 1.14
PAL = {'white': '#F2ECDD', 'pink': '#D98F99', 'green': '#5E9C77', 'red': '#C4472D', 'red2': '#B33C25', 'roof': '#B35A40', 'dark': '#4B3A33',
       'plaza': '#C6BAA1', 'gold': '#E7B83F', 'step': '#E2D8C2', 'rib': '#F5EFE2'}
XN = -0.05
ZD = -0.20            # axe de la coupole
ZFA = 0.68            # plan de la façade


def oct_frame(cx, cz, r, i):
    a = 2*math.pi*i/8
    return Fr((cx+r*math.cos(math.pi/8)*math.sin(a), cz+r*math.cos(math.pi/8)*math.cos(a)), (math.cos(a), -math.sin(a)), (math.sin(a), math.cos(a)))


def build():
    m = Mesh(PAL)
    m.box(-0.75, 0.7, 0, 0.035, -0.78, 0.78, 'plaza', skip=('bot',))
    # nef
    NH = 0.5
    obox(m, ID, XN-0.30, XN+0.30, 0, NH, -0.05, ZFA-0.06, 'white', skip=('front', 'top'))
    gable(m, ID, XN-0.31, XN+0.31, -0.05, ZFA-0.06, NH, NH+0.17, 'roof', 'white', ridge='d', o=0.015)
    for sg in (-1, 1):
        Fs = Fr((XN+sg*0.30, 0), (0, 1), (sg, 0))
        deco_rect(m, Fs, -0.0, 0.62, 0.2, 0.25, 0.003, 'green')
        deco_rect(m, Fs, -0.0, 0.62, 0.42, 0.45, 0.003, 'pink')
        for i in range(4):
            deco_arch(m, Fs, 0.1+0.14*i, 0.03, 0.26, 0.35, 0.40, 0.004, 'dark', 3)
    # croisée : octogone à bandes + trois tribunes
    lathe(m, XN, ZD, [(0.37, 0), (0.37, 0.22), (0.37, 0.28), (0.37, 0.48), (0.37, 0.53), (0.37, 0.6)], 8,
          lambda k, i: ['white', 'green', 'white', 'pink', 'white'][k], rot=math.pi/8)
    for ang in (math.pi, math.pi/2, -math.pi/2):
        lx, lz = XN+0.37*math.sin(ang), ZD+0.37*math.cos(ang)
        cyl(m, lx, lz, 0.18, 0, 0.4, 8, 'white', None, rot=math.pi/8)
        lathe(m, lx, lz, [(0.19, 0.4), (0.0, 0.5)], 8, lambda k, i: 'roof' if i % 2 == 0 else 'red2', rot=math.pi/8)
        for j in range(3):
            a2 = ang+(j-1)*0.5
            Fw = Fr((lx+0.18*math.cos(math.pi/8)*math.sin(a2), lz+0.18*math.cos(math.pi/8)*math.cos(a2)), (math.cos(a2), -math.sin(a2)), (math.sin(a2), math.cos(a2)))
            deco_arch(m, Fw, 0, 0.03, 0.14, 0.24, 0.29, 0.0, 'dark', 3, True)
    # tambour
    lathe(m, XN, ZD, [(0.34, 0.6), (0.34, 0.9), (0.355, 0.9), (0.355, 0.94)], 8, lambda k, i: 'white', rot=math.pi/8)
    for i in range(8):
        Fw = oct_frame(XN, ZD, 0.34, i)
        deco_poly(m, Fw, [(-0.03, 0.72), (0.03, 0.72), (0.045, 0.76), (0.045, 0.8), (0.03, 0.84), (-0.03, 0.84), (-0.045, 0.8), (-0.045, 0.76)], 0.003, 'dark')
    # coupole : huit pans, nervures blanches aux arêtes
    prof = [(0.34, 0.94), (0.335, 1.02), (0.31, 1.13), (0.265, 1.24), (0.2, 1.34), (0.125, 1.42), (0.06, 1.48)]
    rings = [ring_pts(XN, ZD, r, r, y, 8, math.pi/8) for (r, y) in prof]
    fr = [0.0, 0.16, 0.84, 1.0]
    for k in range(len(rings)-1):
        for i in range(8):
            j = (i+1) % 8
            A0, A1, B0, B1 = rings[k][i], rings[k][j], rings[k+1][i], rings[k+1][j]
            for q in range(3):
                f0, f1 = fr[q], fr[q+1]
                pa, pb = lerp(A0, A1, f0), lerp(A0, A1, f1)
                pc, pd = lerp(B0, B1, f1), lerp(B0, B1, f0)
                c = 'rib' if q != 1 else ('red' if k % 2 == 0 else 'red2')
                m.poly([pa, pb, pc, pd], c, (XN, (pa[1]+pc[1])/2-0.05, ZD))
    m.poly(rings[-1], 'rib', (XN, 1.4, ZD))
    # lanterne
    cyl(m, XN, ZD, 0.085, 1.48, 1.53, 8, 'rib', 'rib', rot=math.pi/8)
    cyl(m, XN, ZD, 0.058, 1.53, 1.66, 8, 'white', 'white', rot=math.pi/8)
    for i in range(8):
        deco_arch(m, oct_frame(XN, ZD, 0.058, i), 0, 0.015, 1.56, 1.6, 1.63, 0.002, 'dark', 2)
    lathe(m, XN, ZD, [(0.07, 1.66), (0.05, 1.7), (0.025, 1.76), (0.0, 1.8)], 8, lambda k, i: 'rib', rot=math.pi/8)
    cyl(m, XN, ZD, 0.014, 1.8, 1.9, 4, 'gold', 'gold')
    # façade à bandes
    FA = Fr((XN, 0), (1, 0), (0, 1))
    HW = 0.36
    HL = 0.86
    ops = [(0.0, 0.075, 0.0, 0.22, 0.37), (-0.235, 0.045, 0.0, 0.15, 0.27), (0.235, 0.045, 0.0, 0.15, 0.27)]
    wall_openings(m, FA, -HW, HW, 0, HL, ZFA, ops, 'white', 'dark', 0.05, k=3, pointed=True)
    obox(m, FA, -HW, HW, 0, HL, ZFA-0.07, ZFA-0.05, 'white', skip=('front', 'back'))
    P = FA.P
    m.poly([P(-0.14, HL, ZFA), P(0.14, HL, ZFA), P(0.14, HL+0.1, ZFA), P(0.0, HL+0.21, ZFA), P(-0.14, HL+0.1, ZFA)], 'white', P(0, 0.8, ZFA-3))
    deco_poly(m, FA, [(-0.1, HL+0.01), (0.1, HL+0.01), (0.1, HL+0.09), (0.0, HL+0.17), (-0.1, HL+0.09)], ZFA+0.003, 'pink')
    for sg in (-1, 1):
        a, b = sorted((sg*0.14, sg*HW))
        m.poly([P(a, HL, ZFA), P(b, HL, ZFA), P((a+b)/2, HL+0.1, ZFA)], 'white', P(0, 0.8, ZFA-3))
        deco_poly(m, FA, [(a+0.03, HL+0.01), (b-0.03, HL+0.01), ((a+b)/2, HL+0.075)], ZFA+0.003, 'green')
        cone(m, *(lambda p: (p[0], p[2]))(P(sg*(HW-0.015), 0, ZFA-0.03)), 0.022, HL, HL+0.15, 4, 'pink', rot=math.pi/4)
    deco_rect(m, FA, -HW, HW, 0.42, 0.46, ZFA+0.003, 'green')
    deco_rect(m, FA, -HW, HW, 0.48, 0.5, ZFA+0.003, 'pink')
    deco_rect(m, FA, -HW, -HW+0.02, 0, HL, ZFA+0.003, 'green'); deco_rect(m, FA, HW-0.02, HW, 0, HL, ZFA+0.003, 'green')
    for sg in (-1, 1):
        deco_rect(m, FA, sg*0.155-0.01, sg*0.155+0.01, 0.0, HL, ZFA+0.003, 'pink')
    deco_rect(m, FA, -0.13, 0.13, 0.56, 0.84, ZFA+0.003, 'green')
    deco_rect(m, FA, -0.115, 0.115, 0.575, 0.825, ZFA+0.005, 'pink')
    oc = lambda r: [(math.cos(2*math.pi*i/8+math.pi/8)*r, 0.7+math.sin(2*math.pi*i/8+math.pi/8)*r) for i in range(8)]
    deco_poly(m, FA, oc(0.08), ZFA+0.007, 'white')
    deco_poly(m, FA, oc(0.055), ZFA+0.009, 'dark')
    for sg in (-1, 1):
        deco_arch(m, FA, sg*0.25, 0.045, 0.56, 0.66, 0.73, ZFA+0.003, 'green', 3, True)
        deco_arch(m, FA, sg*0.25, 0.028, 0.57, 0.655, 0.7, ZFA+0.005, 'pink', 3, True)
    for i in range(2):
        m.box(XN-0.34-0.04*i, XN+0.34+0.04*i, 0.035+0.012*i, 0.035+0.012*(i+1), ZFA+0.05-0.04*i, ZFA+0.09-0.04*i, 'step', skip=('bot',))
    # campanile
    CX0, CX1 = XN+0.41, XN+0.65
    ZC0, ZC1 = ZFA-0.24, ZFA
    CH = 1.5
    obox(m, ID, CX0, CX1, 0, CH, ZC0, ZC1, 'white', skip=('top',))
    xc = (CX0+CX1)/2
    zc = (ZC0+ZC1)/2
    cfaces = [(Fr((xc, 0), (1, 0), (0, 1)), ZC1), (Fr((0, zc), (0, -1), (1, 0)), CX1), (Fr((0, zc), (0, 1), (-1, 0)), -CX0)]
    st = [(0.0, 0.3), (0.3, 0.6), (0.6, 0.9), (0.9, 1.2), (1.2, 1.5)]
    for F, dd in cfaces:
        for q, (a, b) in enumerate(st):
            deco_rect(m, F, -0.105, 0.105, a+(0.025 if q else 0.0), b-0.015, dd+0.003, 'green')
            deco_rect(m, F, -0.085, 0.085, a+(0.045 if q else 0.02), b-0.035, dd+0.005, 'pink' if q < 4 else 'white')
            if q in (2, 3):
                for sx in (-0.042, 0.042):
                    deco_arch(m, F, sx, 0.024, a+0.07, a+0.16, a+0.215, dd+0.007, 'dark', 3, True)
            if q == 4:
                for sx in (-0.058, 0.0, 0.058):
                    deco_arch(m, F, sx, 0.02, a+0.07, a+0.15, a+0.2, dd+0.007, 'dark', 3, True)
            if q == 1:
                deco_arch(m, F, 0, 0.03, a+0.08, a+0.15, a+0.19, dd+0.007, 'white', 3, True)
    obox(m, ID, CX0-0.015, CX1+0.015, CH, CH+0.06, ZC0-0.015, ZC1+0.015, 'rib', top='rib')
    obox(m, ID, CX0, CX1, CH+0.06, CH+0.09, ZC0, ZC1, 'pink', top='pink')
    obox(m, ID, CX0-0.015, CX1+0.015, CH+0.09, CH+0.11, ZC0-0.015, ZC1+0.015, 'rib', top='rib')
    return m
