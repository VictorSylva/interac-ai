from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.api import deps
from app.models.investigation import Investigation
from app.services.investigation_engine import investigation_engine

router = APIRouter()

# --- Request Validation Schemas ---
class CaseCreate(BaseModel):
    title: str = Field(..., max_length=150)
    entity_identifier: str = Field(..., description="Target graph identifier being investigated")
    description: Optional[str] = None
    severity: str = Field("medium", description="low, medium, high, critical")
    assigned_to: Optional[str] = None

class NoteCreate(BaseModel):
    author: str = Field(..., max_length=50)
    text: str = Field(...)

class StatusUpdate(BaseModel):
    status: str = Field(..., description="open, in_progress, under_review, closed")

# --- Routes ---

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_case(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_in: CaseCreate
) -> Any:
    """Open a new investigation case."""
    try:
        case = await investigation_engine.create_case(
            db,
            title=case_in.title,
            entity_identifier=case_in.entity_identifier,
            description=case_in.description,
            severity=case_in.severity,
            assigned_to=case_in.assigned_to
        )
        return {"status": "created", "case_id": case.id}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create case: {str(e)}"
        )

@router.get("/", response_model=List[dict])
async def list_cases(
    *,
    db: AsyncSession = Depends(deps.get_db),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0)
) -> Any:
    """List open and closed investigation cases."""
    stmt = select(Investigation).order_by(desc(Investigation.created_at)).limit(limit).offset(offset)
    res = await db.execute(stmt)
    cases = res.scalars().all()
    
    return [
        {
            "case_id": c.id,
            "title": c.title,
            "entity_identifier": c.entity_identifier,
            "status": c.status,
            "severity": c.severity,
            "assigned_to": c.assigned_to,
            "created_at": c.created_at.isoformat()
        } for c in cases
    ]

@router.get("/{case_id}", response_model=dict)
async def get_case_dossier(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: str
) -> Any:
    """Retrieve the full compiled dossier for a case, merging context, timelines, and analyst logs."""
    dossier = await investigation_engine.get_case_details(db, case_id=case_id)
    if not dossier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation case {case_id} not found."
        )
    return dossier

@router.post("/{case_id}/note", response_model=dict)
async def add_case_note(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: str,
    note_in: NoteCreate
) -> Any:
    """Append a new note or logging update to a case file."""
    case = await investigation_engine.add_case_note(
        db, case_id=case_id, author=note_in.author, text=note_in.text
    )
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation case {case_id} not found."
        )
    return {"status": "note_added", "case_id": case_id}

@router.post("/{case_id}/status", response_model=dict)
async def update_case_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    case_id: str,
    status_in: StatusUpdate
) -> Any:
    """Modify case resolution status (e.g. resolve and close)."""
    case = await investigation_engine.update_case_status(
        db, case_id=case_id, status=status_in.status
    )
    if not case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Investigation case {case_id} not found."
        )
    return {"status": "status_updated", "case_id": case_id, "new_status": status_in.status}
