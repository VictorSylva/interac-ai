# INTERACAI — ENTITY MAPPING & DEDUPLICATION ENGINE
**Mapping External Third-Party Objects into the Dynamic Entity System with Absolute Idempotency**

---

## 1. The Entity Synchronization Challenge

When integrating with external business software (e.g. Mews, Shopify, QuickBooks, PowerSchool, OpenMRS), records are constantly being created, updated, or resent across webhooks and polling runs.

Without strict entity resolution and deduplication:
- A customer placing three orders in Shopify would create three duplicate customer profiles in InteracAI.
- A modified hotel reservation in Opera would create duplicate room bookings.
- Repeated webhook retries from Paystack would decrement inventory multiple times.

InteracAI solves this through **Deterministic Dynamic Entity Resolution** built directly on top of the `EntityType` and `EntityV2` models (`backend/database/models/dynamic_entity.py`).

---

## 2. Dynamic Entity Schema Mapping Architecture

```
  EXTERNAL SYSTEM OBJECT                      INTERACAI DYNAMIC ENTITY SYSTEM
┌───────────────────────────┐                ┌─────────────────────────────────────────┐
│ System: Mews PMS          │                │ EntityType: 'hotel_reservation'         │
│ Object: Reservation       │──(Normalized)─►│ Code: 'hotel_reservation'               │
│ External ID: 'RES-88291'  │                │ Org ID: 'org_hotel_lagos'               │
│ Guest: 'Emeka Adeleke'    │                └───────────────────┬─────────────────────┘
│ Room: '304'               │                                    │
│ Dates: 2026-09-10 to 12   │                                    ▼
└───────────────────────────┘                ┌─────────────────────────────────────────┐
                                             │ EntityV2 Instance                       │
                                             │ • id: 'ent_4f92a188bc01' (Internal UUID)│
                                             │ • org_id: 'org_hotel_lagos'             │
                                             │ • entity_type_id: 'et_hotel_res'        │
                                             │ • external_ref_id: 'mews:RES-88291'     │
                                             │ • display_label: 'Res: Emeka - Rm 304'  │
                                             │ • attributes (JSONB):                   │
                                             │   {                                     │
                                             │     "guest_name": "Emeka Adeleke",      │
                                             │     "room_number": "304",               │
                                             │     "check_in": "2026-09-10",           │
                                             │     "status": "CONFIRMED",              │
                                             │     "external_system": "mews",          │
                                             │     "last_synced_at": "2026-09-01T..."  │
                                             │   }                                     │
                                             │ • risk_score: 0.0                       │
                                             └─────────────────────────────────────────┘
```

---

## 3. Entity Resolution & Deduplication Rules

### Rule 1: Compound Key Idempotency (`org_id` + `external_ref_id`)
Every external object is assigned a structured composite reference:
$$\text{external\_ref\_id} = \text{vendor\_slug} : \text{vendor\_primary\_key}$$
- Mews Reservation `9843` $\rightarrow$ `mews:9843`
- Shopify Order `1084` $\rightarrow$ `shopify:1084`
- PowerSchool Student `5541` $\rightarrow$ `powerschool:5541`
- OpenMRS Patient `PAT-991` $\rightarrow$ `openmrs:PAT-991`

When an inbound webhook or polling event arrives, InteracAI performs an indexed database lookup:
```python
stmt = select(EntityV2).where(
    EntityV2.org_id == org_id,
    EntityV2.entity_type_id == target_entity_type_id,
    EntityV2.external_ref_id == f"{vendor}:{external_id}"
)
result = await db.execute(stmt)
existing_entity = result.scalar_one_or_none()
```

### Rule 2: Non-Destructive JSON Attribute Patching (Upsert)
If the entity **exists**:
- InteracAI preserves existing internal tags, CRM activity logs, and assigned staff.
- It updates only the modified vendor fields and updates `updated_at`.
- It records a `connector_entity_updated` observation.

If the entity **does NOT exist**:
- It creates a new `EntityV2` instance with a fresh UUID.
- It links `external_ref_id`.
- It records a `connector_entity_created` observation.

---

### Rule 3: Fuzzy Customer & Guest Reconciliation
When an external system sends customer data without a shared external ID (e.g. guest booking via phone or walk-in POS), InteracAI reconciles profiles using an ordered identity cascade:

```
                  INCOMING CUSTOMER IDENTIFIER
                               │
               Has Exact E.164 Phone Number?
                 ├── YES ──► Match on `attributes.phone == phone`
                 └── NO
                      │
               Has Valid Email Address?
                 ├── YES ──► Match on `attributes.email == email`
                 └── NO
                      │
               Fuzzy Match on Cleaned Full Name + Recent Active Transaction
                 ├── MATCH FOUND (Confidence > 0.90) ──► Link to Existing Customer
                 └── NO MATCH ──────────────────────────► Create New Customer Entity
```

---

## 4. Multi-Domain Entity Mapping Specifications

### 4.1 Hotel Reservation Mapping
```json
{
  "interacai_entity_type": "hotel_reservation",
  "external_source": "mews",
  "field_mapping": {
    "external_ref_id": "mews:{{payload.Id}}",
    "display_label": "Res: {{payload.Customer.Name}} - Room {{payload.AssignedRoom}}",
    "attributes": {
      "guest_name": "{{payload.Customer.Name}}",
      "guest_phone": "{{payload.Customer.Phone}}",
      "guest_email": "{{payload.Customer.Email}}",
      "room_number": "{{payload.AssignedRoom}}",
      "check_in_date": "{{payload.StartUtc}}",
      "check_out_date": "{{payload.EndUtc}}",
      "total_amount": "{{payload.TotalCost.Value}}",
      "status": "{{payload.State}}",
      "external_system": "mews"
    }
  }
}
```

### 4.2 Retail Product / SKU Mapping
```json
{
  "interacai_entity_type": "product",
  "external_source": "shopify",
  "field_mapping": {
    "external_ref_id": "shopify:{{payload.id}}",
    "display_label": "{{payload.title}} (SKU: {{payload.variants[0].sku}})",
    "attributes": {
      "sku": "{{payload.variants[0].sku}}",
      "name": "{{payload.title}}",
      "price": "{{payload.variants[0].price}}",
      "quantity": "{{payload.variants[0].inventory_quantity}}",
      "barcode": "{{payload.variants[0].barcode}}",
      "external_system": "shopify"
    }
  }
}
```

### 4.3 Healthcare Patient Record Mapping
```json
{
  "interacai_entity_type": "patient",
  "external_source": "openmrs",
  "field_mapping": {
    "external_ref_id": "openmrs:{{payload.uuid}}",
    "display_label": "Patient: {{payload.person.display}}",
    "attributes": {
      "mrn": "{{payload.identifiers[0].identifier}}",
      "name": "{{payload.person.display}}",
      "gender": "{{payload.person.gender}}",
      "age": "{{payload.person.age}}",
      "dob": "{{payload.person.birthdate}}",
      "external_system": "openmrs"
    }
  }
}
```

---

## 5. Idempotent Event Deduplication in Action

To guarantee that duplicate webhook deliveries (common during network retries by Stripe, Paystack, or Shopify) never execute duplicate side-effects:

```python
async def process_incoming_webhook_idempotent(session, event_id: str, provider: str, payload: dict):
    # Step 1: Check if event_id has already been processed
    stmt = select(SalesWebhookLog).where(SalesWebhookLog.event_id == event_id)
    res = await session.execute(stmt)
    if res.scalars().first():
        logger.info(f"[Idempotency Guard] Event {event_id} from {provider} already processed. Returning 200 OK.")
        return {"status": "ALREADY_PROCESSED"}

    # Step 2: Log event atomically
    log_entry = SalesWebhookLog(
        id=str(uuid.uuid4()),
        event_id=event_id,
        event_type=payload.get("event"),
        payload=payload
    )
    session.add(log_entry)
    await session.commit()
    
    # Step 3: Execute Business Logic Safely
    return {"status": "PROCESSED"}
```
