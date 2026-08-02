"""Tests du pont d'audit Claude <-> Codex (`scripts/audit_bridge.py`).

RUNTIME, jamais de faux-verrou : on teste le COMPORTEMENT (porte de validité,
verrou, snapshot, liaison de session, quarantaine, archivage des défaillances),
pas la présence de littéraux. Aucun appel réseau ni `codex` réel : le runner
subprocess est injecté (mock) et git/CLI sont monkeypatchés. Aucune écriture hors
tmp_path (BRIDGE_ROOT est redirigé).

Couverture des findings de bootstrap Sol (tour 2) : #1 (session ne salit pas le
tour), #2 (liaison SSoT), #3 (présence positive), #4 (verrou avant registre),
#5 (timeout/exception archivés), #6 (secret stderr), #7 (promotion atomique/dir).
"""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

import scripts.audit_bridge as ab


# ─────────────────────────────────────────────────────────────────────────────
# Fonctions pures
# ─────────────────────────────────────────────────────────────────────────────
def test_sanitize_name_ok():
    assert ab.sanitize_name("pont-audit-codex_v1.2") == "pont-audit-codex_v1.2"


@pytest.mark.parametrize("bad", ["", "../etc", "a/b", "a b", ".", "..", "x\\y"])
def test_sanitize_name_rejette_traversal(bad):
    with pytest.raises(ab.BridgeError):
        ab.sanitize_name(bad)


def test_build_identity_depuis_modele():
    assert "Codex 5.6 Sol" in ab.build_identity_line("gpt-5.6-sol")
    assert "Codex 5.6 Terra" in ab.build_identity_line("gpt-5.6-terra")


def test_build_identity_modele_inconnu_leve():
    with pytest.raises(ab.BridgeError):
        ab.build_identity_line("gpt-4o")


def test_clean_outside_bridge_ignore_les_artefacts_du_pont():
    # Finding #1 : les fichiers du pont ne salissent PAS le tour.
    only_bridge = "?? audits/bridge/demo/SESSION.json\n A audits/bridge/demo/1/MANIFEST.json\n"
    assert ab.clean_outside_bridge(only_bridge) is True


def test_clean_outside_bridge_detecte_une_modif_de_code():
    assert ab.clean_outside_bridge(" M modules/pipeline_synthesis.py\n") is False
    assert ab.clean_outside_bridge('R  a.py -> modules/b.py\n') is False


def test_parse_events_happy():
    events = "\n".join([
        json.dumps({"type": "thread.started", "thread_id": "abc-123", "model": "gpt-5.6-sol"}),
        json.dumps({"type": "agent_message", "message": "Mon audit."}),
        json.dumps({"type": "turn.completed"}),
    ])
    p = ab.parse_events(events)
    assert p["thread_id"] == "abc-123"
    assert p["model"] == "gpt-5.6-sol"
    assert p["has_turn_completed"] is True
    assert p["last_agent_message"] == "Mon audit."
    assert p["malformed"] is False


def test_parse_events_detecte_echec_et_malforme():
    p = ab.parse_events('{"type":"turn.failed"}\nPAS_JSON\n')
    assert p["has_terminal_failure"] is True
    assert p["malformed"] is True
    assert p["has_turn_completed"] is False


def test_scan_secrets():
    assert ab.scan_secrets("clé sk-ABCDEFGHIJKLMNOPQRSTUVWX ici")
    assert ab.scan_secrets("audit normal") == []


# ─────────────────────────────────────────────────────────────────────────────
# Détecteur de secrets — frontière de mot (chantier pont, 2026-07-29)
#
# INCIDENT FONDATEUR : au tour 1 de l'audit Lot 108 T1b, le motif OpenAI
# `sk-[A-Za-z0-9]{20,}` a matché AU MILIEU d'une URL de redirection Gemini
# (`…Qk81mRVUkiP5sk-hIyimS9lq…`) présente dans le cache IA du dépôt et recopiée
# dans la TRACE de l'appel. Conséquence en chaîne : réponse mise en quarantaine
# -> aucun `thread_id` enregistré -> `resume` définitivement impossible -> les
# tours suivants ont dû repartir en fil neuf. Un faux positif du détecteur coûte
# donc un FIL D'AUDIT ENTIER, pas seulement une alerte à ignorer.
#
# Correctif : les 4 motifs de JETON ne matchent que s'ils COMMENCENT un mot.
# Le motif `-----BEGIN … PRIVATE KEY-----` est laissé tel quel (il commence par
# un tiret : une frontière de mot n'y a aucun sens).
#
# Ces tests sont RUNTIME : ils interrogent `scan_secrets`, jamais le littéral du
# motif — le jour où l'implémentation change, ils continuent de dire la vérité.
# ─────────────────────────────────────────────────────────────────────────────

# Jetons FACTICES (jamais de vraie clé dans le dépôt). Un par PRÉFIXE OFFICIEL
# documenté des familles que le pont a choisi de surveiller.
#
# Trou fermé sur finding Sol du 2026-07-29 : ne connaître que `ghp_` laissait
# passer le jeton GitHub le plus courant aujourd'hui (`github_pat_`, granulaire)
# et tous les jetons d'application (`gho_`/`ghu_`/`ghs_`/`ghr_`). Trou de la MÊME
# famille trouvé dans la foulée par mon propre balayage : `sk-[A-Za-z0-9]{20,}`
# s'arrêtait au premier tiret, donc `sk-proj-…` (OpenAI) et `sk-ant-…`
# (Anthropic) — les deux formats ACTUELS — n'étaient pas vus non plus.
_JETONS_FACTICES = {
    "openai classique": "sk-" + "Th1sIsNotARealKey00000000",
    "openai projet": "sk-proj-" + "Th1sIsNotARealKey00000000",
    "anthropic": "sk-ant-api03-" + "Th1sIsNotARealKey00000000",
    "google": "AIza" + "Sy0FauxJeton_pour_tests-0123456789",
    "github pat classique": "ghp_" + "0FauxJetonGithubPourTests0123456789",
    "github pat granulaire": "github_pat_" + "0FauxJetonGithubPourTests0123456789",
    "github oauth": "gho_" + "0FauxJetonGithubPourTests0123456789",
    "github user-to-server": "ghu_" + "0FauxJetonGithubPourTests0123456789",
    "github server-to-server": "ghs_" + "0FauxJetonGithubPourTests0123456789",
    "github refresh": "ghr_" + "0FauxJetonGithubPourTests0123456789",
    "slack bot": "xoxb-" + "0000000000-0000000000-FauxJetonSlack",
    "slack refresh": "xoxe-" + "0000000000-0000000000-FauxJetonSlack",
    "slack application": "xapp-" + "1-A00000000-0000000000-FauxJetonSlack",
    "slack workflow": "xwfp-" + "0000000000-0000000000-FauxJetonSlack",
}

# Les 6 façons dont une clé fuite RÉELLEMENT dans un log, un prompt ou un JSONL.
_CONTEXTES_DE_FUITE = {
    "début de ligne": "{tok}\nsuite du journal",
    "variable d'environnement": "OPENAI_API_KEY={tok}",
    "en-tête HTTP": "Authorization: Bearer {tok}",
    "champ JSON": '{{"api_key": "{tok}"}}',
    "argument de ligne de commande": "codex exec --key {tok} --json",
    "milieu de phrase": "la clé est {tok} et elle ne doit pas être publiée",
}


@pytest.mark.parametrize("famille", sorted(_JETONS_FACTICES))
@pytest.mark.parametrize("contexte", sorted(_CONTEXTES_DE_FUITE))
def test_une_fuite_reste_detectee_dans_tous_les_contextes_reels(famille, contexte):
    """Garde ANTI-SUR-CORRECTION : resserrer le motif ne doit rien laisser passer."""
    texte = _CONTEXTES_DE_FUITE[contexte].format(tok=_JETONS_FACTICES[famille])
    assert ab.scan_secrets(texte), f"fuite {famille} manquée en contexte {contexte!r}"


# Fragment RÉEL mesuré dans `audits/bridge/lot108-t1b/_QUARANTINE/1/EVENTS.jsonl`
# (portion opaque d'une URL `grounding-api-redirect` Gemini, stockée en clair dans
# `ai_cache`). Ce n'est PAS un secret : c'est un identifiant de redirection public.
_FRAGMENT_URL_REEL = (
    "https://vertexaisearch.cloud.google.com/grounding-api-redirect/"
    "AUZIYQG-NxWEugI56DEPr738A0nPmlEJaBCYjJ1pnJhyvqw5LvXiOgyQk81mRVUkiP5sk-"
    "hIyimS9lqljAhRSP9dpXr5a-IEAg_ioQnTL6CZmqtJw"
)


def test_une_url_de_redirection_gemini_ne_declenche_plus_la_quarantaine():
    """L'incident exact du tour 1 T1b : reproduit à l'identique, doit être propre."""
    assert ab.scan_secrets(_FRAGMENT_URL_REEL) == []


# URL RÉELLE présente dans la table `news_articles` du dépôt. « SK Hynix » est un
# fabricant de puces : le sujet revient en permanence dans l'actualité ETF, donc
# ce piège n'a rien d'exceptionnel — il reviendrait à chaque tour d'audit.
_URL_ARTICLE_SK_HYNIX = (
    "https://seekingalpha.com/article/4922846-sk-hynix-has-room-for-another-leg-up"
)


def test_le_nom_d_une_societe_dans_une_url_n_est_pas_une_cle():
    """Régression MESURÉE sur données réelles pendant ce chantier.

    En élargissant le corps du motif `sk-` aux tirets (pour couvrir `sk-proj-` et
    `sk-ant-`), j'ai fabriqué un faux positif tout neuf sur cette URL. C'est
    exactement le risque que l'audit annonçait. Les formats modernes sont
    désormais couverts par sous-préfixe NOMMÉ, pas par un joker.
    """
    assert ab.scan_secrets(_URL_ARTICLE_SK_HYNIX) == []


@pytest.mark.parametrize("famille", sorted(_JETONS_FACTICES))
def test_un_jeton_colle_a_du_texte_alphanumerique_n_est_pas_une_fuite(famille):
    """Généralisation de l'incident : la garde vaut pour les 4 familles, pas que `sk-`."""
    assert ab.scan_secrets("Qk81mRVUkiP5" + _JETONS_FACTICES[famille]) == []


@pytest.mark.parametrize("prefixe", ["CLE_", "--key=", "-"])
@pytest.mark.parametrize("famille", sorted(_JETONS_FACTICES))
def test_apres_un_souligne_ou_un_tiret_la_fuite_reste_vue(famille, prefixe):
    """ARBITRAGE ASSUMÉ, dans les DEUX sens (finding Sol [DURCISSEMENT] 2026-07-29).

    La garde exclut `[A-Za-z0-9]` et volontairement PAS `_` ni `-`.
    · Gain : `CLE_sk-…`, `--key=sk-…`, `-sk-…` restent détectés. Avec un simple
      `\\b`, `_` est un caractère de mot : `CLE_sk-…` deviendrait INVISIBLE.
    · Prix, que je ne masque pas : un identifiant opaque d'URL contenant `_sk-`
      ou `-sk-` déclenche encore une fausse quarantaine. La garde ferme
      l'incident RÉEL mesuré, pas toute la classe des collisions d'URL.
    """
    assert ab.scan_secrets(prefixe + _JETONS_FACTICES[famille])


def test_le_motif_de_cle_privee_n_est_pas_touche_par_la_garde():
    """`-----BEGIN … PRIVATE KEY-----` commence par un tiret : aucune frontière de
    mot à lui appliquer. Il doit rester détecté même collé à du texte.
    """
    assert ab.scan_secrets("dump-----BEGIN RSA PRIVATE KEY-----MIIE")


@pytest.mark.parametrize("famille", sorted(_JETONS_FACTICES))
def test_une_fuite_va_jusqu_a_la_quarantaine_pour_chaque_famille(famille, bridge_env):
    """Exigence de clôture du NO-GO Sol : le verrou ne s'arrête pas à `scan_secrets`,
    il traverse le chemin COMPLET `run_audit` -> quarantaine -> rien de brut versionné.
    """
    jeton = _JETONS_FACTICES[famille]
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="audit normal",
                     runner=_make_runner("GO", _valid_events(message="GO"),
                                         stderr=f"GITHUB_TOKEN={jeton}"))
    assert m["status"] == "QUARANTINED", f"famille {famille} promue hors quarantaine"
    cdir = bridge_env / "bridge" / "demo"
    assert (cdir / "_QUARANTINE" / "1").is_dir()
    assert not (cdir / "1").exists()  # aucun brut versionnable


def test_la_quarantaine_ne_detruit_plus_le_fil_de_discussion(bridge_env):
    """Finding Sol [DURCISSEMENT] 2026-07-29 — la panne qui a motivé tout ce chantier.

    Mettre des artefacts au coffre est une décision sur les FICHIERS ; ça ne doit
    pas condamner la SESSION. Avant ce correctif, le `thread_id` n'était
    enregistré que sur un tour `VALID` : une quarantaine rendait tout `resume`
    définitivement impossible et le fil d'audit était perdu (vécu en réel sur
    Lot 108 T1b, tour 1). Le tour reste QUARANTINED — ce n'est PAS un GO déguisé.
    """
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="x",
                     runner=_make_runner("GO", _valid_events(thread_id="thr-7", message="GO"),
                                         stderr="fuite " + _JETONS_FACTICES["github pat classique"]))
    assert m["status"] == "QUARANTINED"
    reg = json.loads((bridge_env / "bridge" / "demo" / "SESSION.json").read_text(encoding="utf-8"))
    assert reg["thread_id"] == "thr-7", "le fil est perdu : resume impossible"

    # Et le fil est réellement reprenable au tour suivant.
    m2 = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="suite",
                      mode="resume", thread_id="thr-7",
                      runner=_make_runner("GO2", _valid_events(thread_id="thr-7", message="GO2")))
    assert m2["status"] == "VALID" and m2["nn"] == 2


def test_un_tour_casse_ne_fait_pas_naitre_de_fil(bridge_env):
    """Contre-épreuve du test précédent : on n'enregistre le fil que si le tour a
    VRAIMENT abouti côté auditeur. Un tour en échec (exit != 0) ne doit pas lier
    la session à un thread bancal.
    """
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="x",
                     runner=_make_runner("GO", _valid_events(thread_id="thr-9", message="GO"),
                                         returncode=1))
    assert m["status"] == "FAILED"
    reg = json.loads((bridge_env / "bridge" / "demo" / "SESSION.json").read_text(encoding="utf-8"))
    assert reg["thread_id"] is None


def test_next_turn_number(tmp_path):
    d = tmp_path / "c"
    assert ab.next_turn_number(d) == 1
    (d / "1").mkdir(parents=True)
    (d / "2").mkdir()
    assert ab.next_turn_number(d) == 3
    (d / "_QUARANTINE" / "3").mkdir(parents=True)
    assert ab.next_turn_number(d) == 4  # NN quarantiné jamais réutilisé


def test_build_command_new():
    argv = ab.build_command(model="gpt-5.6-sol", effort="high", mode="new",
                            thread_id=None, response_path=Path("/tmp/r.md"))
    assert argv[:2] == ["codex", "exec"]
    assert argv[argv.index("--sandbox") + 1] == "read-only"
    assert "--strict-config" in argv and "--json" in argv
    assert 'model_reasoning_effort="high"' in argv
    assert argv[-1] == "-"


def test_build_command_resume_reimpose_read_only():
    argv = ab.build_command(model="gpt-5.6-sol", effort="xhigh", mode="resume",
                            thread_id="tid-9", response_path=Path("/tmp/r.md"))
    assert "resume" in argv and "tid-9" in argv and "-C" not in argv
    assert "--model" in argv and "gpt-5.6-sol" in argv  # modèle réimposé (symétrie new)
    assert 'sandbox_mode="read-only"' in argv and 'approval_policy="never"' in argv
    assert "--strict-config" in argv


def test_build_command_resume_sans_thread_leve():
    with pytest.raises(ab.BridgeError):
        ab.build_command(model="gpt-5.6-sol", effort="high", mode="resume",
                         thread_id=None, response_path=Path("/tmp/r.md"))


def test_validity_gate_exige_thread_et_message():
    # Finding #3 : thread absent + message absent => FAILED (présence positive).
    class R:
        returncode = 0
    parsed = {"thread_id": None, "model": None, "has_turn_completed": True,
              "has_terminal_failure": False, "last_agent_message": None, "malformed": False}
    status, reasons = ab._validity_gate(result=R, parsed=parsed, response_text="x",
                                        model="gpt-5.6-sol", mode="new", requested_thread=None)
    assert status == "FAILED"
    assert any("thread_id absent" in r for r in reasons)
    assert any("agent_message" in r for r in reasons)


def test_validity_gate_modele_absent_ne_bloque_pas():
    # Calibrage end-to-end : le CLI n'émet PAS le modèle -> son absence ne doit PAS
    # invalider (le modèle fait foi via --model). Seule une contradiction bloque.
    class R:
        returncode = 0
    parsed = {"thread_id": "t1", "model": None, "has_turn_completed": True,
              "has_terminal_failure": False, "last_agent_message": "GO", "malformed": False}
    status, reasons = ab._validity_gate(result=R, parsed=parsed, response_text="GO",
                                        model="gpt-5.6-sol", mode="new", requested_thread=None)
    assert status == "VALID", reasons


# ─────────────────────────────────────────────────────────────────────────────
# Intégration run_audit
# ─────────────────────────────────────────────────────────────────────────────
class _FakeResult:
    def __init__(self, returncode, stdout, stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _valid_events(thread_id="thr-1", message="Verdict : GO.", model="gpt-5.6-sol"):
    return "\n".join([
        json.dumps({"type": "thread.started", "thread_id": thread_id, "model": model}),
        json.dumps({"type": "agent_message", "message": message}),
        json.dumps({"type": "turn.completed"}),
    ])


def _make_runner(response_text, events, returncode=0, stderr=""):
    def runner(argv, stdin_text, timeout_s):
        oidx = argv.index("-o")
        Path(argv[oidx + 1]).write_text(response_text, encoding="utf-8")
        return _FakeResult(returncode, events, stderr)
    return runner


@pytest.fixture
def bridge_env(tmp_path, monkeypatch):
    monkeypatch.setattr(ab, "BRIDGE_ROOT", tmp_path / "bridge")
    monkeypatch.setattr(ab, "cli_version", lambda: "codex-cli 0.0.0-test")
    monkeypatch.setattr(ab, "lot_base_sha", lambda head: "base0")
    snap = {"branch": "feat/pont-audit-codex", "head": "sha0", "clean": True}
    monkeypatch.setattr(ab, "git_snapshot", lambda: dict(snap))
    return tmp_path


def test_run_audit_valid(bridge_env):
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="Audite.", runner=_make_runner("Verdict : GO.", _valid_events()))
    assert m["status"] == "VALID"
    assert m["thread_id_observed"] == "thr-1"
    turn = bridge_env / "bridge" / "demo" / "1"
    assert (turn / "RESPONSE.md").read_text(encoding="utf-8") == "Verdict : GO."
    assert (turn / "MANIFEST.json").exists() and (turn / "EVENTS.jsonl").exists()
    reg = json.loads((bridge_env / "bridge" / "demo" / "SESSION.json").read_text(encoding="utf-8"))
    assert reg["thread_id"] == "thr-1" and reg["base_sha"] == "base0"
    assert not (bridge_env / "bridge" / "demo" / ".lock").exists()  # verrou libéré


def test_run_audit_resume_apres_new(bridge_env):
    ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t1",
                 runner=_make_runner("GO", _valid_events(thread_id="thr-1", message="GO")))
    m2 = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t2",
                      mode="resume", thread_id="thr-1",
                      runner=_make_runner("GO2", _valid_events(thread_id="thr-1", message="GO2")))
    assert m2["status"] == "VALID" and m2["nn"] == 2


def test_run_audit_resume_mauvais_thread_leve(bridge_env):
    ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t1",
                 runner=_make_runner("GO", _valid_events(thread_id="thr-1", message="GO")))
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t2",
                     mode="resume", thread_id="MAUVAIS",
                     runner=_make_runner("x", _valid_events()))


def test_run_audit_new_sur_session_avec_thread_leve(bridge_env):
    ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t1",
                 runner=_make_runner("GO", _valid_events(thread_id="thr-1", message="GO")))
    with pytest.raises(ab.BridgeError):  # doit utiliser resume, pas new
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t2",
                     runner=_make_runner("x", _valid_events()))


def test_run_audit_effort_mismatch_leve(bridge_env):
    ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t1",
                 runner=_make_runner("GO", _valid_events(thread_id="thr-1", message="GO")))
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="xhigh", prompt="t2",
                     mode="resume", thread_id="thr-1",
                     runner=_make_runner("x", _valid_events()))


def test_run_audit_resume_sans_session_leve(bridge_env):
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="t",
                     mode="resume", thread_id="thr-1",
                     runner=_make_runner("x", _valid_events()))


def test_run_audit_exit_non_zero_failed(bridge_env):
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="x",
                     runner=_make_runner("partiel", _valid_events(), returncode=1))
    assert m["status"] == "FAILED"
    assert (bridge_env / "bridge" / "demo" / "1" / "MANIFEST.json").exists()


def test_run_audit_response_mismatch_failed(bridge_env):
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="x",
                     runner=_make_runner("FALSIFIÉ", _valid_events(message="vrai")))
    assert m["status"] == "FAILED"
    assert any("dernier agent_message" in r for r in m["reasons"])


def test_run_audit_modele_observe_mismatch_failed(bridge_env):
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="x",
                     runner=_make_runner("GO", _valid_events(model="gpt-5.6-luna", message="GO")))
    assert m["status"] == "FAILED"
    assert any("modèle observé" in r for r in m["reasons"])


def test_run_audit_timeout_archive(bridge_env):
    # Finding #5 : un timeout est archivé (manifeste INVALID), pas une exception nue.
    def runner(argv, stdin_text, timeout_s):
        raise subprocess.TimeoutExpired(cmd=argv, timeout=timeout_s)
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="x", runner=runner)
    assert m["status"] == "INVALID"
    assert any("timeout" in r for r in m["reasons"])
    assert (bridge_env / "bridge" / "demo" / "1" / "MANIFEST.json").exists()
    assert not (bridge_env / "bridge" / "demo" / ".lock").exists()  # verrou libéré


def test_run_audit_exception_runner_archive(bridge_env):
    def runner(argv, stdin_text, timeout_s):
        raise RuntimeError("boom")
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="x", runner=runner)
    assert m["status"] == "INVALID"
    assert (bridge_env / "bridge" / "demo" / "1" / "MANIFEST.json").exists()


def test_run_audit_arbre_sale_refuse(bridge_env, monkeypatch):
    monkeypatch.setattr(ab, "git_snapshot",
                        lambda: {"branch": "feat/x", "head": "sha0", "clean": False})
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="x", runner=_make_runner("y", _valid_events()))


def test_run_audit_branche_master_refuse(bridge_env, monkeypatch):
    monkeypatch.setattr(ab, "git_snapshot",
                        lambda: {"branch": "master", "head": "sha0", "clean": True})
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="x", runner=_make_runner("y", _valid_events()))


def test_run_audit_mutation_pendant_appel_invalide(bridge_env, monkeypatch):
    # Finding B : un changement de branche à SHA constant est détecté.
    snaps = iter([
        {"branch": "feat/pont-audit-codex", "head": "sha0", "clean": True},
        {"branch": "feat/AUTRE", "head": "sha0", "clean": True},
    ])
    monkeypatch.setattr(ab, "git_snapshot", lambda: next(snaps))
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="x", runner=_make_runner("GO", _valid_events(message="GO")))
    assert m["status"] == "INVALID"
    assert any("branche" in r for r in m["reasons"])


def test_run_audit_verrou_avant_session(bridge_env):
    # Finding #4 : un verrou présent bloque AVANT toute création de SESSION.json.
    cdir = bridge_env / "bridge" / "demo"
    cdir.mkdir(parents=True)
    (cdir / ".lock").write_text('{"token":"autre"}', encoding="utf-8")
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="x", runner=_make_runner("y", _valid_events()))
    assert not (cdir / "SESSION.json").exists()  # registre PAS touché


def test_run_audit_secret_dans_stderr_quarantaine(bridge_env):
    # Finding #6 : un secret dans STDERR déclenche la quarantaine.
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high", prompt="x",
                     runner=_make_runner("GO", _valid_events(message="GO"),
                                         stderr="warning sk-ABCDEFGHIJKLMNOPQRSTUVWX"))
    assert m["status"] == "QUARANTINED"
    cdir = bridge_env / "bridge" / "demo"
    assert (cdir / "_QUARANTINE" / "1").is_dir()
    assert not (cdir / "1").exists()  # rien de brut versionné hors quarantaine


def test_run_audit_modele_non_designe_leve(bridge_env):
    with pytest.raises(ab.BridgeError):
        ab.run_audit(chantier="demo", model="gpt-4o", effort="high",
                     prompt="x", runner=_make_runner("y", _valid_events()))


_SECRET = "sk-ABCDEFGHIJKLMNOPQRSTUVWX"


def test_run_audit_timeout_avec_secret_quarantaine(bridge_env):
    # Finding tour 3 : un secret dans le prompt + timeout => quarantaine, jamais versionné.
    def runner(argv, stdin_text, timeout_s):
        raise subprocess.TimeoutExpired(cmd=argv, timeout=timeout_s)
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt=f"voici la clé {_SECRET}", runner=runner)
    assert m["status"] == "QUARANTINED"
    cdir = bridge_env / "bridge" / "demo"
    assert (cdir / "_QUARANTINE" / "1").is_dir()
    assert not (cdir / "1").exists()  # rien de brut hors quarantaine


def test_run_audit_exception_avec_secret_quarantaine(bridge_env):
    # Le motif d'exception lui-même peut porter un secret => scanné + quarantaine.
    def runner(argv, stdin_text, timeout_s):
        raise RuntimeError(f"échec réseau exposant {_SECRET}")
    m = ab.run_audit(chantier="demo", model="gpt-5.6-sol", effort="high",
                     prompt="prompt neutre", runner=runner)
    assert m["status"] == "QUARANTINED"
    cdir = bridge_env / "bridge" / "demo"
    assert (cdir / "_QUARANTINE" / "1").is_dir()
    assert not (cdir / "1").exists()


def test_release_lock_seulement_par_proprietaire(tmp_path):
    lock_path, token = ab.acquire_lock(tmp_path, thread_id=None, force_unlock=False)
    ab.release_lock(lock_path, "mauvais-jeton")
    assert lock_path.exists()  # pas le propriétaire -> non libéré
    ab.release_lock(lock_path, token)
    assert not lock_path.exists()
