export const onRequestPost: PagesFunction<{ 
  OPENAI_API_KEY: string; 
  NEWS_API_KEY?: string;
  BRAVE_API_KEY?: string;
  THE_GUARDIAN_KEY?: string;
}> = async ({ request, env }) => {
  console.log("Chat function called");
  
  try {
    const { messages, prompted } = await request.json();
    console.log("Received messages:", messages.length);

    // Erstmal OHNE Function Calling testen
    const testDirectResponse = true; // Setze auf false um News zu aktivieren

    if (testDirectResponse) {
      // Einfacher Test ohne News-APIs
      console.log("Testing direct response without news APIs");
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview",
          messages: messages,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        console.error("OpenAI API error:", response.status, response.statusText);
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("OpenAI response received");

      return new Response(JSON.stringify({
        reply: data.choices[0].message.content
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // News API Integration (wenn testDirectResponse = false)
    const functions = [
      {
        name: "search_news",
        description: "Sucht nach aktuellen Nachrichten zu einem Thema",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Das Suchthema"
            }
          },
          required: ["query"]
        }
      }
    ];

    // Erster API Call mit Functions
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: messages,
        functions: functions,
        function_call: "auto",
        temperature: 0.3
      })
    });

    const data = await response.json();
    
    if (data.choices[0].message.function_call) {
      console.log("Function call detected");
      const functionCall = data.choices[0].message.function_call;
      const functionArgs = JSON.parse(functionCall.arguments);

      let newsData = "Keine News-APIs konfiguriert.";

      // Teste nur APIs die Keys haben
      if (env.NEWS_API_KEY) {
        console.log("Trying NewsAPI...");
        try {
          const newsResponse = await fetch(
            `https://newsapi.org/v2/everything?` + 
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&language=de` +
            `&sortBy=publishedAt` +
            `&pageSize=3` +
            `&apiKey=${env.NEWS_API_KEY}`
          );

          if (newsResponse.ok) {
            const newsJson = await newsResponse.json();
            if (newsJson.articles && newsJson.articles.length > 0) {
              newsData = "=== NewsAPI Ergebnisse ===\n\n";
              newsJson.articles.forEach((article, i) => {
                newsData += `${i+1}. ${article.title}\n`;
                newsData += `   Quelle: ${article.source.name}\n`;
                newsData += `   Datum: ${new Date(article.publishedAt).toLocaleString('de-DE')}\n\n`;
              });
            }
          }
        } catch (e) {
          console.error("NewsAPI error:", e);
        }
      }

      // Sende News zurück an GPT
      const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview",
          messages: [
            ...messages,
            data.choices[0].message,
            {
              role: "function",
              name: functionCall.name,
              content: newsData
            }
          ],
          temperature: 0.3
        })
      });

      const finalData = await secondResponse.json();
      return new Response(JSON.stringify({
        reply: finalData.choices[0].message.content
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Normale Antwort
    return new Response(JSON.stringify({
      reply: data.choices[0].message.content
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Chat function error:", error);
    return new Response(JSON.stringify({
      reply: `Fehler: ${error.message || 'Unbekannter Fehler'}. Bitte prüfe die Logs.`
    }), {
      status: 200, // 200 damit die Antwort angezeigt wird
      headers: { "Content-Type": "application/json" }
    });
  }
};