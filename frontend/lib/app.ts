export async function askRag(question: string) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BACKEND_URL}/ask`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      }
    );
  
    if (!res.ok) {
      throw new Error("Failed to fetch from backend");
    }
  
    return res.json();
  }
  