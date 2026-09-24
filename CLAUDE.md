# cogheim-site

The public website at **cogheim.com**, plus the `/backstage` private console.

This file exists so a session does not have to rediscover how publishing works.
Read the "Publishing" section before making any change intended to go live.

---

## Publishing: how a change reaches cogheim.com

**Only a push to `main` publishes anything.**

```
push to main  →  .github/workflows/daily-captains-log.yml  →  wrangler deploy  →  cogheim.com
```

The whole run takes roughly 30 seconds.

### Work directly on `main` for site content

A devlog post, a Captain's Log correction, a copy fix, new art — commit it to
`main` and push. That push is the deploy.

Branch-and-PR is the wrong shape for this repo's content work. A push to a
`claude/*` branch **changes nothing on the live site**, because the deploy
workflow only listens to `main`. The work sits on the branch until someone
merges it. If a session is scoped to a feature branch and the goal is to
publish, say so and get that scope lifted rather than pushing somewhere the
deploy does not watch.

`main` is unprotected: no required reviews, no required checks. A push
succeeds and deploys immediately. That is deliberate — treat it with the care
that implies, because there is no gate between a commit and the public site.

### Deploy method: Wrangler direct upload, not Git integration

The Cloudflare project serving cogheim.com (`super-mode-9b19`) was created as a
**Direct Upload** project, and Cloudflare does not allow converting one to Git
integration after the fact. So GitHub holds version history, and the workflow
deploys via `wrangler deploy` with an API token.

There is no git-triggered Cloudflare build. Connecting the repo in the
Cloudflare dashboard will not work. Do not propose it as a fix — the only route
to true git-triggered deploys is a new Pages project with the domain migrated
across, which has already been considered and rejected.

`wrangler.toml` uploads `./site` as static assets and `worker.js` as the Worker.

---

## Layout

| Path | What it is |
|---|---|
| `site/` | Every public page and asset. Uploaded wholesale on each deploy. |
| `worker.js` | Serves `/backstage`; hands everything else to the static assets. |
| `wrangler.toml` | Worker name, assets binding, D1 binding. |
| `master_index.md` | The Cogheim master plan. See "Canon" below. |
| `.github/workflows/daily-captains-log.yml` | The only workflow. Deploys, and runs the daily generator. |

---

## Two content streams, which behave differently

### Devlog posts — written by hand

A post is a standalone page plus a card on the hub:

1. Create `site/devlog-<slug>.html`.
2. Add a `.post-card` block at the **top** of the posts `<section>` in
   `site/devlog.html` — newest first. Copy the shape of the existing cards:
   eyebrow (`DD Month YYYY &middot; Category`), `<h3>` title, `.ptag` spans,
   a one-paragraph summary, and a `.readmore` link to the page.
3. Add the hero image beside it, e.g. `site/devlog-<slug>-hero.jpg`.

The workflow diffs each push for **newly added** `site/devlog-*.html` files and
posts them to the `#devlog-updates` Discord channel after the deploy succeeds.
Renaming an existing post will not notify; only an added file does.

### Captain's Log — generated, do not hand-write

`site/generate_captains_log.py` runs daily at 06:30 Mountain. It reads **one**
line for today's date from `site/devlog_queue.md`, sends it to the Anthropic
API, and writes `site/captains-log-YYYY-MM-DD.html`, then swaps the hero block
in `site/captains-log.html` and demotes the previous entry into the list below.

To queue an entry, append one line to `site/devlog_queue.md`:

```
[ ] (2026-09-22) One sentence, already safe to say publicly.
```

The generator consumes exactly one line per run and marks it `[x]`. With no
line for today it exits cleanly and does nothing — which is the normal case on
most runs.

Do not hand-author `captains-log-*.html` pages or hand-edit the hero markers in
`captains-log.html`. The generator owns that structure, and editing it by hand
will collide with the next run. Never paste raw session content into the
queue — one curated sentence.

---

## The workflow's failure shape

Steps run in this order, and **`wrangler deploy` is near the end**:

1. Checkout (`fetch-depth: 2`, needed for the devlog diff)
2. Detect new devlog posts in the push
3. Discord history backfill *(marker-guarded, `continue-on-error`)*
4. Concept art backfill *(marker-guarded, `continue-on-error`)*
5. Generate today's Captain's Log entry *(`continue-on-error`)*
6. Commit and push if anything changed
7. Install Wrangler
8. **Deploy to Cloudflare**
9. Discord notifications

Steps 3–5 carry `continue-on-error: true` on purpose. All three are optional
enrichment, and step 5 makes a metered Anthropic API call that can fail for
reasons having nothing to do with the site. Without the guard, one API hiccup
kills the job before step 8 and a perfectly good site edit silently fails to
publish — a push that appears to succeed while cogheim.com never changes.

**Do not move `wrangler deploy` earlier to "fix" this.** It sits after the
generator so that a freshly generated Captain's Log entry ships in the same
run. Moving it up would delay every new entry by a day.

The two backfills are guarded by `site/.discord_backfill_done` and
`site/.concept_art_backfill_done`. Both markers are committed and both
backfills are permanently no-ops now. Deleting a marker re-fires that backfill
and re-posts history to Discord.

### Required repo secrets

`ANTHROPIC_API_KEY` (metered, not covered by a Claude subscription),
`CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit),
`DISCORD_DEVLOG_WEBHOOK`, `DISCORD_CAPTAINSLOG_WEBHOOK`,
`DISCORD_CONCEPTART_WEBHOOK`. The Discord hooks are optional — unset ones skip
rather than fail. The Cloudflare account ID is hardcoded in the workflow.

### Daylight saving

The cron is UTC and ships set for MDT (`30 12 * * *` = 06:30 Denver). It needs
flipping to `30 13 * * *` when Mountain goes to MST. A missed hour twice a year
was accepted over more machinery.

---

## /backstage

`worker.js` serves `/backstage` — a private console reading the master plan and
production status from D1 (`cogheim-backstage`), with a Google Drive path as
its live source. Authentication is **Cloudflare Access** on `cogheim.com/backstage*`.
The Worker performs no auth of its own and must never be described as if it
does. The nightly sweep writes D1; the Worker is not redeployed when that data
changes.

---

## Canon

`master_index.md` is the living record — no version numbers, one document.
The authoritative copy lives in the **Cogheim folder in Google Drive** beside
`cogheim_production_status.json`, and that is what sessions read. The copy in
this repo is a mirror and can lag.

Canon moves. Rulings get overturned, names get retired, seals get lifted. Check
the master plan's change log before asserting any canon rule on a public page,
and do not carry a rule forward from an old commit message or an old page —
several have already been reversed.
