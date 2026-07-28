---
description: Crée une version personnalisée de la FoodApp pour un nouvel utilisateur (Math, Sophie, etc.)
---

Ce workflow permet de générer un fichier HTML indépendant avec ses propres clés de stockage local et son propre identifiant de synchronisation Cloud.

1. **Identification de l'utilisateur** :
   - Demander le prénom du destinataire (ex: "Sophie").

2. **Génération du fichier** :
   - Dupliquer le fichier source : `cp foodapp-v5-Joel.html foodapp-v5-[Prénom].html`

3. **Personnalisation des clés (Local & Cloud)** :
   - Remplacer `'pantry_v5'` par `'pantry_v5_[Prénom]'` (clés LocalStorage).
   - Remplacer `'FoodApp_V5_Joel'` par `'FoodApp_V5_[Prénom]'` (identifiant Firebase).

4. **Vérification et Partage** :
   - Confirmer l'emplacement du fichier : `foodapp-v5-[Prénom].html`.
   - Rappeler qu'il ne reste plus qu'à le charger sur son dépôt GitHub dédié.
