import urllib.parse
from datetime import datetime, timedelta

class CalendarService:
    def generate_google_calendar_link(self, title: str, start_at: datetime, duration_minutes: int, description: str, location: str = None):
        """
        Generates a Google Calendar Template URL.
        """
        end_at = start_at + timedelta(minutes=duration_minutes)
        
        # Format: YYYYMMDDTHHmmSSZ
        fmt = "%Y%m%dT%H%M%SZ"
        dates = f"{start_at.strftime(fmt)}/{end_at.strftime(fmt)}"
        
        params = {
            "action": "TEMPLATE",
            "text": title,
            "dates": dates,
            "details": description
        }
        if location:
            params["location"] = location
            
        return f"https://www.google.com/calendar/render?{urllib.parse.urlencode(params)}"

    def generate_ics_content(self, title: str, start_at: datetime, duration_minutes: int, description: str, location: str = None):
        """
        Generates raw ICS file content as a string.
        """
        end_at = start_at + timedelta(minutes=duration_minutes)
        fmt = "%Y%m%dT%H%M%SZ"
        
        # Escape newlines for ICS
        desc_escaped = description.replace('\n', '\\n')
        
        ics_lines = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//InteracAI//Scheduling//EN",
            "BEGIN:VEVENT",
            f"UID:{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}@interacai.com",
            f"DTSTAMP:{datetime.utcnow().strftime(fmt)}",
            f"DTSTART:{start_at.strftime(fmt)}",
            f"DTEND:{end_at.strftime(fmt)}",
            f"SUMMARY:{title}",
            f"DESCRIPTION:{desc_escaped}",
        ]
        
        if location:
            ics_lines.append(f"LOCATION:{location}")
            
        ics_lines.extend([
            "END:VEVENT",
            "END:VCALENDAR"
        ])
        
        return "\n".join(ics_lines)

calendar_service = CalendarService()
