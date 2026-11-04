"""New York : l'Empire State Building. Art déco à redans, trumeaux verticaux calcaires, flèche. Hauteur 4,4."""
from lib_france_usa import *

PAL = {'pier': '#D3CEBF', 'win': '#7B8595', 'pier2': '#C3BDAB', 'crown': '#DAD5C6', 'crownwin': '#8892A2',
       'cap': '#B4B0A6', 'cornice': '#E4DFD0', 'dark': '#4A4D56', 'metal': '#C4CAD2', 'walk': '#A5A3A0', 'gold': '#D8C27A'}

# (largeur, profondeur, y0, y1, fenêtres devant, fenêtres côté, part de trumeau, trumeau, vitre)
STAGES = [
    (1.50, 0.72, 0.03, 0.25, 11, 4, 0.50, 'pier2', 'win'),
    (1.06, 0.60, 0.25, 0.53, 8, 4, 0.45, 'pier', 'win'),
    (0.82, 0.52, 0.53, 0.73, 6, 4, 0.45, 'pier', 'win'),
    (0.62, 0.44, 0.73, 2.78, 8, 6, 0.46, 'pier', 'win'),
    (0.52, 0.38, 2.78, 2.98, 5, 4, 0.46, 'pier', 'win'),
    (0.44, 0.32, 2.98, 3.16, 4, 3, 0.46, 'pier', 'win'),
    (0.36, 0.27, 3.16, 3.33, 4, 3, 0.30, 'crown', 'crownwin'),
    (0.28, 0.22, 3.33, 3.52, 3, 3, 0.40, 'crown', 'crownwin'),
    (0.20, 0.16, 3.52, 3.70, 2, 2, 0.40, 'crown', 'crownwin'),
]

def build():
    m = XM(PAL)
    # trottoir
    m.box(-0.89, 0.89, 0.0, 0.03, -0.45, 0.45, 'walk', skip=('bot',))
    for (w, d, y0, y1, nf, ns, pf, cp, cw) in STAGES:
        tower(m, 0, 0, w, d, y0, y1, pattern(nf, pf, cp, cw), pattern(ns, pf, cp, cw), top_col='cap')
        h = 0.012
        m.box(-w/2-0.012, w/2+0.012, y1-h, y1+0.004, -d/2-0.012, d/2+0.012, 'cornice', skip=('bot',))
    # grand portail de l'entrée, devant
    z = 0.72/2
    m.box(-0.14, 0.14, 0.03, 0.20, z-0.005, z+0.022, 'cornice', skip=('bot', 'nz'))
    flat_rect(m, -0.09, 0.09, 0.03, 0.17, z+0.0225, 'dark')
    # flèche et mât
    lathe(m, 0, 0, [(0.10, 3.70), (0.10, 3.70), (0.088, 3.74, 'crown'), (0.088, 3.80), (0.064, 3.84, 'crown'),
                    (0.064, 3.93), (0.040, 3.97, 'metal'), (0.040, 4.02), (0.020, 4.06, 'metal'), (0.008, 4.40)], 8, 'crown', deg=22.5)
    return m
