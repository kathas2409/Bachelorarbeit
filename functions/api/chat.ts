export const onRequestPost: PagesFunction<{ OPENAI_API_KEY: string }> = async ({ request, env }) => {
  console.log("=== Chat Function Start ===");
  
  try {
    const body = await request.json();
    console.log("Request body:", JSON.stringify(body));
    
    const { messages, prompted } = body;
    
    // Filter out duplicate messages
    const uniqueMessages = [];
    const seenContent = new Set();
    
    for (const msg of messages) {
      const key = `${msg.role}:${msg.content}`;
      if (!seenContent.has(key)) {
        seenContent.add(key);
        uniqueMessages.push(msg);
      }
    }
    
    console.log("Unique messages:", uniqueMessages.length);
    
    // Simple OpenAI call without any functions
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: uniqueMessages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    console.log("OpenAI Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Error:", errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    console.log("OpenAI Response received");

    const reply = data.choices[0]?.message?.content || "Keine Antwort erhalten";
    
    console.log("=== Chat Function End ===");
    
    return new Response(JSON.stringify({ reply }), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error("=== ERROR in chat function ===");
    console.error(error);
    
    return new Response(JSON.stringify({
      reply: `Fehler: ${error.message}. Bitte überprüfe die Cloudflare Logs.`
    }), {
      status: 200, // 200 damit es im Chat angezeigt wird
      headers: { "Content-Type": "application/json" }
    });
  }
};