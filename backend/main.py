# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.upload import router as upload_router
from routes.analyze import router as analyze_router
from routes.generate import router as generate_router
from pathlib import Path

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

app = FastAPI(title="PodClip API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded/generated files as static files
# This means http://localhost:8000/files/filename.mp4 will work
app.mount("/files", StaticFiles(directory="uploads"), name="files")

app.include_router(upload_router)
app.include_router(analyze_router)
app.include_router(generate_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "message": "PodClip API is running"}