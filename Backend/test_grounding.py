from tavily import TavilyClient
import json

client = TavilyClient("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")

response = client.search(
    query="will i get a 4 bed ac in T block with 692 rank in vit vellore ",
    include_answer="advanced",
    search_depth="advanced"
)

print(json.dumps(response, indent=2))