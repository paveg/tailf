# Embeddings Backfill Runbook

After PR #2 ships, the production database has the `posts.embedding` column populated only for posts inserted *after* PR #1's deploy. This runbook covers backfilling the historical rows.

## When to run

- Once, immediately after PR #2 reaches production.
- Re-run if a new bulk-import (e.g. mass feed registration) leaves a wedge of NULL-embedding rows.

## Pre-flight

Confirm the endpoints are live:

```sh
curl -sS -H "Authorization: Bearer $ADMIN_SECRET" \
  https://tailf.pavegy.workers.dev/api/admin/embeddings/status
```

Expected: `{"data":{"total":N,"withEmbedding":M,"percent":P}}` where `M < N`.

## Run

Loop until `done: true`. Default batch size (100) is the right starting point; bump to 200 if you want to finish faster.

```sh
ADMIN_SECRET=$(op read 'op://tailf/admin-secret/password')   # or wherever you store it
HOST=https://tailf.pavegy.workers.dev

while true; do
  RESP=$(curl -sS -X POST \
    -H "Authorization: Bearer $ADMIN_SECRET" \
    -H "Content-Type: application/json" \
    -d '{"batchSize": 100}' \
    "$HOST/api/admin/embeddings/backfill")
  echo "$(date -u +%H:%M:%S) $RESP"
  echo "$RESP" | grep -q '"done":true' && break
  sleep 2
done
```

Expected wall time for ~5K posts at batchSize 100: ~50 batches × 3-5 s each = **3-5 minutes**.

## During the run

- Each call costs ~N + 3 subrequests. Workers Paid ceiling is 1000 — well under.
- BGE-M3 is billed per input tokens. ~5K posts × ~250 tokens average = ~1.25M tokens, roughly $0.015 total.
- D1 grows by ~20 MB (5K × 4096 bytes).

## After the run

```sh
curl -sS -H "Authorization: Bearer $ADMIN_SECRET" \
  "$HOST/api/admin/embeddings/status"
```

Expected: `withEmbedding == total`, `percent == 100`. If not, run the loop again — idempotent.

## Failure modes

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| HTTP 503 `AI binding not available` | Workers AI binding not configured for the deployed Worker | Check `wrangler.toml` and the Cloudflare dashboard's Worker bindings |
| HTTP 500 `computeBatch failed` | Workers AI rate-limited or model timeout | Wait 60 s, retry. The operation is idempotent — partial progress is preserved. |
| `errors[]` array in response | One or more individual posts hit `encodeEmbedding` length guard or D1 UPDATE failure | Investigate the listed post IDs. Re-running the backfill skips already-embedded posts and retries the failed ones. |
| `processed: 0, done: false` | Should not happen. Means the SELECT returned zero candidates but the COUNT > 0. | Possibly a transactional-isolation oddity. Wait 5 s and retry. |

## Stopping early

The endpoint is stateless. Killing the loop mid-run leaves the DB in a consistent state — already-embedded posts stay embedded, the rest stay NULL. Resume with the same loop.

## Local development note

If you ever need to clean up after running the backfill against a local D1, killing the dev server with `pkill -f "wrangler dev"` will terminate the parent process but may leave the `workerd` child holding port 8788. If a subsequent `pnpm dev:api` fails to bind, run `lsof -ti:8788 | xargs kill` to clear it.
