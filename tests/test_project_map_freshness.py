"""
tests/test_project_map_freshness.py — Gardien d'actualité de PROJECT_MAP.md pour FoodApp.

But : Verifier que chaque module JS sous src/ et chaque test dans tests/
sont documentés dans PROJECT_MAP.md.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROJECT_MAP = PROJECT_ROOT / "PROJECT_MAP.md"

# Une ligne d'inventaire : « - `chemin/fichier.js` : description ».
LIGNE_INVENTAIRE = re.compile(r"\s*-\s*`([^`]+)`")


def _project_map_content() -> str:
    if not PROJECT_MAP.is_file():
        pytest.fail(f"PROJECT_MAP.md introuvable à {PROJECT_MAP}.")
    return PROJECT_MAP.read_text(encoding="utf-8").lower()


def _composants_declares() -> set[str]:
    """
    Les composants RÉELLEMENT inventoriés, c'est-à-dire ceux qui ouvrent une ligne de la
    carte — pas ceux dont le nom traîne quelque part dans une phrase.

    DURCI AU LOT 014 (§F). Avant, ce verrou cherchait le nom de fichier N'IMPORTE OÙ dans
    `PROJECT_MAP.md`. Constaté sur pièce le 2026-07-31 : `src/ui/addForm.js` est passé VERT
    alors qu'il n'était déclaré nulle part — la chaîne « addForm.js » se trouvait déjà dans
    la phrase décrivant `tests/add-form.test.js`, ajoutée au commit précédent. Le verrou
    prouvait qu'un texte existait, pas qu'un composant était documenté.
    """
    contenu = PROJECT_MAP.read_text(encoding="utf-8")
    declares = set()
    for ligne in contenu.splitlines():
        trouve = LIGNE_INVENTAIRE.match(ligne)
        if trouve:
            declares.add(trouve.group(1).strip().lower())
    return declares


def _list_src_modules() -> set[str]:
    """Liste tous les fichiers JS sous src/."""
    src_dir = PROJECT_ROOT / "src"
    if not src_dir.is_dir():
        return set()
    found = set()
    for p in src_dir.rglob("*.js"):
        rel = p.relative_to(PROJECT_ROOT).as_posix()
        found.add(rel)
    return found


def _list_tests() -> set[str]:
    """Liste tous les fichiers de test dans tests/."""
    tests_dir = PROJECT_ROOT / "tests"
    if not tests_dir.is_dir():
        return set()
    found = set()
    for p in tests_dir.glob("*.*"):
        found.add(p.name)
    return found


def test_project_map_file_exists():
    assert PROJECT_MAP.is_file(), "PROJECT_MAP.md critique manquant à la racine."


def test_l_inventaire_lui_meme_est_non_trivial():
    """
    GARDE CONTRE CE VERROU LUI-MÊME (LOT 014 §F). Si le format des lignes d'inventaire
    changeait, `_composants_declares()` renverrait un ensemble vide — et les deux tests
    ci-dessous rougiraient massivement, ce qui est le bon sens. Mais si c'était l'inverse
    (une expression trop permissive), ils passeraient à vide. Cette garde ancre le format.
    """
    declares = _composants_declares()
    assert len(declares) >= 50, (
        f"Seulement {len(declares)} lignes d'inventaire reconnues dans PROJECT_MAP.md : "
        "le format a changé et ce verrou ne prouve plus rien."
    )


def test_project_map_mentions_all_src_modules():
    declares = _composants_declares()
    missing = [
        mod for mod in _list_src_modules()
        if mod.lower() not in declares and Path(mod).name.lower() not in declares
    ]
    assert not missing, (
        f"Composants src/ manquants dans PROJECT_MAP.md : {missing}. "
        "Chacun doit avoir SA propre ligne d'inventaire (« - `chemin` : description ») — "
        "une simple mention dans la description d'un autre composant ne compte pas."
    )


def test_project_map_mentions_all_tests():
    declares = _composants_declares()
    missing = [
        tf for tf in _list_tests()
        if tf.lower() not in declares and f"tests/{tf}".lower() not in declares
    ]
    assert not missing, (
        f"Fichiers de test manquants dans PROJECT_MAP.md : {missing}. "
        "Chacun doit avoir SA propre ligne d'inventaire (« - `tests/…` : description »)."
    )
