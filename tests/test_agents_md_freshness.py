"""
tests/test_agents_md_freshness.py — Gardien d'actualité d'AGENTS.md (généré).
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

PROJECT_ROOT = Path(__file__).resolve().parents[1]
_SCRIPT = PROJECT_ROOT / "scripts" / "sync_agents_md.py"

_spec = importlib.util.spec_from_file_location("sync_agents_md", _SCRIPT)
assert _spec is not None and _spec.loader is not None, f"Script introuvable : {_SCRIPT}"
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)


def test_agents_md_exists():
    assert _mod.TARGET.is_file(), (
        "AGENTS.md absent de la racine — lancer : python scripts/sync_agents_md.py"
    )


def test_agents_md_is_fresh():
    expected = _mod.build_content()
    actual = _mod.TARGET.read_text(encoding="utf-8")
    assert actual == expected, (
        "AGENTS.md a divergé de ses sources — lancer : python scripts/sync_agents_md.py"
    )


def test_agents_md_under_codex_byte_limit():
    size = len(_mod.build_content().encode("utf-8"))
    assert size <= _mod.MAX_BYTES, (
        f"AGENTS.md généré = {size} octets > plafond {_mod.MAX_BYTES}."
    )


def test_current_claude_md_markers_are_balanced():
    text = _mod.GOVERNANCE.read_text(encoding="utf-8")
    _mod._validate_markers(text)


@pytest.mark.parametrize(
    "bad",
    [
        "A\n<!-- NOINJECT -->\nsecret\nB\n",
        "A\n<!-- /NOINJECT -->\nB\n",
        "A\n<!-- NOINJECT -->\nx\n<!-- NOINJECT -->\ny\n<!-- /NOINJECT -->\nz\n<!-- /NOINJECT -->\nB\n",
    ],
)
def test_malformed_markers_are_rejected(bad):
    with pytest.raises(_mod.NoInjectMarkerError):
        _mod._validate_markers(bad)
