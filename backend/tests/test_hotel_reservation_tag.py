import re
import json

ai_reply = """
Thank you, Dr. Aisha Bello! I have successfully reserved a Deluxe Queen Room for you at Grand Azure Hotel & Suites from September 20th to September 22nd, 2026 (2 nights). We look forward to your stay!

[ACTION: HOTEL_RESERVATION | {"guest_name": "Dr. Aisha Bello", "check_in_date": "2026-09-20", "check_out_date": "2026-09-22", "room_type": "Deluxe Queen", "room_number": "102", "nights": 2, "nightly_rate": 180.00, "total_amount": 360.00, "special_requests": "Quiet room on high floor"}]
[ANALYSIS: booking | positive]
"""

# Test matching
hotel_res_match = re.search(r'\[ACTION:\s*HOTEL_RESERVATION\s*\|\s*(?P<json>\{.*?\})\]', ai_reply, re.IGNORECASE | re.DOTALL)
assert hotel_res_match is not None, "Failed to match hotel reservation tag"
res_data = json.loads(hotel_res_match.group("json"))
print("EXTRACTED DATA:", res_data)
assert res_data["guest_name"] == "Dr. Aisha Bello"
assert res_data["total_amount"] == 360.00

# Test cleanup
clean_reply = re.sub(r'\[ACTION:.*?\]', '', ai_reply, flags=re.DOTALL).strip()
clean_reply = re.sub(r'\[ANALYSIS:.*?\]', '', clean_reply, flags=re.DOTALL).strip()
print("CLEAN CUSTOMER REPLY:\n" + clean_reply)
assert "[ACTION" not in clean_reply
assert "[ANALYSIS" not in clean_reply
print("TEST PASSED SUCCESSFULLY!")
