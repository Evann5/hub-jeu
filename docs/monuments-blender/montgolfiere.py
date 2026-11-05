"""Göreme (Turquie) : cheminées de fée de tuf à chapeau sombre, montgolfière rayée posée au centre."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'ground': '#DCBF8E', 'tuff': '#E8C99C', 'tuff_d': '#CFA070', 'tuff_l': '#F3DFBC', 'cap': '#A8734F', 'cap_d': '#86593C', 'basket': '#B07840',
       'red': '#D83A3A', 'yellow': '#F2C230', 'blue': '#3A78C8', 'white': '#F6F0E2', 'rope': '#5A4631', 'burner': '#6E7078', 'door': '#5E4332'}

def chimney(m, cx, cz, h, r, rot=0.0):
    prof = [(r*1.15, 0.05), (r*0.92, h*0.22), (r*0.7, h*0.55), (r*0.5, h*0.8), (r*0.4, h*0.86), (r*0.66, h*0.92), (r*0.55, h*0.98), (0, h)]
    lathe(m, prof, 7, ['tuff_d', 'tuff', 'tuff', 'tuff_l', 'cap', 'cap', 'cap_d'], cx, cz, rot)
    front(m, cz+r*0.62, arch2d(cx, h*0.2, h*0.3, h*0.38, r*0.17, 3), 'door')   # petite fenêtre taillée dans le tuf

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.05, -0.88, 0.88, 'ground', skip=('bot',))
    # buttes de tuf en arrière-plan
    lathe(m, [(0.38, 0.05), (0.31, 0.2), (0.2, 0.36), (0, 0.42)], 8, ['tuff_d', 'tuff', 'tuff_l'], 0.48, -0.5, 0.2)
    lathe(m, [(0.36, 0.05), (0.29, 0.18), (0.19, 0.3), (0, 0.34)], 8, ['tuff_d', 'tuff', 'tuff_l'], -0.5, -0.52, 0.5)
    for (x, z, h, r, rot) in ((-0.6, 0.02, 1.0, 0.21, 0.1), (0.6, 0.1, 1.15, 0.22, 0.4), (-0.3, 0.52, 0.72, 0.17, 0.3), (0.28, 0.6, 0.62, 0.15, 0.7),
                              (0.72, -0.4, 0.7, 0.14, 0.2), (-0.72, -0.35, 0.62, 0.13, 0.5)):
        chimney(m, x, z, h, r, rot)
    # montgolfière : nacelle, cordes, brûleur, enveloppe à fuseaux de couleur
    bx, bz = 0.0, -0.12
    m.box(bx-0.09, bx+0.09, 0.05, 0.16, bz-0.09, bz+0.09, 'basket', skip=('bot',))
    m.box(bx-0.1, bx+0.1, 0.15, 0.17, bz-0.1, bz+0.1, 'cap_d', skip=('bot',))
    # enveloppe en goutte d'eau : bouche étroite en bas, fuseaux de couleur
    yb = 0.78
    prof = [(0.0, yb), (0.17, yb+0.02), (0.3, yb+0.14), (0.44, yb+0.34), (0.51, yb+0.6), (0.48, yb+0.86), (0.36, yb+1.08), (0.18, yb+1.22), (0.0, yb+1.28)]
    n = 12
    gores = ['red', 'white', 'yellow', 'white', 'blue', 'white']
    rings = [ring(bx, bz, y, r, n) for r, y in prof]
    for k in range(len(rings)-1):
        for i in range(n):
            j = (i+1) % n
            m.poly([rings[k][i], rings[k][j], rings[k+1][j], rings[k+1][i]], gores[i % 6], (bx, yb+0.6, bz))
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.beam((bx+sx*0.09, 0.17, bz+sz*0.09), (bx+sx*0.12, yb+0.02, bz+sz*0.12), 0.016, 'rope', caps=True)
    cyl(m, bx, bz, 0.4, 0.5, 0.03, 'burner', n=5)
    return m
