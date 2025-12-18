import json
import os
import sqlite3
import time

DB_PATH = os.environ.get("WEBUI_DB_PATH", "/app/backend/data/webui.db")

ADMIN_GROUP_ID = "open_persona_admins"

USER_TOOL_ID = "open_persona_provider_keys"
USER_TOOL_NAME = "Open Persona Provider Keys"
USER_TOOL_PATH = "/app/backend/open_persona_provider_keys_tool.py"

ADMIN_TOOL_ID = "open_persona_provider_defaults"
ADMIN_TOOL_NAME = "Open Persona Provider Defaults"
ADMIN_TOOL_PATH = "/app/backend/open_persona_provider_defaults_tool.py"


def main() -> int:
    if not os.path.exists(DB_PATH):
        # DB might not exist on first boot until migrations run.
        return 0

    if not os.path.exists(USER_TOOL_PATH) or not os.path.exists(ADMIN_TOOL_PATH):
        return 0

    with open(USER_TOOL_PATH, "r", encoding="utf-8") as f:
        user_content = f.read()

    with open(ADMIN_TOOL_PATH, "r", encoding="utf-8") as f:
        admin_content = f.read()

    now = int(time.time())
    specs = "[]"  # No callable tools.

    user_meta = json.dumps({"description": "Per-user provider keys for Open Persona"})
    admin_meta = json.dumps({"description": "Admin defaults for Open Persona provider keys"})

    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()

        # Ensure an admin group exists for restricting defaults UI.
        cur.execute("SELECT 1 FROM 'group' WHERE id = ?", (ADMIN_GROUP_ID,))
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO 'group' (id, user_id, name, description, data, meta, permissions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    ADMIN_GROUP_ID,
                    "system",
                    "Open Persona Admins",
                    "Admins allowed to manage Open Persona defaults.",
                    json.dumps({}),
                    json.dumps({}),
                    json.dumps({}),
                    now,
                    now,
                ),
            )

        # Ensure all admin-role users are members.
        cur.execute("SELECT id FROM user WHERE role = 'admin'")
        admin_user_ids = [r[0] for r in cur.fetchall()]
        for uid in admin_user_ids:
            member_id = f"{ADMIN_GROUP_ID}:{uid}"
            cur.execute(
                "INSERT OR IGNORE INTO group_member (id, group_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (member_id, ADMIN_GROUP_ID, uid, now, now),
            )

        # Public per-user keys tool: readable by all (access_control NULL), user valves store per-user keys.
        cur.execute("SELECT 1 FROM tool WHERE id = ?", (USER_TOOL_ID,))
        if cur.fetchone():
            cur.execute(
                "UPDATE tool SET content = ?, meta = ?, specs = ?, updated_at = ? WHERE id = ?",
                (user_content, user_meta, specs, now, USER_TOOL_ID),
            )
        else:
            cur.execute(
                "INSERT INTO tool (id, user_id, name, content, specs, meta, created_at, updated_at, valves, access_control) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    USER_TOOL_ID,
                    "system",
                    USER_TOOL_NAME,
                    user_content,
                    specs,
                    user_meta,
                    now,
                    now,
                    json.dumps({}),
                    None,
                ),
            )

        # Admin defaults tool: visible only to the admin group.
        admin_access_control = json.dumps(
            {
                "read": {"group_ids": [ADMIN_GROUP_ID], "user_ids": []},
                "write": {"group_ids": [ADMIN_GROUP_ID], "user_ids": []},
            }
        )

        cur.execute("SELECT 1 FROM tool WHERE id = ?", (ADMIN_TOOL_ID,))
        if cur.fetchone():
            cur.execute(
                "UPDATE tool SET content = ?, meta = ?, specs = ?, access_control = ?, updated_at = ? WHERE id = ?",
                (admin_content, admin_meta, specs, admin_access_control, now, ADMIN_TOOL_ID),
            )
        else:
            cur.execute(
                "INSERT INTO tool (id, user_id, name, content, specs, meta, created_at, updated_at, valves, access_control) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    ADMIN_TOOL_ID,
                    "system",
                    ADMIN_TOOL_NAME,
                    admin_content,
                    specs,
                    admin_meta,
                    now,
                    now,
                    json.dumps({}),
                    admin_access_control,
                ),
            )

        conn.commit()
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
