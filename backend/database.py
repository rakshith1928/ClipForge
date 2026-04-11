# backend/database.py
# This file sets up the database connection and defines all our tables.
# We use SQLAlchemy which lets us write Python classes instead of raw SQL.

import os
from sqlalchemy import create_engine, Column, String, Float, Integer, Text, DateTime, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/podclip")

# Create the database engine
engine = create_engine(DATABASE_URL)

# Each database session is a unit of work
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class all our models inherit from
Base = declarative_base()


# ── Table 1: Episodes ────────────────────────────────────────────────────────
# Stores every uploaded podcast episode

class Episode(Base):
    __tablename__ = "episodes"

    id = Column(String, primary_key=True)           # UUID from upload
    title = Column(String, nullable=True)
    filename = Column(String)
    transcript = Column(Text)
    word_count = Column(Integer, default=0)
    duration = Column(Float, default=0)
    episode_summary = Column(Text, nullable=True)
    main_themes = Column(JSON, default=list)
    topics_discussed = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Table 2: Generated Content ───────────────────────────────────────────────
# Stores every quote, clip, thread, etc generated from an episode

class GeneratedContent(Base):
    __tablename__ = "generated_content"

    id = Column(String, primary_key=True)
    episode_id = Column(String)                     # links back to Episode
    content_type = Column(String)                   # quote, clip, thread, linkedin, instagram
    title = Column(String, nullable=True)
    body = Column(Text)                             # the actual content
    metadata = Column(JSON, default=dict)           # extra data like timestamps, scores
    file_path = Column(String, nullable=True)       # path to generated file if any
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Table 3: Scheduled Posts ─────────────────────────────────────────────────
# The content calendar — what goes out on which day

class ScheduledPost(Base):
    __tablename__ = "scheduled_posts"

    id = Column(String, primary_key=True)
    episode_id = Column(String)
    content_id = Column(String)                     # links to GeneratedContent
    content_type = Column(String)                   # quote, clip, thread, linkedin, instagram
    content_body = Column(Text)                     # copy of the content for easy access
    scheduled_date = Column(DateTime)               # when to post
    platform = Column(String)                       # twitter, linkedin, instagram
    status = Column(String, default="scheduled")    # scheduled, posted, skipped
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Create all tables ────────────────────────────────────────────────────────

def init_db():
    """Call this once to create all tables in the database."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Dependency that gives each request its own database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
