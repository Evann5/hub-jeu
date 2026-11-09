"""Matadi (RD Congo) : le pont Maréchal, pont suspendu d'acier sur le fleuve Congo, entre des collines rocheuses (« matadi » : les pierres).
Pylônes en portique d'acier contreventé, tablier en poutre-treillis, deux câbles porteurs. Les maisons de la ville sur la rive gauche.
Remplace Goma (09/11/2026). Construction : Blender -b --factory-startup -P mk_ab.py -- <dossier> pontMatadi"""
from lib import Mesh
from lib_ab import *

PAL = {'river': '#3A86A8', 'river2': '#5BA9C6', 'foam': '#EAF6F8', 'rock': '#9C8B78', 'rock2': '#7E6E5E', 'grass': '#6FA555', 'grass2': '#4E8A45',
       'steel': '#D5DCE3', 'steel2': '#8F9BA8', 'cable': '#E8EDF2', 'deck': '#5D6269', 'road': '#3F444B', 'conc': '#CFC7B8',
       'h1': '#F4EBD6', 'h2': '#E8B15C', 'h3': '#9DC6E0', 'roof': '#B5402F', 'roof2': '#7A8794', 'hull': '#F4F0E6', 'hull2': '#C8553D'}
YD = 0.62          # dessus du tablier
TX = 0.5           # position des pylônes
TOP = 1.42         # sommet des pylônes
LZ = 0.16          # jambes et câbles, de part et d'autre de la route
XA = 0.84          # ancrages des câbles, sur les rives


def tower(m, x):
    """Un pylône : deux jambes d'acier, des traverses et des croix entre elles (un portique rigide)."""
    for z in (-LZ, LZ):
        tbox(m, x, z, YD-0.5, TOP, 0.04, 0.04, 0.03, 0.03, 'steel')
    levels = [YD+0.05, 0.92, 1.17, TOP-0.03]
    for y in levels:
        m.box(x-0.035, x+0.035, y-0.03, y+0.03, -LZ, LZ, 'steel')
    for ya, yb in zip(levels[1:-1], levels[2:]):
        rod(m, (x, ya+0.03, -LZ+0.03), (x, yb-0.03, LZ-0.03), 0.018, 'steel2')
        rod(m, (x, ya+0.03, LZ-0.03), (x, yb-0.03, -LZ+0.03), 0.018, 'steel2')
    tbox(m, x, 0, 0.04, YD-0.5, 0.09, LZ+0.08, 0.07, LZ+0.06, 'conc')       # la pile, dans l'eau
    for z in (-LZ, LZ):
        m.box(x-0.05, x+0.05, TOP, TOP+0.04, z-0.05, z+0.05, 'steel2')     # selle des câbles


def truss(m, x0, x1, n):
    """La poutre de rigidité sous la route : membrures et diagonales, des deux côtés."""
    xs = [x0+(x1-x0)*i/n for i in range(n+1)]
    for z in (-LZ-0.01, LZ+0.01):
        rod(m, (x0, YD-0.11, z), (x1, YD-0.11, z), 0.02, 'steel2')
        for i in range(n):
            a, b = (xs[i], YD-0.11, z), (xs[i+1], YD-0.03, z)
            if i % 2:
                a, b = (xs[i], YD-0.03, z), (xs[i+1], YD-0.11, z)
            rod(m, a, b, 0.014, 'steel2')


def build():
    m = Mesh(PAL)
    # le fleuve
    m.box(-0.88, 0.88, 0, 0.04, -0.6, 0.6, 'river', skip=('bot',))
    for (x0, x1, z0) in ((-0.3, -0.12, 0.42), (0.1, 0.32, -0.3), (-0.05, 0.12, 0.05)):
        m.box(x0, x1, 0.04, 0.046, z0, z0+0.03, 'river2', skip=('bot',))
    # les rives rocheuses, et les collines
    for sx in (-1, 1):
        x0, x1 = (0.66, 0.88) if sx > 0 else (-0.88, -0.66)
        sbox(m, x0, x1, 0.04, YD-0.06, -0.6, 0.6, 'rock', 'grass')
        tbox(m, sx*0.62, -0.3, 0.04, 0.3, 0.07, 0.16, 0.04, 0.1, 'rock2')
        tbox(m, sx*0.63, 0.32, 0.04, 0.22, 0.06, 0.12, 0.03, 0.08, 'rock2')
    blob(m, 0.78, YD+0.02, -0.4, 0.12, 0.1, 0.16, 'grass2', n=6, lats=(-40, 10, 55))
    tree(m, 0.76, 0.42, YD-0.06, 0.26, 'rock2', 'grass2', 'grass', r=0.08)
    # quelques maisons de Matadi, sur la rive gauche
    for (x, z, h, col, roof) in ((-0.82, -0.42, 0.13, 'h1', 'roof'), (-0.73, -0.47, 0.17, 'h2', 'roof2'), (-0.8, 0.4, 0.12, 'h3', 'roof')):
        sbox(m, x-0.05, x+0.05, YD-0.06, YD-0.06+h, z-0.05, z+0.05, col, col)
        gable(m, x-0.06, x+0.06, z-0.06, z+0.06, YD-0.06+h, 0.06, roof, end_col=col)
    # la route et ses culées
    for sx in (-1, 1):
        sbox(m, sx*0.66 if sx > 0 else -0.88, 0.88 if sx > 0 else -0.66, YD-0.06, YD-0.02, -LZ-0.04, LZ+0.04, 'conc', 'conc')
    sbox(m, -0.88, 0.88, YD-0.03, YD, -LZ+0.01, LZ-0.01, 'road', 'road')
    m.box(-0.66, 0.66, YD-0.05, YD-0.03, -LZ-0.02, LZ+0.02, 'deck', skip=('top',))
    truss(m, -0.66, 0.66, 14)
    for z in (-LZ+0.005, LZ-0.005):
        m.box(-0.88, 0.88, YD, YD+0.03, z-0.006, z+0.006, 'steel', skip=('bot',))
    # les pylônes
    for x in (-TX, TX):
        tower(m, x)
    # les câbles porteurs : la grande travée au milieu, les petites vers les ancrages
    for z in (-LZ, LZ):
        main = sag((-TX, TOP+0.02, z), (TX, TOP+0.02, z), TOP+0.02-(YD+0.1), 16)
        cable(m, main, 0.022, 'cable')
        for i, p in enumerate(main[1:-1], 1):
            if i % 2 == 0:
                m.beam((p[0], p[1]-0.01, z), (p[0], YD+0.02, z), 0.01, 'cable', sides=3)
        for sx in (-1, 1):
            side = sag((sx*TX, TOP+0.02, z), (sx*XA, YD+0.03, z), 0.08, 6)
            cable(m, side, 0.022, 'cable')
        for sx in (-1, 1):
            m.box(sx*XA-0.04, sx*XA+0.04, YD-0.02, YD+0.06, z-0.04, z+0.04, 'conc')   # massifs d'ancrage
    # un bateau sur le fleuve
    tbox(m, 0.05, 0.36, 0.04, 0.09, 0.14, 0.05, 0.16, 0.06, 'hull2', col_top='hull')
    sbox(m, 0.0, 0.1, 0.09, 0.15, 0.32, 0.4, 'hull', 'hull')
    return m
