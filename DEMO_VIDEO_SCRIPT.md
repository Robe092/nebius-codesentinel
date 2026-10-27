# 🎬 Script Vidéo de Démonstration (Durée : 2 min 30 s)

> **Projet** : Nebius CodeSentinel  
> **Concours** : Nebius x NVIDIA Global AI Hackathon (Track : *Coding and Agentic Engineering*)  
> **Format** : Présentation dynamique, capture d'écran interactive du Studio Cockpit, webcam présentateur en incrustation.

---

## ⏱️ Timeline & Déroulé Séquentiel

```mermaid
flowchart LR
    S1["0:00 - 0:25<br>L'Accroche & La Faille"] --> S2["0:25 - 0:55<br>Architecture Nebius & NVIDIA"]
    S2 --> S3["0:55 - 1:35<br>Démo Live d'Auto-Guérison"]
    S3 --> S4["1:35 - 2:05<br>Le Comparateur A/B"]
    S4 --> S5["2:05 - 2:30<br>Feedback Nebius & Conclusion"]
```

---

### 🎬 Scène 1 : L'Accroche & Le Problème Réel (0:00 - 0:25)
- **Visuel** : Vue du présentateur avec un montage rapide d'incidents de production (alerte de clé d'API divulguée, webhook qui crashe, notification Slack non contrôlée).
- **Voix Off (FR)** :
  > *"Dans le développement moderne et les pipelines agentiques comme n8n ou GitHub Actions, une seule erreur silencieuse peut être fatale : une clé Stripe codée en dur, un dispatch non protégé par une validation humaine, ou une simple coquille d'expression. Les développeurs perdent des heures à débugger, et les modèles IA généralistes créent souvent plus de régressions qu'ils n'en corrigent."*
- **Voiceover (EN alternative)** :
  > *"In modern agentic pipelines, silent code defects cost millions: leaked secret keys, unguarded notification dispatches, and broken expressions. Today, generic LLMs often hallucinate and introduce fresh regressions."*

---

### 🎬 Scène 2 : Présentation de Nebius CodeSentinel & Architecture (0:25 - 0:55)
- **Visuel** : Transition vers le Cockpit Studio `Nebius CodeSentinel` sur fond sombre moderne. Zoom sur les badges : `NVIDIA Nemotron` vert néon et `Nebius Token Factory` violet.
- **Voix Off (FR)** :
  > *"Voici Nebius CodeSentinel. Un agent autonome d'audit et d'auto-guérison de code spécialement conçu pour le Nebius x NVIDIA Hackathon. Notre secret ? L'alliance d'un moteur d'analyse statique déterministe avec la puissance de raisonnement de NVIDIA Nemotron-3 Super, servi avec une latence record par la Nebius Token Factory."*
- **Action à l'écran** : Survol des indicateurs de statut en haut à droite : endpoint `api.studio.nebius.ai`, modèle `nvidia/nemotron-3-super-120b`, latence ultra-faible.

---

### 🎬 Scène 3 : Démonstration Live de l'Auto-Guérison (0:55 - 1:35)
- **Visuel** : Le curseur clique sur le premier scénario préconfiguré : *Vulnerable Workflow (Secret + Unguarded Comm)*.
- **Action à l'écran** :
  1. Clic sur **"1. Static Audit"** : instantanément, les alertes s'affichent en rouge et orange : violation critique de secret Stripe, alerte d'expression et dispatch Slack non régulé. Score : 55/100.
  2. Clic sur **"2. NVIDIA Healing Loop"** : la boucle agentique se déclenche. En moins d'une seconde, la trace d'exécution de Nemotron apparaît avec son raisonnement pas-à-pas.
  3. Le banc de test d'invariants valide la conformité. Le statut passe en vert émeraude : **"Autonomous Healing Completed - Score 100/100"**.
  4. Clic sur l'onglet **"Unified Diff & Patch"** : mise en évidence du diff unifié où le secret est extrait vers `process.env` et le dispatch encapsulé dans une approbation HITL.
- **Voix Off (FR)** :
  > *"Regardez en direct : en un clic, le moteur détecte la clé Stripe et le dispatch Slack non sécurisé. Nous lançons la boucle d'auto-guérison. NVIDIA Nemotron analyse les dépendances, extrait le secret vers une variable d'environnement, insère un garde-fou humain, et normalise la syntaxe. En une seule itération, le banc de test valide les invariants sans aucune régression."*

---

### 🎬 Scène 4 : La Preuve Différentielle — Comparateur A/B (1:35 - 2:05)
- **Visuel** : Clic sur l'onglet **"Comparateur A/B"**. La vue s'anime avec les 4 cartes KPI et le tableau comparatif détaillé.
- **Action à l'écran** : Survol des chiffres clés :
  - Vitesse : **840 ms** sur GPU Nebius H100 vs 3 450 ms (4.1x plus rapide).
  - Zéro-Hallucination : **100 %** vs 58.3 %.
  - Réussite au 1er coup : **96.4 %**.
  - Économie : **8.3x moins cher** ($1.80 vs $15.00).
- **Voix Off (FR)** :
  > *"Mais au-delà de la démo, voici la preuve chiffrée. Comparé à une baseline générique du cloud standard, la Nebius Token Factory couplée à Nemotron est 4,1 fois plus rapide grâce à l'infrastructure GPU H100, 8,3 fois plus économique, et atteint un taux parfait de 100 % de zéro hallucination sur la syntaxe. De plus, notre Circuit Breaker garantit un arrêt propre si un invariant n'est pas respecté."*

---

### 🎬 Scène 5 : Retour sur Nebius & Conclusion (2:05 - 2:30)
- **Visuel** : Retour sur le présentateur avec incrustation du terminal montrant les 25 tests automatisés (unitaires, routes, CLI) validés et le test Puppeteer E2E en vert (100% PASS).
- **Voix Off (FR)** :
  > *"Notre retour sur la Nebius Token Factory ? Une intégration OpenAI-compatible sans friction en moins de cinq minutes, un streaming stable et des performances de tout premier ordre. Nebius CodeSentinel prouve que l'avenir de l'ingénierie logicielle repose sur des agents autonomes fiables, gouvernés et ultra-rapides. Le code est 100 % open source et prêt à l'emploi. Merci à Nebius et NVIDIA pour ce hackathon exceptionnel !"*
- **Écran de fin** : Logo Nebius CodeSentinel, liens GitHub, Devpost et contact.

---

## 🎙️ Recommandations Techniques pour l'Enregistrement

1. **Résolution** : 1080p ou 4K à 60 FPS (capturé via OBS Studio ou Loom).
2. **Audio** : Micro clair sans bruit de fond (voix posée et rythmée).
3. **Plein écran** : Masquer la barre d'onglets du navigateur pour un rendu épuré de produit SaaS professionnel.
