export const onRequestPost: PagesFunction<{ OPENAI_API_KEY: string }> = async (context) => {
  try {
    const { messages, prompted } = await context.request.json();
    
    // OpenAI API direkt aufrufen ohne SDK
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

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || "Keine Antwort erhalten.";

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Fehler in chat.ts:", error);
    return new Response(JSON.stringify({ 
      reply: "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut." 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};