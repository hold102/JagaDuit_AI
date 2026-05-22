import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routes.analyze import router as analyze_router
from routes.telegram import router as telegram_router
from routes.voice import router as voice_router

app = FastAPI(title="JagaDuit AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze_router, prefix="/api")
app.include_router(telegram_router, prefix="/api")
app.include_router(voice_router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
