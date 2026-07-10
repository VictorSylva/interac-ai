from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

# --- Observation Schemas ---
class ObservationBase(BaseModel):
    entity_id: int
    camera_id: Optional[int] = None
    event_id: Optional[int] = None
    metadata_json: Optional[Dict[str, Any]] = None

class ObservationCreate(ObservationBase):
    pass

class ObservationResponse(ObservationBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


# --- Relationship Schemas ---
class RelationshipBase(BaseModel):
    source_entity_id: int
    target_entity_id: int
    relationship_type: str  # SEEN_AT, OBSERVED_BY, ASSOCIATED_WITH, INVOLVED_IN
    confidence_score: float = 1.0
    metadata_json: Optional[Dict[str, Any]] = None

class RelationshipCreate(RelationshipBase):
    pass

class RelationshipResponse(RelationshipBase):
    id: int
    timestamp: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


# --- Risk Assessment Schemas ---
class RiskAssessmentBase(BaseModel):
    entity_id: int
    score: float
    contributing_factors: Optional[List[Dict[str, Any]]] = None

class RiskAssessmentResponse(RiskAssessmentBase):
    id: int
    last_updated: datetime

    class Config:
        from_attributes = True


# --- Entity Schemas ---
class EntityBase(BaseModel):
    entity_type: str  # person, vehicle, license_plate, camera, zone
    entity_identifier: str
    metadata_json: Optional[Dict[str, Any]] = None
    risk_score: float = 0.0
    status: str = "active"

class EntityCreate(EntityBase):
    pass

class EntityUpdate(BaseModel):
    last_seen: Optional[datetime] = None
    metadata_json: Optional[Dict[str, Any]] = None
    risk_score: Optional[float] = None
    status: Optional[str] = None

class EntityResponse(EntityBase):
    id: int
    first_seen: datetime
    last_seen: datetime
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


# --- Composite & Intelligence Schemas ---
class RelationshipDetailResponse(BaseModel):
    id: int
    relationship_type: str
    confidence_score: float
    timestamp: datetime
    metadata_json: Optional[Dict[str, Any]] = None
    
    # Details of the connected node
    target_id: int
    target_type: str
    target_identifier: str

    class Config:
        populate_by_name = True

class EntityProfileResponse(BaseModel):
    entity: EntityResponse
    observations: List[ObservationResponse]
    relationships: List[RelationshipDetailResponse]
    risk_history: List[RiskAssessmentResponse]

class SuspiciousVehicleResponse(BaseModel):
    entity_id: int
    identifier: str
    risk_score: float
    associated_plates: List[str]
    seen_locations: List[str]
    observations_count: int
    status: str

class RecentPatternResponse(BaseModel):
    pattern_type: str  # e.g., loitering_spree, multi_site_vehicle, night_intrusion
    description: str
    severity: str
    detected_at: datetime
    entities_involved: List[Dict[str, Any]]
