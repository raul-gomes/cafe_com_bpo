"""
Pricing Module - Models

Database models for storing pricing scenarios.
The calculation engine is in domain/engine.py (domain-driven design).
"""

from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4

from src.core.database import Base


class PricingScenario(Base):
    """Stored pricing scenarios for users."""

    __tablename__ = "pricing_scenarios"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(PGUUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)

    # Pricing parameters (stored as JSON or individual fields)
    total_cost = Column(Float, nullable=False)
    people_count = Column(Integer, nullable=False)
    hours_per_month = Column(Float, nullable=False)
    tax_rate = Column(Float, nullable=False)
    desired_profit_margin = Column(Float, nullable=False)

    # Results
    final_price = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship
    user = relationship("User", back_populates="pricing_scenarios")
