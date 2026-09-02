# INTERACAI — SIGNAL TRANSLATION & EVENT NORMALIZATION ENGINE
**Transforming Third-Party Vendor Telemetry into Standardized Operational Intelligence**

---

## 1. The Signal Translation Paradigm

Third-party software vendors emit events using arbitrary, inconsistent JSON payload structures. For example:
- **Opera PMS** emits: `{"event": "BOOKING_CONFIRMED", "guestFullName": "John Doe", "arrivalDate": "2026-09-10"}`
- **Mews PMS** emits: `{"Type": "ReservationAdded", "Customer": {"Name": "John Doe"}, "StartUtc": "2026-09-10T14:00:00Z"}`
- **Shopify POS** emits: `{"topic": "orders/create", "total_price": "45000.00", "line_items": [...]}`
- **Paystack** emits: `{"event": "charge.success", "data": {"reference": "T123", "amount": 4500000}}`

If raw external vendor schemas were ingested directly into the Workflow Engine or ARGUS, every single workflow, risk rule, and dashboard widget would have to be rewritten for every new piece of software.

**InteracAI's Canonical Signal Normalizer** decouples external vendor schemas from internal intelligence:

```
  EXTERNAL SOFTWARE EVENT (Messy, Vendor-Specific)
                    │
                    ▼
  [1. Ingestion & Signature Verification] (HMAC / API Token)
                    │
                    ▼
  [2. Event Classifier] (Vendor Code -> InteracAI Canonical Event Code)
                    │
                    ▼
  [3. Field Extraction & Unit Normalization] (Currency kobo->Naira, UTC->Local, String Trim)
                    │
                    ▼
  [4. Entity Resolver] (Match `external_ref_id` -> internal `EntityV2` UUID)
                    │
                    ▼
  [5. Observation Synthesizer] (Create `ObservationV2` with Risk Impact & Location)
                    │
                    ▼
  [6. ARGUS Graph Builder] (Synthesize relationship edges e.g. `ASSIGNED_ROOM`)
                    │
                    ▼
  OBSERVATION BUS & WORKFLOW ENGINE (Uniform Platform Ingestion)
```

---

## 2. Canonical Signal Translation Matrix

### 2.1 Hotel & Hospitality Domain
| External Software | External Event Name | Canonical InteracAI Signal | Normalized Payload Attributes | Default Severity | Risk Impact |
|---|---|---|---|:---:|:---:|
| **Mews / Opera** | `ReservationAdded` / `BOOKING_CREATED` | `hotel.reservation.created` | `reservation_id`, `guest_name`, `room_type`, `check_in_date`, `check_out_date`, `nightly_rate` | `INFO` | `0.0` |
| **Mews / Opera** | `CustomerCheckedIn` / `CHECK_IN` | `hotel.guest.checkin` | `reservation_id`, `guest_name`, `room_number`, `vip_status`, `check_in_time` | `INFO` | `0.0` |
| **Mews / Opera** | `CustomerCheckedOut` / `CHECK_OUT` | `hotel.guest.checkout` | `reservation_id`, `guest_name`, `room_number`, `folio_balance`, `checkout_time` | `INFO` | `0.0` |
| **Smart Lock API** | `DOOR_UNLOCKED_RFID` | `hotel.access.door_unlocked` | `room_number`, `keycard_id`, `access_status`, `timestamp` | `INFO` | `0.0` |
| **Smart Lock API** | `DOOR_FORCED_OPEN` | `hotel.security.unauthorized_access` | `room_number`, `lock_id`, `alarm_type`, `timestamp` | `CRITICAL` | `+80.0` |
| **Restaurant POS** | `ROOM_CHARGE_POSTED` | `hotel.restaurant.room_charged` | `order_id`, `room_number`, `guest_name`, `items_summary`, `total_amount` | `INFO` | `0.0` |

---

### 2.2 Retail & Supermarket Domain
| External Software | External Event Name | Canonical InteracAI Signal | Normalized Payload Attributes | Default Severity | Risk Impact |
|---|---|---|---|:---:|:---:|
| **Shopify / WooCommerce**| `orders/create` / `order.created` | `retail.sale.completed` | `order_id`, `total_amount`, `items_count`, `channel`: `"online"`, `customer_email` | `INFO` | `0.0` |
| **Square / Moniepoint** | `payment.updated` (COMPLETED) | `retail.sale.completed` | `order_id`, `total_amount`, `terminal_id`, `channel`: `"pos"`, `cashier_name` | `INFO` | `0.0` |
| **Shopify / Square** | `refund.created` | `retail.pos.refund_issued` | `refund_id`, `order_id`, `refund_amount`, `reason`, `authorized_by` | `WARNING` | `+20.0` |
| **Inventory / ERP** | `inventory.level_low` | `retail.inventory.low_stock` | `sku`, `item_name`, `current_stock`, `min_reorder_level`, `unit_cost` | `WARNING` | `+10.0` |
| **CCTV / AI Camera** | `SWEETHEARTING_DETECTED` | `retail.security.pos_anomaly` | `camera_id`, `cashier_id`, `terminal_id`, `confidence`, `snapshot_url` | `CRITICAL` | `+85.0` |

---

### 2.3 School & Education Domain
| External Software | External Event Name | Canonical InteracAI Signal | Normalized Payload Attributes | Default Severity | Risk Impact |
|---|---|---|---|:---:|:---:|
| **PowerSchool / Edves** | `student.enrolled` | `school.admission.completed` | `student_id`, `student_name`, `grade_level`, `parent_phone`, `parent_email` | `INFO` | `0.0` |
| **RFID Turnstile Gate** | `attendance.scan_absent` | `school.attendance.absent` | `student_id`, `student_name`, `class_name`, `status`: `"UNEXCUSED"`, `timestamp` | `INFO` | `+5.0` |
| **Grading Portal** | `grades.term_finalized` | `school.academic.grades_published` | `student_id`, `term`, `gpa`, `failing_subjects_count` | `INFO` | `0.0` |
| **Paystack / Bank** | `bursary.tuition_paid` | `school.finance.tuition_paid` | `invoice_id`, `student_id`, `amount_paid`, `cleared_status`: `true` | `INFO` | `0.0` |
| **Clinic Log** | `clinic.emergency_admitted`| `school.clinic.emergency_visit` | `student_id`, `student_name`, `symptoms`, `nurse_name`, `severity`: `"HIGH"` | `CRITICAL` | `+40.0` |

---

### 2.4 Healthcare & Hospital Domain
| External Software | External Event Name | Canonical InteracAI Signal | Normalized Payload Attributes | Default Severity | Risk Impact |
|---|---|---|---|:---:|:---:|
| **OpenMRS / HMS** | `PATIENT_REGISTERED` | `hospital.patient.registered` | `patient_id` (MRN), `patient_name`, `dob`, `gender`, `emergency_contact` | `INFO` | `0.0` |
| **HMS Appointments** | `APPOINTMENT_SCHEDULED` | `hospital.appointment.booked` | `appointment_id`, `patient_id`, `doctor_id`, `department`, `scheduled_time` | `INFO` | `0.0` |
| **Laboratory LIS** | `LAB_PANIC_VALUE` | `hospital.lab.critical_result` | `test_id`, `patient_id`, `analyte`: `"Potassium"`, `value`: `6.8`, `normal_range`: `"3.5-5.0"` | `CRITICAL` | `+95.0` |
| **Pharmacy POS** | `EMERGENCY_STOCK_DEPLETED`| `hospital.pharmacy.stock_critical` | `drug_code`, `drug_name`: `"Adrenaline 1mg"`, `stock_remaining`: `2`, `min_safety`: `20` | `CRITICAL` | `+75.0` |

---

### 2.5 Small Business & Commerce Domain
| External Software | External Event Name | Canonical InteracAI Signal | Normalized Payload Attributes | Default Severity | Risk Impact |
|---|---|---|---|:---:|:---:|
| **Paystack / Flutterwave**| `charge.success` | `commerce.payment.received` | `transaction_id`, `customer_email`, `amount_naira`, `payment_channel` | `INFO` | `0.0` |
| **Meta WhatsApp API** | `messages[0]` (text) | `customer.message.received` | `from_number`, `message_body`, `timestamp`, `channel`: `"whatsapp"` | `INFO` | `0.0` |
| **Google Forms / Webhook**| `form_response_submitted`| `crm.lead.created` | `lead_name`, `email`, `phone`, `service_requested`, `budget_range` | `INFO` | `0.0` |

---

## 3. Transformation Code Walkthrough

When a third-party webhook arrives (e.g. from Opera PMS at `POST /api/v1/hotel/integrations/webhook`), the normalizer runs the canonical transformation:

```python
# 1. Classify & Extract Canonical Fields
canonical_type = "hotel.reservation.created" if event_type == "BOOKING_CREATED" else f"hotel.event.{event_type.lower()}"

# 2. Resolve Entity in Dynamic EAV Store
res = await db.execute(select(EntityV2).where(
    EntityV2.org_id == org_id, 
    EntityV2.external_ref_id == external_booking_id
))
entity = res.scalar_one_or_none()

if not entity:
    # Create or link entity
    entity = EntityV2(
        id=f"ent_{uuid.uuid4().hex[:16]}",
        org_id=org_id,
        entity_type_id=type_id,
        external_ref_id=external_booking_id,
        display_label=f"Res: {guest_name} - Room {room_number}",
        attributes={"guest_name": guest_name, "room_number": room_number, "status": "RESERVED"}
    )
    db.add(entity)

# 3. Emit Normalized Observation to Observation Bus
obs = observation_service.record_observation(
    db=db,
    org_id=org_id,
    source_channel=f"connector_{external_system.lower()}",
    observation_type=canonical_type,
    primary_entity_id=entity.id,
    location_label=f"Room {room_number}",
    payload=normalized_payload,
    severity="INFO"
)

# 4. Trigger Matching Workflows Automatically
await workflow_engine.trigger_workflow(
    business_id=org_id,
    trigger_type=canonical_type,
    trigger_data=normalized_payload
)
```
