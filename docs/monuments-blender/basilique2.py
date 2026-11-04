"""Lyon : la basilique de Fourvière, toute blanche, ses quatre tours octogonales coiffées de dômes d'ardoise, sa double loggia,
sur la colline verte."""
import math
from lib_france_usa import *

PAL = {'stone': '#F1ECDE', 'stone2': '#E0D8C3', 'shade': '#CFC6AC', 'roof': '#8A95A2', 'roof2': '#A2ABB6', 'dark': '#5A564E',
       'gold': '#DDAA3C', 'lawn': '#8DA16B', 'lawn2': '#7B925A', 'terr': '#D9D0B6', 'path': '#CDBF9E'}

TX, TZF, TZB = 0.42, 0.26, -0.36     # tours : x, z avant, z arrière
RT = 0.115
AP = RT*math.cos(math.radians(22.5))  # apothème

def octo_tower(m, cx, cz):
    y0 = 0.40
    # fût octogonal, faces tournées vers l'avant
    lathe(m, cx, cz, [(RT, y0), (RT, 0.86, 'stone'), (RT+0.012, 0.86), (RT+0.012, 0.89, 'stone2'), (RT, 0.89), (RT, 1.20, 'stone')], 8, 'stone', deg=22.5)
    def slots():
        flat_arch(m, -0.016, 0.016, 0.52, 0.76, AP+0.002, 'dark')
        flat_arch(m, -0.016, 0.016, 0.95, 1.12, AP+0.002, 'dark')
    for k in range(8):
        with m.frame(45*k, cx, 0, cz):
            slots()
    # beffroi ajouré puis dôme d'ardoise et lanterne
    lathe(m, cx, cz, [(RT+0.01, 1.20), (RT+0.01, 1.23, 'stone2'), (0.098, 1.23), (0.098, 1.36, 'stone'), (0.112, 1.36), (0.112, 1.39, 'stone2'),
                      (0.100, 1.39), (0.108, 1.46, 'roof'), (0.088, 1.54), (0.055, 1.62), (0.026, 1.67), (0.0, 1.70, 'gold')], 8, 'stone', deg=22.5)
    for k in range(8):
        with m.frame(45*k, cx, 0, cz):
            flat_arch(m, -0.026, 0.026, 1.25, 1.34, 0.098*math.cos(math.radians(22.5))+0.002, 'dark')

def build():
    m = XM(PAL)
    # colline et terrasse
    rock_hill(m, [(0.88, 0.0, 0.0, 'lawn2'), (0.78, 0.13, 0.04, 'lawn'), (0.69, 0.27, 0.05, 'lawn'), (0.63, 0.31, 0.02, 'lawn')], seed=2.0)
    lathe(m, 0, 0, [(0.63, 0.28), (0.63, 0.40, 'terr'), (0.0, 0.40)], 16, 'terr', zr=0.94)
    # chemin en lacet vers la terrasse
    m.poly([(-0.14, 0.395, 0.56), (0.14, 0.395, 0.56), (0.24, 0.02, 0.82), (-0.06, 0.02, 0.82)], 'path', (0, 0, 0.5))
    # corps de la basilique : côtés à fenêtres
    f = pattern(4, 0.5, 'stone', 'stone2')
    tower(m, 0, -0.05, 0.84, 0.62, 0.40, 0.94, f, f, top_col=None, skip=(0,))
    # façade : portique à trois arcs, loggia à trois arcs
    zf = TZF
    for k in range(3):
        xa = -0.32+0.2133*k; xb = xa+0.2133
        arch_bay(m, xa, xb, 0.40, 0.64, zf, 0.06, 'stone', 'dark', S0=0.18, S1=0.82, gap=0.03)
        arch_bay(m, xa, xb, 0.67, 0.90, zf, 0.05, 'stone', 'dark', S0=0.2, S1=0.8, gap=0.03)
    m.box(-0.33, 0.33, 0.64, 0.67, zf-0.01, zf+0.015, 'stone2', skip=('bot', 'nz'))
    m.box(-0.33, 0.33, 0.90, 0.94, zf-0.01, zf+0.02, 'stone2', skip=('bot', 'nz'))
    # toit de la nef et fronton
    gable(m, -0.36, 0.36, -0.36, zf+0.02, 0.94, 0.20, 'roof', 'stone', axis='z', over=0.0)
    # abside arrière
    prism(m, 0, TZB, 0.26, 0.26, 0.40, 0.84, 12, 'stone', top=False)
    cone(m, 0, TZB, 0.27, 0.27, 0.84, 1.00, 12, 'roof2')
    # quatre tours d'angle
    for sx in (-1, 1):
        for z in (TZF, TZB):
            octo_tower(m, sx*TX, z)
    return m
