# BACKLOG — Durcissements import et panier — ➡️ MIGRÉE VERS LE REGISTRE TECHNIQUE

> **⚑ FICHE FERMÉE LE 2026-08-02. Ne plus travailler ici.**
>
> Son contenu vivant a été **déplacé** — pas copié — vers **`audits/BACKLOG_TECHNIQUE.md`**,
> le registre des dettes techniques. Un finding n'a qu'un seul domicile (règle SSOT,
> `CLAUDE.md` §6) : le laisser aux deux endroits aurait garanti que les deux divergent.
>
> Cette fiche reste pour la **trace de l'origine** (règle « rien ne se supprime »).

## Où sont passés ses points

| Ancien § | Devenu | État |
|---|---|---|
| §1 — import par nom ambigu (deux homonymes) | **F-001** | 🟠 ouvert |
| §4b — restauration hors ligne puis reconnexion | **F-002** | 🟠 ouvert — le plus risqué |
| §5c — 2 boutons inatteignables du détail de recette | **F-003** | 🟠 ouvert |
| §6 — temporisations sans test | **F-004** | 🟠 ouvert (re-mesuré : **5 sur 16**, et non 9 sur 20) |
| §7 + §8 — câblage du démarrage hors de portée des tests | **F-005** | 🟠 ouvert, assumé |
| §2 + §3 — articles libres | **F-006** | ✅ traité (supprimés, LOT 014 §G) |
| §4a — divergence entre deux appareils | **F-007** | ✅ écarté (sans objet) |
| §5a — modale « ajout groupé » morte | **F-008** | ✅ traité (retirée, LOT 014) |
| §5b — `sanitize()` sans appelant | **F-009** | ✅ traité (supprimée, LOT 014) |
| §9 — deux défauts de catégorisation | **F-010** | ✅ traité (corrigés le 2026-07-31) |

## Origine (conservée)

**Audit Dur du LOT 008** par Codex 5.6 (Sol), 2026-07-29. Findings tagués DURCISSEMENT,
explicitement non bloquants — consignés plutôt que corrigés en passant (discipline
`CLAUDE.md` §5 : pas de « correction en passant » hors spec). Complété ensuite par les
découvertes du LOT 013 et l'audit Gemini du LOT 015.

- Audit source : NO-GO Codex 5.6 sur `f7d11ec`, corrigé en `2483c06`. Les deux findings
  CRITIQUES (reset incomplet, export versionné) ont été traités ou levés par Joel à
  l'époque ; cette fiche ne portait que les DURCISSEMENTS résiduels.
- Deux autres durcissements du même audit ont été traités à la clôture du LOT 008 : test
  d'ordre push→reload durci (résolution prouvée, pas seulement l'invocation) ; `exportJSON`
  aligné sur l'oracle (`URL.revokeObjectURL` + toast « 💾 Export téléchargé »).

## Pourquoi cette fiche s'était périmée — leçon à garder

Relue le 2026-08-02, elle décrivait un code qui n'existait plus : **toutes ses références de
ligne étaient fausses** (elle citait `js/app.js:2135` et `:2781`, alors que ce fichier ne fait
plus que 568 lignes depuis le LOT 018), et **cinq de ses neuf points étaient déjà réglés**
sans que personne ne l'y note.

**Une fiche qui cite des numéros de ligne se périme au premier rangement.** C'est la raison
d'être du registre : un endroit unique, avec une date d'origine sur chaque finding, que le
démarrage de session relit à chaque fois.
