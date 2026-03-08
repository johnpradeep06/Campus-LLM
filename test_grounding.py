import os
from google import genai
from google.genai import types

def run_test():
    client = genai.Client()
    
    model = "gemini-3-flash-preview"
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text="What is the weather in VIT Vellore today?"),
            ],
        ),
    ]
    tools = [
        types.Tool(googleSearch=types.GoogleSearch()),
    ]
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="HIGH"),
        tools=tools,
    )

    response = client.models.generate_content(
        model=model,
        contents=contents,
        config=config,
    )
    
    print("Response text:", response.text)
    print("\nCandidates type:", type(response.candidates))
    
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
            meta = candidate.grounding_metadata
            print("\nGrounding metadata type:", type(meta))
            if hasattr(meta, 'grounding_chunks') and meta.grounding_chunks:
                for chunk in meta.grounding_chunks:
                    print("Chunk:", chunk)
                    if hasattr(chunk, 'web') and chunk.web:
                        print(f"  Web Title: {chunk.web.title}")
                        print(f"  Web URI: {chunk.web.uri}")

if __name__ == "__main__":
    run_test()
