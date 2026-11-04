"""Planche groupée : Blender -b --factory-startup -P sheet.py -- sortie.png fichier1.glb fichier2.glb ...
Chaque modèle à 256 px et à 96 px (384 réduit 4x4), fond #2A2D38, soleil chaud à gauche, vue plongeante 57 degrés."""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import render0 as R

argv = sys.argv[sys.argv.index('--')+1:]
out, glbs = argv[0], argv[1:]
BG = np.array([0.0232, 0.0262, 0.0397])
# couleur sRGB du fond #2A2D38
bg = np.array([0x2A, 0x2D, 0x38])/255.0
cells = []
for g in glbs:
    obj = R.setup(g, (2.2, 2.2))
    R.camera(obj)
    tmp = out + '.tmp.png'
    big = R.render(tmp, 256)
    sm = R.down(R.render(tmp, 384), 4)
    os.remove(tmp)
    cells.append((big, sm))
cols = 3
rows = (len(cells)+cols-1)//cols
cw, ch = 256+8+96+12, 256+12
sheet = np.ones((rows*ch+12, cols*cw+12, 3), dtype=np.float32)*bg
for k, (big, sm) in enumerate(cells):
    r, c = divmod(k, cols)
    y, x = 12+r*ch, 12+c*cw
    sheet[y:y+256, x:x+256] = big
    sheet[y:y+96, x+264:x+360] = sm
R.save(sheet, out)
print('planche', out, sheet.shape)
