import json
import urllib.request
import time
import sys

GATEWAY_URL = "http://localhost:8080"

def make_post_request(path, data):
    url = f"{GATEWAY_URL}{path}"
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error calling POST {url}: {e}")
        return None

def make_get_request(path):
    url = f"{GATEWAY_URL}{path}"
    try:
        with urllib.request.urlopen(url) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception as e:
        print(f"Error calling GET {url}: {e}")
        return None

def run_tests():
    print("======================================================================")
    print("                ARGUS OS INTEGRATED TEST SUITE                        ")
    print("======================================================================\n")

    # 1. Test Observation Ingestion (Camera sighting)
    print("Step 1: Emitting a raw camera alert observation...")
    cam_obs = {
        "id": f"test_cam_obs_{int(time.time())}",
        "source_system": "cameras",
        "entity_type": "person",
        "entity_id": "test_intruder_42",
        "location": "Warehouse Dock A",
        "confidence": 0.98,
        "metadata": {
            "event_type": "loitering_detected",
            "camera_name": "East Wing PTZ"
        },
        "relationships": [],
        "context": "Subject observed loitering near the warehouse entrance dock.",
        "severity": "medium"
    }
    res_obs1 = make_post_request("/api/v2/observations/", cam_obs)
    if res_obs1:
        print(f"-> SUCCESS: Ingested observation ID: {res_obs1.get('id')}\n")
    else:
        print("-> FAILED: Could not ingest camera observation. Is Nginx gateway on port 8080 running?\n")
        sys.exit(1)

    # 2. Test Observation Ingestion (Zone Intrusion Alert)
    print("Step 2: Emitting a critical zone intrusion observation (Triggering Risk Vector & Escalation)...")
    intrusion_obs = {
        "id": f"test_intrusion_obs_{int(time.time())}",
        "source_system": "cameras",
        "entity_type": "person",
        "entity_id": "test_intruder_42",
        "location": "Warehouse Dock A",
        "confidence": 0.99,
        "metadata": {
            "event_type": "zone_intrusion_detected",
            "camera_name": "East Wing PTZ"
        },
        "relationships": [
            {
                "target_type": "zone",
                "target_id": "restricted_vault_1",
                "type": "OBSERVED_AT",
                "confidence": 1.0
            }
        ],
        "context": "CRITICAL ALERT: Subject crossed line boundary and entered restricted vault zone.",
        "severity": "critical"
    }
    res_obs2 = make_post_request("/api/v2/observations/", intrusion_obs)
    if res_obs2:
         print(f"-> SUCCESS: Ingested intrusion observation ID: {res_obs2.get('id')}\n")
    else:
         print("-> FAILED\n")

    # Give database/redis a millisecond to commit and run triggers
    time.sleep(0.5)

    # 3. Check World Model State
    print("Step 3: Querying the World Model operational summary cache...")
    world_summary = make_get_request("/api/v2/world-model/summary")
    if world_summary:
        print(f"-> SUCCESS: Active incidents registered: {len(world_summary.get('active_incidents', []))}")
        print(f"-> Tracked entities location: {world_summary.get('tracked_locations')}\n")
    else:
        print("-> FAILED\n")

    # 4. Check Context Engine (Entity profile & risk vector check)
    print("Step 4: Querying the Context Engine for target profile...")
    context = make_get_request("/api/v2/context/test_intruder_42")
    if context:
        print(f"-> SUCCESS: Entity Aggregate Risk Score: {context.get('risk_score')}/100")
        print(f"-> Status bounds: {context.get('status')}")
        print(f"-> Associated nodes in Graph: {context.get('associated_entities')}")
        print(f"-> Recommended actions: {context.get('recommended_actions')}\n")
    else:
        print("-> FAILED\n")

    # 5. Check Timeline Engine
    print("Step 5: Querying the Timeline Engine for audit logs...")
    timeline = make_get_request("/api/v2/timeline/test_intruder_42")
    if timeline:
        print(f"-> SUCCESS: Timeline entries reconstructed: {len(timeline)}")
        for idx, item in enumerate(timeline[:3]):
            desc_text = item.get('description') or ""
            # Safe print
            print(f"   [{item.get('timestamp')}] ({item.get('source_system')}) {desc_text.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8')}")
        print("")
    else:
         print("-> FAILED\n")

    # 6. Check Investigations Workspace List
    print("Step 6: Querying Investigations case log registry...")
    cases = make_get_request("/api/v2/investigations/")
    if cases:
        print(f"-> SUCCESS: Open case files: {len(cases)}")
        for c in cases[:3]:
            print(f"   - Case ID: {c.get('case_id')} | Title: '{c.get('title')}' | Status: {c.get('status')}")
        print("")
    else:
        print("-> FAILED\n")

    # 7. Check AI Copilot reasoning loop (Dry-run or actual loop completion)
    print("Step 7: Launching AI Copilot ReAct Reasoning Agent query...")
    copilot_query = {
        "query": "Investigate the threat footprint and details for entity test_intruder_42"
    }
    copilot_res = make_post_request("/api/v2/copilot/query", copilot_query)
    if copilot_res:
        print("-> SUCCESS: Copilot completed analysis. Response dossier trace:")
        analysis_text = copilot_res.get("analysis") or ""
        # Safe print for Windows console encoding compatibility
        print(analysis_text.encode(sys.stdout.encoding or 'utf-8', errors='replace').decode(sys.stdout.encoding or 'utf-8'))
        print("")
    else:
        print("-> FAILED\n")

    print("======================================================================")
    print("            ALL ARGUS INTEGRATION CHECKS COMPLETED                    ")
    print("======================================================================")

if __name__ == "__main__":
    run_tests()
