#!/usr/bin/env python3
"""
notify_discord_devlog.py

Takes a newline-separated list of newly-added site/devlog-*.html file paths
(passed as argv[1]) and posts one Discord embed per file to the webhook URL
in the DISCORD_DEVLOG_WEBHOOK environment variable.

Designed to run AFTER the site has already deployed, so the links posted
are live by the time anyone clicks them.

Silently does nothing if the webhook env var isn't set (lets the workflow
run fine before the secret is configured) and does nothing if no file
paths are passed in.
"""

import os
import re
import sys
import urllib.request
import json

SITE_BASE_URL = "https://cogheim.com"


def extract_title(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r"<title>([^<]+)</title>", content)
    if not m:
        return os.path.basename(html_path)
    title = m.group(1)
    # Titles in this project are formatted "Actual Title | COGHEIM" or similar —
    # keep just the human part before the first pipe.
    return title.split("|")[0].strip()


def extract_description(html_path):
    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'<meta name="description" content="([^"]*)"', content)
    return m.group(1) if m else ""


def post_to_discord(webhook_url, title, url, description):
    payload = {
        "embeds": [
            {
                "title": title,
                "url": url,
                "description": description[:300],
                "color": 0xE26A26,  # matches the site's ember accent
                "footer": {"text": "New Devlog post on cogheim.com"},
            }
        ]
    }
    req = urllib.request.Request(
        webhook_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "COGHEIM-DevBot/1.0 (+https://cogheim.com)",
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print(f"Notified Discord: {title}")
    except Exception as e:
        # Never fail the whole workflow over a notification hiccup —
        # the site deploy already succeeded, that's what matters.
        print(f"Discord notify failed for {title}: {e}")


def main():
    webhook_url = os.environ.get("DISCORD_DEVLOG_WEBHOOK", "").strip()
    if not webhook_url:
        print("DISCORD_DEVLOG_WEBHOOK not set — skipping Discord notification.")
        return

    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("No new devlog files passed in — nothing to notify.")
        return

    file_list = [line.strip() for line in sys.argv[1].splitlines() if line.strip()]
    if not file_list:
        print("No new devlog files — nothing to notify.")
        return

    for path in file_list:
        if not os.path.isfile(path):
            print(f"Skipping {path} — file not found (may have been deleted since diff).")
            continue
        title = extract_title(path)
        description = extract_description(path)
        filename = os.path.basename(path)
        url = f"{SITE_BASE_URL}/{filename}"
        post_to_discord(webhook_url, title, url, description)


if __name__ == "__main__":
    main()
