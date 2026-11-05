"""Saint-Louis : le pont Faidherbe, long pont de fer à poutres en treillis sur le fleuve Sénégal, piles de pierre."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'river': '#3A92B8', 'foam': '#EAF6F8', 'bank': '#E6CF98', 'bank2': '#C9A96C', 'grass': '#79AE58', 'pier': '#D9C7A2', 'pier2': '#AE9570',
       'iron': '#4F8AA8', 'iron2': '#33607A', 'deck': '#6B6F73', 'rail': '#EEF3F6', 'trunk': '#7A5632', 'leaf': '#2FA05A', 'leaf2': '#1E8049'}
YD = 0.5
Z = 0.13


def truss(m, x0, x1, hmax, n):
    """Poutre en treillis (un côté) : membrure haute bombée, montants et diagonales."""
    xs = [x0+(x1-x0)*i/n for i in range(n+1)]
    top = [YD+0.06+hmax*max(0.0, 1-((x-(x0+x1)/2)/((x1-x0)/2))**2)**0.6 for x in xs]
    for sz in (-1, 1):
        z = sz*Z
        for i in range(n):
            m.beam((xs[i], top[i], z), (xs[i+1], top[i+1], z), 0.05, 'iron', sides=3, caps=True)
        for i in range(n+1):
            m.beam((xs[i], YD+0.03, z), (xs[i], top[i], z), 0.035, 'iron2', sides=3, caps=True)
        for i in range(n):
            a, b = (i, i+1) if i % 2 == 0 else (i+1, i)
            m.beam((xs[a], YD+0.03, z), (xs[b], top[b], z), 0.028, 'iron2', sides=3, caps=True)
    # entretoises hautes
    for i in range(1, n, 2):
        m.beam((xs[i], top[i], -Z), (xs[i], top[i], Z), 0.03, 'iron2', sides=3, caps=True)


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.04, -0.88, 0.88, 'river', skip=('bot',))
    for (x0, x1, z0) in ((-0.55, -0.4, 0.5), (0.35, 0.5, -0.6), (-0.1, 0.1, 0.72)):
        m.box(x0, x1, 0.04, 0.046, z0, z0+0.03, 'foam', skip=('bot',))
    # berges aux deux bouts
    for sx in (-1, 1):
        x0, x1 = (0.68, 0.88) if sx > 0 else (-0.88, -0.68)
        sbox(m, x0, x1, 0.04, YD, -0.88, 0.88, 'bank', 'grass')
        tbox(m, sx*0.78, 0.0, YD, YD+0.02, 0.1, 0.5, 0.1, 0.5, 'bank2')
    palm(m, -0.7, 0.6, 0.55, 'trunk', 'leaf', 'leaf2', y0=YD, lean=0.05, fronds=6, flen=0.18)
    palm(m, 0.7, -0.55, 0.5, 'trunk', 'leaf', 'leaf2', y0=YD, lean=-0.05, fronds=6, flen=0.18)
    # piles
    for px in (-0.3, 0.3):
        tbox(m, px, 0, 0.04, YD, 0.09, 0.19, 0.075, 0.17, 'pier', col_top='pier2')
        tbox(m, px, 0.21, 0.04, 0.3, 0.02, 0.03, 0.01, 0.01, 'pier2')
    # tablier
    sbox(m, -0.88, 0.88, YD-0.04, YD+0.02, -0.15, 0.15, 'deck', 'deck')
    m.box(-0.7, 0.7, YD-0.07, YD-0.04, -0.15, 0.15, 'iron2', skip=('top',))
    truss(m, -0.7, -0.3, 0.2, 4)
    truss(m, -0.3, 0.3, 0.32, 6)
    truss(m, 0.3, 0.7, 0.2, 4)
    return m
