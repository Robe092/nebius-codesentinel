# Vérification du second avis — 29 octobre 2026

## Verdict

Les retouches ciblées sont vérifiées hors ligne. La vidéo n’a pas été modifiée et ne nécessite pas de nouvelle prise pour le parcours décrit. Les liens publics et l’envoi Devpost restent à finaliser. Ce rapport ne certifie pas une exécution métier ni la qualité de toute future sortie du modèle.

## Constats vérifiés

- **P1, liens publics : confirmé.** Les emplacements de liens publics sont toujours en attente dans `SUBMISSION_DEVPOST.md`. Aucune publication n’a été effectuée pendant cette vérification.
- **P2, environnement du modèle : confirmé et corrigé dans le périmètre documenté.** L’ancien exemple `samples/clean_workflow.ts` obtenait 100 au contrôle statique mais échouait réellement au contrôle TypeScript avec TS2792 pour `./guardrails`. Le prompt du client ne fournissait pas le contrat des helpers. L’exemple utilise maintenant le helper global existant `verifyHumanApproval(event)` et le prompt décrit sa signature, `$json`, `process.env` et `./notifier`. Aucun module applicatif arbitraire ni helper d’exécution fictif n’a été ajouté au compilateur. La nécessité de fournir les implémentations dans un véritable hôte reste documentée.
- **P3, typecheck bloqué : non reproduit.** Une copie sans `.next-polish-build` passe le typecheck avec la référence générée telle quelle et avec cette référence retirée. Une seconde copie passe aussi le typecheck sans `next-env.d.ts`, puis le build Next par défaut et le typecheck après génération. Le fichier est généré et n’est pas suivi par Git. Il est omis du nouvel export de relecture pour ne pas transporter une référence locale inutile. Les dépendances étaient celles déjà installées, liées dans le dossier temporaire ; aucun `npm install` réseau neuf n’a été prétendu.
- **P4, périmètre du live : limite confirmée, pas modifiée.** La vidéo distingue déjà la simulation à trois findings et la sonde réelle de secret sur une fixture réduite. Aucun nouvel appel réel n’a été fait. Les tests du nouveau contrat utilisent un transport local contrôlé, ils ne démontrent pas qu’un nouvel appel multi-règles à Nemotron réussirait.
- **P5, script vidéo : corrigé.** Le script racine renvoie maintenant au montage réel de 109,667 secondes, à ses minutages et à la narration exacte. Le scénario préparatoire de 2 min 40 est archivé. Le README précise déjà que les commandes partent de la racine du dépôt autonome ; son indication conditionnelle pour l’espace parent reste valide. L’architecture décrit désormais cette racine autonome.

## Validation

Les deux nouveaux tests ont d’abord échoué pour les défauts attendus (`red.log`), puis passent après la retouche (`green.log`). La suite complète canonique `MOCK_MODE=true npm test`, avec `ENABLE_LIVE_REPAIR` non défini dans ce processus de test, passe **98/98** (`full-tests-canonical.log`). Le build et les typechecks de la copie propre passent. Aucun code généré n’a été exécuté et aucun appel payant n’a été lancé.

Un premier lancement de la suite avec `ENABLE_LIVE_REPAIR=false` a donné **91 réussites / 7 échecs** : ce drapeau bloque volontairement aussi les transports injectés de la bibliothèque de sonde, alors que ces tests cherchent à exercer ces transports hors ligne. Ce n’est pas une régression provoquée par le prompt. Les échecs concernés, conservés dans `full-tests.log`, sont :

1. `A failed library probe returns FAIL without changing the caller exit status`
2. `R2 Offline: runLiveVerification counts primary & fallback attempts accurately on offline stub`
3. `Invalid primary deleted program with an environment comment is rejected before a valid fallback`
4. `Invalid fallback deleted program with an environment comment never becomes a verified repair`
5. `Invalid primary replacement hardcoded credential is rejected before a valid fallback`
6. `Invalid fallback replacement hardcoded credential never becomes a verified repair`
7. `Valid controlled primary repair succeeds without an unnecessary fallback`

La commande canonique a ensuite été relancée sans ce drapeau de blocage ; les transports de ces cas restent injectés et aucune requête fournisseur ne part. Le guide des juges précise cette distinction. Le serveur de l’application garde son mode de simulation.

Les 30 contrôles navigateur précédents restent des résultats datés, non réexécutés ici : aucun composant d’interface n’a changé. Les fichiers de preuve réelle et le MP4 final sont identiques octet pour octet à l’archive qui a été relue. Le patch ciblé figure dans `changes-from-reviewed-snapshot.patch` et distingue ces retouches des nombreuses modifications plus anciennes déjà présentes dans Git.
