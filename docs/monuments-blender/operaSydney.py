"""Sydney : l'Opéra, deux groupes de grandes coques blanches lisses, larges et emboîtées, sur un grand socle ocre bordé de marches, au bord de l'eau.
Passe 3 (05/11/2026) : fini les bandes rayées (on lisait des voiles de bateau) : une seule teinte blanche, coques plus larges et plus basses,
emboîtées en escalier, foyer vitré au pied ; le socle ocre occupe presque toute la dalle. Aucun détail de façade, tout se joue sur la silhouette."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'water': '#2B8FC0', 'foam': '#EAF6F8', 'plat': '#D2A767', 'plat2': '#B98A4B', 'step': '#E9CF9A', 'step2': '#D9B97C',
    'white': '#F8F6F0', 'white2': '#EBE7DD', 'glass': '#4E7592', 'dark': '#3A3633',
}
Y0 = 0.04
PY = 0.2       # hauteur du socle


def shell(m, x0, W, z0, H, B, apex=0.12, lean=-0.18, k=9, n=11, tone='white', tone2='white2'):
    """Une coque : demi-ellipse à fond plat (face vitrée, côté fond) qui se resserre vers un sommet pointu au-dessus de son bout gauche.
    Le dos blanc bombé fait face à l'avant ; le sommet penche vers l'arrière (lean < 0).
    x0 : bout gauche de la base ; W : largeur ; B : profondeur du dos ; H : hauteur."""
    rings = []
    xc0 = x0+W/2
    for j in range(k+1):
        t = j/k
        sc = (1-t)**0.92 if j < k else 0.0
        a = W/2*sc
        b = B*sc
        cx = xc0+(x0+W*apex-xc0)*t**1.2
        y = PY-0.02+H*(1-(1-t)**1.55)**0.9 if j < k else PY-0.02+H
        cz = z0+lean*t**1.3
        rings.append([(cx+a*math.cos(math.pi*i/(n-1)), y, cz+b*math.sin(math.pi*i/(n-1))) for i in range(n)])
    ref = (xc0, PY+H*0.3, z0-B*0.1)
    for j in range(k):
        col = tone if j < k-2 else tone2
        m.band(rings[j], rings[j+1], col, ref, closed=False)
    left = [r[0] for r in rings]
    right = [r[-1] for r in rings]
    for j in range(k):
        m.poly([left[j], right[j], right[j+1], left[j+1]], 'white2', (xc0, PY+H*0.3, z0+B*3))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, Y0, -0.88, 0.88, 'water', skip=('bot',))
    m.box(-0.64, 0.64, Y0, Y0+0.012, 0.68, 0.86, 'foam', skip=('bot',))
    # grand socle ocre et large escalier de marches devant
    m.box(-0.84, 0.84, Y0, PY, -0.76, 0.46, 'plat', skip=('bot',))
    m.box(-0.84, 0.84, PY, PY+0.025, -0.76, -0.71, 'plat2', skip=('bot',))
    for k_ in range(3):
        m.box(-0.7-0.03*k_, 0.7+0.03*k_, Y0, PY-0.045*(k_+1), 0.46+0.07*k_, 0.46+0.07*(k_+1), 'step' if k_ % 2 == 0 else 'step2', skip=('bot', 'nz'))
    # deux groupes de coques emboîtées : la plus grande au fond, les plus petites devant, décalées en escalier
    for (gx, sc, hz) in ((-0.8, 1.0, 1.0), (0.0, 0.86, 0.8)):
        shell(m, gx+0.0, 0.86*sc, -0.5, 1.22*sc*hz, 0.5*sc, tone='white2', tone2='white2')
        shell(m, gx+0.18, 0.7*sc, -0.22, 0.9*sc*hz, 0.4*sc)
        shell(m, gx+0.36, 0.52*sc, 0.06, 0.6*sc*hz, 0.3*sc, tone='white2', tone2='white')
        m.box(gx+0.04, gx+0.84*sc, PY, PY+0.07, 0.3, 0.38, 'glass', skip=('bot',))    # foyer vitré au pied du groupe
    return m
