#!/bin/zsh
# Asie et Turquie. usage : run_asie.sh <dossier_sortie> <planche.png> <azimut> nom...
# construit les GLB, les contrôle (check.py), rend une planche groupée (256 px et 96 px) et vérifie le sens des faces
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
D=$1; P=$2; AZ=$3; shift 3
$B -b --factory-startup -P mk_asie.py -- "$D" "$@" 2>&1 | grep -E "^\[|écrit|Error|Traceback|rror|File \"/Users"
for n in "$@"; do python3 -I check.py "$D/$n.glb" | grep -E "fichier|Ko|triangles|taille"; done
args=(); for n in "$@"; do args+=("$D/$n.glb"); done
$B -b --factory-startup -P planche_mp.py -- "$P" $AZ $args 2>&1 | grep -E "planche|Error|Traceback|rror"
$B -b --factory-startup -P faces_mp.py -- $args 2>&1 | grep -E "CULL|Error|Traceback"
