# Agent guidance

Conventions and gotchas for AI agents working in this repo. Record new learnings
here — not in any agent's private/internal memory.

## Session Start Workflow

Before making code or documentation changes in this repo:

1. Switch back to `master`.
2. Pull the latest changes with `git pull --ff-only`.
3. Create a new branch with a short, descriptive name related to the feature being added or the bug being fixed.
4. Make the requested changes on that branch.

Do not start work from an old feature branch unless the user explicitly asks to continue that branch.

## Meeting numbering

A meeting's `n` is **frozen** — `assignNumber` (`src/sync/state.ts`) hands out
the next free number in its `{year}/{month}` bucket once and never reassigns it,
so deletions leave gaps and the counter only ever grows.

**The one exception is the manual merge** (`src/sync/merge.ts`, the
`Merge two meetings…` command). When two cross-source duplicates are merged, the
lower number survives and every later meeting *in the same bucket* shifts down by
one to close the gap; `state.counters[bucket]` is reset to the new max + 1. That
renames folders and folder-note files for the shifted meetings — `VaultIO.rename`
is backed by `app.fileManager.renameFile`, which rewrites internal links, so
this is the only path that renames/deletes vault files (the sync engine itself
only creates/overwrites). Merges are restricted to **disjoint sources** (one
MacParakeet + one Fellow); same-source pairs can't merge because the data model
holds one binding per source and artifact filenames are source-suffixed.

## Source timestamps (createdAt is a *start*, except MacParakeet)

The engine treats a `SourceMeeting.createdAt` as the meeting **start**: it dates
the note from it, buckets by its month, and builds the canonical matching
interval as `[createdAt, createdAt + durationMs]` (`intervalFromDuration`,
`src/sync/state.ts`).

**Gotcha — MacParakeet's `createdAt` is the recording END (save time), not the
start.** The CLI stamps it when the recording is finalized (its manifest is
generated within seconds of `createdAt`, for a meeting that ran far longer), and
it exposes *no* start field (only `createdAt`, `updatedAt`, `durationMs`; internal
metadata uses a monotonic `hostTime`, not wall-clock). So `MacParakeetAdapter`
(`src/sources/macparakeet.ts`) normalizes it to the real start
(`createdAt − durationMs`) before handing meetings to the engine. Without that,
every MacParakeet meeting's window lands one full duration too late, which
mis-dates notes and overlaps the *next* meeting during cross-source matching
(swallowing Fellow recaps into the wrong meeting). Fellow already maps
`createdAt` from a real `started_at` (`src/fellow/mapper.ts`) and is unaffected —
do not "fix" it. The derived start is only as good as `durationMs`; a paused or
re-recorded session whose duration no longer matches wall-clock can still be off.

## Fellow channel ids are Relay global ids

`filters.channel_id` on `POST /recordings` is **not** the numeric channel id
Fellow's UI and MCP tools show. It is `base64("Channel:<numeric id>")` — the last
path segment of a channel URL. `toChannelId` (`src/settings.ts`) accepts a URL, a
number, or the opaque id and normalizes all three; it validates by *decoding*,
because an id that merely looks like base64 fails as a mid-sync 400 instead.

The filter takes **one channel per request**, so `FellowClient.listRecordings`
fans out one paginated walk per channel and dedupes by recording id — a recording
can belong to several channels. Never add a fallback that drops the filter on
error: an unknown channel returns 400, and silently listing the whole workspace
instead would sync meetings into a vault chosen precisely to exclude them.

Full findings, including the absence of a channel-listing endpoint, are in
[docs/fellow-api-notes.md](docs/fellow-api-notes.md) §8.

## Releases

`.github/workflows/release.yml` cuts a GitHub release with:

    gh release create "$TAG" --title "$TAG" --generate-notes main.js manifest.json versions.json

`--generate-notes` builds the "What's Changed" section from the **pull requests
merged within the tag range**. The repo's normal flow is PR-based, and that
produces a proper changelog — e.g. `0.2.0` lists PRs #32–#36 in its body.

**Gotcha — an empty "What's Changed".** If a release's tag range contains no
merged PRs — because the change was committed straight to `master` and tagged
without going through a PR — `--generate-notes` has nothing to list and the body
is just the `**Full Changelog**` compare link. This is what happened to the
0.2.1, 0.2.2, and 0.3.0 point releases. It is **range-dependent, not a repo
convention**: this repo does use PRs, so don't describe it as a "direct-commit
repo".

When cutting a release that should have notes:

- **Land the change via a PR first** (the repo's usual flow), then tag — so
  `--generate-notes` has PR titles to list. Don't commit straight to `master`
  and immediately tag a release.
- Or pass explicit notes instead of relying on `--generate-notes`:
  `--notes "$(git log <prev-tag>..$TAG --pretty='- %s')"`, or `--notes-file`
  from a maintained `CHANGELOG.md`.
