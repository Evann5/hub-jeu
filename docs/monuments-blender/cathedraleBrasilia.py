"""Brasília : la cathédrale, couronne de seize colonnes de béton courbes qui se resserrent à mi-hauteur puis s'évasent en haut (hyperboloïde),
verrière bleue entre les colonnes, anneau blanc au sommet, clocher à quatre mâts au coin du parvis.
Passe 2 (05/11/2026) : ancienne forme en tube torsadé remplacée par un vrai profil en sablier évasé ; parvis beige."""
import math
from lib import Mesh
from lib_ab import *

PAL = {'ground': '#E3D2A8', 'plat': '#F1ECE0', 'plat2': '#CFC4AA', 'col': '#F7F3E8', 'col2': '#DDD6C4', 'ring': '#FFFFFF', 'glass': '#7CC4E8',
       'glass2': '#4C9CCF', 'dark': '#7A7466', 'bell': '#B9B2A2', 'pool': '#6FAFC8'}
N = 16
YB, YT, TW = 0.16, 1.55, 0.5


def rad(t):
    """Rayon de la couronne à la hauteur relative t : large en bas, taille fine à mi-hauteur, évasé en haut."""
    return 0.62*(1-0.5*math.sin(math.pi*t)**1.1)+0.17*t**3


def pt(k, t, scale=1.0):
    a = 2*math.pi*k/N+TW*t
    r = rad(t)*scale
    return (r*math.cos(a), YB+(YT-YB)*t, r*math.sin(a))


def build():
    m = Mesh(PAL)
    m.box(-0.88, 0.88, 0, 0.05, -0.88, 0.88, 'ground', skip=('bot',))
    cyl(m, 0, 0, 0.05, 0.1, 0.8, 'plat2', n=16, col_top='plat2')
    cyl(m, 0, 0, 0.1, YB, 0.72, 'plat', n=16, col_top='plat')
    # verrière entre les colonnes, un peu rentrée
    ts = [0, 0.2, 0.4, 0.6, 0.8, 0.92]
    rings = [[pt(k, t, 0.94) for k in range(N)] for t in ts]
    for a in range(len(rings)-1):
        for k in range(N):
            j = (k+1) % N
            m.poly([rings[a][k], rings[a][j], rings[a+1][j], rings[a+1][k]], 'glass' if a % 2 == 0 else 'glass2', (0, rings[a][k][1]*0.5+rings[a+1][k][1]*0.5, 0))   # référence sur l'axe, à la même hauteur
            m.poly([rings[a][k], rings[a][j], rings[a+1][j], rings[a+1][k]], 'glass2' if a % 2 == 0 else 'glass', (3*rings[a][k][0], rings[a][k][1]*0.5+rings[a+1][k][1]*0.5, 3*rings[a][k][2]))   # face intérieure (vue par le haut)
    # seize colonnes courbes : chaînes de poutres le long du profil
    S = 7
    for k in range(N):
        for i in range(S):
            t0, t1 = i/S, (i+1)/S
            m.beam(pt(k, t0), pt(k, t1), 0.11-0.04*t0, 'col' if k % 2 == 0 else 'col2', w1=0.11-0.04*t1, caps=(i == 0 or i == S-1))
    # anneau blanc au sommet
    R1 = rad(1.0)
    out = [(R1*1.07*math.cos(2*math.pi*i/N+TW), R1*1.07*math.sin(2*math.pi*i/N+TW)) for i in range(N)]
    inn = [(R1*0.8*math.cos(2*math.pi*i/N+TW), R1*0.8*math.sin(2*math.pi*i/N+TW)) for i in range(N)]
    for i in range(N):
        j = (i+1) % N
        a, b, c, d = out[i], out[j], inn[j], inn[i]
        m.poly([(a[0], YT-0.03, a[1]), (b[0], YT-0.03, b[1]), (b[0], YT+0.05, b[1]), (a[0], YT+0.05, a[1])], 'ring', (0, YT, 0))
        cx, cz = (inn[i][0]+inn[j][0])/2, (inn[i][1]+inn[j][1])/2
        m.poly([(d[0], YT-0.03, d[1]), (c[0], YT-0.03, c[1]), (c[0], YT+0.05, c[1]), (d[0], YT+0.05, d[1])], 'ring', (cx*3, YT, cz*3))
        m.poly([(a[0], YT+0.05, a[1]), (b[0], YT+0.05, b[1]), (c[0], YT+0.05, c[1]), (d[0], YT+0.05, d[1])], 'ring', (0, YT-1, 0))
    # clocher à quatre mâts, au coin du parvis
    bx, bz = 0.7, -0.68
    for (dx, dz) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.beam((bx+dx*0.07, 0.05, bz+dz*0.07), (bx+dx*0.02, 1.05, bz+dz*0.02), 0.045, 'bell', w1=0.025, caps=True)
    for y in (0.35, 0.7):
        w = 0.07-0.05*(y-0.05)/1.0
        m.box(bx-w, bx+w, y, y+0.03, bz-w, bz+w, 'bell', skip=('bot',))
    return m
