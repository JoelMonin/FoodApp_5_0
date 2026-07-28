# /handoff - Cloture et livraison de lot

Pre-requis : etre sur une branche feat/lotXX-* avec tous les fichiers commites.

## Etapes

1. Lis CURRENT_GOAL.md - identifie le numero de lot actif (XX).

2. Lance la validation unifiee :
   .\validate.bat  (ou npm run check)
   Si des tests echouent (Vitest ou Pytest) : STOP. Affiche les erreurs. Ne pas continuer.

3. Recupere les metriques :
   - git diff main...HEAD --stat
   - git log main...HEAD --oneline
   - SHA du dernier commit

4. ZIP de handoff — SUR DEMANDE SEULEMENT (allegement Joel 2026-07-24).
   Par defaut : NE PAS produire de ZIP (Codex lit le depot directement).
   Le produire UNIQUEMENT si Joel le demande, ou si le livrable part vers une
   IA externe sans acces au depot. Dans ce cas :
   - Genere les fichiers temporaires dans handoff/ :
     git_diff_LOTXX.txt (git diff main...HEAD) · git_status_LOTXX.txt
     (git status --short) · validation_LOTXX.txt (resultat complet validate.bat)
   - Cree handoff/handoffXX_nom-du-lot.zip : fichiers modifies du lot + les 3 .txt
     IMPORTANT : exclure tous les fichiers *.zip existants (pas de poupee russe)
   - Supprime les fichiers .txt temporaires de handoff/.

5. Met a jour SHIP_LOG.md :
   Format : [LOT XX] YYYY-MM-DD - [titre] - Tests: N passed - SHA: XXXXXXX

6. Marque le lot [CLOTURE] dans CURRENT_GOAL.md et dans ROADMAP.md.

7. Renomme le fichier spec du lot dans `RoadMap & Project Pipeline/` :
   - Cherche : `Lot XX *.md` (sans prefixe)
   - Renomme en : `[CLÔTURÉ] Lot XX *.md`
   - Met a jour le lien markdown correspondant dans ROADMAP.md
     (URL-encode `[CLÔTURÉ] ` → `%5BCL%C3%94TUR%C3%89%5D%20` en debut de href)
   - Si aucun fichier spec n'existe pour ce lot (lot hotfix/patch sans spec formelle) : noter explicitement "pas de fichier spec a renommer"

8. Affiche le resume :
   LOT XX cloture
   ZIP : handoff/handoffXX_*.zip / pas de ZIP (defaut depuis 2026-07-24)
   Validation : Vitest + Pytest 100% vert
   SHIP_LOG.md mis a jour
   Prochaine etape : /new-lot [N+1] [nom]
