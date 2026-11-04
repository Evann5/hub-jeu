"""Marseille : Notre-Dame de la Garde sur sa colline. Église rayée blanc et vert, clocher carré, statue dorée de la Vierge."""
import math
from lib_france_usa import *

PAL = {'scrub': '#76895A', 'rock': '#A89C80', 'rock2': '#8F8568', 'wall': '#B9AC8E', 'wh': '#EAE2CD', 'gr': '#8FA084',
       'dome': '#A9AF9E', 'roof': '#9AA394', 'dark': '#4A4237', 'gold': '#E3AF2D', 'gold2': '#C58F20', 'cream': '#D8CDB0'}

BANDS = ['wh', 'gr']

def build():
    m = XM(PAL)
    # colline et rempart
    rock_hill(m, [(0.88, 0.0, 0.0, 'scrub'), (0.76, 0.17, 0.06, 'scrub'), (0.64, 0.34, 0.07, 'rock2'),
                  (0.57, 0.46, 0.03, 'rock'), (0.55, 0.50, 0.0, 'rock')])
    lathe(m, 0, 0, [(0.56, 0.50), (0.56, 0.60, 'wall'), (0.50, 0.60), (0.50, 0.50, 'wall', True)], 16, 'wall', zr=0.94)
    # tout l'édifice est tourné de 30 degrés : on voit le flanc de la nef et l'abside à côté du clocher
    with m.frame(30):
        # église basse (crypte) rayée, deux arcades devant
        y0, y1 = 0.50, 0.76
        tower(m, 0, 0.01, 0.66, 0.74, y0, y1, None, None, top_col='cream', bands=BANDS*3, skip=(0,))
        for xa, xb in ((-0.33, -0.15), (0.15, 0.33)):
            arch_bay(m, xa, xb, y0, y1, 0.38, 0.05, 'wh', 'dark', S0=0.2, S1=0.8, gap=0.03)
        # église haute : nef, transept, abside, dôme
        tower(m, 0, -0.12, 0.42, 0.50, y1, 1.0, None, None, top_col=None, bands=BANDS*2)
        gable(m, -0.21, 0.21, -0.37, 0.13, 1.0, 0.09, 'roof', 'wh', axis='z', over=0.01)
        tower(m, 0, -0.10, 0.62, 0.20, y1, 0.95, None, None, top_col=None, bands=BANDS*2)
        gable(m, -0.31, 0.31, -0.20, 0.0, 0.95, 0.08, 'roof', 'wh', axis='x', over=0.01)
        prism(m, 0, -0.33, 0.21, 0.21, y1, 1.0, 10, 'wh', top=False)
        dome(m, 0, -0.33, 0.215, 0.215, 1.0, 0.13, 10, 3, 'dome')
        prism(m, 0, -0.10, 0.16, 0.16, 1.0, 1.12, 8, 'wh', deg=22.5)
        dome(m, 0, -0.10, 0.17, 0.17, 1.12, 0.16, 8, 3, 'dome', deg=22.5)
        lathe(m, 0, -0.10, [(0.03, 1.27), (0.03, 1.33, 'wh'), (0.025, 1.33), (0.0, 1.40, 'dome')], 6, 'wh')
        # clocher
        cz = 0.28
        tower(m, 0, cz, 0.30, 0.30, y0, 1.55, None, None, top_col='cream', bands=BANDS*7)
        def portal():
            flat_arch(m, -0.05, 0.05, 0.50, 0.70, 0.152, 'dark')
            flat_arch(m, -0.025, 0.025, 1.00, 1.30, 0.152, 'dark')
        around4(m, 0, cz, portal)
        m.box(-0.17, 0.17, 1.55, 1.58, cz-0.17, cz+0.17, 'cream', skip=('bot',))
        tower(m, 0, cz, 0.26, 0.26, 1.58, 1.84, None, None, top_col='cream', bands=['wh'])
        def belfry():
            for xc in (-0.055, 0.055):
                flat_arch(m, xc-0.035, xc+0.035, 1.62, 1.80, 0.132, 'dark')
        around4(m, 0, cz, belfry)
        m.box(-0.15, 0.15, 1.84, 1.87, cz-0.15, cz+0.15, 'cream', skip=('bot',))
        lathe(m, 0, cz, [(0.125, 1.87), (0.125, 2.00, 'gr'), (0.14, 2.00), (0.14, 2.03, 'cream'), (0.10, 2.03), (0.09, 2.05, 'wh'),
                         (0.06, 2.24), (0.075, 2.24, 'cream'), (0.075, 2.26), (0.0, 2.26)], 8, 'wh', deg=22.5)
        # statue dorée de la Vierge à l'Enfant
        lathe(m, 0, cz, [(0.045, 2.26), (0.062, 2.30, 'gold'), (0.054, 2.40), (0.04, 2.49), (0.03, 2.53), (0.028, 2.54),
                         (0.028, 2.58), (0.0, 2.64)], 8, 'gold')
        m.box(-0.07, 0.07, 2.42, 2.45, cz-0.012, cz+0.012, 'gold2')
        m.box(-0.075, -0.04, 2.36, 2.46, cz+0.02, cz+0.05, 'gold')
    return m
