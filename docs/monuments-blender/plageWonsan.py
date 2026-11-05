"""Wonsan (Corée du Nord) : plage de sable, parasols et transats, grand hôtel blanc de bord de mer, palmiers."""
import math
from lib import Mesh
from lib_ico import *

PAL = {'sea': '#2FA7D6', 'shallow': '#76D6DA', 'sand': '#F3E0AA', 'sand2': '#E1C98A', 'hotel': '#F7F3EA', 'hotel2': '#FF8E72', 'slab': '#E6DFCF',
       'glass': '#3E6D95', 'roofb': '#4C8DB8', 'pool': '#46C4E8', 'edge': '#FFFFFF', 'pole': '#8A5E3A', 'p1': '#E8433B', 'p2': '#FFFFFF', 'p3': '#FFC93C', 'p4': '#2F9BD8',
       'bed': '#FFFFFF', 'trunk': '#8A5E3A', 'leaf': '#2E9E4E', 'leaf2': '#4CBF63'}

BEACH = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.3), (0.55, 0.38), (0.15, 0.26), (-0.3, 0.36), (-0.65, 0.26), (-0.88, 0.32)]
SHALLOW = [(-0.88, -0.88), (0.88, -0.88), (0.88, 0.46), (0.55, 0.54), (0.15, 0.42), (-0.3, 0.52), (-0.65, 0.42), (-0.88, 0.48)]


def build():
    m = Mesh(PAL)
    plate(m, 'sea', 0.05)
    prism_xz(m, SHALLOW, 0.05, 0.062, 'shallow', 'shallow')
    prism_xz(m, BEACH, 0.05, 0.1, 'sand2', 'sand')
    # hôtel : tour de 7 étages et aile basse
    X0, X1, Z0, Z1 = -0.58, 0.22, -0.82, -0.46
    for k in range(7):
        yb = 0.1+0.2*k
        m.box(X0, X1, yb, yb+0.2, Z0, Z1, 'hotel', skip=('bot', 'top'))
        m.box(X0-0.015, X1+0.015, yb+0.17, yb+0.2, Z0, Z1+0.045, 'slab', skip=('bot',))
        m.poly([(X0+0.04, yb+0.04, Z1+0.046), (X1-0.04, yb+0.04, Z1+0.046), (X1-0.04, yb+0.13, Z1+0.046), (X0+0.04, yb+0.13, Z1+0.046)],
               'glass', ((X0+X1)/2, yb, 0))
    yr = 0.1+0.2*7
    m.box(X0-0.03, X1+0.03, yr, yr+0.05, Z0-0.03, Z1+0.05, 'roofb', skip=('bot',))
    m.box(-0.4, -0.05, yr+0.05, yr+0.2, -0.75, -0.55, 'hotel2', skip=('bot',))
    # coupe de coraux sur la façade : bandes verticales corail
    for x in (-0.45, -0.1, 0.15):
        m.box(x-0.02, x+0.02, 0.1, yr, Z1, Z1+0.06, 'hotel2', skip=('bot', 'top'))
    # aile basse avec toit-terrasse
    m.box(0.22, 0.8, 0.1, 0.5, -0.8, -0.5, 'hotel', skip=('bot', 'top'))
    m.box(0.2, 0.82, 0.5, 0.54, -0.82, -0.48, 'roofb', skip=('bot',))
    for yy in (0.2, 0.36):
        m.poly([(0.3, yy, -0.498), (0.72, yy, -0.498), (0.72, yy+0.09, -0.498), (0.3, yy+0.09, -0.498)], 'glass', (0.5, yy, -3))
    # piscine
    m.box(-0.5, 0.1, 0.1, 0.108, -0.36, -0.16, 'edge', skip=('bot',))
    m.box(-0.47, 0.07, 0.108, 0.112, -0.33, -0.19, 'pool', skip=('bot',))
    # parasols et transats
    for (x, z, c1, c2) in ((-0.62, 0.02, 'p1', 'p2'), (-0.22, 0.12, 'p3', 'p2'), (0.2, -0.02, 'p4', 'p2'), (0.55, 0.1, 'p1', 'p3'), (0.68, -0.18, 'p4', 'p2')):
        parasol(m, x, z, 0.1, 0.26, 0.15, c1, c2, 'pole')
        m.box(x-0.07, x+0.07, 0.1, 0.125, z+0.12, z+0.26, 'bed', skip=('bot',))
        m.box(x-0.07, x+0.07, 0.125, 0.175, z+0.26, z+0.285, 'bed', skip=('bot',))
    palm(m, 0.58, -0.3, 0.85, 0.06, 'trunk', 'leaf', 'leaf2', y0=0.1, fronds=6, flen=0.24)
    palm(m, -0.66, -0.2, 0.7, -0.04, 'trunk', 'leaf', 'leaf2', y0=0.1, fronds=6, flen=0.22)
    return m
