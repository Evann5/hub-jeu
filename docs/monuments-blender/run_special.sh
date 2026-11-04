#!/bin/zsh
# usage : run.sh <dossier_sortie> <planche.png> <azimut> nom...   (noms : start customs ...)
cd "$(dirname "$0")"
B=/Applications/Blender.app/Contents/MacOS/Blender
D=$1; P=$2; AZ=$3; shift 3
$B -b --factory-startup -P mk_special.py -- "$D" "$@" 2>&1 | grep -E "^\[|écrit|Error|Traceback|rror|File|line"
args=(); for n in "$@"; do args+=("$D/special-$n.glb"); done
for f in $args; do python3 -I check.py "$f" | grep -E "fichier|Ko|triangles|taille|attributs"; done
[ -n "$P" ] && $B -b --factory-startup -P planche_mp.py -- "$P" $AZ $args 2>&1 | grep -E "planche|Error|Traceback|rror"
