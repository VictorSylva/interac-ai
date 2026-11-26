import asyncio
import uuid
import logging
from sqlalchemy import select, delete
from database.session import AsyncSessionLocal
from database.models.workflow import Workflow, WorkflowNode, WorkflowEdge
from database.models.general import Business

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("seed_demo_workflows")

HOTEL_BIZ_ID = "89b093e8-ffd0-46e8-82c3-7e933937c080" # Grand Azure Hotel & Suites
SME_BIZ_ID = "dbfdaa35-f31d-4658-bd64-d806204bacef"   # Maylore Studio

DEMO_WORKFLOWS = [
    # ==========================================
    # HOTEL DEMOS (Grand Azure Hotel & Suites)
    # ==========================================
    {
        "business_id": HOTEL_BIZ_ID,
        "name": "Hotel Demo 1: VIP Reservation & Pre-Arrival Concierge Alert",
        "description": "Triggered when a room is booked: sends WhatsApp welcome with check-in instructions, routes alert to Front Desk, and logs VIP arrival observation.",
        "trigger_type": "reservation_booked",
        "trigger_config": {},
        "nodes": [
            {
                "id": "h1_n1",
                "type": "start",
                "label": "Room Reservation Booked",
                "config": {},
                "position": {"x": 100, "y": 150}
            },
            {
                "id": "h1_n2",
                "type": "action",
                "label": "Send WhatsApp Guest Welcome & Check-In Guide",
                "config": {
                    "action_type": "send_message",
                    "template": "Dear {{guest_name}}, your reservation at Grand Azure Hotel & Suites for Room {{room_number}} is confirmed! Check-in: {{check_in}} | Check-out: {{check_out}}. Our AI Concierge is available 24/7. Reply to this chat anytime to request room service, housekeeping, or local recommendations."
                },
                "position": {"x": 350, "y": 150}
            },
            {
                "id": "h1_n3",
                "type": "action",
                "label": "Route VIP Arrival to Front Desk",
                "config": {
                    "action_type": "route_to_department",
                    "department": "frontdesk"
                },
                "position": {"x": 650, "y": 150}
            },
            {
                "id": "h1_n4",
                "type": "action",
                "label": "Record VIP Arrival Observation",
                "config": {
                    "action_type": "record_observation",
                    "observation_type": "hotel_vip_arrival",
                    "severity": "INFO",
                    "payload": {"status": "expected_arrival"}
                },
                "position": {"x": 920, "y": 150}
            }
        ],
        "edges": [
            {"source": "h1_n1", "target": "h1_n2"},
            {"source": "h1_n2", "target": "h1_n3"},
            {"source": "h1_n3", "target": "h1_n4"}
        ]
    },
    {
        "business_id": HOTEL_BIZ_ID,
        "name": "Hotel Demo 2: In-Stay Service Request & Housekeeping SLA",
        "description": "Triggered when guest texts asking for amenities or reporting an issue: AI responds instantly, creates an internal housekeeping ticket, and routes to team.",
        "trigger_type": "message_created",
        "trigger_config": {
            "keywords": ["towel", "cleaning", "room service", "ac", "air condition", "maintenance", "housekeeping", "amenities", "pillows", "water", "blanket"]
        },
        "nodes": [
            {
                "id": "h2_n1",
                "type": "start",
                "label": "Guest Service Keyword Detected",
                "config": {},
                "position": {"x": 100, "y": 150}
            },
            {
                "id": "h2_n2",
                "type": "action",
                "label": "AI Immediate Empathic Response",
                "config": {
                    "action_type": "send_message",
                    "template": "Hello! Your request has been received by Grand Azure Guest Services. An attendant has been dispatched to your room right away. Thank you for your patience!"
                },
                "position": {"x": 350, "y": 150}
            },
            {
                "id": "h2_n3",
                "type": "action",
                "label": "Create Housekeeping / Maintenance Ticket",
                "config": {
                    "action_type": "create_ticket",
                    "subject": "In-Stay Guest Amenity & Service Request",
                    "priority": "high",
                    "description": "Automated ticket created from in-stay guest chat."
                },
                "position": {"x": 650, "y": 150}
            },
            {
                "id": "h2_n4",
                "type": "action",
                "label": "Route Conversation to Housekeeping",
                "config": {
                    "action_type": "route_to_department",
                    "department": "housekeeping"
                },
                "position": {"x": 920, "y": 150}
            }
        ],
        "edges": [
            {"source": "h2_n1", "target": "h2_n2"},
            {"source": "h2_n2", "target": "h2_n3"},
            {"source": "h2_n3", "target": "h2_n4"}
        ]
    },
    {
        "business_id": HOTEL_BIZ_ID,
        "name": "Hotel Demo 3: Express Checkout, Digital Folio & 5-Star Review",
        "description": "Triggered when guest checks out: delivers final folio summary on WhatsApp, asks for Google Review rating, and flags room for turnover cleaning.",
        "trigger_type": "guest_checkout",
        "trigger_config": {},
        "nodes": [
            {
                "id": "h3_n1",
                "type": "start",
                "label": "Guest Checkout Processed",
                "config": {},
                "position": {"x": 100, "y": 150}
            },
            {
                "id": "h3_n2",
                "type": "action",
                "label": "Send Digital Folio & 5-Star Review Prompt",
                "config": {
                    "action_type": "send_message",
                    "template": "Thank you for staying with us at Grand Azure Hotel & Suites, {{guest_name}}! We hope you enjoyed your time in Room {{room_number}}. Your digital folio has been settled. If you loved your stay, please take 30 seconds to rate us 5 stars on Google: https://g.page/r/grandazure/review. Safe travels!"
                },
                "position": {"x": 380, "y": 150}
            },
            {
                "id": "h3_n3",
                "type": "action",
                "label": "Flag Room for Turnover Cleaning",
                "config": {
                    "action_type": "record_observation",
                    "observation_type": "hotel_room_turnaround_needed",
                    "severity": "INFO",
                    "payload": {"status": "dirty", "action_required": "housekeeping_deep_clean"}
                },
                "position": {"x": 680, "y": 150}
            }
        ],
        "edges": [
            {"source": "h3_n1", "target": "h3_n2"},
            {"source": "h3_n2", "target": "h3_n3"}
        ]
    },

    # ==========================================
    # SME DEMOS (Maylore Studio)
    # ==========================================
    {
        "business_id": SME_BIZ_ID,
        "name": "SME Demo 1: Instant DM Product Inquiry to Paystack Checkout",
        "description": "Triggered on social/WhatsApp price inquiry: sends product specs, delivers direct Paystack subaccount checkout link, captures lead in CRM.",
        "trigger_type": "message_created",
        "trigger_config": {
            "keywords": ["price", "how much", "buy", "order", "glow oil", "acrylic", "nails", "cost"]
        },
        "nodes": [
            {
                "id": "s1_n1",
                "type": "start",
                "label": "Product / Price Inquiry Received",
                "config": {},
                "position": {"x": 100, "y": 150}
            },
            {
                "id": "s1_n2",
                "type": "action",
                "label": "Send Pricing & One-Click Checkout Link",
                "config": {
                    "action_type": "send_message",
                    "template": "Hi! Thank you for inquiring with Maylore Studio. Our Acrylic Nails & Glow Oil are in stock at ₦7,000! You can complete your order securely through our official checkout here: http://localhost:3000/pay/maylore-studio/acrylic-nails"
                },
                "position": {"x": 380, "y": 150}
            },
            {
                "id": "s1_n3",
                "type": "lead_capture",
                "label": "Capture High-Intent Lead in CRM",
                "config": {
                    "status": "interested",
                    "source": "whatsapp_social_inquiry",
                    "notes": "Interested in Acrylic Nails & Glow Oil via automated pricing trigger."
                },
                "position": {"x": 680, "y": 150}
            },
            {
                "id": "s1_n4",
                "type": "action",
                "label": "Route to Sales Rep",
                "config": {
                    "action_type": "route_to_department",
                    "department": "sales"
                },
                "position": {"x": 920, "y": 150}
            }
        ],
        "edges": [
            {"source": "s1_n1", "target": "s1_n2"},
            {"source": "s1_n2", "target": "s1_n3"},
            {"source": "s1_n3", "target": "s1_n4"}
        ]
    },
    {
        "business_id": SME_BIZ_ID,
        "name": "SME Demo 2: Order Payment Cleared & Low-Stock Replenishment",
        "description": "Triggered when Paystack payment succeeds: delivers instant WhatsApp customer receipt, records finance observation, and alerts warehouse manager.",
        "trigger_type": "payment_received",
        "trigger_config": {},
        "nodes": [
            {
                "id": "s2_n1",
                "type": "start",
                "label": "Paystack Payment Verified",
                "config": {},
                "position": {"x": 100, "y": 150}
            },
            {
                "id": "s2_n2",
                "type": "action",
                "label": "Send Branded WhatsApp Order Receipt",
                "config": {
                    "action_type": "send_message",
                    "template": "🎉 Payment Confirmed! Thank you {{customer_name}}. Your order {{order_number}} for ₦{{total_amount}} has been received and is being prepared for fast dispatch by Maylore Studio."
                },
                "position": {"x": 380, "y": 150}
            },
            {
                "id": "s2_n3",
                "type": "action",
                "label": "Record Verified Revenue Signal",
                "config": {
                    "action_type": "record_observation",
                    "observation_type": "sme_payment_verified",
                    "severity": "INFO",
                    "payload": {"channel": "paystack_direct", "status": "paid"}
                },
                "position": {"x": 680, "y": 150}
            },
            {
                "id": "s2_n4",
                "type": "action",
                "label": "Alert Inventory & Dispatch Team",
                "config": {
                    "action_type": "send_email",
                    "recipient_type": "department",
                    "department": "inventory",
                    "subject": "Fulfillment Alert: Order {{order_number}} Paid",
                    "body": "A new order {{order_number}} for ₦{{total_amount}} was paid via Paystack. Please verify remaining stock and dispatch."
                },
                "position": {"x": 920, "y": 150}
            }
        ],
        "edges": [
            {"source": "s2_n1", "target": "s2_n2"},
            {"source": "s2_n2", "target": "s2_n3"},
            {"source": "s2_n3", "target": "s2_n4"}
        ]
    },
    {
        "business_id": SME_BIZ_ID,
        "name": "SME Demo 3: Abandoned Order Recovery & 5% Discount Nudge",
        "description": "Triggered when an order/invoice remains unpaid: waits 2 hours, sends friendly WhatsApp check-in with one-click payment link and discount code.",
        "trigger_type": "sme_invoice_overdue",
        "trigger_config": {},
        "nodes": [
            {
                "id": "s3_n1",
                "type": "start",
                "label": "Unpaid Order / Cart Abandoned",
                "config": {},
                "position": {"x": 100, "y": 150}
            },
            {
                "id": "s3_n2",
                "type": "time_delay",
                "label": "Wait 2 Hours Before Nudge",
                "config": {
                    "seconds": 7200
                },
                "position": {"x": 350, "y": 150}
            },
            {
                "id": "s3_n3",
                "type": "action",
                "label": "Send Gentle Discount Recovery Nudge",
                "config": {
                    "action_type": "send_message",
                    "template": "Hi {{customer_name}}, we noticed you started an order with Maylore Studio! We've reserved your items for you. Use code FLASH5 for 5% off if you complete your order today: http://localhost:3000/pay/maylore-studio/acrylic-nails"
                },
                "position": {"x": 620, "y": 150}
            },
            {
                "id": "s3_n4",
                "type": "action",
                "label": "Log Retention Win-Back Opportunity",
                "config": {
                    "action_type": "record_observation",
                    "observation_type": "sme_cart_recovery_sent",
                    "severity": "INFO",
                    "payload": {"discount_offered": "5%"}
                },
                "position": {"x": 900, "y": 150}
            }
        ],
        "edges": [
            {"source": "s3_n1", "target": "s3_n2"},
            {"source": "s3_n2", "target": "s3_n3"},
            {"source": "s3_n3", "target": "s3_n4"}
        ]
    }
]

async def seed_workflows():
    async with AsyncSessionLocal() as session:
        logger.info("Starting Demo Workflow Seeding...")
        
        # Verify businesses exist
        for b_id in [HOTEL_BIZ_ID, SME_BIZ_ID]:
            biz = await session.get(Business, b_id)
            if not biz:
                logger.error(f"Business {b_id} not found! Please check IDs.")
                return
            logger.info(f"Verified business: {biz.name} ({biz.id})")

        created_count = 0
        for wf_data in DEMO_WORKFLOWS:
            biz_id = wf_data["business_id"]
            name = wf_data["name"]

            # Remove existing workflow with this exact name if already present to avoid duplicates
            existing_stmt = select(Workflow).where(Workflow.business_id == biz_id, Workflow.name == name)
            res = await session.execute(existing_stmt)
            existing_wf = res.scalar_one_or_none()
            if existing_wf:
                logger.info(f"Replacing existing workflow: {name}")
                await session.delete(existing_wf)
                await session.flush()

            # Create workflow record
            wf = Workflow(
                id=str(uuid.uuid4()),
                business_id=biz_id,
                name=name,
                description=wf_data["description"],
                trigger_type=wf_data["trigger_type"],
                trigger_config=wf_data.get("trigger_config", {}),
                definition={
                    "nodes": wf_data["nodes"],
                    "edges": wf_data["edges"]
                },
                is_active=True
            )
            session.add(wf)
            await session.flush()

            node_map = {}
            for n in wf_data["nodes"]:
                node_id = str(uuid.uuid4())
                node_map[n["id"]] = node_id
                node = WorkflowNode(
                    id=node_id,
                    workflow_id=wf.id,
                    type=n["type"],
                    label=n["label"],
                    config=n.get("config", {}),
                    platform_meta=n.get("position", {})
                )
                session.add(node)
            await session.flush()

            for e in wf_data["edges"]:
                source_id = node_map.get(e["source"])
                target_id = node_map.get(e["target"])
                if source_id and target_id:
                    edge = WorkflowEdge(
                        id=str(uuid.uuid4()),
                        workflow_id=wf.id,
                        source_id=source_id,
                        target_id=target_id,
                        condition_value=e.get("condition")
                    )
                    session.add(edge)

            created_count += 1
            logger.info(f"Seeded: '{name}' for business {biz_id}")

        await session.commit()
        logger.info(f"Successfully seeded {created_count} demo workflows!")

if __name__ == "__main__":
    asyncio.run(seed_workflows())
