"""Nampho (Corée du Nord) : le long barrage de l'Ouest, piliers de béton, vannes bleues levées, jets d'écume, route et bâtiment de commande."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'up': '#4FB6C8', 'dn': '#2A86B8', 'foam': '#F2F8F8', 'foam2': '#CBE7F0', 'conc': '#D5D3CA', 'conc_d': '#A9A8A0', 'gate': '#2F5F86', 'gate_l': '#4A86B3',
       'bank': '#6FA85A', 'bank2': '#5A9449', 'road': '#4A4A50', 'rail': '#F4F4F0', 'hut': '#F2EEE4', 'hut_r': '#3C8DB8', 'glass': '#2D4E70', 'crane': '#E0A93B'}

PW, BW = 0.07, 0.13            # pilier, travée
X0 = -(7*PW+6*BW)/2            # début du barrage
ZB, ZF = -0.2, 0.15            # arrière et avant du corps du barrage


def build():
    m = Mesh(PAL)
    plate(m, 'dn', 0.06)
    # retenue en amont (haute) et berges
    m.box(-H, H, 0.0, 0.4, -H, ZB, 'up', skip=('bot',))
    m.box(-H, -0.65, 0.0, 0.2, -H, H, 'bank', skip=('bot',))
    m.box(0.65, H, 0.0, 0.2, -H, H, 'bank', skip=('bot',))
    m.box(-H, -0.65, 0.2, 0.215, -H, H, 'bank2', skip=('bot',))
    m.box(0.65, H, 0.2, 0.215, -H, H, 'bank2', skip=('bot',))
    # pilier + vanne par travée
    x = X0
    for i in range(7):
        m.box(x, x+PW, 0.0, 0.58, ZB, ZF, 'conc', skip=('bot',))
        m.box(x+0.01, x+PW-0.01, 0.58, 0.62, ZB, ZF, 'conc_d', skip=('bot',))
        x += PW
        if i < 6:
            m.box(x, x+BW, 0.13, 0.42, -0.06, -0.035, 'gate', skip=('bot',))
            m.box(x+0.012, x+BW-0.012, 0.2, 0.34, -0.035, -0.028, 'gate_l', skip=('bot',))
            m.box(x, x+BW, 0.4, 0.5, ZB, ZB+0.03, 'conc_d', skip=('bot',))     # linteau amont
            # jet d'écume sous la vanne
            m.poly([(x+0.006, 0.13, -0.05), (x+BW-0.006, 0.13, -0.05), (x+BW-0.006, 0.075, 0.36), (x+0.006, 0.075, 0.36)],
                   'foam' if i % 2 == 0 else 'foam2', (x, -5, 0.0))
            m.box(x+0.004, x+BW-0.004, 0.06, 0.075, 0.36, 0.44, 'foam', skip=('bot',))
            x += BW
    XE = x
    # tablier : route, rambardes
    m.box(X0-0.02, XE+0.02, 0.62, 0.64, ZB-0.02, ZF+0.02, 'conc', skip=('bot',))
    m.box(X0-0.02, XE+0.02, 0.64, 0.65, ZB+0.03, ZF-0.03, 'road', skip=('bot',))
    m.box(X0-0.02, XE+0.02, 0.64, 0.7, ZF, ZF+0.02, 'rail', skip=('bot',))
    m.box(X0-0.02, XE+0.02, 0.64, 0.7, ZB-0.02, ZB, 'rail', skip=('bot',))
    # pont roulant sur le tablier
    for xx in (-0.3, 0.1):
        m.box(xx, xx+0.03, 0.65, 0.84, ZB+0.05, ZB+0.08, 'crane', skip=('bot',))
        m.box(xx+0.2, xx+0.23, 0.65, 0.84, ZB+0.05, ZB+0.08, 'crane', skip=('bot',))
        m.box(xx, xx+0.23, 0.82, 0.86, ZB+0.04, ZB+0.09, 'crane', skip=('bot',))
    # bâtiment de commande sur la berge de droite
    m.box(0.68, 0.84, 0.215, 0.8, -0.1, 0.1, 'hut', skip=('bot', 'top'))
    m.box(0.66, 0.86, 0.8, 0.84, -0.12, 0.12, 'hut_r', skip=('bot',))
    for yy in (0.38, 0.58):
        m.poly([(0.72, yy, 0.104), (0.8, yy, 0.104), (0.8, yy+0.08, 0.104), (0.72, yy+0.08, 0.104)], 'glass', (0.76, yy, 0))
    for sgn in (-1, 1):
        cypress(m, sgn*0.72, 0.6, 0.215, 0.2, 0.05, 'bank2')
    cypress(m, -0.72, -0.5, 0.215, 0.22, 0.05, 'bank2')
    return m
