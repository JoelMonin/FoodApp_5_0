"""scripts/sync_agents_md.py — Génère AGENTS.md depuis les 2 SSoT de gouvernance de FoodApp.

AGENTS.md (racine) est le SEUL fichier auto-injecté au démarrage de session
chez les auditeurs. Il ne doit JAMAIS être édité à la main : éditer `Claude.md` (gouvernance)
ou `.agents/01_auditor_role.md` (mandat auditeur), puis relancer ce script.
"""
from __future__ import annotations

import re
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
GOVERNANCE = PROJECT_ROOT / "Claude.md"
MANDATE = PROJECT_ROOT / ".agents" / "01_auditor_role.md"
TARGET = PROJECT_ROOT / "AGENTS.md"

MAX_BYTES = 65536
ANTIGRAVITY_MAX_BYTES = 23500
GOVERNANCE_BUDGET_BYTES = 22000

_NOINJECT_RE = re.compile(r"<!-- NOINJECT -->.*?<!-- /NOINJECT -->\n?", re.DOTALL)
_OPEN = "<!-- NOINJECT -->"
_CLOSE = "<!-- /NOINJECT -->"
_MARKER_RE = re.compile(r"<!-- /?NOINJECT -->")


class NoInjectMarkerError(RuntimeError):
    """Marqueurs NOINJECT malformés dans Claude.md (déséquilibre / imbrication)."""


def _validate_markers(text: str) -> None:
    depth = 0
    for pos, m in enumerate(_MARKER_RE.finditer(text)):
        line = text.count("\n", 0, m.start()) + 1
        if m.group() == _OPEN:
            if depth != 0:
                raise NoInjectMarkerError(
                    f"Marqueur NOINJECT ouvrant imbrique (ligne {line}) : "
                    "un bloc precedent n'est pas ferme."
                )
            depth = 1
        else:
            if depth != 1:
                raise NoInjectMarkerError(
                    f"Marqueur /NOINJECT fermant orphelin (ligne {line}) : "
                    "aucun bloc ouvert a cet endroit."
                )
            depth = 0
    if depth != 0:
        raise NoInjectMarkerError(
            "Marqueur NOINJECT ouvert jamais ferme dans Claude.md : "
            "un bloc secret fuirait dans la copie injectee aux auditeurs."
        )


BANNER = """\
<!-- =====================================================================
FICHIER GÉNÉRÉ — NE PAS MODIFIER DIRECTEMENT.
LES INSTRUCTIONS CI-DESSOUS SONT OBLIGATOIRES ET DOIVENT ÊTRE APPLIQUÉES.
Régénération : python scripts/sync_agents_md.py
Verrou anti-divergence : tests/test_agents_md_freshness.py
===================================================================== -->

# AGENTS.md — Gouvernance injectée (Auditeurs : Gemini / Codex)

Tu n'es PAS Claude Code. Si ton harnais (Antigravity ou Codex) t'injecte ce
fichier au démarrage, tu es l'AUDITEUR de la session : le mandat de la
PARTIE 1 est le tien.

NB : la mécanique interne de l'exécutant (blocs NOINJECT de `Claude.md`) et
la doctrine produit spécifique (`DOCTRINE_PRODUIT.md`) sont exclues de cette
copie — lis ces fichiers au besoin. Ce fichier DOIT se terminer par la
ligne-témoin « FIN DES RÈGLES INJECTÉES » : si elle manque, ton contexte est TRONQUÉ — signale-le à Joel.
"""

CANARY = (
    "**FIN DES RÈGLES INJECTÉES — AGENTS.md complet.** "
    "(Si cette ligne n'apparaît pas dans ton contexte, l'injection a été "
    "tronquée : signale-le immédiatement à Joel.)"
)


def _strip_noinject(text: str) -> str:
    _validate_markers(text)
    stripped = _NOINJECT_RE.sub("", text)
    if _MARKER_RE.search(stripped):
        raise NoInjectMarkerError(
            "Marqueur NOINJECT residuel apres strip. Verifier Claude.md."
        )
    return re.sub(r"\n{3,}", "\n\n", stripped)


def build_content() -> str:
    mandate = MANDATE.read_text(encoding="utf-8")
    governance = _strip_noinject(GOVERNANCE.read_text(encoding="utf-8"))
    return (
        BANNER
        + "\n---\n\n# PARTIE 1 — MANDAT DE L'AUDITEUR\n\n"
        + mandate.strip()
        + "\n\n---\n\n# PARTIE 2 — GOUVERNANCE PROJET"
        + " (copie de Claude.md, hors blocs historiques NOINJECT)\n\n"
        + governance.strip()
        + "\n\n---\n\n"
        + CANARY
        + "\n"
    )


def main() -> None:
    content = build_content()
    size = len(content.encode("utf-8"))
    if size > MAX_BYTES:
        raise SystemExit(
            f"AGENTS.md généré = {size} octets > plafond DUR Codex {MAX_BYTES}."
        )
    TARGET.write_text(content, encoding="utf-8", newline="\n")
    print(f"AGENTS.md régénéré ({size} octets UTF-8).")


if __name__ == "__main__":
    main()
