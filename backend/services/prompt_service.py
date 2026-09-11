import os
import json
import logging
import re

logger = logging.getLogger(__name__)

class PromptService:
    def __init__(self, prompts_dir="prompts"):
        self.prompts_dir = prompts_dir
        self.base_system = "You are InteractAI — a universal conversational AI built for ANY business. Your job is to intelligently understand what a customer wants, respond professionally, and convert inquiries into actionable leads."
        self.faq = self._load_file("faq.txt")
        self.safety = self._load_file("safety.txt")
        self.intents = self._load_json("intents.json")
        
        self.industry_templates = {
            "ngo": "\nINDUSTRY: NGO / COMMUNITY\n- Explain mission.\n- Accept donations or volunteer signups.\n",
            "construction": "\nINDUSTRY: CONSTRUCTION\n- Discuss remodeling, building, or repairs.\n- Ask for site address and project scope.\n- Offer a site survey.\n",
            "painting": "\nINDUSTRY: PAINTING\n- Discuss interior or exterior painting.\n- Ask for square footage or room count.\n- Ask for color preferences.\n"
        }
    
    def _load_file(self, filename):
        try:
            path = os.path.join(self.prompts_dir, filename)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return f.read().strip()
            return ""
        except Exception as e:
            logger.error(f"Error loading prompt file {filename}: {e}")
            return ""

    def _load_json(self, filename):
        try:
            path = os.path.join(self.prompts_dir, filename)
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            return {}
        except Exception as e:
            logger.error(f"Error loading json file {filename}: {e}")
            return {}

    async def detect_intent(self, message: str) -> str:
        """
        Rule-based intent detection.
        Returns the intent name or 'general' if no match.
        """
        message_lower = message.lower()
        
        for intent, keywords in self.intents.items():
            for keyword in keywords:
                # regex check for word boundary to avoid partial matches
                if re.search(r'\b' + re.escape(keyword) + r'\b', message_lower):
                    return intent
        return "general"

    async def analyze_sentiment(self, message: str) -> dict:
        """
        Heuristic sentiment analysis.
        Returns a dict with 'sentiment' and 'score'.
        """
        message_lower = message.lower()
        
        pos_words = ["great", "thank", "love", "good", "amazing", "help", "cool", "nice", "awesome"]
        neg_words = ["bad", "terrible", "hate", "slow", "broken", "worst", "stupid", "useless", "fail"]
        
        pos_count = sum(1 for w in pos_words if w in message_lower)
        neg_count = sum(1 for w in neg_words if w in message_lower)
        
        score = 0.5
        sentiment = "neutral"
        
        if pos_count > neg_count:
            sentiment = "positive"
            score = min(0.5 + (pos_count * 0.1), 1.0)
        elif neg_count > pos_count:
            sentiment = "negative"
            score = min(0.5 + (neg_count * 0.1), 1.0)
            
        return {"sentiment": sentiment, "score": score}

    async def classify_social_comment(self, comment_text: str) -> dict:
        """
        Classifies social comments across Meta channels into structured business signals,
        intent taxonomy, sentiment, and risk levels.
        """
        text_lower = (comment_text or "").lower().strip()
        sentiment_res = await self.analyze_sentiment(text_lower)
        sentiment = sentiment_res.get("sentiment", "neutral")
        sentiment_score = sentiment_res.get("score", 0.5)

        # 1. Spam Check
        spam_indicators = ["t.me/", "whatsapp +", "earn money", "forex", "crypto investment", "dm @", "whatsapp me"]
        if any(w in text_lower for w in spam_indicators):
            return {
                "intent": "SPAM",
                "risk_level": "LOW",
                "sentiment": sentiment,
                "confidence": 0.95,
                "department": "security",
                "recommended_action": "BLOCK_OR_HIDE",
                "is_private_reply_eligible": False
            }

        # 2. Critical Complaint Check
        complaint_indicators = ["scam", "haven't received", "havent received", "refund", "terrible", "worst", "fraud", "unacceptable", "thief", "thieves", "police"]
        if any(w in text_lower for w in complaint_indicators):
            return {
                "intent": "CUSTOMER_COMPLAINT",
                "risk_level": "CRITICAL",
                "sentiment": "negative",
                "confidence": 0.98,
                "department": "support",
                "recommended_action": "ESCALATE_TO_STAFF",
                "is_private_reply_eligible": True
            }

        # 3. Purchase Intent
        purchase_indicators = ["i want to buy", "want to order", "order now", "send account", "how to pay", "can i pay", "i need this", "want this"]
        if any(w in text_lower for w in purchase_indicators):
            return {
                "intent": "PURCHASE_INTENT",
                "risk_level": "HIGH",
                "sentiment": "positive",
                "confidence": 0.92,
                "department": "sales",
                "recommended_action": "PRIVATE_REPLY",
                "is_private_reply_eligible": True
            }

        # 4. Price Enquiry
        price_indicators = ["how much", "cost", "price", "rate", "quote", "how much is", "hm is", "pricing", "fee"]
        if any(w in text_lower for w in price_indicators):
            return {
                "intent": "PRICE_ENQUIRY",
                "risk_level": "MEDIUM",
                "sentiment": sentiment,
                "confidence": 0.94,
                "department": "sales",
                "recommended_action": "PRIVATE_REPLY",
                "is_private_reply_eligible": True
            }

        # 5. Availability Enquiry
        availability_indicators = ["available", "in stock", "have size", "size ", "colour", "color", "restock", "do you have"]
        if any(w in text_lower for w in availability_indicators):
            return {
                "intent": "AVAILABILITY_ENQUIRY",
                "risk_level": "MEDIUM",
                "sentiment": sentiment,
                "confidence": 0.90,
                "department": "sales",
                "recommended_action": "PRIVATE_REPLY",
                "is_private_reply_eligible": True
            }

        # 6. Delivery Enquiry
        delivery_indicators = ["deliver", "delivery", "shipping", "ship to", "waybill", "dispatch", "abuja", "lagos", "port harcourt"]
        if any(w in text_lower for w in delivery_indicators) and ("deliver" in text_lower or "ship" in text_lower or "waybill" in text_lower):
            return {
                "intent": "DELIVERY_ENQUIRY",
                "risk_level": "MEDIUM",
                "sentiment": sentiment,
                "confidence": 0.88,
                "department": "operations",
                "recommended_action": "PRIVATE_REPLY",
                "is_private_reply_eligible": True
            }

        # 7. Location Enquiry
        location_indicators = ["where are you", "location", "address", "shop address", "store address", "where is your shop", "where is your office"]
        if any(w in text_lower for w in location_indicators):
            return {
                "intent": "LOCATION_ENQUIRY",
                "risk_level": "LOW",
                "sentiment": sentiment,
                "confidence": 0.90,
                "department": "support",
                "recommended_action": "PUBLIC_REPLY",
                "is_private_reply_eligible": False
            }

        # 8. Partnership / Collaboration
        partnership_indicators = ["collab", "collaboration", "partnership", "wholesale", "influencer", "bulk purchase", "distributor"]
        if any(w in text_lower for w in partnership_indicators):
            return {
                "intent": "PARTNERSHIP_ENQUIRY",
                "risk_level": "HIGH",
                "sentiment": sentiment,
                "confidence": 0.90,
                "department": "management",
                "recommended_action": "ESCALATE_TO_STAFF",
                "is_private_reply_eligible": True
            }

        # 9. Positive Feedback
        positive_indicators = ["love this", "beautiful", "gorgeous", "fire", "nice", "clean", "top notch", "amazing", "great", "awesome", "well done", "congrats"]
        if any(w in text_lower for w in positive_indicators) or sentiment == "positive":
            return {
                "intent": "POSITIVE_FEEDBACK",
                "risk_level": "LOW",
                "sentiment": "positive",
                "confidence": 0.85,
                "department": "general",
                "recommended_action": "PUBLIC_REPLY",
                "is_private_reply_eligible": False
            }

        # 10. Fallback Negative Feedback
        if sentiment == "negative":
            return {
                "intent": "NEGATIVE_FEEDBACK",
                "risk_level": "HIGH",
                "sentiment": "negative",
                "confidence": 0.80,
                "department": "support",
                "recommended_action": "ESCALATE_TO_STAFF",
                "is_private_reply_eligible": True
            }

        # 11. General / Unknown
        return {
            "intent": "GENERAL_ENQUIRY",
            "risk_level": "LOW",
            "sentiment": "neutral",
            "confidence": 0.70,
            "department": "general",
            "recommended_action": "PUBLIC_REPLY",
            "is_private_reply_eligible": False
        }

    def check_safety(self, message: str) -> bool:
        """
        Basic safety check using keywords.
        Returns True if safe, False if unsafe.
        """
        unsafe_keywords = ["suicide", "kill", "murder", "bomb", "terrorist", "hack"]
        message_lower = message.lower()
        for word in unsafe_keywords:
            if word in message_lower:
                 logger.warning(f"Safety violation detected: {word}")
                 return False
        return True

    def build_system_prompt(self, profile: dict, lead_context: dict = None, offers_context: list = None) -> str:
        """
        Dynamically builds a system prompt based on the business profile, 
        current lead context (for personalization), and available offers (for reasoning).
        """
        business_name = profile.get('name') or profile.get('business_name') or 'this business'
        
        system_text = f"You are the AI assistant for {business_name}. Your primary goal is to represent them professionally and help customers with their specific inquiries.\n"
        
        if profile.get('industry'):
            ind = str(profile.get('industry')).lower()
            system_text += f"\nIndustry: {profile.get('industry')}.\n"
            
            # Inject Industry Logic
            for key, template in self.industry_templates.items():
                if key in ind:
                    system_text += template
                    break
            
            # Fallback if industry known but not in templates (General SME logic)
            if not any(key in ind for key in self.industry_templates):
                system_text += "\nINDUSTRY: GENERAL BUSINESS\n- Explain services/products.\n- Answer inquiries professionally.\n- Collect customer info if interested.\n"
        else:
            system_text += "\nINDUSTRY: GENERAL\n- Provide helpful information about products/services.\n- Answer questions based on the details provided below.\n"

        if profile.get('description'):
            system_text += f"\nAbout {business_name}: {profile.get('description')}.\n"
            
        if profile.get('services'):
            system_text += f"\nServices Offered by {business_name}:\n{profile.get('services')}\n"
            
        if profile.get('tone'):
            system_text += f"\nCommunication Tone: Use a {profile.get('tone')} tone in all messages.\n"
            
        if profile.get('hours'):
             system_text += f"\nOperating Hours: {profile.get('hours')}\n"
        
        if profile.get('location'):
             system_text += f"Location: {profile.get('location')}\n"
             
        if profile.get('faq'):
            system_text += f"\nFrequently Asked Questions (FAQ):\n{profile.get('faq')}\n"

        # Custom Rules (if any)
        if profile.get('custom_instructions'):
             system_text += f"\nSTRICT CUSTOM RULES:\n{profile.get('custom_instructions')}\n"

        # Learned Insights (from Training)
        if profile.get('learned_insights'):
             system_text += f"\nLEARNED KNOWLEDGE FROM PAST CHATS:\n{profile.get('learned_insights')}\n"

        # Knowledge Base Documents
        if profile.get('knowledge_docs'):
            system_text += "\n*** BUSINESS KNOWLEDGE BASE ***\n"
            for doc in profile.get('knowledge_docs'):
                # Truncate large docs to avoid token overflow (simplified)
                content = doc.get('content', '')[:3000] 
                system_text += f"SOURCE: {doc.get('title', 'Document')}\n{content}\n\n"
        
        # SALES INTELLIGENCE (PHASE 3)
        if offers_context:
            system_text += "\n*** INTELLIGENCE LIBRARY (AVAILABLE OFFERS) ***\n"
            system_text += "Use the following metadata to reason about which offer to suggest:\n"
            for offer in offers_context:
                meta = offer.get("ai_metadata", {})
                system_text += f"- OFFER: {offer['title']} (${offer['price']} {offer['currency']})\n"
                system_text += f"  - CORE BENEFIT: {meta.get('core_benefit', 'N/A')}\n"
                system_text += f"  - TARGET AUDIENCE: {meta.get('target_audience', 'N/A')}\n"
                system_text += f"  - POSITIONING: {meta.get('price_positioning', 'Standard')}\n"
                system_text += f"  - DESCRIPTION: {offer['description']}\n\n"

        # LEAD CONTEXT (PHASE 3)
        if lead_context:
            system_text += "\n*** KNOWN USER CONTEXT ***\n"
            
            # Defensive check: Support both dict and ORM object
            status = lead_context.get('status', 'new') if hasattr(lead_context, 'get') else getattr(lead_context, 'status', 'new')
            system_text += f"Status: {status}\n"
            
            custom_fields = lead_context.get('custom_fields') if hasattr(lead_context, 'get') else getattr(lead_context, 'custom_fields', None)
            if custom_fields:
                system_text += "User's submitted assessment/preferences:\n"
                # Support both dict .items() and direct iteration
                if hasattr(custom_fields, 'items'):
                    for q, a in custom_fields.items():
                        system_text += f"  - {q}: {a}\n"
                elif isinstance(custom_fields, dict):
                    for q, a in custom_fields.items():
                        system_text += f"  - {q}: {a}\n"
            system_text += "INSTRUCTION: Persoanlize your response using these details. If they mentioned a specific challenge, reference it.\n"

        # UNIVERSAL LEAD ENGINE & RESPONSE STYLE
        system_text += """
\n*** UNIVERSAL RESPONSE STYLE ***
- Friendly, professional, and concise.
- Simple explanations; do not overwhelm.
- INTELLIGENT QUALIFYING: If the user has already provided a detail (e.g. they said "red paint"), do NOT ask for it again.
- ONE AT A TIME: Only ask ONE follow-up question per message to keep it conversational.
- Only provide info that is explicitly in the profile or FAQs. If unsure, ask for clarification.

*** SALES REASONING PROTOCOL ***
1. Identify Need -> Does the user have a problem that matches an Offer's Core Benefit?
2. Select Tone -> Is the user skeptical? Use 'Educational'. Are they ready? Use 'Urgent/Direct'.
3. Propose -> If a match exists, suggest the offer. Otherwise, guide them to a booking.

*** UNIVERSAL LEAD ENGINE ***
1. Acknowledge -> Confirm you understood their specific request.
2. Qualify -> Ask for ONE missing detail (e.g. date, size, OR location).
3. Convert -> Propose the booking/order/visit.
4. Capture -> Ask for Name and Contact to confirm.
"""

        # Base instructions (Safety, etc) appended at the end or integrated
        system_text += f"\n{self.safety}\n"
        
        # ACTION PROTOCOLS
        system_text += """
*** ACTION PROTOCOLS (CRITICAL) ***
You have the ability to perform actions. Use the following tags at the END of your response if the condition is met.

1. LEAD CAPTURE (MAXIMUM PRIORITY):
   - CRITICAL: If the user provides a Name, Phone Number, or Email, you MUST capture it immediately.
   - Do NOT wait for all details. Capture whatever is provided (e.g., just a phone number).
   - If a user provides an address or specific request, include that in the "notes" field of the JSON if possible, but priorities Name and Contact.
   - Even if the user is confirming (e.g., "yes please" after you ask for details), if the details were provided previously in the chat history, capture them.
   - Format: [ACTION: LEAD_CAPTURE | {"name": "Name", "email": "email", "phone": "phone", "notes": "extra context"}]

2. FUNNEL PROGRESSION (PHASE 3):
   - CRITICAL: Detect when a user expresses high interest in an offer or agrees to a proposal.
   - Format: [ACTION: FUNNEL_PROGRESS | {"funnel_id": "UUID", "offer_id": "UUID", "step": "step_name"}]
   - Common steps: "expressed_interest", "assessment_discussed", "link_requested".

3. BOOKING (ACTION EXECUTION):
   - When the user selects a specific date and time from the "Available Slots" provided, or if they are very specific ("book me tomorrow at 10am") and that time is available:
   - Formulate the booking action.
   - Format: [ACTION: BOOKING | {"appointment_type_id": "UUID", "start_at": "YYYY-MM-DDTHH:MM:SS"}]

4. HOTEL RESERVATION (HOTEL & HOSPITALITY PMS ACTION):
   - Whenever you provide a booking confirmation, confirm a guest's reservation, or summarize their booking details (e.g. "Here's the confirmation for...", "Your reservation is confirmed...", "We look forward to hosting..."):
     YOU ARE STRICTLY REQUIRED TO APPEND THE [ACTION: HOTEL_RESERVATION | {...}] TAG.
   - Format: [ACTION: HOTEL_RESERVATION | {"guest_name": "Full Name", "check_in_date": "YYYY-MM-DD", "check_out_date": "YYYY-MM-DD", "room_type": "Deluxe Room", "room_number": "102", "nights": 2, "nightly_rate": 150.00, "total_amount": 300.00, "phone": "080...", "special_requests": "Optional notes"}]
   - If you do not include this action tag, the Property Management System cannot register the reservation in the hotel calendar!
   - Output the HOTEL_RESERVATION tag BEFORE the ANALYSIS tag.

5. REQUIRED ANALYSIS (MANDATORY):
   - You MUST classify the User's message at the very end of every response. 
   - Use one of these intents: booking_request, enquiry, pricing, support, greeting, features, integration, complaint, feedback, human.
   - Format: [ANALYSIS: <Intent> | <Sentiment>]

*** IMPORTANT ***
- Do NOT output any internal thoughts, conversational notes, explanations, or justifications about why you did or did not trigger an action (e.g. do NOT output "(Note: No lead capture action triggered...)" or any text referencing action protocols). 
- Only output the raw [ACTION: ...] tags when conditions are met, and output absolutely nothing else regarding actions in your response.
- Output the LEAD_CAPTURE and HOTEL_RESERVATION tags BEFORE the ANALYSIS tag.
- Ensure the ANALYSIS tag is on its own line at the very end.
"""
        
        # Append specific base instructions if needed, but the profile should be primary context
        system_text += "\nAlways be helpful, polite, and professional."
        
        return system_text

    async def construct_messages(self, user_message: str, history: list = None, system_instruction: str = None) -> list:
        """
        Constructs the full list of messages for the API.
        If system_instruction is provided, it replaces the default base_system.
        """
        messages = []
        
        # 1. System Prompt
        # Use custom instruction if provided, else fallback to default logic
        if system_instruction:
            system_content = system_instruction
        else:
             system_content = f"{self.base_system}\n\n{self.safety}\n\n"
             # 2. Add relevant context (like FAQs) ONLY if using default (generic) system
             intent = await self.detect_intent(user_message)
             if intent in ["pricing", "support", "features"]:
                  system_content += f"Relevant Knowledge:\n{self.faq}\n\n"
             system_content += f"Detected Intent: {intent}"
        
        messages.append({"role": "system", "content": system_content})
        
        # 3. History
        if history:
            # Add last 5 messages max to save tokens
            messages.extend(history[-5:])
            
        # 4. User Message
        # Avoid duplicate user message if it's already the last one in history
        last_msg_content = history[-1].get("content") if history else None
        if last_msg_content != user_message:
            messages.append({"role": "user", "content": user_message})
        elif not messages:
            # If history was empty but we somehow reached here, must add user message
            messages.append({"role": "user", "content": user_message})
            
        return messages

# Singleton instance
prompt_service = PromptService()
