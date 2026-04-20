from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class UrgentTaskResponse(BaseModel):
    id: UUID
    title: str
    client_name: str
    deadline: Optional[datetime] = None
    priority: str
    status: str
    
    model_config = ConfigDict(from_attributes=True)

class ActivityResponse(BaseModel):
    id: UUID
    type: str
    created_at: datetime
    is_read: bool
    post_id: Optional[UUID] = None
    comment_id: Optional[UUID] = None
    triggered_by_name: str
    message_snippet: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class DashboardSummary(BaseModel):
    user_name: str
    urgent_tasks: List[UrgentTaskResponse]
    activities: List[ActivityResponse]
    stats: dict = {}
