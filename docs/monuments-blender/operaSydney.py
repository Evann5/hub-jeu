"""Sydney : l'Opéra, voiles blanches en coques qui s'élèvent sur une esplanade au bord de l'eau."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'water': '#2B8FC0', 'foam': '#EAF6F8', 'plat': '#B79C7A', 'plat2': '#9B8160', 'step': '#D9C6A0', 'white': '#F6F4EE', 'glass': '#4E7592', 'white2': '#CBD6E0', 'dark': '#3A3633', 'sun': '#F2D26A',
}
Y0 = 0.04
PY = 0.18      # hauteur du socle

def sail(m, x0, W, z0, H, B, apex=0.04, lean=-0.14, k=7, n=9):
    """Une voile : coque en demi-ellipse qui se resserre vers un sommet au-dessus de son bout gauche (silhouette de voile, pas de cône).
    La corde droite (face vitrée) est au fond (-z) ; le dos blanc bombé fait face à l'avant ; le sommet penche vers l'arrière (lean < 0).
    x0 : bout gauche de la base ; W : largeur ; B : profondeur du dos ; H : hauteur."""
    rings = []
    xc0 = x0+W/2
    for j in range(k+1):
        t = j/k
        sc = (1-t**1.35)**1.0
        a = W/2*sc
        b = B*sc
        cx = xc0+(x0+W*apex-xc0)*t**1.15
        y = PY-0.02+H*t**0.92
        cz = z0+lean*t
        rings.append([(cx+a*math.cos(math.pi*i/(n-1)), y, cz+b*math.sin(math.pi*i/(n-1))) for i in range(n)])
    ref = (xc0, Y0+0.08, z0-B*0.2)
    for j in range(k):
        m.band(rings[j], rings[j+1], 'white' if j % 2 == 0 else 'white2', ref, closed=False)
    poly = [r[0] for r in rings]+[r[-1] for r in rings[::-1]][:-1]
    # face vitrée : on triangule l'éventail des deux bords de la corde
    left = [r[0] for r in rings]
    right = [r[-1] for r in rings]
    for j in range(k):
        m.poly([left[j], right[j], right[j+1], left[j+1]], 'glass', (xc0, Y0+0.3, z0+B*3))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'water', skip=('bot',))
    m.box(-0.62, 0.62, Y0, Y0+0.012, 0.66, 0.84, 'foam', skip=('bot',))
    # esplanade et marches
    m.box(-0.84, 0.84, Y0, PY, -0.62, 0.5, 'plat', skip=('bot',))
    for k in range(3):
        m.box(-0.56-0.05*k, 0.56+0.05*k, Y0, PY-0.045*(k+1), 0.5+0.06*k, 0.5+0.06*(k+1), 'step', skip=('bot', 'nz'))
    m.box(-0.84, 0.84, PY, PY+0.03, -0.62, -0.58, 'plat2', skip=('bot',))
    # deux groupes de trois voiles emboîtées : la plus grande derrière, les petites devant, toutes penchées pareil
    for (gx, sc) in ((-0.84, 1.0), (0.04, 1.06)):
        sail(m, gx+0.0, 0.78*sc, -0.56, 1.22*sc, 0.42*sc)
        sail(m, gx+0.07, 0.66*sc, -0.32, 1.0*sc, 0.36*sc)
        sail(m, gx+0.14, 0.54*sc, -0.08, 0.78*sc, 0.3*sc)
        sail(m, gx+0.22, 0.4*sc, 0.16, 0.54*sc, 0.24*sc)
        m.box(gx+0.0, gx+0.0+0.74*sc, PY, PY+0.09, 0.4, 0.49, 'glass', skip=('bot',))   # foyer vitré au pied du groupe
    return m
