"""Pont d'audit Claude <-> Codex (V1 sobre) — `scripts/audit_bridge.py`.

But (chantier `feat/pont-audit-codex`, 2026-07-24) : supprimer le copier-coller
manuel de Joel dans la boucle d'audit. Claude appelle Codex via `codex exec` en
lecture seule, le wrapper capture la sortie BRUTE et écrit lui-même les artefacts
de traçabilité. Joel garde SEUL le feu vert de merge.

PORTÉE HONNÊTE : garde-fou ANTI-ACCIDENT (troncature / substitution involontaire
de la réponse), PAS une preuve cryptographique contre un exécutant malveillant —
Claude, le wrapper et les artefacts partagent le même compte Windows et le même
dépôt. La preuve forte (stockage externe append-only / signature hors de portée
de Claude) est un candidat V2 explicite, jamais un acquis.

Architecture GO par Codex Sol (2026-07-24) puis 8 corrections de bootstrap
(2026-07-24, tour 2). Invariants gravés :
  - snapshot immuable base_sha (merge-base) -> target_sha, arbre propre HORS
    `audits/bridge/` vérifié AVANT et APRÈS (les artefacts du pont ne salissent
    pas le tour) ;
  - VERROU exclusif AVANT toute lecture/écriture du registre de session ;
  - session = SSoT : modèle/effort/dépôt/branche/hashes/version CLI liés ;
    `new` seulement sans thread enregistré, `resume` seulement avec le thread exact ;
  - porte de validité par PRÉSENCE POSITIVE (turn.completed, dernier agent_message
    == RESPONSE, thread_id) — un échec n'est JAMAIS un GO implicite ; le modèle et
    l'effort ne sont PAS émis par le CLI (prouvé end-to-end), ils font foi via argv ;
  - toute tentative (échec, timeout, exception) est ARCHIVÉE avec un manifeste ;
  - scan de secrets sur TOUS les artefacts bruts (prompt/réponse/JSONL/stderr) ;
  - promotion ATOMIQUE d'un répertoire (un seul rename), anti-écrasement ;
  - identité injectée depuis le modèle réel, jamais tapée librement par Claude.

Ce module est du CODE D'INFRA en bootstrap MANUEL : son diff est audité à la main
par Sol AVANT toute activation officielle du pont (il ne se certifie pas lui-même).

Limites V1 assumées (documentées, non silencieuses) : la mise à mort de l'arbre de
process enfant sur timeout Windows repose sur `subprocess` (pas de Job Object) ; et
`--force-unlock` est un geste HUMAIN délibéré + journalisé, sans test de vie du PID.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRIDGE_ROOT = ROOT / "audits" / "bridge"
BRIDGE_REL = "audits/bridge/"  # préfixe exclu des vérifs clean-tree

# Mapping modèle réel -> identité (le wrapper génère l'identité depuis le modèle
# DEMANDÉ ; Claude ne la tape jamais librement).
MODEL_IDENTITY = {
    "gpt-5.6-sol": "Codex 5.6 Sol",
    "gpt-5.6-terra": "Codex 5.6 Terra",
    "gpt-5.6-luna": "Codex 5.6 Luna",
}
VALID_EFFORTS = {"low", "medium", "high", "xhigh", "max", "ultra"}

# ── Détecteur de secrets ─────────────────────────────────────────────────────
# PORTÉE DÉCLARÉE, à ne jamais survendre : c'est une heuristique par PRÉFIXE
# CONNU, sur une liste de familles CHOISIES (ci-dessous). Elle ne verra jamais un
# secret sans préfixe reconnaissable, ni une famille non listée. Chaque famille
# ajoutée élargit aussi la surface de faux positifs — la liste est donc délibérée
# et nommée, pas « tous les secrets ».
#
# Garde `_DEBUT_DE_MOT` : le préfixe ne compte que si le caractère qui le précède
# n'est PAS alphanumérique. Motif de l'ajout — audit Lot 108 T1b tour 1, le
# préfixe `sk-` a matché au milieu d'un identifiant opaque d'URL Gemini
# (`…UkiP5sk-hIyimS9lq…`) stocké dans `ai_cache`. Coût réel d'un faux positif :
# la quarantaine, donc un tour non versionné — et, jusqu'au correctif du même
# jour, la perte du fil d'audit entier.
#
# `_` et `-` sont VOLONTAIREMENT hors de la garde, contrairement à un `\b` :
# sinon `CLE_sk-…` deviendrait invisible (`_` est un caractère de mot pour `\b`).
# PRIX ASSUMÉ, mesuré et testé : un identifiant d'URL contenant `_sk-` ou `-sk-`
# déclenche encore une fausse quarantaine. Cette garde ferme l'incident RÉEL
# rencontré, PAS toute la classe des collisions dans les identifiants URL-safe.
_DEBUT_DE_MOT = r"(?<![A-Za-z0-9])"

# Familles surveillées, une entrée par PRÉFIXE OFFICIEL documenté. Le trou fermé
# le 2026-07-29 (finding Sol) était de ne connaître qu'un préfixe par famille :
# `ghp_` seul ignorait `github_pat_` (jeton granulaire, le plus courant
# aujourd'hui) et les jetons d'application ; et `sk-[A-Za-z0-9]` s'arrêtait au
# premier tiret, donc ni `sk-proj-…` (OpenAI) ni `sk-ant-…` (Anthropic) — les
# deux formats ACTUELS — n'étaient vus. Ce n'était pas la limite déclarée
# ci-dessus : c'étaient des préfixes documentés, simplement absents.
SECRET_PATTERNS = [
    # OpenAI / Anthropic. Le corps de la forme HISTORIQUE reste sans tiret :
    # admettre `-` ici a été essayé et MESURÉ comme dangereux — l'URL d'un
    # article de presse `…/4922846-sk-hynix-has-room-for-another-leg-up`
    # (SK Hynix, fabricant de puces, sujet récurrent de l'actualité ETF présente
    # dans `news_articles`) devenait une fausse fuite. Les formats modernes sont
    # donc couverts par leur sous-préfixe NOMMÉ, jamais par un joker.
    # Limite déclarée : un sous-préfixe éditeur inédit devra être ajouté ici.
    re.compile(_DEBUT_DE_MOT + r"sk-(?:proj|ant|svcacct|admin)-[A-Za-z0-9_\-]{20,}"),
    re.compile(_DEBUT_DE_MOT + r"sk-[A-Za-z0-9]{20,}"),
    # Google (clés d'API Gemini / Maps…).
    re.compile(_DEBUT_DE_MOT + r"AIza[0-9A-Za-z_\-]{30,}"),
    # GitHub : `github_pat_` (granulaire) + les 5 préfixes courts documentés
    # (`ghp_` PAT classique, `gho_` OAuth, `ghu_` user-to-server,
    # `ghs_` server-to-server, `ghr_` refresh).
    re.compile(_DEBUT_DE_MOT + r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(_DEBUT_DE_MOT + r"gh[pousr]_[A-Za-z0-9]{30,}"),
    # Slack : `xox<lettre>-` (bot/user/app/refresh/…), `xapp-` (niveau
    # application), `xwfp-` (workflow).
    re.compile(_DEBUT_DE_MOT + r"xox[a-z]-[A-Za-z0-9\-]{10,}"),
    re.compile(_DEBUT_DE_MOT + r"x(?:app|wfp)-[A-Za-z0-9\-]{10,}"),
    # Pas de garde ici : ce motif COMMENCE par un tiret, une frontière de mot n'y
    # aurait aucun sens (et il doit rester détecté même collé à un dump binaire).
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]


class BridgeError(RuntimeError):
    """Erreur bloquante du pont : arrête proprement AVANT toute dépense de tokens."""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers purs (testables sans réseau ni subprocess)
# ─────────────────────────────────────────────────────────────────────────────
def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def sanitize_name(name: str) -> str:
    """Neutralise le path traversal dans un nom de chantier / d'auditeur."""
    if not name or not re.fullmatch(r"[A-Za-z0-9._-]+", name) or name in {".", ".."}:
        raise BridgeError(
            f"nom invalide {name!r} : seuls [A-Za-z0-9._-] sont autorisés "
            "(protection path traversal)."
        )
    return name


def build_identity_line(model: str) -> str:
    """Ligne d'identité injectée en tête de prompt, dérivée du modèle réel."""
    identity = MODEL_IDENTITY.get(model)
    if identity is None:
        raise BridgeError(
            f"modèle {model!r} hors mapping — modèles connus : {sorted(MODEL_IDENTITY)}."
        )
    return (
        f"Tu es {identity}, désigné via le routage validé par Joel pour ce "
        f"chantier. Applique ton mandat d'auditeur (AGENTS.md)."
    )


def clean_outside_bridge(porcelain: str) -> bool:
    """True si aucun changement git HORS `audits/bridge/`.

    Les artefacts que le pont écrit lui-même (SESSION.json, tours promus…) ne
    doivent PAS compter comme un arbre sale — sinon chaque tour réel serait
    invalidé (finding Sol #1). Seule une modif de code AUDITÉ salit le tour.
    """
    for line in porcelain.splitlines():
        if not line.strip():
            continue
        rest = line[3:] if len(line) > 3 else line
        parts = rest.split(" -> ") if " -> " in rest else [rest]
        for raw in parts:
            path = raw.strip().strip('"')
            if path and not path.startswith(BRIDGE_REL):
                return False
    return True


def parse_events(events_text: str) -> dict:
    """Analyse le flux JSONL de `codex exec --json`."""
    thread_id = None
    model = None
    has_completed = False
    has_failure = False
    last_agent_message = None
    malformed = False

    for raw in events_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        try:
            evt = json.loads(line)
        except (json.JSONDecodeError, ValueError):
            malformed = True
            continue
        if not isinstance(evt, dict):
            malformed = True
            continue

        etype = evt.get("type")
        for key in ("thread_id", "session_id"):
            if evt.get(key):
                thread_id = evt[key]
        thread = evt.get("thread")
        if isinstance(thread, dict) and thread.get("id"):
            thread_id = thread["id"]
        if evt.get("model"):
            model = evt["model"]

        if etype == "turn.completed":
            has_completed = True
        if etype in {"turn.failed", "error"} or evt.get("error"):
            has_failure = True

        if etype == "agent_message":
            msg = evt.get("message", evt.get("text"))
            if isinstance(msg, dict):
                msg = msg.get("text") or msg.get("content")
            if isinstance(msg, str) and msg.strip():
                last_agent_message = msg
        item = evt.get("item")
        if isinstance(item, dict) and item.get("type") == "agent_message":
            txt = item.get("text") or item.get("content")
            if isinstance(txt, str) and txt.strip():
                last_agent_message = txt

    return {
        "thread_id": thread_id,
        "model": model,
        "has_turn_completed": has_completed,
        "has_terminal_failure": has_failure,
        "last_agent_message": last_agent_message,
        "malformed": malformed,
    }


def scan_secrets(*texts: str) -> list[str]:
    """Retourne les motifs de secret trouvés (vide = propre)."""
    hits = []
    for text in texts:
        for pat in SECRET_PATTERNS:
            if pat.search(text or ""):
                hits.append(pat.pattern)
    return sorted(set(hits))


def next_turn_number(chantier_dir: Path) -> int:
    """Prochain NN d'après les tours déjà promus (répertoires `NN/`), quarantaine
    incluse. Doit être appelé SOUS LE VERROU. Un NN d'échec ne se réutilise jamais.
    """
    if not chantier_dir.exists():
        return 1
    maxn = 0
    for d in chantier_dir.iterdir():
        if d.is_dir() and d.name.isdigit():
            maxn = max(maxn, int(d.name))
    quarantine = chantier_dir / "_QUARANTINE"
    if quarantine.exists():
        for d in quarantine.iterdir():
            if d.is_dir() and d.name.isdigit():
                maxn = max(maxn, int(d.name))
    return maxn + 1


# ─────────────────────────────────────────────────────────────────────────────
# Git — snapshot immuable
# ─────────────────────────────────────────────────────────────────────────────
def _git(*args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args], text=True, encoding="utf-8"
    ).strip()


def git_snapshot() -> dict:
    """Photo git : branche, HEAD, propreté de l'arbre HORS `audits/bridge/`."""
    porcelain = subprocess.check_output(
        ["git", "-C", str(ROOT), "status", "--porcelain"], text=True, encoding="utf-8"
    )
    return {
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        "head": _git("rev-parse", "HEAD"),
        "clean": clean_outside_bridge(porcelain),
    }


def lot_base_sha(head: str) -> str:
    """Base réelle du lot = merge-base avec la branche par défaut. Repli : head.

    ADAPTATION FoodApp : la branche par défaut de CE dépôt est `main` (elle est
    donc essayée EN PREMIER ; `master` n'existe pas ici). Ne pas se tromper de
    nom a un coût silencieux et grave : si aucun merge-base n'est trouvé, le
    repli rend `head`, donc `base_sha == target_sha`, donc un diff VIDE — l'audit
    part alors sur un périmètre nul sans rien signaler.
    """
    for defaut in ("main", "master"):
        try:
            return _git("merge-base", defaut, "HEAD")
        except subprocess.CalledProcessError:
            continue
    return head


def assert_feat_branch(branch: str) -> None:
    if branch in {"master", "main"} or not branch.startswith("feat/"):
        raise BridgeError(
            f"branche {branch!r} interdite : le pont n'audite que sur une branche "
            "feat/, jamais la branche par défaut."
        )


def cli_version() -> str:
    return subprocess.check_output(
        ["codex", "--version"], text=True, encoding="utf-8"
    ).strip()


# ─────────────────────────────────────────────────────────────────────────────
# Verrou exclusif par session (atomique, AVANT toute mutation du registre)
# ─────────────────────────────────────────────────────────────────────────────
def acquire_lock(chantier_dir: Path, thread_id: str | None, force_unlock: bool):
    """Acquiert un verrou EXCLUSIF via O_CREAT|O_EXCL (atomique). Retourne (path, token).

    Un second lancement concurrent échoue AVANT toute dépense de tokens. Un verrou
    orphelin n'est JAMAIS supprimé en silence : `--force-unlock` (geste humain
    délibéré) est requis, et la réclamation est journalisée dans RECLAIM.log.
    """
    chantier_dir.mkdir(parents=True, exist_ok=True)
    lock_path = chantier_dir / ".lock"
    token = f"{os.getpid()}-{time.time_ns()}"
    payload = json.dumps(
        {"pid": os.getpid(), "thread_id": thread_id, "ts": time.time(), "token": token}
    )
    try:
        fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    except FileExistsError:
        existing = _read_lock(lock_path)
        if not force_unlock:
            raise BridgeError(
                f"verrou de session déjà présent : {existing}. Un autre appel du "
                "pont tourne, ou un verrou orphelin subsiste (crash). Aucune "
                "réclamation silencieuse — relancer avec --force-unlock APRÈS avoir "
                "vérifié qu'aucun `codex exec` n'est actif."
            )
        with (chantier_dir / "RECLAIM.log").open("a", encoding="utf-8") as log:
            log.write(
                json.dumps(
                    {"reclaimed_at": time.time(), "previous": existing, "by_pid": os.getpid()}
                )
                + "\n"
            )
        lock_path.unlink()
        fd = os.open(str(lock_path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(payload)
    return lock_path, token


def _read_lock(lock_path: Path) -> str:
    try:
        return lock_path.read_text(encoding="utf-8")
    except OSError:
        return "<illisible>"


def release_lock(lock_path: Path, token: str) -> None:
    """Ne libère QUE si le verrou nous appartient (protège d'un verrou recréé par
    un autre process après un force-unlock concurrent)."""
    try:
        content = json.loads(lock_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    if content.get("token") == token:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Registre de session = SSoT (liaison complète — finding Sol #2)
# ─────────────────────────────────────────────────────────────────────────────
def session_binding_hashes() -> dict:
    out = {}
    for label, rel in (
        ("agents_md", "AGENTS.md"),
        ("codex_config", ".codex/config.toml"),
        ("wrapper", "scripts/audit_bridge.py"),
    ):
        p = ROOT / rel
        out[label] = _sha256_file(p) if p.exists() else None
    out["cli_version"] = cli_version()
    return out


def load_or_create_session(
    chantier_dir: Path,
    *,
    model: str,
    effort: str,
    current_head: str,
    mode: str,
    requested_thread: str | None,
    repo: str,
    branch: str,
) -> dict:
    """Charge le registre SESSION.json ou le crée. Le registre est la SSoT :
    modèle/effort/dépôt/branche/hashes/version CLI liés ; `new` seulement sans
    thread enregistré, `resume` seulement avec le thread EXACT.
    """
    chantier_dir.mkdir(parents=True, exist_ok=True)
    session_path = chantier_dir / "SESSION.json"
    binding = session_binding_hashes()

    if session_path.exists():
        reg = json.loads(session_path.read_text(encoding="utf-8"))
        mismatches = []
        if reg.get("model") != model:
            mismatches.append(f"modèle {reg.get('model')} != {model}")
        if reg.get("effort") != effort:
            mismatches.append(f"effort {reg.get('effort')} != {effort}")
        if reg.get("repo") != repo:
            mismatches.append("dépôt canonique différent")
        if reg.get("branch") != branch:
            mismatches.append(f"branche {reg.get('branch')} != {branch}")
        for key, val in binding.items():
            if reg.get("binding", {}).get(key) != val:
                mismatches.append(f"{key} a changé depuis l'ouverture de session")
        if mismatches:
            raise BridgeError(
                "liaison de session rompue -> il faut une NOUVELLE session (jamais "
                "resume) : " + " ; ".join(mismatches)
            )
        stored_thread = reg.get("thread_id")
        if mode == "new" and stored_thread:
            raise BridgeError(
                "cette session a déjà un thread enregistré -> utiliser resume, pas new "
                "(le registre est la source de vérité)."
            )
        if mode == "resume":
            if not stored_thread:
                raise BridgeError("resume impossible : aucun thread enregistré (faire un new d'abord).")
            if requested_thread != stored_thread:
                raise BridgeError(
                    f"resume : thread demandé {requested_thread!r} != enregistré {stored_thread!r}."
                )
        return reg

    if mode == "resume":
        raise BridgeError("resume impossible : session inexistante (faire un new d'abord).")
    reg = {
        "chantier": chantier_dir.name,
        "model": model,
        "effort": effort,
        "repo": repo,
        "branch": branch,
        "base_sha": lot_base_sha(current_head),
        "binding": binding,
        "thread_id": None,
        "created_ts": time.time(),
    }
    session_path.write_text(json.dumps(reg, indent=2), encoding="utf-8")
    return reg


def save_session_thread(chantier_dir: Path, thread_id: str) -> None:
    session_path = chantier_dir / "SESSION.json"
    reg = json.loads(session_path.read_text(encoding="utf-8"))
    reg["thread_id"] = thread_id
    session_path.write_text(json.dumps(reg, indent=2), encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Construction de la commande codex (prompt via stdin)
# ─────────────────────────────────────────────────────────────────────────────
def build_command(
    *, model: str, effort: str, mode: str, thread_id: str | None, response_path: Path
) -> list[str]:
    if effort not in VALID_EFFORTS:
        raise BridgeError(f"effort {effort!r} invalide (attendu : {sorted(VALID_EFFORTS)}).")
    effort_override = f'model_reasoning_effort="{effort}"'
    if mode == "new":
        return [
            "codex", "exec", "-C", str(ROOT), "--model", model,
            "-c", effort_override, "--sandbox", "read-only", "--strict-config",
            "--json", "-o", str(response_path), "-",
        ]
    if mode == "resume":
        if not thread_id:
            raise BridgeError("mode resume : thread_id requis.")
        # `resume` refuse -C (dépôt mémorisé) MAIS accepte --model (CLI 0.144.1) : on
        # réimpose EXPLICITEMENT le modèle (le demandé fait foi, symétrie avec `new`)
        # + la lecture seule par overrides -c + --strict-config.
        return [
            "codex", "exec", "resume", thread_id,
            "--model", model,
            "-c", effort_override, "-c", 'sandbox_mode="read-only"',
            "-c", 'approval_policy="never"', "--strict-config",
            "--json", "-o", str(response_path), "-",
        ]
    raise BridgeError(f"mode {mode!r} inconnu (new|resume).")


# ─────────────────────────────────────────────────────────────────────────────
# Orchestrateur d'un tour d'audit
# ─────────────────────────────────────────────────────────────────────────────
def run_audit(
    *,
    chantier: str,
    model: str,
    effort: str,
    prompt: str,
    mode: str = "new",
    thread_id: str | None = None,
    force_unlock: bool = False,
    timeout_s: int = 900,
    runner=None,
) -> dict:
    """Exécute UN tour d'audit et écrit les artefacts. Retourne le manifeste.

    `runner(argv, stdin_text, timeout_s)` est injectable (défaut : subprocess réel).
    """
    chantier = sanitize_name(chantier)
    if model not in MODEL_IDENTITY:
        raise BridgeError(f"modèle {model!r} non désigné (aucun défaut silencieux).")
    if effort not in VALID_EFFORTS:
        raise BridgeError(f"effort {effort!r} invalide.")
    if mode not in {"new", "resume"}:
        raise BridgeError(f"mode {mode!r} inconnu (new|resume).")

    chantier_dir = BRIDGE_ROOT / chantier

    # 1. Pré-vol : snapshot git, arbre propre HORS bridge, branche feat/.
    snap = git_snapshot()
    assert_feat_branch(snap["branch"])
    if not snap["clean"]:
        raise BridgeError(
            "arbre git NON propre (hors audits/bridge/) — committer un checkpoint "
            "sur la branche feat/ avant d'auditer (snapshot immuable exigé)."
        )
    target_sha = snap["head"]
    branch = snap["branch"]

    # 2. VERROU d'abord (avant toute lecture/écriture du registre — finding Sol #4).
    lock_path, token = acquire_lock(chantier_dir, thread_id, force_unlock)
    try:
        reg = load_or_create_session(
            chantier_dir, model=model, effort=effort, current_head=target_sha,
            mode=mode, requested_thread=thread_id, repo=str(ROOT), branch=branch,
        )
        nn = next_turn_number(chantier_dir)
        work = chantier_dir / f".tmp_{nn}"
        if work.exists():
            raise BridgeError(f"répertoire de travail résiduel {work} — nettoyer d'abord.")
        work.mkdir(parents=True)

        identity = build_identity_line(model)
        full_prompt = f"{identity}\n\n{prompt}"
        request_path = work / "REQUEST.md"
        response_path = work / "RESPONSE.md"
        request_path.write_text(full_prompt, encoding="utf-8")
        argv = build_command(
            model=model, effort=effort, mode=mode,
            thread_id=thread_id, response_path=response_path,
        )
        common = {
            "nn": nn, "chantier": chantier, "model_requested": model,
            "requested_effort": effort, "mode": mode, "thread_id_requested": thread_id,
            "base_sha": reg.get("base_sha"), "target_sha": target_sha,
            "cli_version": reg["binding"]["cli_version"], "argv": argv,
            "identity_injected": identity, "binding": reg["binding"],
        }

        # 3. Appel bloquant — toute défaillance est ARCHIVÉE (finding Sol #5).
        run = runner or _default_runner
        try:
            result = run(argv, full_prompt, timeout_s)
        except subprocess.TimeoutExpired as exc:
            return _archive_failure(
                work, chantier_dir, nn, common,
                status="INVALID", reason=f"timeout après {timeout_s}s (process tué)",
                partial_stdout=exc.stdout, partial_stderr=exc.stderr,
            )
        except Exception as exc:  # noqa: BLE001 — on archive toute défaillance runner
            return _archive_failure(
                work, chantier_dir, nn, common,
                status="INVALID", reason=f"exception runner : {type(exc).__name__}: {exc}",
            )

        events_text = result.stdout or ""
        stderr_text = result.stderr or ""
        (work / "EVENTS.jsonl").write_text(events_text, encoding="utf-8")
        (work / "STDERR.txt").write_text(stderr_text, encoding="utf-8")

        # 4. Porte de validité (présence POSITIVE des preuves — finding Sol #3).
        parsed = parse_events(events_text)
        response_text = response_path.read_text(encoding="utf-8") if response_path.exists() else ""
        status, reasons = _validity_gate(
            result=result, parsed=parsed, response_text=response_text,
            model=model, mode=mode, requested_thread=thread_id,
        )

        # 5. Deuxième vérif : SHA, branche, arbre propre hors bridge (findings #1 + B).
        snap_after = git_snapshot()
        if (snap_after["head"] != target_sha or snap_after["branch"] != branch
                or not snap_after["clean"]):
            status = "INVALID"
            reasons.append("SHA/branche/arbre modifié pendant l'appel (snapshot rompu).")

        # 6. Scan secrets sur TOUS les bruts, stderr inclus (finding Sol #6).
        # Le statut AVANT quarantaine est conservé : la quarantaine est une décision
        # sur les FICHIERS (ne rien versionner de brut), pas un jugement sur la
        # qualité du tour — et c'est lui qui décide si le fil est enregistrable.
        secret_hits = scan_secrets(full_prompt, response_text, events_text, stderr_text)
        status_hors_quarantaine = status
        if secret_hits:
            status = "QUARANTINED"
            reasons.append(f"secret potentiel détecté : {secret_hits}")

        # 7. Manifeste (écrit EN DERNIER, dans le répertoire de travail).
        manifest = {
            **common,
            "status": status,
            "status_hors_quarantaine": status_hors_quarantaine,
            "reasons": reasons,
            "model_observed": parsed["model"],
            "observed_effort": None,  # non exposé par le CLI (honnête, distinct du demandé)
            "thread_id_observed": parsed["thread_id"],
            "clean_before": snap["clean"],
            "clean_after": snap_after["clean"],
            "exit_code": result.returncode,
            "artifact_sha256": {
                p.name: _sha256_file(p) for p in sorted(work.iterdir()) if p.is_file()
            },
            "created_ts": time.time(),
        }
        (work / "MANIFEST.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        # 8. Promotion ATOMIQUE d'un répertoire (finding Sol #7), quarantaine hors git.
        if status == "QUARANTINED":
            _promote(work, chantier_dir / "_QUARANTINE", nn)
        else:
            _promote(work, chantier_dir, nn)
        # 9. Le FIL survit à la quarantaine (finding Sol 2026-07-29). Avant, le
        # thread n'était enregistré que sur un tour promu : une quarantaine — même
        # sur faux positif — condamnait tout `resume` et faisait perdre le fil
        # d'audit entier (vécu sur Lot 108 T1b tour 1). On enregistre donc sur le
        # statut HORS quarantaine : le tour reste QUARANTINED dans son manifeste,
        # ce n'est pas un GO déguisé, mais la session reste reprenable. Un tour
        # réellement cassé (FAILED/INVALID) ne lie toujours aucun thread.
        if status_hors_quarantaine == "VALID" and mode == "new" and parsed["thread_id"]:
            save_session_thread(chantier_dir, parsed["thread_id"])
        return manifest
    finally:
        release_lock(lock_path, token)


def _validity_gate(*, result, parsed, response_text, model, mode, requested_thread):
    """(status, reasons). VALID exige la PRÉSENCE POSITIVE de chaque preuve promise."""
    reasons: list[str] = []
    if result.returncode != 0:
        reasons.append(f"exit code {result.returncode} != 0")
    if parsed["malformed"]:
        reasons.append("JSONL malformé / ligne non-JSON")
    if not parsed["has_turn_completed"]:
        reasons.append("aucun événement terminal turn.completed")
    if parsed["has_terminal_failure"]:
        reasons.append("événement turn.failed / error présent")
    if not (response_text and response_text.strip()):
        reasons.append("RESPONSE.md vide")
    if not parsed["last_agent_message"]:
        reasons.append("aucun agent_message dans le JSONL (preuve absente)")
    elif response_text.strip() != parsed["last_agent_message"].strip():
        reasons.append("RESPONSE.md != dernier agent_message du JSONL")
    # Le CLI codex n'émet PAS le modèle dans le JSONL (prouvé end-to-end 2026-07-24 :
    # seuls thread.started / item.* / turn.completed). Le modèle DEMANDÉ fait foi
    # (argv --model, validé ; codex échoue sur un modèle inconnu). On ne bloque donc
    # que sur une CONTRADICTION explicite si le CLI venait à l'émettre, jamais sur l'absence.
    if parsed["model"] and parsed["model"] != model:
        reasons.append(f"modèle observé {parsed['model']} != demandé {model}")
    if not parsed["thread_id"]:
        reasons.append("thread_id absent du JSONL")
    elif mode == "resume" and requested_thread and parsed["thread_id"] != requested_thread:
        reasons.append(f"thread_id observé {parsed['thread_id']} != demandé {requested_thread}")
    status = "VALID" if not reasons else "FAILED"
    return status, reasons


def _as_text(value) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def _archive_failure(work: Path, chantier_dir: Path, nn: int, common: dict,
                     *, status: str, reason: str,
                     partial_stdout=None, partial_stderr=None) -> dict:
    """Archive une défaillance (timeout/exception). Conserve les sorties PARTIELLES
    disponibles ET passe par le MÊME scan de secrets / quarantaine que le chemin
    normal avant toute promotion (findings Sol tour 3 #5/#6)."""
    out, err = _as_text(partial_stdout), _as_text(partial_stderr)
    if out:
        (work / "EVENTS.jsonl").write_text(out, encoding="utf-8")
    if err:
        (work / "STDERR.txt").write_text(err, encoding="utf-8")

    # Scan de TOUT le brut disponible + le motif d'exception, AVANT promotion.
    scan_texts = [reason]
    for name in ("REQUEST.md", "RESPONSE.md", "EVENTS.jsonl", "STDERR.txt"):
        p = work / name
        if p.exists():
            scan_texts.append(p.read_text(encoding="utf-8"))
    reasons = [reason]
    if scan_secrets(*scan_texts):
        status = "QUARANTINED"
        reasons.append(f"secret potentiel détecté : {scan_secrets(*scan_texts)}")

    manifest = {
        **common, "status": status, "reasons": reasons,
        "model_observed": None, "observed_effort": None, "thread_id_observed": None,
        "exit_code": None,
        "artifact_sha256": {
            p.name: _sha256_file(p) for p in sorted(work.iterdir()) if p.is_file()
        },
        "created_ts": time.time(),
    }
    (work / "MANIFEST.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    if status == "QUARANTINED":
        _promote(work, chantier_dir / "_QUARANTINE", nn)
    else:
        _promote(work, chantier_dir, nn)
    return manifest


def _promote(work: Path, parent_dir: Path, nn: int) -> None:
    """Promotion ATOMIQUE : un seul rename du répertoire de travail vers `NN/`.

    Anti-écrasement : refuse si la destination existe (un NN ne se réutilise jamais).
    """
    parent_dir.mkdir(parents=True, exist_ok=True)
    dest = parent_dir / str(nn)
    if dest.exists():
        raise BridgeError(f"collision de promotion : {dest} existe déjà (NN réutilisé ?).")
    os.rename(str(work), str(dest))


def _default_runner(argv: list[str], stdin_text: str, timeout_s: int):
    """Runner subprocess réel (jamais utilisé en test — les tests injectent un mock).

    `subprocess.run(timeout=...)` tue le process enfant à l'échéance ; sur Windows,
    d'éventuels petits-enfants ne sont pas garantis tués (limite V1 documentée).
    """
    return subprocess.run(
        argv, input=stdin_text, capture_output=True, text=True,
        encoding="utf-8", timeout=timeout_s, cwd=str(ROOT),
    )


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pont d'audit Claude <-> Codex (V1).")
    parser.add_argument("--chantier", required=True)
    parser.add_argument("--model", required=True, choices=sorted(MODEL_IDENTITY))
    parser.add_argument("--effort", required=True, choices=sorted(VALID_EFFORTS),
                        help="TOUJOURS explicite (défaut CLI = low).")
    parser.add_argument("--prompt-file", required=True, type=Path)
    parser.add_argument("--mode", choices=("new", "resume"), default="new")
    parser.add_argument("--thread-id", default=None)
    parser.add_argument("--force-unlock", action="store_true")
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args(argv)

    prompt = args.prompt_file.read_text(encoding="utf-8")
    try:
        manifest = run_audit(
            chantier=args.chantier, model=args.model, effort=args.effort,
            prompt=prompt, mode=args.mode, thread_id=args.thread_id,
            force_unlock=args.force_unlock, timeout_s=args.timeout,
        )
    except BridgeError as exc:
        print(f"[bridge] BLOQUÉ : {exc}", file=sys.stderr)
        return 2

    print(json.dumps(
        {k: manifest[k] for k in ("nn", "status", "reasons", "thread_id_observed")},
        ensure_ascii=False, indent=2,
    ))
    return 0 if manifest["status"] == "VALID" else 1


if __name__ == "__main__":
    raise SystemExit(main())
