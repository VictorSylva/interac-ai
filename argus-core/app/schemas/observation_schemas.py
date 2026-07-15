from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

class ObservationCreate(BaseModel):
    id: Optional[str] = Field(None, description="Optional custom unique identifier")
    timestamp: Optional[datetime] = Field(None, description="Datetime of observation, defaults to now")
    source_system: str = Field(..., description="System originating the observation, e.g. 'whatsapp'")
    entity_type: str = Field(..., description="Type of core entity, e.g. 'person', 'lead', 'invoice'")
    entity_id: str = Field(..., description="Unique ID of the entity inside the source system")
    location: Optional[str] = Field(None, description="Spatial location string")
    confidence: Optional[float] = Field(1.0, description="Inference or detection confidence from 0.0 to 1.0")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Key-value dictionary of telemetry payload")
    evidence: Optional[Dict[str, Any]] = Field(default_factory=dict, description="URLs to media, files, text transcripts")
    relationships: Optional[List[Dict[str, Any]]] = Field(default_factory=list, description="Associated entity relationships")
    context: Optional[str] = Field(None, description="Plaintext contextual description")
    severity: Optional[str] = Field("info", description="Threat or operational severity: info, low, medium, high, critical")

class ObservationResponse(BaseModel):
    id: str
    timestamp: datetime
    source_system: str
    entity_type: str
    entity_id: str
    location: Optional[str]
    confidence: float
    metadata_json: Optional[Dict[str, Any]] = Field(None, serialization_alias="metadata")
    evidence: Optional[Dict[str, Any]]
    relationships: Optional[List[Dict[str, Any]]]
    context: Optional[str]
    severity: str

    model_config = {
        "populate_by_name": True,
        "from_attributes": True
    }
