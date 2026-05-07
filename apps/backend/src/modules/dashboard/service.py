"""
Dashboard Module - Service Layer

Aggregates data from multiple modules for dashboard display.
"""

from typing import Dict, Any
from uuid import UUID

from src.modules.clients.repository import ClientRepository
from src.modules.proposals.repository import ProposalRepository
from src.modules.tasks.repository import TaskRepository


class DashboardService:
    """Service layer for dashboard data aggregation."""
    
    def __init__(
        self, 
        client_repo: ClientRepository,
        proposal_repo: ProposalRepository,
        task_repo: TaskRepository
    ):
        self.client_repo = client_repo
        self.proposal_repo = proposal_repo
        self.task_repo = task_repo
    
    def get_dashboard_stats(self, user_id: UUID) -> Dict[str, Any]:
        """Get summary statistics for the dashboard."""
        clients = self.client_repo.get_by_user(user_id)
        proposals = self.proposal_repo.get_by_user(user_id)
        tasks = self.task_repo.get_by_user(user_id)
        
        # Count tasks by status
        pending_tasks = len([t for t in tasks if t.status == "pending"])
        completed_tasks = len([t for t in tasks if t.status == "completed"])
        
        return {
            "total_clients": len(clients),
            "total_proposals": len(proposals),
            "pending_tasks": pending_tasks,
            "completed_tasks": completed_tasks,
            "recent_proposals": proposals[:5] if proposals else [],
            "recent_tasks": tasks[:5] if tasks else []
        }
    
    def get_recent_activity(self, user_id: UUID, limit: int = 10) -> list:
        """Get recent activity feed."""
        # This would aggregate recent actions across modules
        # For now, return empty list as placeholder
        return []
