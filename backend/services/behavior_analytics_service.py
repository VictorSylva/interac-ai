import logging
import uuid
from datetime import datetime, timedelta
from sqlalchemy import select, update, insert, func, text
from database.session import AsyncSessionLocal
from database.models.behavior_analytics import BASession, BAEvent, BAAggregate

logger = logging.getLogger(__name__)

class BehaviorAnalyticsService:
    async def get_or_create_session(self, business_id: str, session_id: str, visitor_id: str, metadata: dict):
        """Retrieves or creates a namespaced behavioral session."""
        async with AsyncSessionLocal() as session:
            try:
                stmt = select(BASession).where(BASession.id == session_id)
                result = await session.execute(stmt)
                ba_session = result.scalar_one_or_none()

                if not ba_session:
                    ba_session = BASession(
                        id=session_id or str(uuid.uuid4()),
                        business_id=business_id,
                        visitor_id=visitor_id,
                        referrer=metadata.get("referrer"),
                        utm_source=metadata.get("utm_source"),
                        utm_medium=metadata.get("utm_medium"),
                        utm_campaign=metadata.get("utm_campaign"),
                        device=metadata.get("device"),
                        browser=metadata.get("browser"),
                        os=metadata.get("os"),
                        country=metadata.get("country"),
                        start_time=datetime.utcnow()
                    )
                    session.add(ba_session)
                    await session.commit()
                    await session.refresh(ba_session)
                
                return ba_session
            except Exception as e:
                print(f"DEBUG BA SESSION ERROR: {e}")
                logger.error(f"Error in BAService.get_or_create_session: {e}")
                await session.rollback()
                return None

    async def track_event(self, business_id: str, session_id: str, event_data: dict):
        """Records a single namespaced behavioral event."""
        async with AsyncSessionLocal() as session:
            try:
                # 1. Create Event
                new_event = BAEvent(
                    business_id=business_id,
                    session_id=session_id,
                    event_type=event_data.get("type"),
                    path=event_data.get("path"),
                    offer_id=event_data.get("offer_id"),
                    funnel_id=event_data.get("funnel_id"),
                    element_id=event_data.get("element_id"),
                    element_class=event_data.get("element_class"),
                    element_text=event_data.get("element_text"),
                    properties=event_data.get("properties", {}),
                    timestamp=datetime.utcnow()
                )
                session.add(new_event)

                # 2. Update Session Stats
                stmt = select(BASession).where(BASession.id == session_id)
                res = await session.execute(stmt)
                ba_session = res.scalar_one_or_none()
                
                if ba_session:
                    if event_data.get("type") == "pageview":
                        ba_session.page_views_count += 1
                        if ba_session.page_views_count > 1:
                            ba_session.is_bounce = False
                    
                    ba_session.end_time = datetime.utcnow()
                    ba_session.duration_seconds = int((ba_session.end_time - ba_session.start_time).total_seconds())

                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error in BAService.track_event: {e}")
                await session.rollback()
                return False

    async def track_batch(self, business_id: str, session_id: str, events: list):
        """Processes a batch of behavioral events."""
        results = []
        for event in events:
            res = await self.track_event(business_id, session_id, event)
            results.append(res)
        return all(results)

    async def run_aggregation(self, business_id: str, date_str: str = None):
        """Isloated daily aggregation for behavioral metrics."""
        async with AsyncSessionLocal() as session:
            try:
                date_val = datetime.strptime(date_str, "%Y-%m-%d").date() if date_str else datetime.utcnow().date()
                start_of_day = datetime.combine(date_val, datetime.min.time())
                end_of_day = datetime.combine(date_val, datetime.max.time())

                # Aggregate metrics logic (SESSIONS, PAGEVIEWS, USERS)
                metrics = {}
                
                session_count = (await session.execute(select(func.count(BASession.id)).where(
                    BASession.business_id == business_id,
                    BASession.start_time >= start_of_day,
                    BASession.start_time <= end_of_day
                ))).scalar() or 0
                metrics["sessions"] = session_count

                pv_count = (await session.execute(select(func.count(BAEvent.id)).where(
                    BAEvent.business_id == business_id,
                    BAEvent.event_type == "pageview",
                    BAEvent.timestamp >= start_of_day,
                    BAEvent.timestamp <= end_of_day
                ))).scalar() or 0
                metrics["pageviews"] = pv_count

                user_count = (await session.execute(select(func.count(func.distinct(BASession.visitor_id))).where(
                    BASession.business_id == business_id,
                    BASession.start_time >= start_of_day,
                    BASession.start_time <= end_of_day
                ))).scalar() or 0
                metrics["unique_users"] = user_count

                for name, value in metrics.items():
                    agg_stmt = select(BAAggregate).where(
                        BAAggregate.business_id == business_id,
                        BAAggregate.date == start_of_day,
                        BAAggregate.metric_name == name
                    )
                    existing = (await session.execute(agg_stmt)).scalar_one_or_none()
                    
                    if existing:
                        existing.metric_value = float(value)
                    else:
                        new_agg = BAAggregate(
                            business_id=business_id,
                            date=start_of_day,
                            metric_name=name,
                            metric_value=float(value)
                        )
                        session.add(new_agg)

                await session.commit()
                return True
            except Exception as e:
                logger.error(f"Error in BAService.run_aggregation for {business_id}: {e}")
                await session.rollback()
                return False

behavior_analytics_service = BehaviorAnalyticsService()

# --- Celery Tasks ---
from celery import shared_task
import asyncio

@shared_task(name="behavior_analytics.run_daily_aggregation")
def ba_run_daily_aggregation_task():
    """Isolated shared task for behavioral aggregation."""
    async def run():
        async with AsyncSessionLocal() as session:
            from database.models.general import Business
            stmt = select(Business.id)
            result = await session.execute(stmt)
            for bid in result.scalars().all():
                await behavior_analytics_service.run_aggregation(bid)

    loop = asyncio.get_event_loop()
    if loop.is_running():
        asyncio.ensure_future(run())
    else:
        loop.run_until_complete(run())
