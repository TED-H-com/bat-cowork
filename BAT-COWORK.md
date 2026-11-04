# bat-cowork

Server-first development workstation.

- The desktop is the BAT Tauri / React workflow. The BAT renderer is imported into `apps/bat-desktop`, under a new Tauri crate with its own app id (see `apps/bat-desktop/README.md`).
- The daemon is this Paseo tree, locked at `cf2b3f4bb31c8f6041b156d9da54c06fea12c86f` (Paseo 0.11.0-beta.4). The previous lock was `53ee9cd9930d9479af318c1ed29713a0bfb5f47b`.
- Task rules run in the daemon process: `packages/cowork-core`, bundled into `packages/server/src/server/cowork/reducer.js`. There is no second Python task daemon.

This repository is not an official Paseo or Better Agent Terminal build.
Product name, app id, data directory, and update keys stay separate from both
upstreams. Automatic update is off until a new trust chain exists.

## Remotes

- `origin`: this product
- `upstream-paseo`: https://github.com/getpaseo/paseo

`baseline/paseo-w0` is the untouched snapshot. Product work lands on `main`
above that commit. Do not merge the BAT host back in.

## Status

W0 is the only accepted package. W3 has local evidence. W1, W2, W4, W5, and W6 are not accepted.

See `docs/cowork/RELEASE-GATE.md` for full evidence descriptions, including how session views, multi-client locking, control takeovers, and timeline queries behaved under local daemon test conditions.

Not a release. Do not point this tree at a running production daemon or an existing BAT session.
