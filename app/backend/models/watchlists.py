from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Watchlists(Base):
    __tablename__ = "watchlists"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    ts_code = Column(String, nullable=False)
    stock_name = Column(String, nullable=False)
    added_at = Column(DateTime(timezone=True), nullable=True)