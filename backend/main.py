# backend/main.py
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from database import init_db
from routes.analyze import router as analyze_router
from routes.calendar import router as calendar_router
from routes.generate import router as generate_router
from routes.upload import router as upload_router

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="ClipForge API", version="0.1.0")

# Create database tables on startup
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Required by authlib for Google OAuth state handling
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SECRET_KEY", "changeme_session_secret"))

# Serve uploaded/generated files as static files
# This means http://localhost:8000/files/filename.mp4 will work
app.mount("/files", StaticFiles(directory="uploads"), name="files")

app.include_router(upload_router)
app.include_router(analyze_router)
app.include_router(generate_router)
app.include_router(calendar_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "ClipForge API is running"}