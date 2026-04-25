# backend/database.py

import os
from sqlalchemy import create_engine, Column, String, Float, Integer, Text, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/podclip")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)   # nullable for OAuth later
    provider = Column(String, default="local")        # local or google
    profile_pic = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    episodes = relationship("Episode", back_populates="user")


# ── Episode ───────────────────────────────────────────────────────────────────

class Episode(Base):
    __tablename__ = "episodes"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=True)
    filename = Column(String)
    transcript = Column(Text)
    words = Column(JSON, default=list)
    word_count = Column(Integer, default=0)
    duration = Column(Float, default=0)
    episode_summary = Column(Text, nullable=True)
    main_themes = Column(JSON, default=list)
    topics_discussed = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="episodes")


# ── Generated Content ─────────────────────────────────────────────────────────

class GeneratedContent(Base):
    __tablename__ = "generated_content"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    episode_id = Column(String)
    content_type = Column(String)
    title = Column(String, nullable=True)
    body = Column(Text)
    metadata = Column(JSON, default=dict)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Scheduled Post ────────────────────────────────────────────────────────────

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id = Column(String, primary_key=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    episode_id = Column(String)
    content_id = Column(String)
    content_type = Column(String)
    content_body = Column(Text)
    scheduled_date = Column(DateTime)
    platform = Column(String)
    status = Column(String, default="scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)


# ── DB Helpers ────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()