import asyncio
import httpx
import sys

GENERIC_URL = "http://localhost:8000/api/v1"
ORG_ID = "0bbd48c4-b066-435a-be3d-c095b55897c6"

async def test_crud():
    print("====================================================")
    print("      TESTING DYNAMIC MENU CRUD ENDPOINTS          ")
    print("====================================================")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Fetch current menu items
        print("\n[Step 1] Listing existing menu items...")
        res = await client.get(f"{GENERIC_URL}/entities?org_id={ORG_ID}&entity_type_code=restaurant_food")
        assert res.status_code == 200, f"List failed: {res.text}"
        data = res.json()
        items = data.get("items", [])
        print(f"Found {len(items)} items in the database.")

        # 2. Create new item
        print("\n[Step 2] Creating new menu item 'Peppered Snail'...")
        payload = {
            "org_id": ORG_ID,
            "entity_type_code": "restaurant_food",
            "display_label": "Peppered Snail",
            "attributes": {
                "price": 6000.0
            }
        }
        res = await client.post(f"{GENERIC_URL}/entities", json=payload)
        assert res.status_code == 201, f"Create failed: {res.text}"
        created_item = res.json()
        item_id = created_item["id"]
        print(f"Created successfully: ID={item_id}, Name={created_item['display_label']}, Price={created_item['attributes']['price']}")
        
        # 3. Update the item
        print("\n[Step 3] Updating 'Peppered Snail' price to 7500...")
        update_payload = {
            "display_label": "Peppered Snail Premium",
            "attributes": {
                "price": 7500.0
            }
        }
        res = await client.put(f"{GENERIC_URL}/entities/{item_id}", json=update_payload)
        assert res.status_code == 200, f"Update failed: {res.text}"
        updated_item = res.json()
        print(f"Updated successfully: Name={updated_item['display_label']}, Price={updated_item['attributes']['price']}")

        # 4. Fetch to verify changes persist
        print("\n[Step 4] Fetching specific item...")
        res = await client.get(f"{GENERIC_URL}/entities/{item_id}")
        assert res.status_code == 200, f"Get failed: {res.text}"
        fetched_item = res.json()
        assert fetched_item["display_label"] == "Peppered Snail Premium"
        assert fetched_item["attributes"]["price"] == 7500.0
        print("Verification successful.")

        # 5. Delete the item
        print("\n[Step 5] Deleting the item...")
        res = await client.delete(f"{GENERIC_URL}/entities/{item_id}")
        assert res.status_code == 200, f"Delete failed: {res.text}"
        print("Deleted successfully.")

        # 6. Verify it's gone
        print("\n[Step 6] Verifying item is gone...")
        res = await client.get(f"{GENERIC_URL}/entities/{item_id}")
        assert res.status_code == 404
        print("Confirmed: Item no longer exists.")
        
        print("\n🎉 ALL DYNAMIC MENU CRUD TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_crud())
