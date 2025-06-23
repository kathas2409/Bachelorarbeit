export const onRequestPost: PagesFunction<{ OPENAI_API_KEY: string; NEWS_API_KEY: string }> = async ({ request, env }) => {
  const { messages, prompted } = await request.json();

  // Function Definitions für News-Abruf
  const functions = [
    {
      name: "search_news",
      description: "Sucht nach aktuellen Nachrichten zu einem bestimmten Thema",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Das Suchthema (z.B. 'Marine Le Pen', 'Ukraine', 'Klimawandel')"
          },
          language: {
            type: "string",
            description: "Sprache der Nachrichten (de, en, fr, etc.)",
            default: "de"
          }
        },
        required: ["query"]
      }
    }
  ];

  try {
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
        temperature: 0.3 // Niedrigere Temperature für faktentreue Antworten
      })
    });

    const data = await response.json();
    
    // Prüfe ob News gesucht werden sollen
    if (data.choices[0].message.function_call) {
      const functionCall = data.choices[0].message.function_call;
      const functionArgs = JSON.parse(functionCall.arguments);

      let newsData = "";

      if (functionCall.name === "search_news") {
        // News API Anfrage
        const newsResponse = await fetch(
          `https://newsapi.org/v2/everything?` + 
          `q=${encodeURIComponent(functionArgs.query)}` +
          `&language=${functionArgs.language || 'de'}` +
          `&sortBy=publishedAt` +
          `&pageSize=10` +
          `&apiKey=${env.NEWS_API_KEY}`
        );

        const newsJson = await newsResponse.json();
        
        // Formatiere die News für GPT
        if (newsJson.articles && newsJson.articles.length > 0) {
          newsData = newsJson.articles.map((article, index) => `
            Artikel ${index + 1}:
            Titel: ${article.title}
            Quelle: ${article.source.name}
            Datum: ${new Date(article.publishedAt).toLocaleString('de-DE')}
            Beschreibung: ${article.description}
            URL: ${article.url}
            ${article.content ? `Inhalt: ${article.content}` : ''}
          `).join('\n---\n');
        } else {
          newsData = "Keine aktuellen Nachrichten zu diesem Thema gefunden.";
        }
      }

      // Sende die News-Daten zurück an GPT zur Verarbeitung
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

    // Normale Antwort ohne News-Suche
    return new Response(JSON.stringify({
      reply: data.choices[0].message.content
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("Error in chat function:", error);
    return new Response(JSON.stringify({
      reply: "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};