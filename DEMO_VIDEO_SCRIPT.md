# CodeSentinel — Final video and narration

The current video is **109.667 seconds (about 1 min 50)**, exported on 29 October 2026 in 1920 × 1080 at 30 fps, H.264/AAC, with English narration and 47 burned-in English captions.

- [Final video](deliverables/video-20261029/CodeSentinel_EN_1080p.mp4)
- [Exact narration](deliverables/video-20261029/NARRATION_EN.txt)
- [Timed English subtitles](deliverables/video-20261029/CodeSentinel_EN.srt)
- [Technical export verification](deliverables/video-20261029/VERIFICATION.json)
- [Editing notes and limitations](deliverables/video-20261029/README_FR.md)

The earlier 2 min 40 rehearsal script is preserved in [the follow-up record](docs/astra-followup-20261029/DEMO_VIDEO_SCRIPT_previous.md.txt). It describes preparation, not the final cut.

| Final time | What is shown | Provenance |
| --- | --- | --- |
| 00:00–00:12 | Problem and project introduction | Editorial opening with an actual example excerpt |
| 00:12–00:28 | Workspace and payment webhook source | Recorded interface; simulation disclosed |
| 00:28–00:39 | Analyze code, three findings, initial 45/100 rule score | Simulated interface run |
| 00:39–00:45 | Repair source and 100/100 configured-rule result | Simulated proposal, not a new NVIDIA response |
| 00:45–01:04 | Side-by-side source comparison and verification limits | Recorded comparison; code is not executed |
| 01:04–01:17 | 14 targeted tests and their saved runner output | Local offline tests recorded on 29 October |
| 01:17–01:40 | Saved NVIDIA/Nebius response, returned code and provider metadata | One controlled real request from 28 October |
| 01:40–01:50 | Conclusion and developer review | Editorial closing |

## Scope of the demonstration

The three-issue interface repair is deterministic simulation, identified in the image and narration. The separate real model response repairs a fictitious credential in a smaller controlled fixture. Its provenance is preserved in `docs/live-proof-20261028/`.

The rule score covers configured checks. Static rules, TypeScript diagnostics and structural checks do not prove runtime behavior or general business equivalence. Generated code is never executed by the application.

Cuts, holds and crops follow the narration. The video is not a performance benchmark. The video is now public on [YouTube](https://youtu.be/6gfGnUcbGi0); its link is recorded in `SUBMISSION_DEVPOST.md`.
