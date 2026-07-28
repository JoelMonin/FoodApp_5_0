# /ultra-audit - Audit Parallèle Multi-Agents (100% Autonome)

Audit approfondi utilisant 6 agents parallèles locaux. 
Conçu pour être "token-efficient" et se concentrer sur l'**architecture, la stratégie et l'analyse statique**. 

> 💡 **Philosophie d'Indépendance** : Cet outil a été créé pour **remplacer** totalement les audits cloud payants. Il agit comme l'unique filet de sécurité du projet. Sa force réside dans sa rapidité, son contrôle total des tokens, et sa capacité à scruter le code sous 6 angles sans dépendre d'un service externe.

## 🎯 Étape 0 : Cible, Contexte & Vérification Git

Avant tout lancement, l'orchestrateur doit préparer le terrain :

1. 🧠 **Lecture de la Mémoire (Dream Layer + Blacklist)** : L'orchestrateur DOIT charger DEUX fichiers complémentaires (s'ils existent) :
   - `.claude/audit_memory.md` → **Faux positifs récurrents** : findings à filtrer SILENCIEUSEMENT du rapport (semantique : *"ignore ça, ce n'est pas un vrai problème dans ce projet"*).
   - `.claude/audit_blacklist.md` → **Trade-offs refusés en mémoire** : findings qui doivent rester VISIBLES dans le rapport mais qu'il est INTERDIT de proposer comme candidat audit_memory en Étape 4.5 (semantique : *"mentionne mais ne demande plus à archiver, l'utilisateur a déjà tranché"*).

   Les deux fichiers suivent le même format YAML (voir §"Formats" ci-dessous). Confondre les deux sémantiques = bug de protocole.

2. 🛡️ **Clause de Conscience Git** : L'orchestrateur DOIT exécuter `git branch --no-merged main` (ou la branche principale équivalente).
   - **Si la sortie est vide** : ne rien signaler. Les branches existantes sont des fossiles déjà intégrés, sans risque de faux positif. Ne pas mentionner leur existence.
   - **Si la sortie est non-vide** : lister UNIQUEMENT les branches non mergées et avertir l'utilisateur : *"Attention, ces N branches contiennent du travail non fusionné dans main : [liste]. Si elles incluent des correctifs en cours, cet audit risque de signaler à tort des bugs déjà résolus ailleurs. Veux-tu cibler une de ces branches plutôt que main ?"*
   - **Interdit** : juger qualitativement « il semble y avoir des branches sœurs ». La condition est binaire et vérifiable par commande Git.

3. 🗺️ **Consultation de la Roadmap (Anti-doublon — ÉTAPE BLOQUANTE)** : L'orchestrateur DOIT lister les fichiers de `RoadMap & Project Pipeline/*.md` (hors `[CLÔTURÉ]`) et lire au minimum :
   - `ROADMAP.md` (vue d'ensemble des chantiers en cours et du backlog)
   - Tout fichier dont le nom est cité dans les sections "EN COURS", "PROCHAIN HAUTE PRIORITÉ" et "BACKLOG MOYEN TERME"

   **🔒 Vérification matérialisée (anti-shortcut)** : avant de pouvoir invoquer l'outil `Agent` (Étape 1), l'orchestrateur DOIT explicitement écrire dans son raisonnement (thought/TodoWrite/log) la liste **complète et nommée** des chantiers actifs lus, avec une ligne par chantier. Format obligatoire :
   ```
   📋 Chantiers actifs consultés (Étape 0.3) :
   - PERF_BOOT_AND_RENDER — Performance de démarrage et de rendu (Prochain HAUTE)
   - RACE_CONDITIONS_AI — Stabilité asynchrone et silent fails (Prochain HAUTE)
   - [autres...]
   ```
   Sans ce listing visible, **l'invocation des agents en Étape 1 est interdite** (l'utilisateur peut interrompre l'audit).

   **Règle stricte** : si un finding identifié pendant l'audit correspond à un chantier déjà spécifié dans la roadmap, l'orchestrateur ne le re-spécifie PAS dans le rapport. Il le mentionne par référence : *"Voir spec existante `[NOM_CHANTIER].md`. Le diagnostic est-il toujours valide ? Faut-il prioriser ?"*. Cela évite que l'audit redécouvre tous les 3 mois ce qui est déjà tracé.

4. 📏 **Garde-fou "Diff trop gros"** : Avant de demander la cible, l'orchestrateur exécute `git diff --stat <base>..HEAD` (selon le mode envisagé). Si le diff dépasse **2000 lignes** OU **30 fichiers**, il DOIT proposer un découpage avant tout déploiement d'agents :
   > *"Le diff est massif (X lignes / Y fichiers). Auditer en bloc dégraderait la qualité ET brûlerait le budget tokens. Veux-tu cibler : (a) `src/` uniquement, (b) `js/` + `css/` uniquement, (c) ce qui a changé depuis le dernier merge mergé sur main, (d) tout d'un coup en assumant la perte de qualité ?"*
   Si l'utilisateur choisit (d), procéder mais logger un avertissement dans le rapport final.

5. 🎯 **Choix de la cible** : Demander à l'utilisateur : **Voulez-vous cibler le dernier diff ou tout le projet ?**
   - **Mode Laser (recommandé)** : Analyser uniquement le diff par rapport à main (`git diff HEAD~1` ou `git diff --cached`). **Si le diff est vide, l'orchestrateur refuse de lancer l'audit (pas de matière, pas de revue).**
   - **Mode Full Scan** : Analyser l'ensemble des dossiers applicatifs (`src/`, `js/`, `css/`, `index.html`, `foodapp-v5-Joel.html`).

6. 🌐 **Audit externe optionnel (Cross-référence)** : l'orchestrateur accepte un paramètre optionnel `--external-audit <path>` pointant vers un fichier markdown contenant un audit indépendant (Gemini, ChatGPT, Opus, audit humain). Détection alternative automatique : tout fichier `audits/EXTERNAL_AUDIT_*.md` modifié dans les 24h précédant l'invocation.

## 🚀 Étape 0.9 : Choix du mode d'orchestration (Legacy `Agent` vs `Workflow`)

### Mode 1 — Workflow tool (RECOMMANDÉ si disponible)
Multi-modèles natif + schema strict + pipeline déterministe.

### Mode 2 — Agent natif (Legacy — toujours supporté)
6 agents lancés en parallèle via `Agent` natif dans un seul message.

### Mode 3 — Single-Agent dégradé
Si le dry-run technique (Étape 1.0) échoue.

## 🩺 Étape 1.0 : Dry-run technique (Vérification de l'outil Agent)
Vérification ultra-légère du canal agentique avant de déployer l'équipe.

## 🤖 Étape 1 : Déploiement des 6 Agents (En parallèle)

Lancer DANS UN SEUL MESSAGE (via l'outil `Agent`) les 6 agents sur la cible choisie.

### Lentilles d'analyse
1. 🏛️ **Agent Qualité, Architecture & Style** *(privilégie variante B)*
2. 🐛 **Agent Correction Logique & Bugs** *(privilégie variante A)*
3. 🔒 **Agent Sécurité (OWASP)** *(privilégie variante A)*
4. 🧪 **Agent Audit des Tests** *(privilégie variante B)*
5. ⚡ **Agent Performance & Optimisation** *(privilégie variante A)*
6. 🎨 **Agent UX/UI & Accessibilité (Mode Éclaireur)** *(Suspect Visual Checklist)*

## ⚔️ Étape 1.5 : Adversarial Verifier (Filtrage faux positifs)
1 agent sceptique qui tente de réfuter les findings des 6 lentilles.

## 🛡️ Étape 2 : Verifier Stratifié (Post-Collecte)
Qualification formelle des findings : **REPRODUCED**, **TRACED**, **HYPOTHESIS**, **REFUTED**, **ROADMAP_REF**.

## 🧠 Étape 3 : Synthèse Intelligente (Orchestrateur)
Consensus, corroboration vs répétition, mise en exergue des désaccords.

## 📝 Étape 4 : Le Livrable (`ULTRA_AUDIT_REPORT.md`)
Écriture obligatoire du rapport sur disque avant toute réponse chat.

## 🤝 Étape 4.5 : Validation utilisateur des rétrogradations

## 📚 Étape 5 : Mise à jour de la Mémoire (Dream Layer + Blacklist)
Mise à jour de `.claude/audit_memory.md` et `.claude/audit_blacklist.md` après validation humaine.
