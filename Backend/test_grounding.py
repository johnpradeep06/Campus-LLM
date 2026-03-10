from exa_py import Exa
exa =  Exa(api_key="d7c0235f-7fb2-4edf-94b2-e711c4649507")
response = exa.answer("Can a guest visit vit again to give a guest lecture?")
print(response.answer)

''' import os
import bs4
import requests
import json
from dotenv import load_dotenv

from langchain_core.prompts import PromptTemplate
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import WebBaseLoader, PyPDFLoader, TextLoader
from langchain_community.vectorstores import Chroma
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from google import genai
from google.genai import types

# =========================================================
# LOAD ENV
# =========================================================

load_dotenv()

# =========================================================
# LANGSMITH CONFIG
# =========================================================

os.environ["LANGCHAIN_TRACING_V2"] = "true"
os.environ["LANGCHAIN_ENDPOINT"] = "https://api.smith.langchain.com"

# =========================================================
# CONFIG
# =========================================================

RELEVANCE_THRESHOLD = 0.15
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
CHROMA_PERSIST_DIR = "./chroma_db"

if not OPENROUTER_API_KEY:
    raise ValueError("OPENROUTER_API_KEY not found in .env file")

# =========================================================
# INDEXING & STORAGE
# =========================================================

embedding_func = OpenAIEmbeddings(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    model="openai/text-embedding-ada-002",
)

vectorstore = Chroma(
    persist_directory=CHROMA_PERSIST_DIR,
    embedding_function=embedding_func
)

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
)

def ingest_document(file_path: str):
    """
    Load a file (PDF or Text), split it, and add to vectorstore.
    """
    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        # Default to text loader for other formats
        loader = TextLoader(file_path)
    
    docs = loader.load()
    splits = text_splitter.split_documents(docs)
    vectorstore.add_documents(documents=splits)
    # vectorstore.persist() # Chroma 0.4+ persists automatically or uses a different mechanism, but explicit persist calls are sometimes needed depending on version. 
    # For newer versions, it's auto-persisted.

# =========================================================
# RETRIEVAL
# =========================================================

def retrieve_context(question: str) -> str | None:
    results = vectorstore.similarity_search_with_relevance_scores(
        question,
        k=4,
    )

    relevant_docs = [
        doc for doc, score in results if score >= RELEVANCE_THRESHOLD
    ]

    if not relevant_docs:
        return None

    return "\n\n".join(doc.page_content for doc in relevant_docs)

# =========================================================
# GREETING DETECTOR
# =========================================================

def is_greeting(text: str) -> bool:
    greetings = {
        "hi",
        "hello",
        "hey",
        "hai",
        "hii",
        "good morning",
        "good afternoon",
        "good evening",
        "whats up",
        "what's up",
    }

    text = text.lower().strip()
    return any(text == g or text.startswith(g) for g in greetings)

# =========================================================
# PROMPT
# =========================================================

prompt = PromptTemplate(
    input_variables=["context", "question"],
    template="""
You are a helpful university campus assistant.

You can:
- Answer questions about university policies, academics, hostel, placements, events, etc.
- Guide students using official university information.

Rules:
1. If the question is about your identity, capabilities, or what you can help with,
   answer directly without using the context.
2. For all university-related queries, answer ONLY using the provided context.
3. CRITICAL RULE: If the exact answer or specific details relevant to the university query are NOT present in the Context block below, you MUST respond exactly with the phrase: "Sorry, I don't know based on the given context." Do not provide any other information or guesses. Do not provide a partial answer.
4. Keep answers clear, simple, and student-friendly.
5. Provide steps in bullet points when applicable.
6. Do NOT add assumptions or external information.

Context:
{context}

Student Question:
{question}

Answer:
"""
)

# =========================================================
# LLM
# =========================================================

llm = ChatOpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    model="openai/gpt-oss-120b",
    max_tokens=1000
)

# =========================================================
# SECONDARY RAG / FALLBACK
# =========================================================

def is_university_relevant(question: str) -> bool:
    relevance_prompt = PromptTemplate(
        input_variables=["question"],
        template="""
Determine if the following question is related to a university, campus, college, or general student life.
Respond with exactly YES or NO.

Question: {question}
"""
    )
    chain = relevance_prompt | llm | StrOutputParser()
    try:
        result = chain.invoke({"question": question})
        return "YES" in result.strip().upper()
    except Exception:
        return False

def openrouter_search_fallback(question: str) -> str:
    try:
        api_key = os.environ.get("SEARCH_API")
        if not api_key:
            return "Sorry, SEARCH_API key is missing in environment."

        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
            },
            data=json.dumps({
                "model": "openai/gpt-4o-mini-search-preview",
                "messages": [
                    {
                        "role": "user",
                        "content": question
                    }
                ]
            })
        )
        response.raise_for_status()
        data = response.json()
        
        print(f"OpenRouter API Response:\n{json.dumps(data, indent=2)}")
        
        if "choices" in data and len(data["choices"]) > 0:
            message = data["choices"][0]["message"]
            answer_text = message.get("content", "")
            
            sources = []
            annotations = message.get("annotations", [])
            
            if annotations:
                # Build sources list in original order
                for annotation in annotations:
                    if annotation.get("type") == "url_citation":
                        citation = annotation.get("url_citation", {})
                        title = citation.get("title", "Source")
                        url = citation.get("url", "")
                        if url:
                            source_md = f"- [{title}]({url})"
                            if source_md not in sources:
                                sources.append(source_md)
                
                # Remove inline citations from text (process backwards to maintain indices)
                def get_start_index(ann):
                    return ann.get("url_citation", {}).get("start_index", -1)
                
                valid_annotations = [a for a in annotations if a.get("type") == "url_citation" and get_start_index(a) >= 0]
                sorted_annotations = sorted(valid_annotations, key=get_start_index, reverse=True)
                
                for annotation in sorted_annotations:
                    citation = annotation.get("url_citation", {})
                    start_idx = citation.get("start_index")
                    end_idx = citation.get("end_index")
                    if start_idx is not None and end_idx is not None:
                        answer_text = answer_text[:start_idx] + answer_text[end_idx:]
            
            if sources:
                answer_text = answer_text.strip()
                answer_text += "\n\n**Sources:**\n" + "\n".join(sources)
                
            return answer_text.strip()
        else:
            return "Sorry, I couldn't find an answer from the fallback search."
    except Exception as e:
        return f"Sorry, I couldn't find an answer. (Error: {str(e)})"

# =========================================================
# RAG FUNCTION
# =========================================================

def rag_answer(question: str) -> str:
    context = retrieve_context(question)

    if context is None:
        answer = "I don’t know based on the given context."
    else:
        chain = (
            {
                "context": lambda _: context,
                "question": RunnablePassthrough(),
            }
            | prompt
            | llm
            | StrOutputParser()
        )
        answer = chain.invoke(question)

    fallback_triggers = [
        "don't know based on the given context",
        "don’t know based on the given context",
        "do not know based on the given context",
        "don't know based on the context",
        "don’t know based on the context",
        "don't know" # catch shorter versions of the LLM defying prompt rules
    ]
    
    answer_lower = answer.lower()
    
    # If the response indicates lack of context knowledge, completely override it with the fallback
    if any(trigger in answer_lower for trigger in fallback_triggers):
        if is_university_relevant(question):
            extended_query = f"{question} in vit vellore"
            return openrouter_search_fallback(extended_query)

    return answer
'''