"""
Regenerate a schema baseline migration from the live Supabase project.

Runs execution/sql/export_schema.sql (read-only) through the Supabase Management API and writes the
DDL it returns to supabase/migrations/<timestamp>_baseline.sql (or --out). Needs SUPABASE_ACCESS_TOKEN
and SUPABASE_PROJECT_ID in .env. Standard library only.

Usage:
    python execution/export_schema_baseline.py            # writes a new timestamped baseline
    python execution/export_schema_baseline.py --out x.sql
"""
import argparse
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SQL_FILE = ROOT / "execution" / "sql" / "export_schema.sql"

SECTION_TITLES = {
    0: "Extensions",
    10: "Sequences",
    20: "Tables",
    25: "Sequence ownership",
    30: "Primary keys, unique and check constraints",
    31: "Foreign keys",
    35: "Indexes",
    40: "Comments",
    50: "Functions",
    55: "Function privileges",
    60: "Row level security",
    65: "Policies (public tables and storage.objects)",
    70: "Triggers (including signup on auth.users)",
    80: "Table and sequence privileges (explicit: Supabase stops auto-granting new public tables on 2026-10-30)",
    90: "Storage buckets",
}
# Multi-line statements get a blank line after them for readability.
SPACED_SECTIONS = {20, 50, 65, 70}


def load_env() -> dict:
    env = {}
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip().rstrip("\r")
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                env[key.strip()] = value.strip()
    env.update({k: v for k, v in os.environ.items() if k.startswith("SUPABASE_")})
    return env


def run_query(project: str, token: str, sql: str) -> list:
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{project}/database/query",
        data=json.dumps({"query": sql, "read_only": True}).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    if not isinstance(data, list):
        raise RuntimeError(f"Query failed: {data}")
    return data


def render(rows: list, project: str, generated_on: str) -> str:
    out = [
        f"-- Klaro schema baseline, generated from the live project ({project}) on {generated_on}.\n"
        "--\n"
        "-- Builds the whole public schema from nothing: tables, constraints, functions, policies, triggers,\n"
        "-- storage buckets and explicit grants. Earlier incremental migrations are kept for reference in\n"
        "-- supabase/migrations_archive/.\n"
        "--\n"
        "-- Grants are written out explicitly because, from 2026-10-30, Supabase no longer grants Data API\n"
        "-- access to new tables in \"public\" automatically. Any later migration that creates a table must add\n"
        "-- its own GRANTs (see the \"Database changes\" rule in CLAUDE.md).\n"
    ]
    current = None
    for row in rows:
        sec = row["sec"]
        if sec != current:
            current = sec
            title = SECTION_TITLES.get(sec, f"Section {sec}")
            out.append(f"\n-- ─── {title} {'─' * max(3, 70 - len(title))}\n")
        out.append(row["line"].rstrip() + ("\n" if sec in SPACED_SECTIONS else ""))
        if sec == 0 and row["ord"] == "1":
            out.append(
                "\n-- Supabase sets this on new projects; restated so the baseline doesn't depend on it.\n"
                "GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;"
            )
    return "\n".join(out) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, help="output file (default: new timestamped file in supabase/migrations)")
    args = parser.parse_args()

    env = load_env()
    token, project = env.get("SUPABASE_ACCESS_TOKEN"), env.get("SUPABASE_PROJECT_ID")
    if not token or not project:
        print("SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_ID must be set in .env", file=sys.stderr)
        return 1

    now = datetime.now(timezone.utc)
    rows = run_query(project, token, SQL_FILE.read_text())
    out = args.out or ROOT / "supabase" / "migrations" / f"{now:%Y%m%d%H%M%S}_baseline.sql"
    out.write_text(render(rows, project, f"{now:%Y-%m-%d}"))
    print(f"Wrote {len(rows)} statements to {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
