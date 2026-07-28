# -*- coding: utf-8 -*-
"""Propagateur de version — SSOT : APP_VERSION dans src/constants.js.

Usage :
    python scripts/sync_version.py            # propage la version de constants.js partout
    python scripts/sync_version.py --set 5.3.0  # change la SSOT PUIS propage

Cibles propagées :
    - package.json         ("version")
    - package-lock.json    (racine + packages."")
    - index.html           (les 2 nœuds d'affichage "Version X.Y")
    - SHIP_LOG.md          (ligne "**Version actuelle**")

Verrou de cohérence associé : tests/test_version_ssot.py (validation unifiée).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONSTANTS = ROOT / "src" / "constants.js"

VERSION_RE = re.compile(r"export const APP_VERSION = '(\d+\.\d+\.\d+)';")


def read_version() -> str:
    match = VERSION_RE.search(CONSTANTS.read_text(encoding="utf-8"))
    if not match:
        sys.exit("ERREUR : APP_VERSION introuvable dans src/constants.js")
    return match.group(1)


def write_version(new_version: str) -> None:
    if not re.fullmatch(r"\d+\.\d+\.\d+", new_version):
        sys.exit(f"ERREUR : format attendu X.Y.Z, reçu « {new_version} »")
    text = CONSTANTS.read_text(encoding="utf-8")
    CONSTANTS.write_text(
        VERSION_RE.sub(f"export const APP_VERSION = '{new_version}';", text),
        encoding="utf-8",
    )


def sync(version: str) -> list[str]:
    short = ".".join(version.split(".")[:2])  # 5.2.0 -> "5.2" pour l'affichage UI
    changed = []

    pkg_path = ROOT / "package.json"
    pkg = json.loads(pkg_path.read_text(encoding="utf-8"))
    if pkg.get("version") != version:
        pkg["version"] = version
        pkg_path.write_text(json.dumps(pkg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        changed.append("package.json")

    lock_path = ROOT / "package-lock.json"
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        if lock.get("version") != version or lock["packages"][""].get("version") != version:
            lock["version"] = version
            lock["packages"][""]["version"] = version
            lock_path.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            changed.append("package-lock.json")

    html_path = ROOT / "index.html"
    html = html_path.read_text(encoding="utf-8")
    new_html = re.sub(r"Version \d+\.\d+(?:\.\d+)?(?=</div>)", f"Version {short}", html)
    if new_html != html:
        html_path.write_text(new_html, encoding="utf-8")
        changed.append("index.html")

    log_path = ROOT / "SHIP_LOG.md"
    log = log_path.read_text(encoding="utf-8")
    new_log = re.sub(r"(\*\*Version actuelle\*\* : ).*", rf"\g<1>{version}", log)
    if new_log != log:
        log_path.write_text(new_log, encoding="utf-8")
        changed.append("SHIP_LOG.md")

    return changed


def main() -> None:
    if len(sys.argv) == 3 and sys.argv[1] == "--set":
        write_version(sys.argv[2])
        print(f"SSOT mise à jour : src/constants.js -> {sys.argv[2]}")
    version = read_version()
    changed = sync(version)
    if changed:
        print(f"Version {version} propagée vers : {', '.join(changed)}")
    else:
        print(f"Version {version} : tout est déjà synchronisé.")


if __name__ == "__main__":
    main()
