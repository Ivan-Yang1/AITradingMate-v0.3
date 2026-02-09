from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class User_settings(Base):
    __tablename__ = "user_settings"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    ai_model = Column(String, nullable=True)
    temperature = Column(Float, nullable=True)
    max_tokens = Column(Integer, nullable=True)
    auto_analysis = Column(Boolean, nullable=True)
    stream_output = Column(Boolean, nullable=True)
    analysis_focus = Column(String, nullable=True)
    custom_prompt = Column(String, nullable=True)
    custom_api_enabled = Column(Boolean, nullable=True)
    custom_api_base_url = Column(String, nullable=True)
    custom_api_key = Column(String, nullable=True)
    custom_api_model = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
    investment_style = Column(String, nullable=True)