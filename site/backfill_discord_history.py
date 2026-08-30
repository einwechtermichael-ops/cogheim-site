#!/usr/bin/env python3
"""
backfill_discord_history.py

ONE-TIME script. Posts every existing Devlog and Captain's Log entry to their
respective Discord channels, in chronological order, complete with each
post's actual hero image (referenced by live cogheim.com URL — no file
upload needed, Discord embeds happily load remote images).

Guarded by a marker file (site/.discord_backfill_done) so this can safely
sit in the workflow forever without ever re-running and re-spamming the
channels. Delete that marker file manually if a genuine re-run is ever
wanted.
"""

import os
import sys
import time
import json
import urllib.request

SITE_BASE_URL = "https://cogheim.com"
MARKER_PATH = "site/.discord_backfill_done"

DEVLOG_POSTS = [
    ("28 May 2026", "Six Units, One Style: Locking Consistency Across Early Vehicle Concept Art",
     "devlog-vehicle-concept-art.html", "devlog-vehicle-art-hero.webp",
     "Six support vehicles, generated independently, looked like six different games. The seeding discipline that fixed it."),
    ("12 Jun 2026", "Renaming Mid-Build: What Changing the Game's Name Actually Cost",
     "devlog-the-rename.html", "devlog-rename-hero.webp",
     "COGHEIM wasn't the name we opened with. Why it changed, what carried over, what it cost."),
    ("9 Jul 2026", "Five Books, One Pipeline: Finishing the Cogheim Quintet's First Drafts",
     "devlog-quintet-first-drafts.html", "hero-06-books.jpg",
     "Book III closed out, Books IV and V went from open questions to full first drafts."),
    ("12 Jul 2026", "The First Build: Getting COGHEIM Walkable in UE5.8",
     "devlog-first-ue58-build.html", "devlog-first-build-hero.webp",
     "From project skeleton to a walkable 10km terrain slice, and the version-mismatch bug that almost stopped it."),
    ("22 Jul 2026", "21 Decks: Locking Blackjack's Full Interior Spec",
     "devlog-blackjack-interior.html", "devlog-blackjack-hero.webp",
     "The largest Strider class, fully specced — and a geometry conflict that survived three prior attempts."),
    ("26 Jul 2026", "Getting Print-Ready: The KDP Pipeline Behind the Quintet",
     "devlog-kdp-pipeline.html", "hero-06-books.jpg",
     "EPUB accessibility fixes, 6x9 print interiors, and the margin bug that took three tries to solve."),
    ("28 Jul 2026", "Building a Cast: The Character Portrait System",
     "devlog-character-portraits.html", "devlog-portraits-hero.webp",
     "Batch generation produced identical outfits and muddy results. Three failures, three fixes."),
    ("16 Aug 2026", "The Netcode Doesn't Care Where You're Standing: Building RFA",
     "devlog-rfa-worldmap.html", "devlog-rfa-hero.webp",
     "Generalizing Strider-local netcode into a universal authority model, and locking the disc at 2,500km."),
    ("29 Aug 2026", "Stabilizing the Machine: What Unreal Engine 5.8.2 Changes for COGHEIM",
     "devlog-ue-5-8-2.html", "devlog-ue582-hero.jpg",
     "Safer large-world cooking, stronger simulation foundations, and what we're doing about each one."),
]

CAPTAINS_LOG_ENTRIES = [
    ("28 May 2026", "008", "Six Machines That Didn't Belong Together",
     "captains-log-2026-05-28.html", "captains-log-hero-pool/tavern-01.webp"),
    ("12 Jun 2026", "014", "The Last Time I Saw the Old Name",
     "captains-log-2026-06-12.html", "devlog-rename-hero.webp"),
    ("9 Jul 2026", "006", "It Wasn't a Story Problem",
     "captains-log-2026-07-09.html", "hero-06-books.jpg"),
    ("12 Jul 2026", "004", "Written For an Engine That Wasn't There",
     "captains-log-2026-07-12b.html", "captains-log-hero-pool/junction-01.webp"),
    ("12 Jul 2026", "011", "Ten Minutes, Wrong Program",
     "captains-log-2026-07-12a.html", "captains-log-hero-pool/corridor-01.webp"),
    ("21 Jul 2026", "013", "Too Many Pieces on the Table at Once",
     "captains-log-2026-07-21.html", "captains-log-hero-pool/tavern-01.webp"),
    ("22 Jul 2026", "002", "The Wall That Wasn't Square",
     "captains-log-2026-07-22.html", "captains-log-hero-pool/gearworks-01.webp"),
    ("23 Jul 2026", "009", "The Bug That Was Never Wrong",
     "captains-log-2026-07-23.html", "captains-log-hero-pool/junction-01.webp"),
    ("26 Jul 2026", "005", "The Margin Nobody Would Have Noticed",
     "captains-log-2026-07-26.html", "hero-06-books.jpg"),
    ("28 Jul 2026", "007", "Thirty People, One Jacket",
     "captains-log-2026-07-28.html", "devlog-portraits-hero.webp"),
    ("16 Aug 2026", "010", "Caught By the Thing Built to Catch It",
     "captains-log-2026-08-16.html", "captains-log-hero-pool/gearworks-01.webp"),
    ("20 Aug 2026", "003", "Starting Over on Purpose",
     "captains-log-2026-08-20.html", "devlog-vehicle-art-hero.webp"),
    ("24 Aug 2026", "012", "Still Stuck On This One",
     "captains-log-2026-08-24.html", "captains-log-hero-pool/museum-01.webp"),
    ("30 Aug 2026", "001", "The Corridor Argument",
     "captains-log-2026-08-30.html", "captains-log-2026-08-30-hero.webp"),
    ("30 Aug 2026", "015", "Chasing the Wrong Problem All Night",
     "captains-log-2026-08-30b.html", "captains-log-hero-pool/museum-01.webp"),
]


def post_embed(webhook_url, title, url, image_url, description, footer_text, color):
    payload = {
        "embeds": [
            {
                "title": title,
                "url": url,
                "description": description,
                "image": {"url": image_url},
                "color": color,
                "footer": {"text": footer_text},
            }
        ]
    }
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print(f"  posted: {title}")
        return True
    except Exception as e:
        print(f"  FAILED: {title} -> {e}")
        return False


def main():
    if os.path.isfile(MARKER_PATH):
        print("Backfill already ran previously (marker file present). Skipping.")
        return

    devlog_hook = os.environ.get("DISCORD_DEVLOG_WEBHOOK", "").strip()
    captains_hook = os.environ.get("DISCORD_CAPTAINSLOG_WEBHOOK", "").strip()

    if not devlog_hook or not captains_hook:
        print("One or both webhook secrets not set — skipping backfill this run "
              "(will retry on the next push once secrets are configured).")
        return

    print(f"Backfilling {len(DEVLOG_POSTS)} Devlog posts...")
    for date_disp, title, href, hero, desc in DEVLOG_POSTS:
        url = f"{SITE_BASE_URL}/{href}"
        image_url = f"{SITE_BASE_URL}/{hero}"
        post_embed(devlog_hook, title, url, image_url, desc, f"Devlog · {date_disp}", 0xE26A26)
        time.sleep(1)

    print(f"Backfilling {len(CAPTAINS_LOG_ENTRIES)} Captain's Log entries...")
    for date_disp, log_num, title, href, hero in CAPTAINS_LOG_ENTRIES:
        url = f"{SITE_BASE_URL}/{href}"
        image_url = f"{SITE_BASE_URL}/{hero}"
        post_embed(captains_hook, title, url, image_url, "", f"Log {log_num} · {date_disp}", 0xE8D08A)
        time.sleep(1)

    os.makedirs(os.path.dirname(MARKER_PATH), exist_ok=True)
    with open(MARKER_PATH, "w", encoding="utf-8") as f:
        f.write("Discord history backfill completed. Delete this file to allow a re-run.\n")
    print("Backfill complete, marker file written.")


if __name__ == "__main__":
    main()
