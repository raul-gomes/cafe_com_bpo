from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from uuid import uuid4

from src.core.database import Base


class RoiSimulation(Base):
    __tablename__ = "roi_simulations"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    current_monthly_cost = Column(Float, nullable=False)
    bpo_monthly_cost = Column(Float, nullable=False)
    employees_count = Column(Integer, nullable=False, default=1)
    hourly_rate = Column(Float, nullable=False)
    error_rate_pct = Column(Float, nullable=False, default=0)
    productivity_gain_pct = Column(Float, nullable=False, default=0)
    timeframe_months = Column(Integer, nullable=False, default=12)

    roi_percentage = Column(Float, nullable=False)
    net_savings = Column(Float, nullable=False)
    payback_months = Column(Float, nullable=False)
    annual_savings = Column(Float, nullable=False)

    llm_explanation = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="roi_simulations")
