# 🤖 CLAUDE.md - Instructions et Règles de Comportement

Ce fichier centralise les consignes globales que l'IA doit respecter lors des interactions sur ce projet.

## 1. RÈGLES DE GOUVERNANCE (VIBE-ONLY)
* **Communication** : Parle-moi comme à un chef de projet, pas un dev. Explique les problèmes par leur impact sur l'utilisateur (ex: "Le bouton ne marche pas car...") et pas par le code.
* **Autonomie** : Tu as le droit de créer des branches feat/ et d'y faire tes tests seul.
* **Validation** : Avant de me demander d'écrire un fichier, montre-moi que tes tests (ou le lint) sont au vert.
* **Branche main** : Interdiction d'y toucher sans mon feu vert explicite.

## 2. Source de Vérité et Documentation
* **Lecture obligatoire** : Au début d'un chantier, tu dois toujours lire `RoadMap & Project Pipeline/ROADMAP.md` (si présent) et le fichier markdown spécifique du projet.
* **Mise à jour proactive** : La documentation de suivi n'est pas une option. Tu dois tenir à jour la roadmap, le fichier du projet, `SHIP_LOG.md` et `CURRENT_GOAL.md`.
* **Nommage de projet** : Format strict `NOM - 3 ou 4 mots explicatifs`.

## 3. Discipline Git et Traçabilité
* **INTERDICTION DE `git add .`** : Le staging doit toujours se faire fichier par fichier.
* **Vérification avant commit** : Utiliser `git status --short` et faire valider les changements.

## 4. Protocole de Handoff (Livrable ZIP)
Tout lot impliquant une modification de code doit générer un pack de validation dans `handoff/`.

## 5. Architecture et Seuils de Maintenance
* **Seuils d'alerte** : Signaler un risque si un fichier approche **1 500 lignes** (Attention : FoodApp dépasse déjà ce seuil !).
* **Modularisation** : Extraire la logique métier de la présentation.
