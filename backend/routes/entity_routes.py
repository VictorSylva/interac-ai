"""
InteracAI Generic Dynamic Entity API Routes.
Provides standardized REST endpoints for creating, querying, and managing dynamic multi-industry entities.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Dict, Any, Optional
import uuid
import logging

from database.session import get_db
from database.models.dynamic_entity import EntityType, EntityV2


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1", tags=["Dynamic Entities"])


def _entity_to_dict(e: EntityV2) -> Dict[str, Any]:
    return {
        "id": e.id,
        "org_id": e.org_id,
        "entity_type_id": e.entity_type_id,
        "external_ref_id": e.external_ref_id,
        "display_label": e.display_label,
        "attributes": e.attributes or {},
        "risk_score": e.risk_score,
        "created_at": e.created_at.isoformat() if e.created_at else None,
    }


def _type_to_dict(t: EntityType) -> Dict[str, Any]:
    return {
        "id": t.id,
        "org_id": t.org_id,
        "module_id": t.module_id,
        "code": t.code,
        "display_name": t.display_name,
        "description": t.description,
        "schema_definition": t.schema_definition or {},
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# --- ENTITY TYPE ENDPOINTS ---

@router.get("/entity-types")
async def list_entity_types(
    org_id: str = Query(..., description="Organization/Business ID"),
    module_id: Optional[str] = Query(None, description="Filter by Industry Module ID"),
    db: AsyncSession = Depends(get_db)
):
    """List all entity types registered for an organization."""
    stmt = select(EntityType).where(EntityType.org_id == org_id)
    if module_id:
        stmt = stmt.where(EntityType.module_id == module_id)
    res = await db.execute(stmt)
    types = res.scalars().all()
    return [_type_to_dict(t) for t in types]


@router.post("/entity-types", status_code=status.HTTP_201_CREATED)
async def create_entity_type(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Register a new dynamic entity type for an organization."""
    org_id = payload.get("org_id")
    code = payload.get("code")
    display_name = payload.get("display_name")
    
    if not org_id or not code or not display_name:
        raise HTTPException(status_code=400, detail="Missing required fields: 'org_id', 'code', 'display_name'")

    stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == code)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        return _type_to_dict(existing)

    et = EntityType(
        id=f"et_{uuid.uuid4().hex[:12]}",
        org_id=org_id,
        module_id=payload.get("module_id", "core"),
        code=code,
        display_name=display_name,
        description=payload.get("description"),
        schema_definition=payload.get("schema_definition", {})
    )
    db.add(et)
    await db.commit()
    await db.refresh(et)
    return _type_to_dict(et)


# --- ENTITY INSTANCE ENDPOINTS ---

@router.get("/entities")
async def list_entities(
    org_id: str = Query(..., description="Organization/Business ID"),
    entity_type_code: Optional[str] = Query(None, description="Filter by Entity Type code"),
    search: Optional[str] = Query(None, description="Search display label"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List entity instances for an organization."""
    stmt = select(EntityV2).where(EntityV2.org_id == org_id)

    if entity_type_code:
        et_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == entity_type_code)
        et_res = await db.execute(et_stmt)
        et = et_res.scalar_one_or_none()
        if et:
            stmt = stmt.where(EntityV2.entity_type_id == et.id)
        else:
            return {"items": [], "total": 0}

    if search:
        stmt = stmt.where(EntityV2.display_label.ilike(f"%{search}%"))

    stmt = stmt.order_by(EntityV2.created_at.desc()).offset(offset).limit(limit)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return {"items": [_entity_to_dict(i) for i in items], "total": len(items), "limit": limit, "offset": offset}


@router.post("/entities", status_code=status.HTTP_201_CREATED)
async def create_entity_instance(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Create a new dynamic entity instance."""
    org_id = payload.get("org_id")
    entity_type_code = payload.get("entity_type_code")
    display_label = payload.get("display_label")

    if not org_id or not entity_type_code or not display_label:
        raise HTTPException(status_code=400, detail="Missing required fields: 'org_id', 'entity_type_code', 'display_label'")

    try:
        et_stmt = select(EntityType).where(EntityType.org_id == org_id, EntityType.code == entity_type_code)
        et_res = await db.execute(et_stmt)
        et = et_res.scalar_one_or_none()
        if not et:
            # Auto-create entity type if not yet registered
            et = EntityType(
                id=f"et_{uuid.uuid4().hex[:12]}",
                org_id=org_id,
                module_id=payload.get("module_id", "core"),
                code=entity_type_code,
                display_name=entity_type_code.replace("_", " ").title(),
                schema_definition={}
            )
            db.add(et)
            await db.commit()
            await db.refresh(et)

        entity = EntityV2(
            id=f"ent_{uuid.uuid4().hex[:16]}",
            org_id=org_id,
            entity_type_id=et.id,
            external_ref_id=payload.get("external_ref_id"),
            display_label=display_label,
            attributes=payload.get("attributes", {}),
            risk_score=payload.get("risk_score", 0.0)
        )
        db.add(entity)
        await db.commit()
        await db.refresh(entity)
        return _entity_to_dict(entity)
    except Exception as err:
        logger.error(f"Error creating entity: {err}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/entities/{entity_id}")
async def get_entity_instance(
    entity_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get single entity instance by ID."""
    res = await db.execute(select(EntityV2).where(EntityV2.id == entity_id))
    entity = res.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return _entity_to_dict(entity)


@router.put("/entities/{entity_id}")
async def update_entity_instance(
    entity_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """Update entity instance attributes or display label."""
    res = await db.execute(select(EntityV2).where(EntityV2.id == entity_id))
    entity = res.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    if "display_label" in payload:
        entity.display_label = payload["display_label"]
    if "attributes" in payload:
        merged_attrs = dict(entity.attributes or {})
        merged_attrs.update(payload["attributes"])
        entity.attributes = merged_attrs
    if "risk_score" in payload:
        entity.risk_score = float(payload["risk_score"])

    await db.commit()
    await db.refresh(entity)
    return _entity_to_dict(entity)


@router.delete("/entities/{entity_id}")
async def delete_entity_instance(
    entity_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete an entity instance by ID."""
    res = await db.execute(select(EntityV2).where(EntityV2.id == entity_id))
    entity = res.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    await db.delete(entity)
    await db.commit()
    return {"message": "Entity deleted successfully", "id": entity_id}

