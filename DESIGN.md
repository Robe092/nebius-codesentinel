# CodeSentinel workspace

## Product and surface

Operate mode. A developer inspects an automation script, identifies rule violations, requests a repair and inspects the evidence before using the result. The hackathon jury should understand that sequence in a short screen recording. Preserve the dark workspace and Nebius/NVIDIA identity; concentrate visual emphasis on the source-to-patch transformation.

## Tokens

- Canvas `#0c1015`, workspace `#121820`, raised surface `#19212b`.
- Borders `#303b48`; primary text `#edf2f7`, secondary text `#a5b2c1`.
- NVIDIA action green `#b4e66b`, restrained Nebius violet `#c3acf7`.
- Error `#ff9aab`, warning `#edc782`, information `#9fc7ef`.
- Native system sans for product UI, 14px body / 1.55 line height; 12px supporting labels; 30px page heading. Native monospace for source and numeric evidence only, 13px / 22px.
- 4px spacing base. 8px controls, 12px panels. Borders separate editing and analysis regions; no decorative glows or gradients.

## Layout and behavior

One quiet header, a short task heading and a three-stage progress indicator. A narrow scenario rail accompanies the main source/results workbench on wide screens. Collapse the rail above the workbench on smaller screens. Stack editing and results below 1000px. At mobile sizes all actions remain reachable; code scrolls inside its pane.

The diagnostic panel provides an actionable introduction before any audit. Findings navigate to the relevant source line. Repair results show actual scores and patch provenance, with an execution trace, a line-by-line comparison and a downloadable evidence report. English is the consistent UI language for the international jury.

Simulation is labelled `MOCK_SIMULATED`. Health probes, request round trips and model inference are distinct concepts. Do not display constants as measured benchmarks. Rule checks do not certify compilation or runtime behavior. Editing the source invalidates previous results. Loading disables conflicting changes; failed requests show a recovery action. Keyboard focus is visible, tabs support arrow keys, and reduced-motion preferences are respected.

## Scope

Finish the local cockpit and its evidence display. Preserve API and CLI compatibility and the existing analyzer/orchestrator. No deployment, paid inference, video generation or contest submission in this pass.
