"""
tests/test_esm_imports.py — LOT 014, volet F : verrou anti-recidive sur les imports ESM.

But : tout import RELATIF doit porter son extension de fichier.

POURQUOI CE VERROU EXISTE. Un import sans extension (`from '../src/state'`) ne fonctionne que
parce qu'un outil devine le fichier a la place du navigateur. Vite le tolere en developpement,
un navigateur ne le tolererait pas, et Node en mode ESM strict non plus. C'est un arbitrage
laisse en suspens depuis le LOT 002 : la regle etait connue, appliquee dans `src/` et
`js/app.js` (100 % conformes), et violee dans 22 imports de `tests/` — corriges dans le meme
commit que ce verrou.

Le risque n'est pas theorique : le jour ou l'un de ces chemins devient ambigu (un `state.js` ET
un `state/` cote a cote), l'outil choisit silencieusement, et il peut choisir autrement demain.
"""
from __future__ import annotations

import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DOSSIERS = ("src", "js", "tests")

# Un import relatif doit se terminer par une extension connue.
EXTENSIONS_ATTENDUES = (".js", ".mjs", ".cjs", ".json", ".css", ".html")

# `from './x'` · `import './x'` · `import('./x')` — uniquement les chemins RELATIFS :
# un specificateur nu (`vitest`, `node:fs`) est un paquet, il n'a pas d'extension.
MOTIFS = (
    re.compile(r"""\bfrom\s+['"](\.[^'"]*)['"]"""),
    re.compile(r"""\bimport\s+['"](\.[^'"]*)['"]"""),
    re.compile(r"""\bimport\s*\(\s*['"](\.[^'"]*)['"]"""),
)


def _imports_relatifs() -> list[tuple[str, int, str]]:
    """Rend (fichier, ligne, specificateur) pour chaque import relatif du projet."""
    trouves = []
    for dossier in DOSSIERS:
        racine = PROJECT_ROOT / dossier
        if not racine.is_dir():
            continue
        for fichier in sorted(racine.rglob("*.js")):
            rel = fichier.relative_to(PROJECT_ROOT).as_posix()
            for numero, ligne in enumerate(fichier.read_text(encoding="utf-8").splitlines(), 1):
                for motif in MOTIFS:
                    for spec in motif.findall(ligne):
                        trouves.append((rel, numero, spec))
    return trouves


def test_le_verrou_a_bien_de_la_matiere_a_analyser():
    """
    GARDE CONTRE CE VERROU LUI-MEME. Sans elle, une evolution du projet (imports generes,
    passage a un autre style) ferait que les motifs ne trouvent plus RIEN — et le verrou
    passerait au vert A VIDE, en donnant l'illusion de proteger quelque chose. C'est
    exactement le profil de faux verrou que la chasse de l'etape C0 a trouve 12 fois.
    """
    imports = _imports_relatifs()
    assert len(imports) >= 40, (
        f"Seulement {len(imports)} imports relatifs detectes : les motifs de detection ne "
        "correspondent plus au code. Ce verrou ne prouverait plus rien."
    )


def test_tout_import_relatif_porte_son_extension():
    manquants = [
        f"{fichier}:{ligne}  ->  '{spec}'"
        for fichier, ligne, spec in _imports_relatifs()
        if not spec.endswith(EXTENSIONS_ATTENDUES)
    ]
    assert not manquants, (
        "Ces imports relatifs n'ont pas d'extension — ils ne marchent que parce qu'un outil "
        "devine le fichier a la place du navigateur :\n  " + "\n  ".join(manquants)
    )
