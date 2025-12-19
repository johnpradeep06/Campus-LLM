export async function askRag(question: string) {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/ask`,
    {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ question }),
    }
  );

  if (res.status === 401) {
    // Token expired or invalid
    window.location.href = '/login';
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    throw new Error("Failed to fetch from backend");
  }

  return res.json();
}

