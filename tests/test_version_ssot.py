# -*- coding: utf-8 -*-
"""Verrou de cohérence du versionnage — SSOT : APP_VERSION dans src/constants.js.

Casse si un des emplacements propagés (package.json, index.html, SHIP_LOG.md)
dérive de la SSOT. Remède : `python scripts/sync_version.py`.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REMEDE = "Remède : python scripts/sync_version.py"


def _ssot_version() -> str:
    text = (ROOT / "src" / "constants.js").read_text(encoding="utf-8")
    match = re.search(r"export const APP_VERSION = '(\d+\.\d+\.\d+)';", text)
    assert match, "APP_VERSION introuvable dans src/constants.js (la SSOT a disparu !)"
    return match.group(1)


def test_package_json_aligne_sur_ssot():
    version = _ssot_version()
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    assert pkg["version"] == version, (
        f"package.json ({pkg['version']}) != SSOT ({version}). {REMEDE}"
    )


def test_index_html_aligne_sur_ssot():
    version = _ssot_version()
    short = ".".join(version.split(".")[:2])
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    affichages = re.findall(r"Version (\d+\.\d+(?:\.\d+)?)(?=</div>)", html)
    assert len(affichages) == 2, (
        f"index.html doit afficher la version à exactement 2 endroits, trouvé {len(affichages)}"
    )
    for affiche in affichages:
        assert affiche == short, (
            f"index.html affiche « Version {affiche} » != SSOT ({short}). {REMEDE}"
        )


def test_ship_log_aligne_sur_ssot():
    version = _ssot_version()
    log = (ROOT / "SHIP_LOG.md").read_text(encoding="utf-8")
    match = re.search(r"\*\*Version actuelle\*\* : (\S+)", log)
    assert match, "Ligne « **Version actuelle** » introuvable dans SHIP_LOG.md"
    assert match.group(1) == version, (
        f"SHIP_LOG.md ({match.group(1)}) != SSOT ({version}). {REMEDE}"
    )
