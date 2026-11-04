"""Départ : un portique à damier noir et blanc au-dessus d'une ligne de départ, ses feux rouges, deux valises et un globe."""
import math
from lib import Mesh
from lib_special import *

PAL = {'blk': '#23242B', 'wht': '#F2EFE6', 'red': '#C9382F', 'red2': '#A92A24', 'grey': '#8E939B', 'dgrey': '#4A4D56', 'lamp': '#E5483B',
       'teal': '#2E8C97', 'teal2': '#246F78', 'strap': '#E8D9B0', 'sea': '#3F7FB5', 'land': '#6FA55B', 'gold': '#D6A93A'}


def checker(m, x0, x1, y0, y1, z, nx, ny, c1, c2, face=1):
    w, h = (x1-x0)/nx, (y1-y0)/ny
    for j in range(ny):
        for i in range(nx):
            quad_xy(m, x0+i*w, x0+(i+1)*w, y0+j*h, y0+(j+1)*h, z, c1 if (i+j) % 2 == 0 else c2, face)


def checker_floor(m, x0, x1, z0, z1, y, nx, nz, c1, c2):
    w, d = (x1-x0)/nx, (z1-z0)/nz
    for j in range(nz):
        for i in range(nx):
            quad_xz(m, x0+i*w, x0+(i+1)*w, z0+j*d, z0+(j+1)*d, y, c1 if (i+j) % 2 == 0 else c2)


def suitcase(m, x0, x1, z0, z1, h, col, col2):
    m.box(x0, x1, 0, h, z0, z1, col, skip=('bot',))
    xm = (x0+x1)/2
    # bandes claires et poignée
    for s in (-0.25, 0.25):
        xs = xm+s*(x1-x0)
        quad_xy(m, xs-0.012, xs+0.012, 0, h, z1+0.003, 'strap')
        m.poly([(xs-0.012, h+0.003, z0), (xs+0.012, h+0.003, z0), (xs+0.012, h+0.003, z1), (xs-0.012, h+0.003, z1)], 'strap', (xs, 0, (z0+z1)/2))
    m.box(xm-0.05, xm+0.05, h, h+0.04, (z0+z1)/2-0.012, (z0+z1)/2+0.012, 'dgrey', skip=('bot',))
    quad_xy(m, x0, x1, 0.0, 0.035, z1+0.002, col2)


def build():
    m = Mesh(PAL)
    HW = 0.98          # axe des piliers
    # ---------- piliers ----------
    for sx in (-1, 1):
        cx = sx*HW
        m.box(cx-0.2, cx+0.2, 0, 0.1, -0.2, 0.2, 'grey', skip=('bot',))
        m.box(cx-0.13, cx+0.13, 0.1, 1.9, -0.13, 0.13, 'blk', skip=('bot', 'top'))
        checker(m, cx-0.13, cx+0.13, 0.1, 1.9, 0.13+0.002, 2, 14, 'blk', 'wht')
    # ---------- poutre damier ----------
    Y0, Y1 = 1.9, 2.42
    m.box(-1.15, 1.15, Y0, Y1, -0.09, 0.09, 'blk', skip=('pz',))
    checker(m, -1.15, 1.15, Y0, Y1, 0.09+0.001, 18, 4, 'blk', 'wht')
    m.box(-1.17, 1.17, Y1, Y1+0.04, -0.11, 0.11, 'wht', skip=('bot',))
    m.box(-1.17, 1.17, Y0-0.04, Y0, -0.11, 0.11, 'dgrey', skip=('bot',))
    # ---------- feux de départ ----------
    m.box(-0.5, 0.5, 1.58, Y0-0.04, -0.05, 0.12, 'dgrey', skip=('top',))
    for i in range(5):
        cx = -0.36+0.18*i
        pts = [(cx+0.065*math.cos(a*math.pi/4), 1.58+0.17+0.065*math.sin(a*math.pi/4), 0.12+0.002) for a in range(8)]
        m.poly(pts, 'lamp' if i != 4 else 'lamp', (cx, 1.75, 0))
    # ---------- ligne de départ ----------
    checker_floor(m, -1.15, 1.15, 0.26, 0.46, 0.008, 24, 2, 'blk', 'wht')
    quad_xz(m, -1.15, 1.15, 0.46, 0.52, 0.006, 'red')
    quad_xz(m, -1.15, 1.15, 0.20, 0.26, 0.006, 'red')
    # ---------- valises ----------
    suitcase(m, -0.98, -0.50, 0.58, 0.82, 0.34, 'red2', 'dgrey')
    suitcase(m, -0.46, -0.18, 0.60, 0.80, 0.22, 'teal', 'teal2')
    # ---------- globe sur pied ----------
    gx, gz = 0.82, 0.68
    cyl(m, gx, gz, 0.1, 0, 0.04, 8, 'dgrey', cap='dgrey')
    cyl(m, gx, gz, 0.025, 0.04, 0.2, 6, 'gold')
    def globe_col(pts):
        x, y, z = pts[0][0]-gx, pts[0][1]-0.4, pts[0][2]-gz
        return 'land' if math.sin(x*14)+math.cos(y*11+z*9) > 0.55 else 'sea'
    blob(m, gx, 0.4, gz, 0.2, 0.2, 0.2, 'sea', 1, globe_col)
    return m
