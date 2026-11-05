"""Le Caire : plateau de Gizeh, trois pyramides de sable de tailles décroissantes, un palmier, des dunes."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'sand': '#EBCB8A', 'dune': '#F3DCA4', 'dune2': '#DDB874', 'pl': '#F1D27A', 'pm': '#E0B560', 'pd': '#BE8B42',
       'cap': '#F6E2A0', 'trunk': '#7A5632', 'leaf': '#2FA05A', 'leaf2': '#1E8049', 'base': '#CFA564'}


def pyramide(m, cx, cz, hw, h):
    tbox(m, cx, cz, 0.05, 0.09, hw*1.07, hw*1.07, hw*1.02, hw*1.02, 'base')
    pyr(m, cx, cz, hw, hw, 0.09, h, ('pl', 'pd', 'pd', 'pm'))
    # pointe claire (petite pyramide posée au sommet)
    k = 0.12
    pyr(m, cx, cz, hw*k, hw*k, 0.09+h*(1-k), h*k, 'cap')


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'sand', skip=('bot',))
    # dunes basses
    tbox(m, -0.5, 0.74, 0.05, 0.11, 0.3, 0.12, 0.16, 0.05, 'dune')
    tbox(m, 0.1, 0.78, 0.05, 0.095, 0.2, 0.09, 0.1, 0.04, 'dune2')
    tbox(m, 0.72, -0.72, 0.05, 0.12, 0.16, 0.14, 0.08, 0.06, 'dune')
    pyramide(m, -0.2, -0.25, 0.42, 1.12)
    pyramide(m, 0.5, 0.0, 0.29, 0.76)
    pyramide(m, -0.22, 0.5, 0.2, 0.5)
    palm(m, 0.62, 0.55, 0.5, 'trunk', 'leaf', 'leaf2', y0=0.05, lean=-0.05, fronds=6, flen=0.28)
    return m
