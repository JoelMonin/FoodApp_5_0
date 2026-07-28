"""
tests/test_project_map_freshness.py — Gardien d'actualité de PROJECT_MAP.md pour FoodApp.

But : Verifier que chaque module JS sous src/ et chaque test dans tests/
sont documentés dans PROJECT_MAP.md.
"""
from __future__ import annotations

from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROJECT_MAP = PROJECT_ROOT / "PROJECT_MAP.md"


def _project_map_content() -> str:
    if not PROJECT_MAP.is_file():
        pytest.fail(f"PROJECT_MAP.md introuvable à {PROJECT_MAP}.")
    return PROJECT_MAP.read_text(encoding="utf-8").lower()


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


def test_project_map_mentions_all_src_modules():
    content = _project_map_content()
    modules = _list_src_modules()
    missing = []
    for mod in modules:
        # Vérifie si le fichier ou son basename apparaît dans PROJECT_MAP.md
        name_part = Path(mod).name
        if name_part.lower() not in content and mod.lower() not in content:
            missing.append(mod)
    assert not missing, (
        f"Composants src/ manquants dans PROJECT_MAP.md : {missing}. "
        "Mettre à jour PROJECT_MAP.md."
    )


def test_project_map_mentions_all_tests():
    content = _project_map_content()
    test_files = _list_tests()
    missing = []
    for tf in test_files:
        if tf.lower() not in content:
            missing.append(tf)
    assert not missing, (
        f"Fichiers de test manquants dans PROJECT_MAP.md : {missing}. "
        "Mettre à jour PROJECT_MAP.md."
    )
