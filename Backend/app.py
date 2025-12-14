from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from rag_pipeline import rag_answer

app = FastAPI(
    title="RAG Backend Service",
    description="Context-grounded RAG API with fallback handling",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# Request Schema
# -------------------------

class QueryRequest(BaseModel):
    question: str

# -------------------------
# Health Check
# -------------------------

@app.get("/")
def health_check():
    return {"status": "RAG service is running"}

# -------------------------
# RAG Endpoint
# -------------------------

@app.post("/ask")
def ask_rag(query: QueryRequest):
    answer = rag_answer(query.question)
    return {
        "question": query.question,
        "answer": answer,
    }
