import asyncio
import argparse
from services.workflow_engine import workflow_engine

import uuid

def get_booking_workflow_payload(business_id: str):
    node_start_id = str(uuid.uuid4())
    node_email_id = str(uuid.uuid4())
    edge_1_id = str(uuid.uuid4())
    
    return {
        "business_id": business_id,
        "name": "Booking Confirmation Tracking",
        "trigger_type": "appointment_booked",
        "trigger_config": {},
        "definition": {
            "nodes": [
                {
                    "id": node_start_id,
                    "type": "start",
                    "position": {"x": 100, "y": 100},
                    "data": {"label": "Appointment Booked (Trigger)"}
                },
                {
                    "id": node_email_id,
                    "type": "action",
                    "position": {"x": 100, "y": 300},
                    "data": {
                        "label": "Send Google Meet Calendar Email",
                        "config": {
                            "action_type": "send_email",
                            "subject": "Confirmed: Your Call with {{business_name}}",
                            "body": "<h2>Booking Confirmed!</h2><p>Hello,</p><p>We have successfully scheduled your call for <strong>{{appointment_time}}</strong>.</p><p>You can add this to your calendar using the link below:</p><br/><p><a href=\"{{calendar_link}}\" style=\"background: #001F3F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Add to Google Calendar</a></p><br/><p>We look forward to speaking with you!</p>"
                        }
                    }
                }
            ],
            "edges": [
                {
                    "id": edge_1_id,
                    "source": node_start_id,
                    "target": node_email_id
                }
            ]
        },
        "nodes": [
            {
                "id": node_start_id,
                "type": "start",
                "label": "Appointment Booked (Trigger)",
                "config": {},
                "position": {"x": 100, "y": 100}
            },
            {
                "id": node_email_id,
                "type": "action",
                "label": "Send Google Meet Calendar Email",
                "config": {
                    "action_type": "send_email",
                    "subject": "Confirmed: Your Call with {{business_name}}",
                    "body": "<h2>Booking Confirmed!</h2><p>Hello,</p><p>We have successfully scheduled your call for <strong>{{appointment_time}}</strong>.</p><p>You can add this to your calendar using the link below:</p><br/><p><a href=\"{{calendar_link}}\" style=\"background: #001F3F; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;\">Add to Google Calendar</a></p><br/><p>We look forward to speaking with you!</p>"
                },
                "position": {"x": 100, "y": 300}
            }
        ],
        "edges": [
            {
                "source": node_start_id,
                "target": node_email_id
            }
        ]
    }

async def main():
    parser = argparse.ArgumentParser(description="Create the default Booking Confirmation Workflow for a Business")
    parser.add_argument("business_id", help="The UUID of the business")
    args = parser.parse_args()

    payload = get_booking_workflow_payload(args.business_id)
    
    # We resolve the ID first just in case
    from services.db_service import resolve_business_id
    real_bid = await resolve_business_id(args.business_id)
    
    print(f"Creating Workflow for Business {real_bid}...")
    result = await workflow_engine.create_workflow(real_bid, payload)
    print(result)

if __name__ == "__main__":
    asyncio.run(main())
