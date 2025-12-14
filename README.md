# RAG System Setup Guide

Complete setup guide for the RAG system with Frontend (Next.js) and Backend (FastAPI).

## Architecture

```
Frontend (Next.js) → Backend (FastAPI) → RAG Pipeline → Vector DB
```

## Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

## Backend Setup

1. Navigate to the Backend directory:
```bash
cd Backend
```

2. Create a virtual environment (if not already created):
```bash
python -m venv venv
# On Windows
venv\Scripts\activate
# On Linux/Mac
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the Backend directory:
```env
OPENROUTER_API_KEY=your_api_key_here
LANGCHAIN_API_KEY=your_langchain_key_here  # Optional
```

5. Run the backend server:
```bash
uvicorn app:app --reload --port 8000
```

The backend will be available at `http://localhost:8000`

## Frontend Setup

1. Navigate to the Frontend directory:
```bash
cd Frontend
```

2. Install dependencies:
```bash
npm install
# or
yarn install
```

3. Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. Run the development server:
```bash
npm run dev
# or
yarn dev
```

The frontend will be available at `http://localhost:3000`

## Usage

1. Start the backend server first (port 8000)
2. Start the frontend server (port 3000)
3. Open `http://localhost:3000` in your browser
4. Upload a PDF file (currently the backend needs to be updated to handle file uploads)
5. Ask questions about the uploaded document

## API Endpoints

### Backend (FastAPI)

- `GET /` - Health check
- `POST /ask` - Ask a question
  ```json
  {
    "question": "Your question here"
  }
  ```

## Notes

- The backend currently uses a web loader for documents. You'll need to update `rag_pipeline.py` to handle PDF uploads.
- CORS is configured to allow requests from `http://localhost:3000`
- Make sure both servers are running before using the application
