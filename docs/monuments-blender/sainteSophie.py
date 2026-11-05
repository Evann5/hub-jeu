"""Istanbul (Turquie) : Sainte-Sophie, grand dôme gris-bleu, demi-dômes, contreforts ocre rose, quatre minarets."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'plaza': '#D9CDB4', 'wall': '#D9906A', 'wall2': '#C47A58', 'cream': '#F1E6CC', 'dome': '#8E99A8', 'dome2': '#A3ACB8',
       'win': '#4A3A38', 'gold': '#E2B53C', 'lawn': '#8DB35E', 'trunk': '#7A5A3C', 'leaf': '#4F8A45', 'cap': '#6F7885'}

def build():
    m = Mesh(PAL)
    slab(m, 'plaza', 0.04)
    m.box(-0.88, -0.6, 0.04, 0.05, 0.4, 0.88, 'lawn', skip=('bot',))
    m.box(0.6, 0.88, 0.04, 0.05, 0.4, 0.88, 'lawn', skip=('bot',))
    H = 0.46
    # corps principal et corniche
    m.box(-H, H, 0.04, 0.58, -H, H, 'wall', skip=('bot',))
    m.box(-H-0.02, H+0.02, 0.54, 0.6, -H-0.02, H+0.02, 'cream', skip=('bot',))
    # contreforts : trois par face
    s0 = len(m.faces)
    for x in (-0.3, 0.0, 0.3):
        m.box(x-0.06, x+0.06, 0.04, 0.58, H, H+0.1, 'wall2', skip=('bot',))
        m.box(x-0.07, x+0.07, 0.54, 0.6, H, H+0.11, 'cream', skip=('bot',))
    for x in (-0.15, 0.15):
        window(m, H+0.001, x, 0.12, 0.38, 0.045, 'win', 'cream', True, 1)
    for x in (-0.3, 0.0, 0.3):
    sides4(m, s0)
    # demi-dômes avant et arrière
    for sz in (-1, 1):
        dome(m, 0, sz*0.24, 0.6, 0.31, 0.22, 12, 'dome2', rows=3)
    # tambour percé, grand dôme
    R = 0.3
    cyl(m, 0, 0, 0.58, 0.8, R, 'wall', n=12)
    s1 = len(m.faces)
    rf = R*math.cos(math.pi/12)+0.003
    window(m, rf, 0, 0.64, 0.76, 0.03, 'win', 'cream', True, 1)
    copy_rot(m, s1, [30*k for k in range(1, 12)])
    cyl(m, 0, 0, 0.8, 0.84, R+0.025, 'cream', n=12)
    dome(m, 0, 0, 0.84, 0.31, 0.3, 12, 'dome', rows=4)
    cone(m, 0, 0, 1.12, 1.26, 0.018, 'gold', n=4, cap_bot=False)
    # quatre minarets
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx*0.74, sz*0.7
            m.box(x-0.07, x+0.07, 0.04, 0.16, z-0.07, z+0.07, 'cream', skip=('bot',))
            cyl(m, x, z, 0.16, 1.62, 0.052, 'cream', 0.04, n=10)
            cyl(m, x, z, 1.18, 1.22, 0.085, 'wall', 0.065, n=10)
            cyl(m, x, z, 1.22, 1.26, 0.085, 'cream', n=10)
            cyl(m, x, z, 1.62, 1.68, 0.06, 'cream', n=10)
            cone(m, x, z, 1.68, 2.0, 0.056, 'cap', n=10)
            cone(m, x, z, 2.0, 2.1, 0.01, 'gold', n=4, cap_bot=False)
    # deux arbres
    for x in (-0.74, 0.74):
        cyl(m, x, 0.62, 0.05, 0.25, 0.025, 'trunk', n=5)
        blob(m, x, 0.36, 0.62, 0.15, 0.15, 0.15, 'leaf', n=6)
    return m
