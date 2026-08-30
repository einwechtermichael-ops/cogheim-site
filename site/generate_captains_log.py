#!/usr/bin/env python3
"""
generate_captains_log.py  (v2 — hero-container architecture)
COGHEIM — MAXIOM Captain's Log daily generator

WHAT CHANGED FROM v1
  The Captain's Log is no longer one growing page. Each day now gets its
  own standalone, SEO-indexable page (captains-log-YYYY-MM-DD.html), and
  captains-log.html becomes an index: TODAY's entry is featured inside
  the MAXIOM hero container (title, summary, link to the full page), and
  every previous entry drops into a plain, backgroundless list below it.

WHAT THIS DOES, each run
  1. Reads ONE curated line from devlog_queue.md for today's date.
     If there is no line for today: do nothing and exit cleanly. This
     script never invents a seed.
  2. Sends that single line to Claude with a locked system prompt that
     enforces the Captain's Log voice, a title, and a hard content-safety
     boundary (see CAPTAINS_LOG_SYSTEM_PROMPT below).
  3. Writes a new standalone page: captains-log-{date}.html
  4. Demotes the CURRENT hero entry (read from the HERO markers in
     captains-log.html) into a new row at the top of the plain list.
  5. Replaces the HERO markers' content with the new entry.
  6. Marks the queue line consumed.

WHAT THIS DELIBERATELY DOES NOT DO
  - Never reads Master Index, session transcripts, or any raw project
    file. Its only input is the single line a human queued.
  - Never fabricates a seed if the queue is empty for today.
  - Never touches maxiom-hero.jpg — that's a static asset you generate
    once and upload; this script only ever changes text.

USAGE
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 generate_captains_log.py --site-dir ./site --date 2026-08-31

  Dry run (no API call, no file writes):
  python3 generate_captains_log.py --site-dir ./site --dry-run

TESTED
  Templating, per-day page creation, hero-swap, list-prepend, and queue
  consumption have all been run end-to-end against a STUBBED model
  response (see the handoff doc for the test transcript). The live
  Anthropic API call itself has not been exercised in this sandbox — no
  API key is available here. Run it once for real and read the output
  before trusting the scheduled job unattended.
"""

import argparse
import datetime
import os
import re
import sys
import urllib.request
import json

QUEUE_FILENAME = "devlog_queue.md"
INDEX_FILENAME = "captains-log.html"
COUNTER_FILENAME = ".captains_log_counter"
HERO_BEGIN, HERO_END = "<!-- HERO:BEGIN -->", "<!-- HERO:END -->"
LIST_BEGIN, LIST_END = "<!-- LIST:BEGIN -->", "<!-- LIST:END -->"

CAPTAINS_LOG_SYSTEM_PROMPT = """You are ghostwriting a single "Captain's Log" transmission for the COGHEIM \
website, voiced as Tiffany Cloud-Field, Captain of the Drifter, logged via her MAXIOM unit. \
This is atmosphere and world-flavor for a still-in-development game, NOT a status report.

VOICE
- First person, Tiffany. Warm, plainspoken, a little wry. She is running a ship, not writing marketing copy.
- 3 short paragraphs, 120-220 words total.
- Grounded, physical, sensory. Corridors, decks, weather, crew — not abstractions.
- The entry may gesture at the day's real-world development note ONLY as loose, in-fiction texture. \
It must never read as a progress report.

HARD CONSTRAINTS — VIOLATING ANY OF THESE IS A FAILED OUTPUT
- No numbers of any kind: no percentages, dates beyond what's given, counts, version numbers, prices, or metrics.
- No named real-world tools, engines, companies, or technical terms (no "Unreal," "GitHub," "server," "build," etc).
- No specific COGHEIM system, feature, or mechanic name — allude, never name.
- No financial, legal, fundraising, or business information of any kind.
- No security, exploit, bug, or crash detail of any kind.
- No unreleased novel plot, twist, or sealed-lore content (Lyra Cross, Oasis interior, Extranos origin, \
Christine Chronos, Founder Seal, Book IV/V cliffhanger, Mordechai Stridefall, Armando's tell — never reference these).
- Do not claim anything is finished, shipped, or launching. Nothing is promised.

TITLE
- 2-5 words, evocative, human-readable, no colon-subtitle format, no COGHEIM jargon.

OUTPUT FORMAT — return EXACTLY this shape, nothing else:
TITLE: <the title>
---
<paragraph 1>

<paragraph 2>

<paragraph 3>"""


def read_queue(queue_path):
    if not os.path.exists(queue_path):
        return []
    entries = []
    for line in open(queue_path, encoding="utf-8"):
        raw = line.rstrip("\n")
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        consumed = stripped.startswith("[x]") or stripped.startswith("[X]")
        pending = stripped.startswith("[ ]")
        if not (consumed or pending):
            continue
        body = stripped[3:].strip()
        date_str = None
        m = re.match(r"^\((\d{4}-\d{2}-\d{2})\)\s*(.*)$", body)
        if m:
            date_str, body = m.group(1), m.group(2)
        entries.append({"consumed": consumed, "date": date_str, "text": body, "raw": raw})
    return entries


def pick_seed(entries, target_date):
    for e in entries:
        if not e["consumed"] and e["date"] == target_date:
            return e
    return None


def mark_consumed(queue_path, chosen):
    lines = open(queue_path, encoding="utf-8").read().splitlines()
    out = []
    for line in lines:
        if line.strip() == chosen["raw"].strip():
            out.append(line.replace("[ ]", "[x]", 1))
        else:
            out.append(line)
    with open(queue_path, "w", encoding="utf-8") as f:
        f.write("\n".join(out) + "\n")


def pick_hero_image(site_dir, log_number):
    """Round-robins through site/captains-log-hero-pool/manifest.json so
    consecutive posts don't repeat until the whole pool has cycled."""
    pool_dir = os.path.join(site_dir, "captains-log-hero-pool")
    manifest_path = os.path.join(pool_dir, "manifest.json")
    if not os.path.isfile(manifest_path):
        return None
    with open(manifest_path, "r", encoding="utf-8") as f:
        pool = json.load(f)
    if not pool:
        return None
    entry = pool[(log_number - 1) % len(pool)]
    return {
        "src": f"captains-log-hero-pool/{entry['file']}",
        "alt": entry["alt"],
    }


def next_log_number(site_dir):
    counter_path = os.path.join(site_dir, COUNTER_FILENAME)
    n = 1
    if os.path.exists(counter_path):
        try:
            n = int(open(counter_path).read().strip()) + 1
        except ValueError:
            n = 1
    with open(counter_path, "w") as f:
        f.write(str(n))
    return n


def call_claude(seed_text, model="claude-sonnet-4-6"):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    body = json.dumps({
        "model": model,
        "max_tokens": 500,
        "system": CAPTAINS_LOG_SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": f"Today's real-world seed (for loose texture only): {seed_text}"}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={"content-type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
    parts = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
    return "\n\n".join(parts).strip()


def parse_model_output(raw):
    m = re.match(r"^TITLE:\s*(.+?)\s*\n-{2,}\s*\n(.*)$", raw.strip(), re.S)
    if not m:
        raise ValueError(f"Model output didn't match the required TITLE/---/body shape:\n{raw!r}")
    title = m.group(1).strip()
    paras = [p.strip() for p in m.group(2).strip().split("\n\n") if p.strip()]
    if not (1 <= len(paras) <= 4):
        raise ValueError(f"Expected 3ish paragraphs, got {len(paras)}")
    return title, paras


def slugify_date(date_obj):
    return date_obj.strftime("%Y-%m-%d")


def render_standalone_page(title, log_number, date_obj, paras, prev_href="captains-log.html", hero=None):
    date_disp = date_obj.strftime("%d %b %Y").lstrip("0")
    date_iso = date_obj.isoformat()
    paras_html = "\n      ".join(f"<p>{p}</p>" for p in paras)
    hero_html = ""
    if hero:
        hero_html = (
            f'\n<div class="log-hero">\n'
            f'  <img src="{hero["src"]}" alt="{hero["alt"]}" loading="eager">\n'
            f'</div>\n'
        )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{title} — Captain's Log, {date_disp} | COGHEIM</title>
<meta name="description" content="A MAXIOM transmission from Tiffany Cloud-Field, Captain of the Drifter — Log {log_number:03d}, {date_disp}.">
<link rel="canonical" href="https://cogheim.com/captains-log-{date_iso}.html">
<meta property="og:type" content="article">
<meta property="og:title" content="{title} — Captain's Log, {date_disp}">
<meta property="og:description" content="A MAXIOM transmission from Tiffany Cloud-Field, Captain of the Drifter.">
<meta name="theme-color" content="#0C0F12">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Saira:wght@300;400;600&family=Saira+Condensed:wght@500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@graph": [
    {{"@type": "Article", "headline": "{title}", "datePublished": "{date_iso}",
      "author": {{"@type": "Person", "name": "Tiffany Cloud-Field"}},
      "publisher": {{"@type": "Organization", "name": "Limitless Game Makers LLC"}},
      "url": "https://cogheim.com/captains-log-{date_iso}.html"}}
  ]
}}
</script>
<style>
:root{{--iron:#0C0F12;--frost:#2A4F6F;--ember:#E26A26;--bronze:#B7903C;--steel:#4B515B;--ash:#A2A2A0;--parchment:#E8E2D4;--nav-safe-bottom:110px;--display:'Cinzel',serif;--body:'Saira',sans-serif;--label:'Saira Condensed',sans-serif;--mono:'JetBrains Mono',monospace}}
*{{margin:0;padding:0;box-sizing:border-box}}
body{{background:var(--iron);color:var(--parchment);font-family:var(--body);font-weight:300;line-height:1.65}}
a{{color:var(--bronze);text-decoration:none}}
nav{{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(12,15,18,.92);backdrop-filter:blur(10px);border-bottom:1px solid rgba(183,144,60,.25);padding-top:env(safe-area-inset-top)}}
.nav-inner{{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;padding:.85rem 1.25rem}}
.wordmark{{font-family:var(--display);font-weight:900;font-size:1.3rem;letter-spacing:.14em;background:linear-gradient(175deg,#E8D08A 10%,#B7903C 45%,#7A5E22 90%);-webkit-background-clip:text;background-clip:text;color:transparent}}
.nav-links{{display:flex;gap:1.6rem;font-family:var(--label);font-weight:500;font-size:.95rem;letter-spacing:.1em;text-transform:uppercase}}
.nav-links a{{color:var(--ash)}}
.plain-header{{padding:7rem 1.25rem 2rem;max-width:640px;margin:0 auto}}
.eyebrow{{font-family:var(--label);font-weight:600;letter-spacing:.32em;text-transform:uppercase;color:var(--ember);font-size:.8rem}}
h1{{font-family:var(--display);font-weight:700;font-size:clamp(1.6rem,4.4vw,2.3rem);color:#E8D08A;margin:.6rem 0 .3rem}}
.meta-line{{font-family:var(--mono);font-size:.75rem;letter-spacing:.04em;color:var(--steel);text-transform:uppercase}}
.log-hero{{max-width:640px;margin:1.4rem auto 0;border-radius:3px;overflow:hidden;border:1px solid rgba(183,144,60,.28)}}
.log-hero img{{width:100%;height:auto;display:block}}
section{{padding:0 1.25rem 3.5rem}}
.wrap-n{{max-width:640px;margin:0 auto}}
.tx{{border:1px solid rgba(183,144,60,.28);background:linear-gradient(180deg,rgba(42,79,111,.08),rgba(12,15,18,.5));padding:1.6rem 1.7rem;margin-top:1.2rem}}
.tx p{{font-size:1rem;margin-bottom:.9rem}}
.tx-sign{{font-family:var(--label);font-size:.8rem;letter-spacing:.1em;color:var(--steel);margin-top:1rem;text-align:right;font-style:italic}}
.btn-ghost{{font-family:var(--label);font-weight:600;letter-spacing:.14em;text-transform:uppercase;font-size:.85rem;border:1px solid var(--bronze);color:var(--bronze);padding:.55rem 1.2rem;border-radius:3px;display:inline-block;margin-top:1.8rem}}
footer{{border-top:1px solid rgba(183,144,60,.25);padding:3rem 1.25rem;text-align:center;color:var(--steel);font-size:.9rem}}
</style>
</head>
<body>
<nav><div class="nav-inner"><a class="wordmark" href="index.html">COGHEIM</a>
<div class="nav-links"><a href="index.html">Home</a><a href="devlog.html">Devlog</a><a href="captains-log.html">Captain's Log</a></div>
</div></nav>
<div class="plain-header">
  <p class="eyebrow">MAXIOM Transmission</p>
  <h1>{title}</h1>
  <p class="meta-line">Log {log_number:03d} &middot; {date_disp} &middot; Relayed &middot; Deck 6 Archive</p>
</div>
{hero_html}
<section><div class="wrap-n">
  <div class="tx">
      {paras_html}
      <div class="tx-sign">&mdash; T.C.F., Drifter, Deck 6</div>
  </div>
  <a class="btn-ghost" href="{prev_href}">&larr; All Transmissions</a>
</div></section>
<footer>&copy; 2026 Limitless Game Makers LLC &middot; Build. Move. Conquer.</footer>
</body>
</html>
"""


def render_list_row(title, log_number, date_obj, href, summary):
    date_disp = date_obj.strftime("%d %b %Y").lstrip("0")
    return (f'      <li class="plain-entry">\n'
            f'        <p class="pe-meta">Log {log_number:03d} &middot; {date_disp}</p>\n'
            f'        <h3><a href="{href}">{title}</a></h3>\n'
            f'        <p>{summary}</p>\n'
            f'      </li>\n')


def extract_between(src, begin, end):
    i = src.index(begin) + len(begin)
    j = src.index(end)
    return src[i:j], i, j


def demote_current_hero_and_set_new(index_path, new_title, new_log_number, new_date_obj, new_paras, new_href):
    src = open(index_path, encoding="utf-8").read()

    hero_block, hi, hj = extract_between(src, HERO_BEGIN, HERO_END)
    # Pull the outgoing hero's title/href/summary/log-number/date back out of its own markup
    m_title = re.search(r'<h1><a href="([^"]+)">([^<]+)</a></h1>', hero_block)
    m_meta = re.search(r'Log (\d+)\s*&middot;\s*([^<]+)</p>', hero_block)
    m_summary = re.search(r'<p class="hero-summary">(.*?)</p>', hero_block, re.S)
    if m_title and m_meta and m_summary:
        old_href, old_title = m_title.group(1), m_title.group(2)
        old_log_number = int(m_meta.group(1))
        old_date_str = m_meta.group(2).strip()
        old_date_obj = datetime.datetime.strptime(old_date_str, "%d %b %Y").date()
        old_summary = m_summary.group(1).strip()
        old_row = render_list_row(old_title, old_log_number, old_date_obj, old_href, old_summary)
    else:
        old_row = ""  # first-ever run: nothing to demote yet

    summary = new_paras[0]
    if len(summary) > 180:
        summary = summary[:177].rsplit(" ", 1)[0] + "..."

    new_hero = (
        f'\n    <p class="hero-meta">Log {new_log_number:03d} &middot; {new_date_obj.strftime("%d %b %Y").lstrip("0")}</p>\n'
        f'    <h1><a href="{new_href}">{new_title}</a></h1>\n'
        f'    <p class="hero-summary">{summary}</p>\n'
        f'    <a class="btn-ghost" href="{new_href}">Read the full transmission &rarr;</a>\n'
    )
    src = src[:hi] + new_hero + src[hj:]

    if old_row:
        li = src.index(LIST_BEGIN) + len(LIST_BEGIN)
        src = src[:li] + "\n" + old_row + src[li:]

    with open(index_path, "w", encoding="utf-8") as f:
        f.write(src)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site-dir", required=True)
    ap.add_argument("--date", default=None, help="YYYY-MM-DD, defaults to today")
    ap.add_argument("--model", default="claude-sonnet-4-6")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    target_date = args.date or datetime.date.today().isoformat()
    date_obj = datetime.date.fromisoformat(target_date)

    queue_path = os.path.join(args.site_dir, QUEUE_FILENAME)
    index_path = os.path.join(args.site_dir, INDEX_FILENAME)

    entries = read_queue(queue_path)
    chosen = pick_seed(entries, target_date)
    if chosen is None:
        print(f"No queued signal for {target_date}. Skipping publish (expected, not an error).")
        return

    print(f"Seed for {target_date}: {chosen['text']!r}")
    if args.dry_run:
        print("[dry-run] Would call the model, write a standalone page, swap the hero, and consume the queue line.")
        return

    raw = call_claude(chosen["text"], model=args.model)
    title, paras = parse_model_output(raw)
    log_number = next_log_number(args.site_dir)
    href = f"captains-log-{slugify_date(date_obj)}.html"
    hero = pick_hero_image(args.site_dir, log_number)

    page_html = render_standalone_page(title, log_number, date_obj, paras, hero=hero)
    with open(os.path.join(args.site_dir, href), "w", encoding="utf-8") as f:
        f.write(page_html)

    demote_current_hero_and_set_new(index_path, title, log_number, date_obj, paras, href)
    mark_consumed(queue_path, chosen)
    print(f"Published Log {log_number:03d} ({title!r}) for {target_date} -> {href}, promoted to hero.")


if __name__ == "__main__":
    main()
