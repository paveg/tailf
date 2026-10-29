# Database Migrations Runbook

How schema changes reach the D1 database (`tailf-db`).

## Policy

- `apps/api/src/db/schema.ts` is the source of truth.
- Migrations are generated with `pnpm db:generate` (drizzle-kit) and committed exactly as generated.
- Never hand-write or hand-edit migration SQL, `apps/api/migrations/meta/_journal.json`, or the `meta/*_snapshot.json` files.

Why: 0006-0010 were hand-written and applied with wrangler. drizzle-kit never recorded them, so its snapshots stopped at 0005 and the next `drizzle-kit generate` wanted to re-emit DDL production already had. The rebaseline commit (`chore(api): rebaseline drizzle-kit migration metadata`) fixed that once; keeping to this policy keeps it fixed.

File names: new migrations get a timestamp prefix (`migrations: { prefix: 'timestamp' }` in `apps/api/drizzle.config.ts`), e.g. `20261029133818_awesome_roland_deschain.sql`. wrangler orders migrations by leading number, then name, so timestamps always sort after the hand-written `0001`-`0010` files. An index-prefixed `0001_*` would run before the `feeds` table exists on a fresh database.

## Changing the schema

1. Edit `apps/api/src/db/schema.ts`.
2. Generate the migration:

   ```sh
   pnpm db:generate
   ```

   It also refreshes `apps/api/db/schema.sql` (a dump of all migration files); commit that too.
3. Review the new `.sql` file. It must contain only your change. If it contains anything else, stop and run the drift check below.
4. Apply it locally and run the tests:

   ```sh
   pnpm db:migrate:local
   pnpm test
   ```

5. Open the PR. CI fails if `schema.ts` and `apps/api/migrations/` disagree.

## DDL drizzle cannot express

The FTS5 virtual table and triggers from `0005_add_fts5_search.sql` are not modelled by `schema.ts`. This is the single sanctioned way to add such DDL:

```sh
pnpm --filter @tailf/api exec drizzle-kit generate --custom --name=<name>
```

drizzle-kit creates the empty file; fill in the SQL and have it reviewed in the PR. `--custom` copies the previous snapshot and does not look at `schema.ts`, so a `schema.ts` edit must go through plain `pnpm db:generate` first. Never use `--custom` to record a model change.

## Production

Migrations appear to be applied by Workers Builds when a commit lands on `main`, before the Worker is deployed. This is inferred, not read from the build configuration:

- `d1_migrations.applied_at` for `0010_add_post_embedding.sql` is 2026-05-03 10:58:45 UTC, 19 s after PR #48 merged at 10:58:26 UTC. `0009` likewise landed a few minutes after its push.
- `pnpm build:prod` is `pnpm db:migrate:prod && pnpm build`.

The build command lives in the Cloudflare dashboard (Workers & Pages -> tailf -> Settings -> Build). Confirm it there before relying on this.

Consequence: the new schema is live before the new code, and the old Worker keeps serving until the deploy finishes. Every migration must be backward compatible with the currently deployed Worker:

- Additive changes (new nullable column, new table, new index) ship in one PR.
- Drops and renames use expand, deploy, contract across separate PRs: add the new shape, ship code that uses it, then remove the old shape in a later PR.

Do not run `pnpm db:migrate:prod` by hand unless the pipeline is broken.

## Rollback

```sh
pnpm db:rollback:local            # latest migration, local D1
pnpm db:rollback:prod             # latest migration, production D1 (--remote)
./scripts/rollback.sh <name>      # a specific migration, run from apps/api
```

`apps/api/scripts/rollback.sh` picks the last `migrations/*.sql` by file name (or the name you pass), prints it, asks for confirmation, then:

1. deletes its row from `d1_migrations` via `wrangler d1 execute`;
2. deletes the `.sql` file and `meta/<name>_snapshot.json`;
3. removes the entry from `meta/_journal.json`.

Limits:

- It does not undo the DDL. The schema change stays in the database; you must revert it by hand (`wrangler d1 execute ... --command "..."`).
- It edits `_journal.json` by script, the only exception to the policy above. Use it only to abandon a migration that has not been merged.
- With timestamp prefixes the snapshot is named `<timestamp>_snapshot.json`, not `<timestamp>_<name>_snapshot.json`, so step 2 leaves the snapshot file behind. Delete it by hand.
- Do not use it on a migration that is already in `main`: production has applied it, and removing the file does not reverse that.

## Checking for drift

On a clean `main`, this must report no changes and create no files:

```sh
pnpm --filter @tailf/api exec drizzle-kit generate
git status --short apps/api/migrations   # empty
```

Expected output ends with `No schema changes, nothing to migrate`. CI runs the same check on every PR.

If drizzle-kit asks whether a table or column was created or renamed, answer from the real history, never at random. Without a TTY (CI) it prints an error and exits 0 instead of prompting; the CI step therefore also requires the `No schema changes` line.

## Recreating the baseline

Only needed if the metadata drifts again (for example a hand-written migration slips through). `drizzle-kit generate --custom` cannot do this because it copies the stale snapshot, and plain `generate` would emit DDL production already has. `drizzle-kit pull` is the one command that writes a snapshot of the current state with SQL that is only a comment:

1. In a scratch directory (not the repo), install `drizzle-kit`, `drizzle-orm`, and `better-sqlite3`, copy `schema.ts`, and add a config with `dialect: 'sqlite'`, `dbCredentials: { url: './scratch.sqlite' }`, `migrations: { prefix: 'timestamp' }`, and `tablesFilter: ['!posts_fts*', '!d1_migrations', '!_cf_*', '!sqlite_*']`.
2. `drizzle-kit push --force` builds `scratch.sqlite` from `schema.ts`. Build it this way rather than from the migrations: `pull` reads the hand-written `DEFAULT 0` of `is_official` as `0`, which drizzle-kit then compares unequal to the `false` from `schema.ts` and answers with a table rebuild.
3. `drizzle-kit pull` refuses to write SQL while the output directory has snapshots, so it needs an empty `out`. Copy the resulting `.sql` and `meta/` into `apps/api/migrations/`, replacing the old `meta/`.
4. Check `drizzle-kit generate` reports no changes, and `wrangler d1 migrations apply tailf-db --local --persist-to <fresh dir>` applies everything.

The baseline `.sql` contains a block comment. wrangler appends `INSERT INTO d1_migrations ...` to every file it applies, so applying it only records the file name; no DDL runs and no data changes.
