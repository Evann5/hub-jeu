"""Haïfa (Israël) : jardins en terrasses qui descendent vers la mer, petit dôme doré tout en haut."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'sea': '#2F86C2', 'shallow': '#6BC0D8', 'wall': '#F2EBDD', 'path': '#EFE0BC', 'g1': '#5FAF4E', 'g2': '#7CC25A', 'g3': '#2F7A46',
       'f1': '#E8527A', 'f2': '#F2C640', 'cyp': '#2A6E40', 'col': '#F6F0E2', 'tile': '#C9573A', 'gold': '#E7B731', 'gold2': '#F5D060',
       'hull': '#FFFFFF', 'sail': '#F4F0E6', 'sail2': '#E8574A'}

Z1 = [0.5, 0.3, 0.1, -0.1, -0.3, -0.5]       # bord avant de chaque terrasse
DEP = [0.2, 0.2, 0.2, 0.2, 0.2, 0.38]        # profondeur
YT = [0.10+0.10*i for i in range(6)]         # hauteur de chaque terrasse


def build():
    m = Mesh(PAL)
    plate(m, 'sea', 0.04)
    m.box(-H, H, 0.04, 0.05, 0.5, 0.64, 'shallow', skip=('bot',))
    for i in range(6):
        z1 = Z1[i]; z0 = z1-DEP[i]; yt = YT[i]
        m.box(-0.8, 0.8, 0.0, yt, z0, z1, 'wall', skip=('bot',))
        m.box(-0.77, 0.77, yt, yt+0.012, z0, z1-0.04, 'g1' if i % 2 == 0 else 'g2', skip=('bot',))
        # allée centrale : un ruban clair qui descend les marches
        ylow = 0.05 if i == 0 else YT[i-1]+0.012
        m.box(-0.075, 0.075, ylow, yt+0.02, z0, z1+0.006, 'path', skip=('bot',))
        if i < 5:
            zm = z1-0.1
            for sgn in (-1, 1):
                a, b = (0.12, 0.72) if sgn > 0 else (-0.72, -0.12)
                m.box(a, b, yt+0.012, yt+0.05, z1-0.11, z1-0.06, 'g3', skip=('bot',))
                m.box(sgn*0.42-0.07, sgn*0.42+0.07, yt+0.012, yt+0.032, z0+0.03, z0+0.08, 'f1' if (i+sgn) % 2 else 'f2', skip=('bot',))
                cypress(m, sgn*0.62, z0+0.08, yt+0.012, 0.22, 0.045, 'cyp')
                cypress(m, sgn*0.27, z0+0.08, yt+0.012, 0.2, 0.04, 'cyp')
    # sanctuaire : colonnade, tambour, dôme doré (échelle réduite pour tenir dans la dalle)
    cz = -0.65; y0 = YT[5]+0.012; K = 0.72
    cyl(m, 0, cz, y0, y0+0.06, 0.3*K, 'wall', n=8)
    for k in range(8):
        a = 2*math.pi*(k+0.5)/8
        cyl(m, 0.25*K*math.cos(a), cz+0.25*K*math.sin(a), y0+0.06, y0+0.3, 0.02, 'col', n=4, caps=(False, False))
    cyl(m, 0, cz, y0+0.3, y0+0.35, 0.3*K, 'wall', n=8)
    cyl(m, 0, cz, y0+0.35, y0+0.42, 0.29*K, 'tile', 0.2*K, n=8)
    cyl(m, 0, cz, y0+0.42, y0+0.58, 0.17*K, 'col', n=8)
    base = y0+0.58
    lathe(m, [(0.17*K, base), (0.19*K, base+0.08), (0.17*K, base+0.19), (0.11*K, base+0.29), (0.05*K, base+0.36), (0.0, base+0.39)], 10,
          ['gold', 'gold2', 'gold', 'gold2', 'gold'], 0, cz)
    spire(m, 0, cz, base+0.38, base+0.5, 0.012, 'gold', 0.003, n=4)
    # voilier
    m.box(-0.55, -0.35, 0.05, 0.09, 0.74, 0.8, 'hull', skip=('bot',))
    sail = [(-0.45, 0.09, 0.77), (-0.45, 0.32, 0.77), (-0.36, 0.09, 0.77)]
    m.poly(sail, 'sail', (-0.45, 0.1, 5)); m.poly(sail, 'sail', (-0.45, 0.1, -5))
    sail2 = [(-0.47, 0.09, 0.77), (-0.47, 0.26, 0.77), (-0.54, 0.09, 0.77)]
    m.poly(sail2, 'sail2', (-0.47, 0.1, 5)); m.poly(sail2, 'sail2', (-0.47, 0.1, -5))
    return m
