#!/bin/zsh
# usage : rg.sh sortie.png fichier.glb ...   (planche de contrôle en grand, voir grand.py)
cd "$(dirname "$0")"
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P grand.py -- "$@" 2>&1 | grep -E "planche|Error|Traceback|rror"
