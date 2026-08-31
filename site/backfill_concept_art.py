#!/usr/bin/env python3
"""
backfill_concept_art.py

ONE-TIME script. Posts 16 curated highlight images from the full 179-image
gallery to #concept-art, spanning all five Strider classes, the world
itself, Drifter daily life, the Academy, and the novels. Closes with a
message linking to the full gallery on the site.

Guarded by a marker file (site/.concept_art_backfill_done) so this never
re-runs and re-posts. Delete that marker manually for a genuine re-run.
"""

import os
import sys
import time
import json
import urllib.request

SITE_BASE_URL = "https://cogheim.com"
MARKER_PATH = "site/.concept_art_backfill_done"

CURATED_IMAGES = [
    ("gallery/01_world_model/001_01_cogheim-world-model-stitched-label-free.webp",
     "The World", "The full scope: the disc world, a Strider's internal frame layered against real terrain, and true scale from human to city."),
    ("gallery/strider_classes/blackjack/045_8a50d20a-e5fa-4515-8a7e-a478d604a78f.webp",
     "Blackjack", "Blackjack-class Strider — establishing shot."),
    ("gallery/strider_classes/blackjack/015_15_8906ea5a-3bc1-4120-bf65-3683e70594f0.webp",
     "Blackjack", "Blackjack's full 21-deck interior, laid open."),
    ("gallery/strider_classes/grindwalker/001_catamaran_4b4ba70e4ea3169e.webp",
     "Grindwalker", "Grindwalker-class Strider — the twin-hull catamaran direction that won."),
    ("gallery/strider_classes/vector/031_vector_4654d7b6babe3253.webp",
     "Vector", "Vector-class Strider — eight legs, aurora sky."),
    ("gallery/strider_classes/juggernaut/036_juggernaut_d2f1437b1d8a6ff1.webp",
     "Juggernaut", "Juggernaut-class Strider. One wheel, for scale."),
    ("gallery/strider_classes/scavenger/049_scavenger_3725e2da366b1715.webp",
     "Scavenger", "Scavenger-class Strider — \"First Stitch, Est. 78-21.\" Salvage built the whole hull."),
    ("gallery/04_world_and_environment/004_04_Exploring-the-industrial-cathedral-of-steam.webp",
     "The World", "A gear the size of a cathedral. This is what \"the shop floor\" actually looks like."),
    ("gallery/04_world_and_environment/005_05_Forging-sparks-in-a-steampunk-workshop.webp",
     "The World", "Forging sparks — the unglamorous heart of the world."),
    ("gallery/06_drifter_interiors_and_decks/021_cache_021_1448x1086_a055be7ea8.webp",
     "The Drifter", "A residential deck aboard the Drifter. Someone's home is right here."),
    ("gallery/06_drifter_interiors_and_decks/033_cache_033_1448x1086_3d5830a8c0.webp",
     "The Drifter", "The Copper Cog. Where the crew actually hangs out."),
    ("gallery/06_drifter_interiors_and_decks/006_cache_006_1448x1086_ef895c14b3.webp",
     "The Drifter", "The Drifter's trophy archive — history, kept."),
    ("gallery/06_drifter_interiors_and_decks/024_cache_024_1448x1086_84747a0887.webp",
     "The Drifter", "Gearworks & Firing Range — where an Iron Frame gets built."),
    ("gallery/07_meridian_maritime_academy/008_cache_038_1448x1086_5ebbe267bc.webp",
     "Meridian Academy", "Meridian Maritime Academy — half above the waterline, half below."),
    ("gallery/05_reference_boards/001_01_1000005681.webp",
     "Pipeline", "Six locations, one reference sheet — how visual consistency gets built."),
    ("gallery/10_novel_book1_act_illustrations/act_02_the_ignition.webp",
     "The Quintet", "Act II: The Ignition — from the Cogheim Quintet."),
]


def post_embed(webhook_url, image_url, category, caption):
    payload = {
        "embeds": [
            {
                "image": {"url": image_url},
                "footer": {"text": f"Cogheim Gallery · {category}"},
                "description": caption,
                "color": 0xB7903C,
            }
        ]
    }
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "COGHEIM-DevBot/1.0 (+https://cogheim.com)"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print(f"  posted: {category} — {caption[:50]}")
        return True
    except Exception as e:
        print(f"  FAILED: {category} -> {e}")
        return False


def post_plain(webhook_url, content):
    payload = {"content": content}
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "COGHEIM-DevBot/1.0 (+https://cogheim.com)"},
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print("  posted closing message")
    except Exception as e:
        print(f"  FAILED closing message -> {e}")


def main():
    if os.path.isfile(MARKER_PATH):
        print("Concept art backfill already ran previously (marker file present). Skipping.")
        return

    webhook = os.environ.get("DISCORD_CONCEPTART_WEBHOOK", "").strip()
    print(f"DISCORD_CONCEPTART_WEBHOOK present: {bool(webhook)}")

    if not webhook:
        print("DISCORD_CONCEPTART_WEBHOOK not set — skipping this run "
              "(will retry once the secret is configured). This is expected, "
              "not an error, if the secret hasn't been added yet.")
        return

    any_failure = False

    print(f"Posting {len(CURATED_IMAGES)} curated concept art images...")
    for path, category, caption in CURATED_IMAGES:
        image_url = f"{SITE_BASE_URL}/{path}"
        ok = post_embed(webhook, image_url, category, caption)
        if not ok:
            any_failure = True
        time.sleep(1)

    if any_failure:
        print("At least one post failed to send. NOT writing the marker file, "
              "so this can be retried on the next run. Failing this step loudly "
              "on purpose so it shows up as a real error, not a silent skip.")
        sys.exit(1)

    post_plain(
        webhook,
        "That's a curated slice — the full archive is **179 images** across every "
        "Strider class, the Drifter, the Academy, and the novels. Browse the whole "
        "thing (with filters) at https://cogheim.com/gallery.html"
    )

    os.makedirs(os.path.dirname(MARKER_PATH), exist_ok=True)
    with open(MARKER_PATH, "w", encoding="utf-8") as f:
        f.write("Concept art backfill completed. Delete this file to allow a re-run.\n")
    print("Backfill complete, all posts confirmed sent, marker file written.")


if __name__ == "__main__":
    main()
