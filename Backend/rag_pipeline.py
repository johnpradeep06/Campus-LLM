import os
import bs4
import requests
import json
from dotenv import load_dotenv
from exa_py import Exa


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
exa = Exa(api_key=os.environ.get("EXA_API_KEY"))
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

def exa_search_fallback(question: str) -> str:
    import re
    try:
        response = exa.answer(question)
        answer_text = response.answer
        
        # Extract markdown links from Exa's response
        links = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', answer_text)
        
        sources = []
        seen_urls = set()
        for title, url in links:
            if url not in seen_urls:
                sources.append(f"- [{title}]({url})")
                seen_urls.add(url)
                
        # Remove the citation blocks e.g., ([Title](url), [Title](url))
        answer_text = re.sub(r'\s*\((?:\[[^\]]+\]\((?:https?://[^\)]+)\)(?:,\s*)?)+\)', '', answer_text)
        # Also remove any remaining bare inline links like [Title](url) -> Title
        answer_text = re.sub(r'\[([^\]]+)\]\((https?://[^\)]+)\)', r'\1', answer_text)
        
        if sources:
            sources_text = "\n\n**Sources:**\n" + "\n".join(sources)
            answer_text += sources_text
            
        return answer_text
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
            return exa_search_fallback(extended_query)

    return answer
