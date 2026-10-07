---
name: merge-dependabot
description: Bulk-merge and verify a batch of open Dependabot PRs into a single feature branch, instead of testing/merging them one at a time, then push once so GitHub can auto-close the now-redundant individual PRs.
---

# Merge Dependabot PRs in bulk

Use this skill when the user wants to "test all the Dependabot PRs at once", "merge the dependabot branches", "batch-verify dependency updates", or similar — there are many open Dependabot PRs (often npm/nuget dependency bumps) and testing/merging each individually is impractical.

## Why this approach

Merging each Dependabot PR one-by-one means running the full build/test suite dozens of times. Instead, merge every open Dependabot branch into one feature branch, resolve conflicts once, run the build/tests a single time, then push. Once that branch merges to the base branch, Dependabot re-scans and **auto-closes** the original individual PRs whose target versions are now already satisfied.

## Prerequisites

- A feature/working branch to merge into (create one if not already on one: `git checkout -b <feature-branch>`).
- `git fetch origin` run recently so remote Dependabot branches are visible locally.
- (Optional) [Dependabot CLI](https://github.com/dependabot/cli) installed, for dry-running a `dependabot.yml` config or validating that an update is no longer pending — it does not run your app's own build/test suite, only simulates PR metadata.

## Prompt User to commit changes

If there are unsaved changes in the workspace, encourage user to commit or discard changes; especially package.json and package-lock.json. This is not mandatory but encouraged.

## Steps

### 1. Enumerate the open Dependabot branches

```powershell
git ls-remote --heads origin | Select-String "dependabot/" | ForEach-Object { $_.Line -replace '.*refs/heads/', '' }
```

Group by ecosystem/app path (e.g. `dependabot/npm_and_yarn/apps/frontend/<app>/...`, `dependabot/nuget/...`). Skip any oddly-named stray branches (e.g. a bare `dependabot-<hash>` branch with no ecosystem prefix — these are usually abandoned/multi-directory grouping artifacts).

### 2. Merge each branch into the current feature branch, one at a time

```powershell
git merge --no-edit origin/dependabot/npm_and_yarn/<path>/<package>-<version>
```

Do this in a loop, but **stop and inspect on the first conflict** rather than blindly resolving everything — most conflicts are safe to auto-resolve, but some need judgment (see below).

**Auto-resolvable conflicts (safe):** if only `package-lock.json`/`*.lock` conflicts (not `package.json`/`*.csproj`), keep either side — it gets regenerated in step 3 anyway:

```powershell
git checkout --ours <lockfile>
git add <lockfile>
git commit --no-edit
```

**Manual conflicts (need judgment):** when `package.json` itself conflicts — this happens when two separate Dependabot PRs bump adjacent dependency lines (e.g. one branch bumps `@angular/common`, another bumps `@angular/compiler`, and both diffs touch neighboring lines). Resolve by **keeping both version bumps** (take the newer version from each side), not by picking one side wholesale.

### 3. Align any related packages Dependabot didn't cover (framework lock-step packages)

Dependabot opens one PR per package, but some ecosystems require a package family to stay aligned. For Angular, keep `@angular/core`, `common`, `compiler`, `compiler-cli`, `forms`, `platform-browser`, and `router` on the same exact patch because they declare exact peer versions. `@angular/cdk` and tooling packages such as `cli` and `build` may use different patch versions when their peer ranges permit it.

If Dependabot only opened PRs for a subset (e.g. just `common`/`compiler`/`core`), manually bump the rest to match:

```powershell
npm view <package> versions --json   # find the closest/matching version
```

Not every companion package publishes the exact same patch version (e.g. `@angular/cdk` may lag behind `@angular/core` by a few patches) — use the closest available version in that case; it's still safe since `cdk` only needs a compatible peer range, not an exact match.

(only if projects have snapshot tests) - If snapshot tests fail after merging Dependabot updates, review the changes carefully. Only update snapshots if the changes are expected and correct; do not make arbitrary style changes to the snapshots. Any changes in behaviour to the snapshots must be confirmed with the user before making changes to avoid updating a snapshot to match a failing test.

### 4. Regenerate lockfiles cleanly

```powershell
npm install     # one lockfile for all front-end projects
dotnet restore  # per affected .csproj, if nuget packages were merged
```

### 5. Build and test once, for everything

```powershell
npm run build   # build all frontend apps
npm test        # ng test for every project
dotnet build <solution>.slnx   # backend, if nuget packages were merged
cd e2e; npm run test   # run tests on all frontend projects. Full regression pass, if time allows
```

Investigate any build/test failure by checking whether it also fails on the pre-merge base commit (`git show <base-commit>:<file>` or a quick `git stash`/base checkout) before assuming it's a regression from the merged updates — this repo has a few pre-existing stale/scaffold tests and config quirks unrelated to dependency bumps.

### 6. Commit, push, and let Dependabot clean up

```powershell
git push --set-upstream origin <feature-branch>   # first push on a new branch
```

Once this branch is merged to the base branch, the individual Dependabot PRs for packages now satisfied should auto-close on Dependabot's next scan. Any that don't auto-close (e.g. because they targeted a stricter/different constraint) can be closed manually or with `@dependabot close`.

## Notes

- Don't reach for `npm audit fix` as part of this flow — it can pull in far more (and larger/riskier) updates than what the open Dependabot PRs cover. Stick to exactly what's being merged, then re-evaluate remaining vulnerabilities separately.
- This process works well for scoped batches (e.g. all PRs for one ecosystem/app). For a very large number of unrelated ecosystems/apps, consider running steps 2-5 separately per ecosystem so a conflict/failure in one doesn't block the others.
