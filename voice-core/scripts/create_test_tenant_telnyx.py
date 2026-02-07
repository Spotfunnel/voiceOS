import sys
import os
import json
import uuid
from pathlib import Path

sys.path.insert(0, ".")

from src.database.db_service import get_db_service


TEMPLATE_ID = "full_receptionist"
BUSINESS_NAME = "SpotFunnel Test Tenant"
PHONE_NUMBER = os.getenv("TEST_TENANT_PHONE", "+15557654321")
STATE = "NSW"
TIMEZONE = "Australia/Sydney"
LOCALE = "en-AU"


def load_template(template_id: str) -> dict:
    path = Path("templates") / f"{template_id}.json"
    if not path.exists():
        raise FileNotFoundError(str(path))
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    template = load_template(TEMPLATE_ID)
    tenant_id = str(uuid.uuid4())

    db = get_db_service()
    conn = db.get_connection()
    try:
        cur = conn.cursor()

        # Ensure missing columns exist for get_tenant_config()
        cur.execute(
            """
            ALTER TABLE tenants
            ADD COLUMN IF NOT EXISTS system_prompt TEXT,
            ADD COLUMN IF NOT EXISTS agent_role TEXT,
            ADD COLUMN IF NOT EXISTS agent_personality TEXT,
            ADD COLUMN IF NOT EXISTS greeting_message TEXT,
            ADD COLUMN IF NOT EXISTS static_knowledge TEXT
            """
        )

        # Ensure phone_routing table exists
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS phone_routing (
                phone_number TEXT PRIMARY KEY,
                tenant_id UUID NOT NULL REFERENCES tenants(tenant_id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
            """
        )

        # Insert tenant
        cur.execute(
            """
            INSERT INTO tenants (
                tenant_id, business_name, phone_number, state, timezone, locale,
                status, metadata, created_at, updated_at,
                system_prompt, agent_role, agent_personality, greeting_message, static_knowledge
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, NOW(), NOW(), %s, %s, %s, %s, %s)
            """,
            (
                tenant_id,
                BUSINESS_NAME,
                PHONE_NUMBER,
                STATE,
                TIMEZONE,
                LOCALE,
                "active",
                json.dumps(
                    {
                        "service_catalog": template.get("service_catalog", []),
                        "faq_knowledge_base": template.get("faq_knowledge_base", []),
                    }
                ),
                template.get("system_prompt"),
                template.get("agent_role", "receptionist"),
                template.get("agent_personality", "friendly"),
                template.get("greeting_message"),
                template.get("static_knowledge"),
            ),
        )

        # Insert objective config
        cur.execute(
            """
            INSERT INTO objective_configs (
                tenant_id, version, objective_graph, active, schema_version, created_at
            ) VALUES (%s, %s, %s::jsonb, %s, %s, NOW())
            """,
            (
                tenant_id,
                1,
                json.dumps(template["objective_graph"]),
                True,
                "v1",
            ),
        )

        # Insert onboarding settings (telephony config)
        cur.execute(
            """
            INSERT INTO tenant_onboarding_settings (
                tenant_id, system_prompt, knowledge_base, n8n_workflows,
                dashboard_reasons, dashboard_outcomes, pipeline_values,
                dashboard_report_fields, telephony, updated_at
            ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (tenant_id) DO UPDATE SET
                system_prompt = EXCLUDED.system_prompt,
                knowledge_base = EXCLUDED.knowledge_base,
                n8n_workflows = EXCLUDED.n8n_workflows,
                dashboard_reasons = EXCLUDED.dashboard_reasons,
                dashboard_outcomes = EXCLUDED.dashboard_outcomes,
                pipeline_values = EXCLUDED.pipeline_values,
                dashboard_report_fields = EXCLUDED.dashboard_report_fields,
                telephony = EXCLUDED.telephony,
                updated_at = NOW()
            """,
            (
                tenant_id,
                template.get("system_prompt"),
                template.get("static_knowledge"),
                json.dumps([]),
                json.dumps([]),
                json.dumps([]),
                json.dumps([]),
                json.dumps([]),
                json.dumps(
                    {
                        "phone_number": PHONE_NUMBER,
                        "telnyx_phone_number": PHONE_NUMBER,
                        "voice_webhook_url": "https://antrorse-fluently-beulah.ngrok-free.dev/api/telnyx/webhook",
                    }
                ),
            ),
        )

        # Insert phone routing
        cur.execute(
            """
            INSERT INTO phone_routing (phone_number, tenant_id)
            VALUES (%s, %s)
            ON CONFLICT (phone_number) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
            """,
            (PHONE_NUMBER, tenant_id),
        )

        conn.commit()
        print("CREATED_TEST_TENANT")
        print(f"tenant_id: {tenant_id}")
        print(f"phone_number: {PHONE_NUMBER}")
    except Exception as exc:
        conn.rollback()
        raise
    finally:
        cur.close()
        db.put_connection(conn)


if __name__ == "__main__":
    main()
