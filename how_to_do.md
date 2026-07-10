# How-To: Master Logic & Workflows in InteractAI

This guide provides vivid, step-by-step blueprints for major business processes you can automate using the InteractAI Workflow Engine.

---

## 1. Automated Lead Qualification & CRM Sync

**Goal:** Automatically identify high-value interests, qualify the lead, and save them to your CRM.

### Step-by-Step UI Setup:

1.  **Trigger:** Drag a **Start** node. In config, set Type to `Intent` and value to `pricing`.
2.  **Extraction:** Connect the Start node to an **AI Extract** node.
    - Click the node and add two fields: `budget` (Type: Number) and `company` (Type: String).
3.  **Logic Branch:** Connect AI Extract to a **Condition** node.
    - Set Variable to `budget`.
    - Set Operator to `greater_than`.
    - Set Value to `5000`.
4.  **VIP Capture:** Connect the **True** port of the Condition node to a **Lead Capture** node.
    - Set Name to `{{company}} VIP`.
    - Set Notes to `High budget lead: ${{budget}}`.
5.  **Standard Response:** Connect the **False** port to an **AI Think** node (Intelligence section).
    - Click it and in the **Prompt Template**, enter: "Thanks! We have plans for your company {{company}} starting at $49. Ask them if they'd like a free trial."

---

## 2. Technical Support & Complaint Escalation

**Goal:** Handle dissatisfied customers immediately by extracting details and tracking them in the CRM.

### Step-by-Step UI Setup:

1.  **Trigger:** Create a **Start** node with Intent: `complaint`.
2.  **Initial Empathy:** Connect to an **AI Think** node (Intelligence section).
    - **Prompt Template:** "Acknowledge that the user is frustrated and politely ask them to describe their issue so we can escalate it."
3.  **Human Input:** Connect that node to a **Wait for Reply** node. This "pauses" the workflow until the user speaks.
4.  **Ticket Creation:** Connect the Wait node to a **Create Ticket** node.
    - Set Subject to `High Priority Complaint`.
    - Set Priority to `High`.
5.  **Closure:** Connect to a final **AI Think** node.
    - **Prompt Template:** "Tell the user their Ticket ID is #{{ticket_id}} and assure them our senior team will call them shortly."

---

## 3. Intelligent Appointment Booking

**Goal:** Guide a user through booking a consultation or service visit.

### Step-by-Step UI Setup:

1.  **Trigger:** Set Start node to Intent: `booking`.
2.  **Scheduling Ask:** Connect to an **AI Think** node.
    - **Prompt Template:** "Tell the user we'd love to host them! Ask what day and time works best for their visit."
3.  **Capture Detail:** Connect to a **Wait for Reply**, then an **AI Extract** node.
    - Fields: `date` (String) and `time` (String).
4.  **Confirmation:** Connect to a **Lead Capture** node.
    - Set Status to `Booking Requested`.
    - Set Notes to `Requested {{date}} at {{time}}`.
5.  **Follow-up (Nurture):** Connect to a **Time Delay** node.
    - Set to `3600` seconds (1 Hour).
6.  **Reminder:** Connect the Delay to a final **AI Think** node.
    - **Prompt Template:** "Send a friendly reminder that we've received their booking request for {{date}} and we're looking forward to it."

---

## Best Practices for Workflows

- **Variable Hydration:** Use `{{variable_name}}` to inject extracted data into messages or CRM notes.
- **Intent Over Keywords:** Intent triggers are much more flexible than exact keyword matches.
- **Single Response Rule:** When a workflow is active, the standard AI "brain" stays quiet so it doesn't interrupt the automated flow.
- **AI Think vs Send Message:**
  - Use **AI Think** (Intelligence section) when you want the AI to generate a polite, contextual response based on a **Prompt Template** (your instruction).
  - Use **Send Message** (Actions section) for static, un-changing messages like "Your request has been received."
- **Prompt Template is an Instruction:** Don't just type the message you want. Type the _goal_ or _goal instruction_ (e.g., "Ask the user for their email"). The AI will use this to generate the final polite response.

---

_Need help building a custom flow? Simply ask the assistant: "Help me build a workflow for [Your Process]."_
