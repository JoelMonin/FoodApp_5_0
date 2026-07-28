"""Pont d'audit Claude <-> Codex (V1 sobre) — `scripts/audit_bridge.py`.
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
BRIDGE_REL = "audits/bridge/"

MODEL_IDENTITY = {
    "gpt-5.6-sol": "Codex 5.6 Sol",
    "gpt-5.6-terra": "Codex 5.6 Terra",
    "gpt-5.6-luna": "Codex 5.6 Luna",
}
VALID_EFFORTS = {"low", "medium", "high", "xhigh", "max", "ultra"}

SECRET_PATTERNS = [
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),
    re.compile(r"ghp_[A-Za-z0-9]{30,}"),
    re.compile(r"xox[baprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
]


class BridgeError(RuntimeError):
    """Erreur bloquante du pont : arrête proprement AVANT toute dépense de tokens."""


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha256_file(path: Path) -> str:
    return _sha256_bytes(path.read_bytes())


def sanitize_name(name: str) -> str:
    if not name or not re.fullmatch(r"[A-Za-z0-9._-]+", name) or name in {".", ".."}:
        raise BridgeError(
            f"nom invalide {name!r} : seuls [A-Za-z0-9._-] sont autorisés."
        )
    return name


def build_identity_line(model: str) -> str:
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
    hits = []
    for text in texts:
        for pat in SECRET_PATTERNS:
            if pat.search(text or ""):
                hits.append(pat.pattern)
    return sorted(set(hits))


def next_turn_number(chantier_dir: Path) -> int:
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


def _git(*args: str) -> str:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args], text=True, encoding="utf-8"
    ).strip()


def git_snapshot() -> dict:
    porcelain = subprocess.check_output(
        ["git", "-C", str(ROOT), "status", "--porcelain"], text=True, encoding="utf-8"
    )
    return {
        "branch": _git("rev-parse", "--abbrev-ref", "HEAD"),
        "head": _git("rev-parse", "HEAD"),
        "clean": clean_outside_bridge(porcelain),
    }


def lot_base_sha(head: str) -> str:
    try:
        return _git("merge-base", "master", "HEAD")
    except subprocess.CalledProcessError:
        try:
            return _git("merge-base", "main", "HEAD")
        except subprocess.CalledProcessError:
            return head


def assert_feat_branch(branch: str) -> None:
    if branch in {"master", "main"} or not branch.startswith("feat/"):
        raise BridgeError(
            f"branche {branch!r} interdite : le pont n'audite que sur une branche "
            "feat/, jamais la branche par défaut."
        )


def cli_version() -> str:
    try:
        return subprocess.check_output(
            ["codex", "--version"], text=True, encoding="utf-8"
        ).strip()
    except Exception:
        return "unknown"


def acquire_lock(chantier_dir: Path, thread_id: str | None, force_unlock: bool):
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
                f"verrou de session déjà présent : {existing}."
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
    try:
        content = json.loads(lock_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return
    if content.get("token") == token:
        try:
            lock_path.unlink()
        except FileNotFoundError:
            pass


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
                "liaison de session rompue : " + " ; ".join(mismatches)
            )
        stored_thread = reg.get("thread_id")
        if mode == "new" and stored_thread:
            raise BridgeError(
                "cette session a déjà un thread enregistré -> utiliser resume."
            )
        if mode == "resume":
            if not stored_thread:
                raise BridgeError("resume impossible : aucun thread enregistré.")
            if requested_thread != stored_thread:
                raise BridgeError(
                    f"resume : thread demandé {requested_thread!r} != enregistré {stored_thread!r}."
                )
        return reg

    if mode == "resume":
        raise BridgeError("resume impossible : session inexistante.")
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


def build_command(
    *, model: str, effort: str, mode: str, thread_id: str | None, response_path: Path
) -> list[str]:
    if effort not in VALID_EFFORTS:
        raise BridgeError(f"effort {effort!r} invalide.")
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
        return [
            "codex", "exec", "resume", thread_id,
            "--model", model,
            "-c", effort_override, "-c", 'sandbox_mode="read-only"',
            "-c", 'approval_policy="never"', "--strict-config",
            "--json", "-o", str(response_path), "-",
        ]
    raise BridgeError(f"mode {mode!r} inconnu.")


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
    chantier = sanitize_name(chantier)
    if model not in MODEL_IDENTITY:
        raise BridgeError(f"modèle {model!r} non désigné.")
    if effort not in VALID_EFFORTS:
        raise BridgeError(f"effort {effort!r} invalide.")
    if mode not in {"new", "resume"}:
        raise BridgeError(f"mode {mode!r} inconnu.")

    chantier_dir = BRIDGE_ROOT / chantier

    snap = git_snapshot()
    assert_feat_branch(snap["branch"])
    if not snap["clean"]:
        raise BridgeError(
            "arbre git NON propre (hors audits/bridge/)."
        )
    target_sha = snap["head"]
    branch = snap["branch"]

    lock_path, token = acquire_lock(chantier_dir, thread_id, force_unlock)
    try:
        reg = load_or_create_session(
            chantier_dir, model=model, effort=effort, current_head=target_sha,
            mode=mode, requested_thread=thread_id, repo=str(ROOT), branch=branch,
        )
        nn = next_turn_number(chantier_dir)
        work = chantier_dir / f".tmp_{nn}"
        if work.exists():
            raise BridgeError(f"répertoire de travail résiduel {work}.")
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

        run = runner or _default_runner
        try:
            result = run(argv, full_prompt, timeout_s)
        except subprocess.TimeoutExpired as exc:
            return _archive_failure(
                work, chantier_dir, nn, common,
                status="INVALID", reason=f"timeout après {timeout_s}s",
                partial_stdout=exc.stdout, partial_stderr=exc.stderr,
            )
        except Exception as exc:
            return _archive_failure(
                work, chantier_dir, nn, common,
                status="INVALID", reason=f"exception runner : {type(exc).__name__}: {exc}",
            )

        events_text = result.stdout or ""
        stderr_text = result.stderr or ""
        (work / "EVENTS.jsonl").write_text(events_text, encoding="utf-8")
        (work / "STDERR.txt").write_text(stderr_text, encoding="utf-8")

        parsed = parse_events(events_text)
        response_text = response_path.read_text(encoding="utf-8") if response_path.exists() else ""
        status, reasons = _validity_gate(
            result=result, parsed=parsed, response_text=response_text,
            model=model, mode=mode, requested_thread=thread_id,
        )

        snap_after = git_snapshot()
        if (snap_after["head"] != target_sha or snap_after["branch"] != branch
                or not snap_after["clean"]):
            status = "INVALID"
            reasons.append("SHA/branche/arbre modifié pendant l'appel.")

        secret_hits = scan_secrets(full_prompt, response_text, events_text, stderr_text)
        if secret_hits:
            status = "QUARANTINED"
            reasons.append(f"secret potentiel détecté : {secret_hits}")

        manifest = {
            **common,
            "status": status,
            "reasons": reasons,
            "model_observed": parsed["model"],
            "observed_effort": None,
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

        if status == "QUARANTINED":
            _promote(work, chantier_dir / "_QUARANTINE", nn)
        else:
            _promote(work, chantier_dir, nn)
            if status == "VALID" and mode == "new" and parsed["thread_id"]:
                save_session_thread(chantier_dir, parsed["thread_id"])
        return manifest
    finally:
        release_lock(lock_path, token)


def _validity_gate(*, result, parsed, response_text, model, mode, requested_thread):
    reasons: list[str] = []
    if result.returncode != 0:
        reasons.append(f"exit code {result.returncode} != 0")
    if parsed["malformed"]:
        reasons.append("JSONL malformé")
    if not parsed["has_turn_completed"]:
        reasons.append("aucun événement terminal turn.completed")
    if parsed["has_terminal_failure"]:
        reasons.append("événement turn.failed / error présent")
    if not (response_text and response_text.strip()):
        reasons.append("RESPONSE.md vide")
    if not parsed["last_agent_message"]:
        reasons.append("aucun agent_message dans le JSONL")
    elif response_text.strip() != parsed["last_agent_message"].strip():
        reasons.append("RESPONSE.md != dernier agent_message du JSONL")
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
    out, err = _as_text(partial_stdout), _as_text(partial_stderr)
    if out:
        (work / "EVENTS.jsonl").write_text(out, encoding="utf-8")
    if err:
        (work / "STDERR.txt").write_text(err, encoding="utf-8")

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
    parent_dir.mkdir(parents=True, exist_ok=True)
    dest = parent_dir / str(nn)
    if dest.exists():
        raise BridgeError(f"collision de promotion : {dest} existe déjà.")
    os.rename(str(work), str(dest))


def _default_runner(argv: list[str], stdin_text: str, timeout_s: int):
    return subprocess.run(
        argv, input=stdin_text, capture_output=True, text=True,
        encoding="utf-8", timeout=timeout_s, cwd=str(ROOT),
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Pont d'audit Claude <-> Codex (V1).")
    parser.add_argument("--chantier", required=True)
    parser.add_argument("--model", required=True, choices=sorted(MODEL_IDENTITY))
    parser.add_argument("--effort", required=True, choices=sorted(VALID_EFFORTS))
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
