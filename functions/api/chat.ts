export const onRequestPost: PagesFunction<{ OPENAI_API_KEY: string }> = async (context) => {
  try {
    // Überprüfe ob API Key existiert
    if (!context.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY fehlt in den Environment Variables");
      return new Response(JSON.stringify({ 
        reply: "Konfigurationsfehler: API Key fehlt." 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const { messages, prompted } = await context.request.json();
    
    console.log("Anfrage erhalten mit", messages.length, "Nachrichten");
    
    // OpenAI API direkt aufrufen
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${context.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4", 
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error("OpenAI API Fehler:", responseData);
      return new Response(JSON.stringify({ 
        reply: `API Fehler: ${responseData.error?.message || 'Unbekannter Fehler'}` 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const reply = responseData.choices[0]?.message?.content || "Keine Antwort erhalten.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Fehler in chat.ts:", error);
    return new Response(JSON.stringify({ 
      reply: `Serverfehler: ${error.message}` 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};