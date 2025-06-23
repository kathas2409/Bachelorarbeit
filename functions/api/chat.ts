export const onRequestPost: PagesFunction<{ 
  OPENAI_API_KEY: string; 
  NEWS_API_KEY?: string;
  BRAVE_API_KEY?: string;
  THE_GUARDIAN_KEY?: string;
}> = async ({ request, env }) => {
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

    // Function Definition für umfassende News-Suche
    const functions = [
      {
        name: "search_news_comprehensive",
        description: "Sucht umfassend nach aktuellen Nachrichten aus mehreren vertrauenswürdigen Quellen zu einem Thema",
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

    // System Prompt für Verifikation
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
    } else {
      systemMessages.push({
        role: "system",
        content: "Du bist ein hilfreicher Assistent. Antworte auf Deutsch und nutze die News-Suche wenn nach aktuellen Ereignissen oder Personen gefragt wird."
      });
    }
    
    // Erster API Call mit Functions
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

    console.log("OpenAI Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI Error:", errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data = await response.json();
    
    // Prüfe ob News gesucht werden sollen
    if (data.choices[0].message.function_call) {
      console.log("Function call detected - searching news");
      const functionCall = data.choices[0].message.function_call;
      const functionArgs = JSON.parse(functionCall.arguments);

      let combinedNewsData = "";

      if (functionCall.name === "search_news_comprehensive") {
        // Parallele Abfragen an alle News-APIs
        const newsPromises = [];

        // 1. Brave Search (UNLIMITED!)
        if (env.BRAVE_API_KEY) {
          console.log("Searching Brave News...");
          newsPromises.push(
            fetch(
              `https://api.search.brave.com/res/v1/news/search?` +
              `q=${encodeURIComponent(functionArgs.query)}` +
              `&count=10` +
              `&freshness=pd` +
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

        // 2. NewsAPI.org
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

        // Zusätzlich: Brave Web Search für mehr Kontext
        if (env.BRAVE_API_KEY) {
          newsPromises.push(
            fetch(
              `https://api.search.brave.com/res/v1/web/search?` +
              `q=${encodeURIComponent(functionArgs.query + " news " + new Date().getFullYear())}` +
              `&count=5` +
              `&lang=${functionArgs.language || 'de'}`,
              {
                headers: {
                  "X-Subscription-Token": env.BRAVE_API_KEY,
                  "Accept": "application/json"
                }
              }
            ).then(r => r.json()).catch(e => {
              console.error("Brave Web error:", e);
              return null;
            })
          );
        }

        // Warte auf alle Ergebnisse
        const results = await Promise.allSettled(newsPromises);

        // Verarbeite Brave News Ergebnisse
        if (results[0]?.status === 'fulfilled' && results[0].value?.results) {
          combinedNewsData += "=== 🦁 BRAVE NEWS SEARCH ===\n";
          combinedNewsData += `(${results[0].value.results.length} Artikel gefunden)\n\n`;
          
          results[0].value.results.forEach((article, index) => {
            combinedNewsData += `📰 Artikel ${index + 1}:\n`;
            combinedNewsData += `Titel: ${article.title}\n`;
            combinedNewsData += `Quelle: ${article.source || 'Unbekannt'}\n`;
            combinedNewsData += `Zeitpunkt: ${article.age || 'Kürzlich'}\n`;
            if (article.description) {
              combinedNewsData += `Beschreibung: ${article.description}\n`;
            }
            combinedNewsData += `URL: ${article.url}\n`;
            if (article.extra_snippets && article.extra_snippets.length > 0) {
              combinedNewsData += `Zusatzinfo: ${article.extra_snippets.join(' ')}\n`;
            }
            combinedNewsData += `---\n\n`;
          });
        }

        // Verarbeite NewsAPI Ergebnisse
        if (results[1]?.status === 'fulfilled' && results[1].value?.articles) {
          combinedNewsData += "\n=== 📡 NEWSAPI.ORG ===\n";
          combinedNewsData += `(${results[1].value.articles.length} Artikel gefunden)\n\n`;
          
          results[1].value.articles.forEach((article, index) => {
            combinedNewsData += `📰 Artikel ${index + 1}:\n`;
            combinedNewsData += `Titel: ${article.title}\n`;
            combinedNewsData += `Quelle: ${article.source.name}\n`;
            combinedNewsData += `Datum: ${new Date(article.publishedAt).toLocaleString('de-DE')}\n`;
            if (article.author) {
              combinedNewsData += `Autor: ${article.author}\n`;
            }
            if (article.description) {
              combinedNewsData += `Beschreibung: ${article.description}\n`;
            }
            combinedNewsData += `URL: ${article.url}\n`;
            if (article.content) {
              combinedNewsData += `Inhalt-Vorschau: ${article.content.substring(0, 200)}...\n`;
            }
            combinedNewsData += `---\n\n`;
          });
        }

        // Verarbeite Guardian Ergebnisse
        if (results[2]?.status === 'fulfilled' && results[2].value?.response?.results) {
          combinedNewsData += "\n=== 📰 THE GUARDIAN ===\n";
          combinedNewsData += `(${results[2].value.response.results.length} Artikel gefunden)\n\n`;
          
          results[2].value.response.results.forEach((article, index) => {
            combinedNewsData += `📰 Artikel ${index + 1}:\n`;
            combinedNewsData += `Titel: ${article.webTitle}\n`;
            combinedNewsData += `Sektion: ${article.sectionName}\n`;
            combinedNewsData += `Datum: ${new Date(article.webPublicationDate).toLocaleString('de-DE')}\n`;
            combinedNewsData += `Typ: ${article.type}\n`;
            combinedNewsData += `URL: ${article.webUrl}\n`;
            if (article.fields?.bodyText) {
              combinedNewsData += `Inhalt-Vorschau: ${article.fields.bodyText.substring(0, 300)}...\n`;
            }
            if (article.fields?.standfirst) {
              combinedNewsData += `Zusammenfassung: ${article.fields.standfirst}\n`;
            }
            combinedNewsData += `---\n\n`;
          });
        }

        // Brave Web Search für zusätzlichen Kontext
        if (results[3]?.status === 'fulfilled' && results[3].value?.web?.results) {
          combinedNewsData += "\n=== 🌐 BRAVE WEB SEARCH (Zusatzkontext) ===\n";
          combinedNewsData += `(${results[3].value.web.results.length} Webseiten gefunden)\n\n`;
          
          results[3].value.web.results.forEach((result, index) => {
            combinedNewsData += `🔍 Quelle ${index + 1}:\n`;
            combinedNewsData += `Titel: ${result.title}\n`;
            combinedNewsData += `URL: ${result.url}\n`;
            combinedNewsData += `Beschreibung: ${result.description}\n`;
            if (result.extra_snippets && result.extra_snippets.length > 0) {
              combinedNewsData += `Relevante Passagen: ${result.extra_snippets.join(' | ')}\n`;
            }
            combinedNewsData += `---\n\n`;
          });
        }

        // Zusammenfassung der Suche
        const totalArticles = 
          (results[0]?.value?.results?.length || 0) +
          (results[1]?.value?.articles?.length || 0) +
          (results[2]?.value?.response?.results?.length || 0) +
          (results[3]?.value?.web?.results?.length || 0);

        combinedNewsData += `\n=== 📊 ZUSAMMENFASSUNG ===\n`;
        combinedNewsData += `🔍 Suchbegriff: "${functionArgs.query}"\n`;
        combinedNewsData += `📅 Zeitpunkt: ${new Date().toLocaleString('de-DE')}\n`;
        combinedNewsData += `📰 Quellen abgefragt: ${results.filter(r => r.status === 'fulfilled' && r.value).length} von 4\n`;
        combinedNewsData += `📄 Artikel/Quellen gefunden: ${totalArticles}\n`;
        combinedNewsData += `🌐 Sprache: ${functionArgs.language || 'de'}\n\n`;

        if (totalArticles === 0) {
          combinedNewsData = "Keine aktuellen Nachrichten zu diesem Thema gefunden. Möglicherweise ist der Suchbegriff zu spezifisch oder es gibt keine aktuellen Entwicklungen.";
        }
      }

      // Sende die gesammelten News zurück an GPT-4 zur Analyse
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

    // Normale Antwort ohne News-Suche
    console.log("Direct response - no news search needed");
    
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
      reply: "Es ist ein Fehler aufgetreten. Bitte versuche es erneut."
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
};