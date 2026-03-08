import os
import bs4
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

def gemini_search_fallback(question: str) -> str:
    try:
        client = genai.Client(
            api_key=os.environ.get("GEMINI_API_KEY"),
        )

        model = "gemini-3.1-flash-lite-preview"
        contents = [
            types.Content(
                role="user",
                parts=[
                    types.Part.from_text(text=question),
                ],
            ),
        ]
        tools = [
            types.Tool(googleSearch=types.GoogleSearch()),
        ]
        generate_content_config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(
                thinking_level="HIGH",
            ),
            tools=tools,
        )

        # Using generate_content instead of generate_content_stream to return a full string synchronously
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )
        
        answer_text = response.text
        
        # Extract grounding sources
        sources = []
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                meta = candidate.grounding_metadata
                if hasattr(meta, 'grounding_chunks') and meta.grounding_chunks:
                    for chunk in meta.grounding_chunks:
                        if hasattr(chunk, 'web') and chunk.web:
                            title = getattr(chunk.web, 'title', 'Source')
                            uri = getattr(chunk.web, 'uri', '')
                            if uri:
                                # Deduplicate sources (sometimes the same URI appears multiple times)
                                source_md = f"- [{title}]({uri})"
                                if source_md not in sources:
                                    sources.append(source_md)
        
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
            return gemini_search_fallback(extended_query)

    return answer
