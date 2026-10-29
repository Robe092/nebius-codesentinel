# Vidéo CodeSentinel — 29 octobre 2026

- `CodeSentinel_EN_1080p.mp4` : montage avec la voix ElevenLabs fournie, sous-titres anglais intégrés, H.264/AAC 1920 × 1080 à 30 images/s, environ 1 min 50.
- `CodeSentinel_EN.srt` : sous-titres anglais séparés, disponibles si une plateforme demande un fichier de sous-titres. La version MP4 affiche déjà les sous-titres.
- `CodeSentinel_thumbnail.jpg` : miniature issue du carton d’ouverture.
- `preview.html` : lecteur local, sans téléversement et sans lecture automatique.
- `NARRATION_EN.txt` : texte de référence fourni pour la voix.
- `VERIFICATION.json` : mesures et vérification du fichier exporté.

## Montage

17 séquences : ouverture, vue du produit, extrait de source, clic d’analyse, trois findings, score initial, clic de réparation, résultat simulé, comparaison de source, limite des contrôles, résumé des tests, sortie des tests, preuve Nebius enregistrée, code réellement retourné, métadonnées fournisseur, rappel de provenance, conclusion.

Les gros plans proviennent des captures fournies. Les scores, les résultats des tests, le code et les métadonnées n’ont pas été modifiés. Le carton du code réel reproduit exactement le fichier de réponse déjà enregistré. Les séquences sont coupées ou maintenues pour suivre la voix et ne constituent pas une mesure de performance. Le caractère simulé du parcours applicatif et la provenance enregistrée de la preuve réelle sont indiqués dans l’image et la narration.

Les trois enregistrements originaux et la voix source ne sont pas modifiés. Le son des captures a été omis ; seule la narration fournie est utilisée, avec un niveau ajusté. Aucun appel Nebius, nouvelle synthèse vocale, musique, téléversement ou publication.

## Sources et reproduction

Les scripts Python, le plan, les images intermédiaires, la voix source et les captures originales sont conservés dans les dossiers de production locaux. Le dépôt public comprend le MP4 final, la miniature, la narration et les sous-titres ; les caches et fichiers de travail ne sont pas publiés.

Le montage utilise FFmpeg, Pillow et PyAV. L’alignement a été calculé localement avec faster-whisper puis corrigé à partir du texte de référence pour garder les noms de produit et les termes techniques exacts. La transcription ne remplace pas une écoute humaine de la prononciation.

## Dernière validation humaine

Lire le fichier entier avec le son avant publication : prononciation des noms, confort de lecture et raccords. La publication YouTube, les liens publics et la soumission Devpost restent des étapes séparées.
