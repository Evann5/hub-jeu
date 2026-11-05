#!/bin/zsh
# Égypte, Algérie, Sénégal, Brésil. usage : run_ab.sh <dossier_sortie> <planche.png> <azimut> nom...
# construit les GLB, les contrôle (check.py), rend une planche groupée (planche_mp.py) et vérifie le sens des faces (faces_mp.py)
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
D=$1; P=$2; AZ=$3; shift 3
$B -b --factory-startup -P mk_ab.py -- "$D" "$@" 2>&1 | grep -E "^\[|Error|Traceback|rror|File "
for n in "$@"; do python3 -I check.py "$D/$n.glb" | grep -E "fichier|Ko|triangles|taille"; done
args=(); for n in "$@"; do args+=("$D/$n.glb"); done
$B -b --factory-startup -P planche_mp.py -- "$P" $AZ $args 2>&1 | grep -E "planche|Error|Traceback|rror"
$B -b --factory-startup -P faces_mp.py -- $args 2>&1 | grep -E "CULL|Error|Traceback"
