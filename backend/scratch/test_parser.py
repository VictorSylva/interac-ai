from datetime import datetime

def parse_date(start_at_str):
    start_at_str = str(start_at_str).strip()
    if start_at_str.endswith('Z') or start_at_str.endswith('z'):
        start_at_str = start_at_str[:-1]
    
    start_at = None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M", "%Y-%m-%d %H:%M"):
        try:
            start_at = datetime.strptime(start_at_str[:19], fmt)
            break
        except ValueError:
            continue
    
    if not start_at:
        try:
            start_at = datetime.fromisoformat(start_at_str)
            if start_at.tzinfo is not None:
                start_at = start_at.replace(tzinfo=None)
        except ValueError as e:
            return f"FAILED: {e}"
            
    return f"SUCCESS: {start_at}"

test_cases = [
    "2026-07-29T16:30:00Z",
    "2026-07-29 16:30:00",
    "2026-07-29T16:30:00",
    "2026-07-29 16:30",
    "2026-07-29T16:30",
    "16:30 today",
    "today 16:30",
    "tomorrow 10:30am"
]

for tc in test_cases:
    print(f"Input: {tc:<25} => {parse_date(tc)}")
