import sys
import json
from pathlib import Path

sys.path.insert(0, ".")

from src.database.db_service import get_db_service


TENANT_ID = "e37f48fd-b5ec-4490-b8ea-9d5115f97d44"
TEMPLATE_ID = "lead_capture"


def load_template(template_id: str) -> dict:
    path = Path("templates") / f"{template_id}.json"
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    template = load_template(TEMPLATE_ID)
    db = get_db_service()
    conn = db.get_connection()
    try:
        cur = conn.cursor()
        cur.execute(
            """
            UPDATE tenants
            SET system_prompt = %s,
                agent_role = %s,
                agent_personality = %s,
                greeting_message = %s,
                static_knowledge = %s,
                metadata = %s::jsonb,
                updated_at = NOW()
            WHERE tenant_id = %s
            """,
            (
                template.get("system_prompt"),
                template.get("agent_role", "receptionist"),
                template.get("agent_personality", "friendly"),
                template.get("greeting_message"),
                template.get("static_knowledge"),
                json.dumps(
                    {
                        "service_catalog": template.get("service_catalog", []),
                        "faq_knowledge_base": template.get("faq_knowledge_base", []),
                    }
                ),
                TENANT_ID,
            ),
        )

        cur.execute(
            """
            UPDATE objective_configs
            SET objective_graph = %s::jsonb,
                version = version + 1,
                active = true
            WHERE tenant_id = %s AND active = true
            """,
            (json.dumps(template["objective_graph"]), TENANT_ID),
        )

        cur.execute(
            """
            UPDATE tenant_onboarding_settings
            SET system_prompt = %s,
                knowledge_base = %s,
                updated_at = NOW()
            WHERE tenant_id = %s
            """,
            (
                template.get("system_prompt"),
                template.get("static_knowledge"),
                TENANT_ID,
            ),
        )

        conn.commit()
        print("UPDATED_TEST_TENANT_TEMPLATE")
        print(f"tenant_id: {TENANT_ID}")
        print(f"template: {TEMPLATE_ID}")
    finally:
        cur.close()
        db.put_connection(conn)


if __name__ == "__main__":
    main()
