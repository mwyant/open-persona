import json
import os
import sqlite3
import time

TOOL_ID = "open_persona_provider_keys"
TOOL_NAME = "Open Persona Provider Keys"
TOOL_PATH = "/app/backend/open_persona_provider_keys_tool.py"
DB_PATH = os.environ.get("WEBUI_DB_PATH", "/app/backend/data/webui.db")


def main() -> int:
    if not os.path.exists(DB_PATH):
        # DB might not exist on first boot until migrations run.
        return 0

    if not os.path.exists(TOOL_PATH):
        return 0

    with open(TOOL_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    now = int(time.time())
    specs = "[]"  # No callable tools.
    meta = json.dumps({"description": "Per-user/provider keys for Open Persona"})

    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM tool WHERE id = ?", (TOOL_ID,))
        if cur.fetchone():
            cur.execute(
                "UPDATE tool SET content = ?, meta = ?, specs = ?, updated_at = ? WHERE id = ?",
                (content, meta, specs, now, TOOL_ID),
            )
            conn.commit()
            return 0

        cur.execute(
            "INSERT INTO tool (id, user_id, name, content, specs, meta, created_at, updated_at, valves, access_control) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                TOOL_ID,
                "system",
                TOOL_NAME,
                content,
                specs,
                meta,
                now,
                now,
                json.dumps({}),
                None,
            ),
        )
        conn.commit()
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
