# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.upload import router as upload_router
from routes.analyze import router as analyze_router

app = FastAPI(title="PodClip API", version="0.1.0")

# Allow your Next.js frontend (localhost:3000) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(upload_router)   # ← add this
app.include_router(analyze_router) 

@app.get("/health")
def health_check():
    """Quick check that the server is running"""
    return {"status": "ok", "message": "PodClip API is running"}