# /audit - Audit complet du projet (qualite + bugs + securite)

Audit exhaustif du code source en local (gratuit dans le forfait Max, aucun cout cloud).
Produit un livrable unique `AUDIT_REPORT.md` avec findings priorises (P0/P1/P2) et plan de remediation.

## Perimetre

INCLURE :
- Code applicatif racine (points d'entree `index.html`, `js/app.js`, `foodapp-v5-Joel.html`, modules JS `src/**/*.js` — liste exacte : `DOCTRINE_PRODUIT.md` §2)
- Styles CSS `css/*.css`
- Scripts de production `scripts/*.py` / `scripts/*.js`

EXCLURE :
- `node_modules/` (dependances tierces)
- `dist/` (bundle genere)
- `tests/` (audit du code de test = hors scope)
- `scratch/` (code jetable)
- `handoff/`, `RoadMap & Project Pipeline/`, `*.md` (documentation)

## Etapes

### Etape 1 - Cartographie (5 min)

Execute :
- `git ls-files "*.js" "*.html" "*.css" | grep -v "^tests" | grep -v "^node_modules" | grep -v "^dist" | grep -v "^scratch"`
- Pour chaque fichier source : compter les lignes (`wc -l`)
- Identifier les fichiers > 1500 lignes (seuil CLAUDE.md / DOCTRINE_PRODUIT.md - ex: `foodapp-v5-Joel.html`)
- Identifier les fichiers > 800 lignes (zone d'alerte preventive - ex: `js/app.js`)

Produire un tableau : Fichier | Lignes | Statut (OK / ALERTE / CRITIQUE).

### Etape 2 - Audit Qualite (parallele)

Lancer un agent `Explore` avec ce mandat :

> Audite la QUALITE du code source (hors tests/scratch/node_modules/dist).
> Cherche :
> - Fichiers > 1500 lignes ou fonctions > 150 lignes (seuils CLAUDE.md)
> - Modules avec > 3 responsabilites majeures (god objects)
> - Duplication de code (memes patterns repetes 3+ fois)
> - Dead code / imports non utilises evidents
> - Couplage fort
> - Magic numbers et strings hardcodees critiques
> - Nommage incoherent ou trompeur
> Retourne une liste prioritaire avec file:line pour chaque finding.

### Etape 3 - Audit Bugs (parallele)

Lancer un agent `Explore` avec ce mandat :

> Audite les BUGS POTENTIELS du code source (hors tests/scratch/node_modules/dist).
> Cherche :
> - Exceptions non gerees ou `catch {}` silencieux
> - Race conditions (etat partage sans lock, appels asynchrones concurents Gemini/Firebase)
> - Edge cases : null/undefined, listes vides, parsing JSON invalide, dates invalides
> - Mutations d'objets partages
> - Patterns fragiles moduleState / state
> - TODO / FIXME / XXX dans le code
> - Logique de cache potentiellement incoherente
> - Appels reseau sans timeout / sans retry
> Retourne une liste prioritaire avec file:line pour chaque finding.

### Etape 4 - Audit Securite (parallele)

Lancer un agent `Explore` avec ce mandat :

> Audite la SECURITE du code source (hors tests/scratch/node_modules/dist).
> Reference : OWASP Top 10.
> Cherche :
> - Secrets hardcodes (cles API Firebase/Gemini, tokens) dans le code client
> - Injection XSS (`innerHTML`, `outerHTML`, templates HTML dynamiques non echappees)
> - Validation manquante des entrees utilisateur (formulaires, paste-recipe, prompt Gemini)
> - Storage local altérable (localStorage / sessionStorage sans validation schema)
> - Permissions Firebase Firestore / Auth non securisees
> - Logs qui exposent des donnees sensibles
> Retourne une liste prioritaire avec file:line pour chaque finding et la classe OWASP associee.

### Etape 5 - Lancement parallele

Les etapes 2, 3 et 4 doivent etre lancees DANS UN SEUL message en parallele
(3 appels Agent simultanes) pour gagner du temps et eviter de polluer
le contexte principal.

### Etape 6 - Consolidation

Apres reception des 3 rapports d'agents :

1. Regrouper les findings par criticite :
   - **P0 (BLOQUANT)** : faille de securite exploitable, perte de donnees, crash garanti
   - **P1 (IMPORTANT)** : bug latent, dette architecturale majeure, vulnerabilite conditionnelle
   - **P2 (AMELIORATION)** : code smell, refactoring suggere, micro-optimisation

2. Pour chaque finding, structurer :
   ```
   ### [Pn] Titre court
   **Fichier** : `path/to/file:line`
   **Categorie** : Qualite | Bug | Securite (OWASP A0X si applicable)
   **Description** : ce qui ne va pas
   **Impact** : consequence concrete
   **Remediation** : action proposee (1-3 lignes)
   ```

3. Calculer un score global :
   - Nombre de P0, P1, P2
   - Top 3 fichiers les plus problematiques
   - Top 3 modules a refactorer en priorite

### Etape 7 - Livrable

Ecrire le rapport dans `AUDIT_REPORT.md` a la racine du repo avec ce plan :

```markdown
# AUDIT REPORT - [date du jour]

## Resume executif
- Scope : N fichiers, ~M lignes de code
- Findings : X P0, Y P1, Z P2
- Verdict global : [OK / VIGILANCE / ACTION REQUISE]

## Cartographie
[tableau Etape 1]

## Findings P0 - Bloquants
[liste detaillee]

## Findings P1 - Importants
[liste detaillee]

## Findings P2 - Ameliorations
[liste detaillee]

## Top 3 priorites de remediation
1. [...]
2. [...]
3. [...]

## Plan d'action suggere
- Sprint immediat : tous les P0
- Sprint suivant : P1 critiques
- Backlog : P2 + reste P1
```

### Etape 8 - Synthese a l'oral

Apres ecriture du rapport, afficher uniquement :

```
AUDIT TERMINE
Rapport : AUDIT_REPORT.md
Findings : X P0, Y P1, Z P2
Verdict : [OK / VIGILANCE / ACTION REQUISE]
Top 3 actions :
  1. [titre P0/P1 le plus critique]
  2. [...]
  3. [...]
```

## Garde-fous

- Ne jamais modifier le code lors de l'audit (lecture seule).
- Ne jamais commiter `AUDIT_REPORT.md` automatiquement (laisser l'utilisateur decider).
- Si un agent Explore retourne moins de 3 findings, considerer son audit comme suspect
  et demander une seconde passe ciblee.
- En cas de findings P0 securite (secret expose, injection XSS), alerter l'utilisateur
  avant meme la consolidation finale.
