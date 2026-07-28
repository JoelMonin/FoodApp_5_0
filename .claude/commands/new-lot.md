# /new-lot - Demarrage d un nouveau lot

Arguments attendus : $ARGUMENTS  ex: "21 mcp-permissions"

## Etapes

1. Parse les arguments : numero de lot + nom court.

2. Lis CURRENT_GOAL.md - verifie que le lot precedent est bien marque [CLOTURE].
   Si non : alerte et STOP.

3. Lis RoadMap & Project Pipeline/ROADMAP.md - confirme que ce lot existe
   et extrait son scope prevu (s'il n'existe pas formellement, recapitule le
   plan d'attaque convenu en conversation).

4. Cree la branche git :
   git checkout -b feat/lotNUM-NOM

5. Met a jour CURRENT_GOAL.md :
   - Nouveau lot actif : numero, titre, date de demarrage
   - Tableau de suivi vide

6. **PHASE DECOUVERTE OBLIGATOIRE (ETAPE BLOQUANTE - anti-recidive)**

   Avant TOUT commit feat sur la branche, lancer un agent Explore
   avec une check-list ciblee sur les ressources existantes du projet
   qui touchent la zone de la feature a venir :

   1. **Modules existants pertinents** - grep des concepts metier touches.
      Quelles fonctions publiques ? Quelles donnees retournent ?
   2. **Tables / schema de donnees** - quelles tables touchent la zone ?
      Quels champs disponibles ?
   3. **Caches / fichiers persistes** de la zone (dont caches parquet/json).
   4. **Endpoints existants** exposant la zone.
   5. **Helpers transversaux** et services partages.

   Chemins et commandes exacts de ce projet : `DOCTRINE_PRODUIT.md` §2.

   **Format de sortie attendu de l'agent** : "voici les N ressources
   reutilisables, voici les M gaps a combler". Le plan d'attaque A->F
   doit ensuite **explicitement reutiliser** ces ressources OU justifier
   pourquoi pas.

   Si une ressource pertinente apparait tardivement (en cours de code),
   s'arreter immediatement, reflater le plan avec l'utilisateur, plutot
   que coder un parallele qui devient dette.

   **Pourquoi cette etape est OBLIGATOIRE** :
   - Incident Lot 14 (2026-05-16) : textarea JSON brut livre alors que
     `watchlist_assets`, `portfolio_snapshots`, `price_history`,
     `isin_cache` existaient en DB depuis longtemps. 2h de hotfix + Lot 15
     entierement consacre a la dette = evitables avec un audit prealable.
   - Recidive Lot 15.5 (2026-05-20) : proposition initiale d'un store
     `data/active_policy.json` + hook lecture dans `policies.py` alors que
     `PolicyBundle` (Lot 10) etait deja la single-source d'abstraction
     pour les configs. Reconnu uniquement apres flag explicite de
     l'utilisateur "je n'ai pas envie de te flagger des trucs qu'on a
     deja decide avant".

   Sans cette etape gravee dans le skill (et pas seulement en memoire
   CLAUDE.md), la regle reste passive et donc oubliable.

7. Affiche la confirmation :
   LOT NUM lance - Branche : feat/lotNUM-NOM
   Scope : [extrait roadmap]
   Phase decouverte : [resume agent Explore - N ressources, M gaps]
   CURRENT_GOAL.md mis a jour - pret a coder.
