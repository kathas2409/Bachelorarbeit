export const onRequestPost: PagesFunction<{ 
  OPENAI_API_KEY: string; 
  NEWS_API_KEY?: string;
  BRAVE_API_KEY?: string;
  THE_GUARDIAN_KEY?: string;
}> = async ({ request, env }) => {
  console.log("=== Chat Function Start ===");
  
  try {
    const body = await request.json();
    const { messages, prompted } = body;
    
    // Filter Duplikate
    const uniqueMessages = [];
    const seenContent = new Set();
    
    for (const msg of messages) {
      const key = `${msg.role}:${msg.content}`;
      if (!seenContent.has(key)) {
        seenContent.add(key);
        uniqueMessages.push(msg);
      }
    }

    // Function Definition - GPT entscheidet selbst wann News nötig sind
    const functions = [
      {
        name: "search_news",
        description: "Sucht nach aktuellen Nachrichten. Nutze dies für: Verifikation von Behauptungen, aktuelle Ereignisse, Personen des öffentlichen Lebens, oder wenn der Nutzer explizit nach News/Nachrichten fragt.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Der optimierte Suchbegriff (kurz und prägnant)"
            },
            language: {
              type: "string",
              description: "Sprache (de, en, etc.)",
              default: "de"
            }
          },
          required: ["query"]
        }
      }
    ];

    // System Prompt
    const systemMessages = [];
    if (prompted) {
      systemMessages.push({
        role: "system",
        content: `Du bist ein Experte für Nachrichtenverifikation. 
Nutze die search_news Funktion wenn:
- Verifikation/Faktencheck gewünscht ist
- Nach aktuellen Ereignissen gefragt wird
- Informationen sich schnell ändern könnten
- Der Nutzer explizit nach News fragt

Antworte direkt ohne News-Suche wenn:
- Allgemeinwissen ausreicht
- Theoretische/technische Erklärungen gefragt sind
- Persönliche Meinungen oder Ratschläge gewünscht sind`
      });
    }
    
    // Erster OpenAI Call - schneller mit stream:false
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [...systemMessages, ...uniqueMessages],
        functions: functions,
        function_call: "auto",
        temperature: 0.3,
        max_tokens: 150 // Begrenzt für function calls
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    
    // Wenn keine News-Suche nötig - direkte Antwort
    if (!data.choices[0].message.function_call) {
      console.log("Direct response - no news needed");
      
      // Zweiter Call für vollständige Antwort
      const fullResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview",
          messages: [...systemMessages, ...uniqueMessages],
          temperature: 0.7,
          max_tokens: 1500
        })
      });
      
      const fullData = await fullResponse.json();
      return new Response(JSON.stringify({
        reply: fullData.choices[0].message.content
      }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // News-Suche wird benötigt
    console.log("News search requested");
    const functionCall = data.choices[0].message.function_call;
    const functionArgs = JSON.parse(functionCall.arguments);

    // PARALLEL alle News-APIs abfragen für maximale Geschwindigkeit
    const newsPromises = [];
    
    // Promise.allSettled statt Promise.all - fehlerresistent
    if (env.BRAVE_API_KEY) {
      newsPromises.push(
        fetch(
          `https://api.search.brave.com/res/v1/news/search?` +
          `q=${encodeURIComponent(functionArgs.query)}` +
          `&count=8` + // Reduziert von 10
          `&freshness=pd`,
          {
            headers: {
              "X-Subscription-Token": env.BRAVE_API_KEY,
              "Accept": "application/json"
            }
          }
        ).then(r => r.json())
        .then(data => ({ source: 'brave', data }))
        .catch(e => ({ source: 'brave', error: e }))
      );
    }

    if (env.NEWS_API_KEY) {
      newsPromises.push(
        fetch(
          `https://newsapi.org/v2/everything?` + 
          `q=${encodeURIComponent(functionArgs.query)}` +
          `&language=${functionArgs.language || 'de'}` +
          `&sortBy=publishedAt` +
          `&pageSize=4` + // Reduziert von 5
          `&apiKey=${env.NEWS_API_KEY}`
        ).then(r => r.json())
        .then(data => ({ source: 'newsapi', data }))
        .catch(e => ({ source: 'newsapi', error: e }))
      );
    }

    if (env.THE_GUARDIAN_KEY) {
      newsPromises.push(
        fetch(
          `https://content.guardianapis.com/search?` +
          `q=${encodeURIComponent(functionArgs.query)}` +
          `&page-size=3` + // Reduziert von 5
          `&order-by=newest` +
          `&api-key=${env.THE_GUARDIAN_KEY}`
        ).then(r => r.json())
        .then(data => ({ source: 'guardian', data }))
        .catch(e => ({ source: 'guardian', error: e }))
      );
    }

    // Warte auf ALLE Ergebnisse parallel
    const startTime = Date.now();
    const results = await Promise.allSettled(newsPromises);
    console.log(`News fetched in ${Date.now() - startTime}ms`);

    // Kompakter formatieren für schnellere Verarbeitung
    let newsContext = "=== AKTUELLE NACHRICHTEN ===\n\n";
    let articleCount = 0;

    // Verarbeite Ergebnisse
    results.forEach(result => {
      if (result.status === 'fulfilled' && !result.value.error) {
        const { source, data } = result.value;
        
        if (source === 'brave' && data.results) {
          newsContext += "BRAVE SEARCH:\n";
          data.results.slice(0, 5).forEach(article => {
            articleCount++;
            newsContext += `• "${article.title}" - ${article.source || 'Quelle'} (${article.age || 'neu'})\n`;
          });
          newsContext += "\n";
        }
        
        if (source === 'newsapi' && data.articles) {
          newsContext += "NEWSAPI:\n";
          data.articles.slice(0, 3).forEach(article => {
            articleCount++;
            const date = new Date(article.publishedAt).toLocaleDateString('de-DE');
            newsContext += `• "${article.title}" - ${article.source.name} (${date})\n`;
          });
          newsContext += "\n";
        }
        
        if (source === 'guardian' && data.response?.results) {
          newsContext += "GUARDIAN:\n";
          data.response.results.slice(0, 3).forEach(article => {
            articleCount++;
            const date = new Date(article.webPublicationDate).toLocaleDateString('de-DE');
            newsContext += `• "${article.webTitle}" - ${article.sectionName} (${date})\n`;
          });
          newsContext += "\n";
        }
      }
    });

    newsContext += `\nGesamt: ${articleCount} Artikel gefunden`;

    // Finaler OpenAI Call mit allen News
    const finalResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `Nutze diese aktuellen Nachrichten für deine Analyse:\n\n${newsContext}\n\nBeantworte präzise und gib Quellen an.`
          },
          ...uniqueMessages,
          data.choices[0].message,
          {
            role: "function",
            name: functionCall.name,
            content: newsContext
          }
        ],
        temperature: 0.3,
        max_tokens: 1500
      })
    });

    const finalData = await finalResponse.json();
    console.log("=== Chat Function End ===");
    
    return new Response(JSON.stringify({
      reply: finalData.choices[0].message.content
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    console.error("=== ERROR in chat function ===");
    console.error(error);
    
    return new Response(JSON.stringify({
      reply: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};