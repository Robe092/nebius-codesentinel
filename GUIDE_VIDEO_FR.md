# Guide de préparation et de tournage — CodeSentinel

> **Mise à jour du 29 octobre :** les trois prises et le montage sont terminés. La vidéo actuelle dure **1 min 50**, avec la voix anglaise et les sous-titres intégrés : [ouvrir le MP4](deliverables/video-20261029/CodeSentinel_EN_1080p.mp4). Le [script final](DEMO_VIDEO_SCRIPT.md) et la [narration exacte](deliverables/video-20261029/NARRATION_EN.txt) décrivent le montage livré. Les étapes ci-dessous conservent le guide de préparation utilisé avant le tournage ; le découpage de 2 min 40 n’est plus le montage final.

Nous passons maintenant à la répétition du parcours et à l’enregistrement de la vidéo. La finition locale et une réparation contrôlée réelle sont vérifiées. Aucun nouvel appel payant n’est nécessaire pour répéter les clics ou montrer les fichiers de preuve enregistrés.

## 1. Le test réel est terminé

Le 28 octobre, NVIDIA Nemotron Super sur Nebius a retourné une réparation contrôlée correcte selon nos règles statiques, le compilateur TypeScript et la structure attendue. Un seul appel a été utilisé : 143 tokens d’entrée et 736 de sortie, pour un coût estimé de **0,0007053 $ hors taxes**. Le second appel autorisé n’a pas été utilisé.

La clé est enregistrée dans la configuration privée locale. Il n’est pas nécessaire de l’afficher ni de la recopier pour tourner. L’application reste en `MOCK_SIMULATED` pour que les répétitions ne consomment pas de crédits.

La preuve réelle est conservée dans `docs/live-proof-20261028/`. Ouvrir ces fichiers locaux ne relance pas le modèle. La vidéo montrera séparément le parcours d’interface simulé et le résultat réel enregistré, en annonçant clairement les deux provenances.

## 2. Ce que demande le concours

Le règlement demande une application utilisant réellement Nebius et un modèle NVIDIA open source, une vidéo de moins de trois minutes montrant le produit en fonctionnement, une publication publique sur YouTube et des contenus en anglais ou accompagnés d’une traduction anglaise. Un dépôt public avec licence et un lien vers une démo ou un test build font aussi partie de la soumission. [Règlement officiel](https://nebiusglobalaihackathon.devpost.com/rules).

La date limite consultée est le **30 octobre 2026 à 18 h, heure de Paris**, conversion des 10 h Pacific indiquées par le règlement. Une répétition en simulation peut être faite dès maintenant ; la vidéo finale doit décrire l’utilisation réellement démontrée du service sponsor.

## 3. Le format proposé

Une capture horizontale de l’application avec une voix claire suffit pour notre réalisation. Je propose une durée cible de **2 min 30 à 2 min 45**, sans introduction animée ni musique. La caméra sur ton visage est facultative dans notre montage. Tu peux utiliser le texte anglais de `DEMO_VIDEO_SCRIPT.md` ou parler français avec une traduction anglaise ajoutée au montage.

Le script actuel distingue la démonstration d’interface `MOCK_SIMULATED` et la preuve réelle enregistrée. Présente cette séparation à voix haute ; le parcours simulé n’est pas une nouvelle réponse du modèle.

## 4. Répéter les clics sans enregistrer

Ouvre `http://localhost:3005/`, recharge la page et choisis **Payment webhook** dans le sélecteur d’exemple. Mets la fenêtre assez grande pour lire le code et les résultats. Garde un cadrage constant.

| Temps cible | Ce que tu montres | Idée à expliquer |
| --- | --- | --- |
| 0:00–0:20 | L’interface et le code de l’exemple | Le problème des secrets, approbations et expressions dans les automatisations |
| 0:20–0:40 | Le sélecteur d’exemple et le bouton Analyze code | Le parcours qui va être montré est simulé pour limiter les dépenses |
| 0:40–1:20 | **Analyze code**, puis **Repair source** et **Repair** | Les trois findings, le score initial 45/100 et la proposition simulée |
| 1:20–2:00 | **Changes**, puis déplier **Run details & evidence** et cliquer sur **Download run evidence** | Les différences de source, le garde structurel AST (rejet des patchs destructeurs/vides), les contrôles et la provenance |
| 2:00–2:25 | La preuve lisible en anglais `docs/live-proof-20261028/VIDEO_PROOF_EN.md` et les fichiers de réponse | Une réparation réellement reçue de NVIDIA sur Nebius ; il s’agit d’une preuve enregistrée, sans nouvel appel |
| 2:25–2:40 | Retour à l’interface et résumé des tests | 96 tests automatisés, 30 contrôles navigateur ; statut PARTIAL vs SUCCESS ; runtime métier non vérifié |

Attends la fin de chaque opération avant de changer d’onglet. Pour un appel réel, le temps de réponse et le score final peuvent différer de la simulation : montre les valeurs effectivement retournées. Si une attente est raccourcie au montage, signale cette coupe sans changer les mesures affichées.

## 5. Faire un essai d’enregistrement sur Mac

Commence par un essai de dix secondes pour vérifier que ta voix et les textes sont lisibles.

1. Affiche uniquement la fenêtre de démonstration dans le cadrage choisi et active le mode de concentration pour éviter les notifications.
2. Appuie sur **Maj + Commande + 5**.
3. Choisis l’enregistrement de la partie sélectionnée et encadre l’application.
4. Dans **Options**, sélectionne ton microphone, un minuteur et l’emplacement d’enregistrement. L’affichage des clics peut aider à suivre la démonstration.
5. Lance l’essai, parle quelques secondes et clique sur **Analyze code**.
6. Arrête avec **Commande + Contrôle + Échap**, puis lis le fichier pour vérifier le son et le cadrage. [Procédure officielle Apple](https://support.apple.com/fr-fr/102618).

Une fois cet essai correct, filme les scènes. Tu peux les enregistrer séparément si c’est plus confortable. Le montage assemblera les prises et retirera le début et la fin des captures.

## 6. Avant la publication

Nous relirons ensemble la vidéo : texte lisible, son compréhensible, récit conforme au résultat observé, mode et modèle identifiables, durée sous trois minutes et traduction anglaise si nécessaire. Puis vérifier les liens de la soumission dans un navigateur déconnecté. La publication YouTube et l’envoi sur Devpost sont des étapes séparées du tournage.

**Prochaine action immédiate : répéter une fois les clics sans enregistrer, puis faire l’essai de capture de dix secondes décrit à l’étape 5.** Aucun autre appel au modèle n’est nécessaire pour cette répétition.
