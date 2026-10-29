# Preuve réelle NVIDIA / Nebius — 28 octobre 2026

**PASS : une réparation contrôlée a été réellement reçue de NVIDIA Nemotron Super sur Nebius Token Factory et acceptée par les contrôles du projet. Un seul appel a suffi.**

Ce dossier contient la réponse enregistrée ; l’ouvrir ne lance aucun nouvel appel au modèle. L’interface reste en `MOCK_SIMULATED` pour les répétitions et peut être montrée séparément de cette preuve réelle.

## Résultat observé

| Élément | Valeur réellement renvoyée |
| --- | --- |
| Modèle | `nvidia/nemotron-3-super-120b-a12b` |
| API | `https://api.tokenfactory.nebius.com/v1/` |
| Identifiant de réponse | `chatcmpl-aa293e018d7955bb` |
| Appels de génération | **1** |
| Fallback et retries automatiques | **0** |
| Tokens d’entrée | **143** |
| Tokens de sortie | **736**, dont les tokens de raisonnement déjà inclus |
| Total | **879 tokens** |
| Durée de cette requête | **6 683 ms** |
| Résultat du contrôle | **PASS : règles statiques, TypeScript sémantique et structure de la fixture** |
| Exécution du programme réparé | **NOT_VERIFIED — aucune exécution** |

Le modèle a remplacé une valeur de démonstration explicitement fictive par `process.env.API_CREDENTIAL`, en conservant l’export nommé `handlePayment`. Le code reçu est dans `REPAIRED_PAYMENT_WEBHOOK.txt` ; la réponse du fournisseur est dans `MODEL_RESPONSE_1.json` et le verdict du vérificateur dans `LIVE_NEBIUS_PROBE.json`.

## Dépense limitée

L’utilisateur a autorisé le test préparé avec un budget maximal de **0,05 $** et au plus deux appels. Le premier appel ayant réussi, le second n’a pas été utilisé. Aucun autre appel réel n’a été lancé pour les répétitions ou le tournage.

Aux tarifs du compte consultés le 28 octobre (0,30 $ / million de tokens d’entrée et 0,90 $ / million de tokens de sortie pour ce modèle), le coût d’inférence estimé hors taxes est :

`143 × 0,30 / 1 000 000 + 736 × 0,90 / 1 000 000 = 0,0007053 $`

Cela représente environ **0,07053 centime de dollar**, soit moins d’un dixième de centime. Il s’agit du calcul à partir de l’usage renvoyé et des tarifs observés, pas d’une facture. Le journal `REQUEST_BUDGET.json` enregistre les plafonds et la seule requête envoyée. Les tarifs observés sont conservés dans `../live-preflight-20261028/`.

## Sécurité et portée

Le premier lancement a été refusé par le contrôle automatique avant toute exécution : la fixture employait une fausse valeur au format d’une clé Stripe. Elle a été remplacée par `DEMO_ONLY_NOT_A_REAL_CREDENTIAL`. Les contrôles hors ligne ont confirmé que cette valeur déclenche encore la règle à réparer, sans être une vraie information d’authentification. Seule cette fixture de démonstration a été envoyée au modèle.

La clé Nebius est restée dans la configuration privée locale, exclue de Git. Elle n’est pas incluse dans les messages du modèle ni dans ce dossier de preuve. Elle a servi uniquement à l’authentification auprès du service prévu.

La réussite porte sur **une fixture contrôlée**, sans benchmark comparatif ni garantie générale de sécurité. Le runtime et les contrats métier restent `NOT_VERIFIED`. Ce résultat ne transforme pas les sessions simulées de l’interface en sessions réelles.

## Utilisation dans la vidéo

1. Montrer le parcours d’interface en précisant `MOCK_SIMULATED`.
2. Ouvrir ce rapport et la réponse enregistrée, en disant qu’il s’agit du résultat d’un appel réel antérieur.
3. Montrer le code reçu, son modèle et son identifiant ; cette lecture est locale et ne consomme pas de crédit.

Le déroulé est dans `../../DEMO_VIDEO_SCRIPT.md` et les instructions de capture Mac dans `../../GUIDE_VIDEO_FR.md`. Aucune vidéo n’a encore été enregistrée ou publiée.
