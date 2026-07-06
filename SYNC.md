# Upstream sync

This repository is a fork of [DataDog/rum-events-format](https://github.com/DataDog/rum-events-format).
The `openobserve` branch is **generated** from an upstream commit rather than merged:

```
upstream commit  →  keep-ours overlay  →  rebrand codemod  →  yarn generate  →  format
```

Consumed by [openobserve/browser-sdk](https://github.com/openobserve/browser-sdk), which pins a
specific commit of the `openobserve` branch as the `@openobserve/rum-events-format` dependency and
validates emitted RUM/telemetry events against these schemas.

## What the fork changes

Everything is expressible as codemod rules — there is **no hand-editing of schemas or generated
files**, and **no functional patch series** (unlike browser-sdk).

| Change | How |
| --- | --- |
| `_dd` event namespace → `_oo` | `rename-map.json` regex `\b_dd\b` → `_oo`, applied to `schemas/` + `samples/` |
| `"openobserve"` added to the tracing-propagator enum | `rename-map.json` literal rule on `configuration-schema.json` |
| Repository URL / package description | `rename-map.json` literals on `lib/package.json` |
| LICENSE, NOTICE, README, `.github/` | fork-owned (`keep-ours.txt`), taken from the `openobserve` branch |
| `lib/generated/**` (TS/JS types) | **regenerated** from the rebranded schemas by `yarn generate` — never hand-edited |

## Components

| Piece | Purpose |
| --- | --- |
| `scripts/openobserve/rename-map.json` | Ordered rebrand rules |
| `scripts/openobserve/rebrand.mjs` | Applies the map to every tracked schema/sample file |
| `scripts/openobserve/keep-ours.txt` | Fork-owned paths taken from `openobserve` |
| `scripts/openobserve/UPSTREAM_BASE` | Upstream commit the branch is currently built from |
| `scripts/openobserve/sync-upstream.sh` | Orchestrates the pipeline, produces `sync/upstream-<short>` |
| `.github/workflows/sync-upstream.yml` | Monthly cron + manual dispatch; validates, opens the PR |

## Running locally

```bash
bash scripts/openobserve/sync-upstream.sh                 # tip of upstream default branch
bash scripts/openobserve/sync-upstream.sh <full-sha>      # a specific upstream commit
SKIP_GENERATE=1 bash scripts/openobserve/sync-upstream.sh # rebrand only, no yarn/generate
```

Then: `yarn validate`, push the `sync/upstream-<short>` branch, open a PR against `openobserve`.

## Keeping browser-sdk in lockstep

The schema commit and the SDK that emits `_oo` must move together. After a fork sync PR merges,
bump the browser-sdk pin to the merged commit:

```bash
# in the browser-sdk repo
yarn openobserve:schemas --update <merged-commit-sha>
```

The browser-sdk monthly sync runs 30 min after this repo's, so a fresh schema commit is available.

## Release cadence

- Minor/patch upstream changes: synced automatically by the monthly cron (05:30 UTC, 1st of month).
- The workflow fails loudly (opens an issue) if validation fails or a stray `_dd` leaks into
  `schemas/`/`samples/`.
