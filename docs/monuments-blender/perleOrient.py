"""Shanghai (Chine) : la tour de la Perle de l'Orient, grosses sphères roses sur un fût élancé, trois jambes inclinées, bassin."""
import math
from lib import Mesh
from lib_asie_turquie import *

PAL = {'plaza': '#CBD0DA', 'ring': '#9AA3B5', 'water': '#3F86B0', 'pink': '#E8589A', 'pink_d': '#C23C7C', 'glass': '#8AD6EA',
       'silver': '#D3D9E2', 'dark': '#59607A', 'steel': '#8E97AB', 'white': '#F4F6FA'}

def build():
    m = Mesh(PAL)
    slab(m, 'plaza', 0.04)
    # bassin rond et son rebord
    prism(m, [(0.7*math.sin(2*math.pi*i/14), 0.7*math.cos(2*math.pi*i/14)) for i in range(14)], 0.04, 0.09, 'ring', 'ring')
    prism(m, [(0.62*math.sin(2*math.pi*i/14), 0.62*math.cos(2*math.pi*i/14)) for i in range(14)], 0.09, 0.1, 'water', 'water')
    # trois jambes inclinées et leurs petites sphères de pied
    legs = []
    for k in range(3):
        a = math.radians(90+120*k)
        base = (0.5*math.cos(a), 0.1, 0.5*math.sin(a))
        top = (0.1*math.cos(a), 1.05, 0.1*math.sin(a))
        m.beam(base, top, 0.085, 'silver', w1=0.07, caps=True)
        sphere(m, base[0]*0.92, 0.2, base[2]*0.92, 0.13, 'pink', n=8, rows=4)
    # grosse sphère basse, bandeau de vitres
    sphere(m, 0, 1.02, 0, 0.4, ['pink', 'pink', 'glass', 'glass', 'pink', 'pink'], n=12, rows=6)
    cyl(m, 0, 0, 1.4, 2.1, 0.055, 'silver', 0.05, n=6)
    for yb in (1.55, 1.75):
        cyl(m, 0, 0, yb, yb+0.03, 0.075, 'steel', n=6)
    # sphère haute
    sphere(m, 0, 2.05, 0, 0.22, ['pink', 'glass', 'glass', 'pink'], n=10, rows=4)
    cyl(m, 0, 0, 2.27, 2.55, 0.04, 'silver', 0.035, n=6)
    # petite sphère et mât
    sphere(m, 0, 2.6, 0, 0.1, 'pink', n=8, rows=4)
    cyl(m, 0, 0, 2.69, 3.15, 0.022, 'white', 0.008, n=4, caps=(False, False))
    cyl(m, 0, 0, 2.85, 2.88, 0.045, 'pink_d', n=6)
    return m
