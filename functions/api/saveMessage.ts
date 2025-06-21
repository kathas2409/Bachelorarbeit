export const onRequestPost: PagesFunction<{ DB: D1Database }> = async (context) => {
  try {
    const { message, role = "user", prompted = false } = await context.request.json();
    
    // Session ID aus Cookie oder generiere neue
    const sessionId = context.request.headers.get("cookie")?.match(/session_id=([^;]+)/)?.[1] || crypto.randomUUID();
    
    // IP Hash für Anonymität
    const ip = context.request.headers.get("CF-Connecting-IP") || "unknown";
    const encoder = new TextEncoder();
    const data = encoder.encode(ip);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const ipHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    // In Datenbank speichern
    await context.env.DB.prepare(
      "INSERT INTO messages (session_id, ip_hash, message, role, prompted) VALUES (?, ?, ?, ?, ?)"
    ).bind(sessionId, ipHash, message, role, prompted).run();
    
    console.log("Nachricht gespeichert:", { sessionId, role, prompted });
    
    // Session Cookie setzen
    return new Response(JSON.stringify({ status: "OK", sessionId }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Set-Cookie": `session_id=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=31536000`
      },
    });
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    return new Response(JSON.stringify({ error: "Speichern fehlgeschlagen" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};