"""Bariloche : chalet de bois à grand toit, au bord d'un lac, entouré de sapins."""
import math
from lib import Mesh
from lib_maroc_portugal import *

PAL = {
    'lake': '#2E8FB8', 'lake2': '#53AFD0', 'sand': '#D9C79A', 'grass': '#5E9448', 'log1': '#A87445', 'log2': '#8F5E35',
    'roof': '#7A3B2E', 'roof2': '#923F32', 'snow': '#F0F5F8', 'stone': '#8B8A86', 'win': '#2D3E55', 'door': '#5C3A21',
    'fir': '#2F6B3F', 'fir2': '#3F8650', 'trunk': '#6A4528', 'plank': '#C29A63', 'cream': '#EFE3C4', 'dark': '#2E2A28',
}

def fir(m, x, z, h, r):
    lathe(m, [(0.025, 0.08), (0.025, 0.08+h*0.2)], 5, 'trunk', x, z)
    ys = [0.08+h*0.15, 0.08+h*0.42, 0.08+h*0.68]
    for k, y in enumerate(ys):
        top = y+h*0.4
        lathe(m, [(r*(1-0.22*k), y), (0.0, top)], 6, 'fir' if k % 2 == 0 else 'fir2', x, z, 0.3*k)

def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0.0, 0.04, -0.88, 0.88, 'lake', skip=('bot',))
    m.box(-0.88, 0.88, 0.04, 0.08, -0.88, 0.2, 'grass', skip=('bot',))
    m.box(-0.88, 0.88, 0.04, 0.07, 0.2, 0.34, 'sand', skip=('bot',))
    m.box(-0.5, 0.2, 0.04, 0.045, 0.4, 0.62, 'lake2', skip=('bot',))
    # ponton
    for k in range(6):
        m.box(0.42, 0.52, 0.07, 0.09, 0.2+k*0.1, 0.28+k*0.1, 'plank', skip=('bot',))
    # chalet
    x0, x1, z0, z1, Y = -0.4, 0.2, -0.5, 0.0, 0.08
    for k in range(7):
        m.box(x0, x1, Y+k*0.055, Y+(k+1)*0.055, z0, z1, 'log1' if k % 2 == 0 else 'log2', skip=('bot',))
    b = B(x0, x1, Y, Y+0.385, z0, z1)
    # pignon en rondins
    gable(m, x0-0.1, x1+0.1, z0-0.1, z1+0.12, Y+0.385, 0.38, 'roof', 'z', 'log1')
    gable(m, x0-0.1, x1+0.1, z0-0.1, z1+0.12, Y+0.385+0.19, 0.19, 'roof2', 'z', 'log2')
    decal(m, b, 'pz', rect(-0.06, 0.06, Y, Y+0.2), 'door', 0.004)
    for uu in (-0.2, 0.2):
        decal(m, b, 'pz', rect(uu-0.05, uu+0.05, Y+0.12, Y+0.25), 'cream', 0.004)
        decal(m, b, 'pz', rect(uu-0.04, uu+0.04, Y+0.13, Y+0.24), 'win', 0.007)
    # balcon
    m.box(x0+0.1, x1-0.1, Y+0.385, Y+0.41, z1, z1+0.12, 'plank', skip=('bot',))
    m.box(x0+0.1, x1-0.1, Y+0.41, Y+0.45, z1+0.1, z1+0.12, 'plank', skip=('bot',))
    m.box(x0+0.16, x0+0.24, Y+0.45, Y+0.56, z1-0.01, z1+0.0, 'win')
    # cheminée
    m.box(x1-0.1, x1-0.02, Y+0.3, Y+0.95, z0+0.1, z0+0.18, 'stone', skip=('bot',))
    # sapins
    for (x, z, h, r) in ((-0.7, -0.2, 0.7, 0.2), (-0.62, 0.05, 0.5, 0.16), (0.5, -0.3, 0.8, 0.22), (0.7, -0.05, 0.55, 0.17),
                         (0.3, -0.7, 0.7, 0.2), (-0.5, -0.7, 0.65, 0.19), (0.74, 0.12, 0.4, 0.13)):
        fir(m, x, z, h, r)
    return m
