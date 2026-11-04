#!/bin/zsh
# usage: run.sh <nom> [dossier]   (construit, contrôle, rend la planche)
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
D=${2:-$PWD/essais}
$B -b --factory-startup -P mk.py -- $1 "$D" 2>&1 | grep -E "^\[|écrit|Error|Traceback|File|rror" 
python3 -I check.py "$D/$1.glb" | grep -E "Ko|triangles|taille|COLOR|min|max"
$B -b --factory-startup -P render.py -- "$D/$1.glb" "$PWD/essais" ${3:-38} 2>&1 | grep -E "planche|Error|Traceback|rror"
