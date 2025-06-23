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
    
    // Filter Duplikate falls nötig
    const uniqueMessages = [];
    const seenContent = new Set();
    
    for (const msg of messages) {
      const key = `${msg.role}:${msg.content}`;
      if (!seenContent.has(key)) {
        seenContent.add(key);
        uniqueMessages.push(msg);
      }
    }

    // Function Definition für News-Suche
    const functions = [
      {
        name: "search_news",
        description: "Sucht nach aktuellen Nachrichten aus mehreren vertrauenswürdigen Quellen zu einem Thema",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Das Suchthema oder die zu verifizierende Behauptung"
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

    // System Prompt für Verifikation wenn prompted = true
    const systemMessages = [];
    if (prompted) {
      systemMessages.push({
        role: "system",
        content: `Du bist ein Experte für Nachrichtenverifikation und Faktenchecking. 
        
Deine Aufgaben:
1. Suche IMMER nach aktuellen Nachrichten wenn nach Verifikation, aktuellen Ereignissen oder Personen gefragt wird
2. Analysiere und vergleiche mehrere Quellen
3. Identifiziere Übereinstimmungen und Widersprüche zwischen Quellen
4. Bewerte die Glaubwürdigkeit basierend auf Quellenvielfalt und Reputation
5. Gib das Publikationsdatum jeder relevanten Information an
6. Markiere unsichere oder widersprüchliche Informationen

Strukturiere deine Antworten mit:
- Zusammenfassung der Faktenlage
- Quellenanalyse (welche Quellen berichten was)
- Übereinstimmungen/Widersprüche
- Verifikationsstatus: ✅ Bestätigt / ⚠️ Teilweise bestätigt / ❌ Widerlegt / ❓ Unklar`
      });
    }
    
    // OpenAI Call mit Functions
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
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    
    // Prüfe ob News gesucht werden sollen
    if (data.choices[0].message.function_call) {
      console.log("News search requested");
      const functionCall = data.choices[0].message.function_call;
      const functionArgs = JSON.parse(functionCall.arguments);

      let combinedNewsData = "";
      const newsPromises = [];

      // 1. Brave Search (UNLIMITED - Hauptquelle)
      if (env.BRAVE_API_KEY) {
        console.log("Searching Brave News...");
        newsPromises.push(
          fetch(
            `https://api.search.brave.com/res/v1/news/search?` +
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&count=10` + // Mehr Ergebnisse da unlimited
            `&freshness=pw` + // Past week für aktuelle News
            `&lang=${functionArgs.language || 'de'}`,
            {
              headers: {
                "X-Subscription-Token": env.BRAVE_API_KEY,
                "Accept": "application/json"
              }
            }
          ).then(r => r.json()).catch(e => {
            console.error("Brave error:", e);
            return null;
          })
        );
      }

      // 2. NewsAPI
      if (env.NEWS_API_KEY) {
        console.log("Searching NewsAPI...");
        newsPromises.push(
          fetch(
            `https://newsapi.org/v2/everything?` + 
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&language=${functionArgs.language || 'de'}` +
            `&sortBy=publishedAt` +
            `&pageSize=5` +
            `&apiKey=${env.NEWS_API_KEY}`
          ).then(r => r.json()).catch(e => {
            console.error("NewsAPI error:", e);
            return null;
          })
        );
      }

      // 3. The Guardian
      if (env.THE_GUARDIAN_KEY) {
        console.log("Searching Guardian...");
        newsPromises.push(
          fetch(
            `https://content.guardianapis.com/search?` +
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&show-fields=all` +
            `&page-size=5` +
            `&order-by=newest` +
            `&api-key=${env.THE_GUARDIAN_KEY}`
          ).then(r => r.json()).catch(e => {
            console.error("Guardian error:", e);
            return null;
          })
        );
      }

      // Warte auf alle Ergebnisse
      const results = await Promise.all(newsPromises);
      
      // Verarbeite Brave News
      if (results[0]?.results) {
        combinedNewsData += "=== 🦁 BRAVE SEARCH (Hauptquelle) ===\n";
        combinedNewsData += `Gefunden: ${results[0].results.length} Artikel\n\n`;
        
        results[0].results.forEach((article, i) => {
          combinedNewsData += `📰 ${i + 1}. ${article.title}\n`;
          combinedNewsData += `   Quelle: ${article.source || 'Unbekannt'}\n`;
          combinedNewsData += `   Zeit: ${article.age || 'Kürzlich'}\n`;
          if (article.description) {
            combinedNewsData += `   Info: ${article.description}\n`;
          }
          combinedNewsData += `   URL: ${article.url}\n\n`;
        });
      }

      // Verarbeite NewsAPI
      if (results[1]?.articles) {
        combinedNewsData += "\n=== 📡 NEWSAPI.ORG ===\n";
        combinedNewsData += `Gefunden: ${results[1].articles.length} Artikel\n\n`;
        
        results[1].articles.forEach((article, i) => {
          combinedNewsData += `📰 ${i + 1}. ${article.title}\n`;
          combinedNewsData += `   Quelle: ${article.source.name}\n`;
          combinedNewsData += `   Datum: ${new Date(article.publishedAt).toLocaleString('de-DE')}\n`;
          if (article.description) {
            combinedNewsData += `   Info: ${article.description}\n`;
          }
          combinedNewsData += `   URL: ${article.url}\n\n`;
        });
      }

      // Verarbeite Guardian
      if (results[2]?.response?.results) {
        combinedNewsData += "\n=== 📰 THE GUARDIAN ===\n";
        combinedNewsData += `Gefunden: ${results[2].response.results.length} Artikel\n\n`;
        
        results[2].response.results.forEach((article, i) => {
          combinedNewsData += `📰 ${i + 1}. ${article.webTitle}\n`;
          combinedNewsData += `   Sektion: ${article.sectionName}\n`;
          combinedNewsData += `   Datum: ${new Date(article.webPublicationDate).toLocaleString('de-DE')}\n`;
          combinedNewsData += `   URL: ${article.webUrl}\n\n`;
        });
      }

      if (!combinedNewsData) {
        combinedNewsData = "Keine Nachrichten zu diesem Thema gefunden. Möglicherweise sind die API Keys nicht korrekt konfiguriert.";
      } else {
        // Füge Zusammenfassung hinzu
        const totalArticles = 
          (results[0]?.results?.length || 0) +
          (results[1]?.articles?.length || 0) +
          (results[2]?.response?.results?.length || 0);
        
        combinedNewsData += `\n=== ZUSAMMENFASSUNG ===\n`;
        combinedNewsData += `Suchbegriff: "${functionArgs.query}"\n`;
        combinedNewsData += `Artikel gefunden: ${totalArticles}\n`;
        combinedNewsData += `Zeitpunkt: ${new Date().toLocaleString('de-DE')}\n`;
      }

      // Sende News zurück an GPT zur Analyse
      const secondResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4-turbo-preview",
          messages: [
            ...systemMessages,
            ...uniqueMessages,
            data.choices[0].message,
            {
              role: "function",
              name: functionCall.name,
              content: combinedNewsData
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      const finalData = await secondResponse.json();
      console.log("=== Chat Function End (with news) ===");
      
      return new Response(JSON.stringify({
        reply: finalData.choices[0].message.content
      }), {
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      });
    }

    // Normale Antwort ohne News
    console.log("=== Chat Function End (no news) ===");
    
    return new Response(JSON.stringify({
      reply: data.choices[0].message.content
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
      reply: `Es ist ein Fehler aufgetreten. Bitte versuche es erneut.`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};