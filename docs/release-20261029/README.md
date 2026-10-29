# Release validation — 29 October 2026

This release contains the standalone application, judge testing instructions, the recorded real Nebius/NVIDIA response and the final English demonstration video.

- Automated unit, route and CLI tests: **98 passed, 0 failed** (`tests.log`). The live-probe cases use injected offline transports.
- The curated source export typechecks before a build without generated Next.js declarations, builds with the default `.next` directory, and typechecks after the build. See `export-*.log`.
- Validation uses the already installed locked dependency versions, linked into a clean temporary source export. It does not claim a fresh network dependency installation.
- Current source files and historical Git blobs were checked for the known private credential and high-confidence credential patterns (`SECRET_SCAN.json`). Private environment files and production caches are excluded.
- `SOURCE_MANIFEST.json` fingerprints the selected application, documentation, evidence and final media files, before adding this release-validation record itself.
- The earlier 30 browser checks remain dated evidence in `docs/progressive-ui-20261028/`; they were not repeated for packaging because the UI is unchanged.
- No new paid inference request was made. The saved real response remains a controlled credential-repair fixture; the interface demonstration is separately labelled simulation. Runtime behavior is not verified.

Public video: https://youtu.be/6gfGnUcbGi0
