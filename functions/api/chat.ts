export const onRequestPost: PagesFunction<{ 
  OPENAI_API_KEY: string; 
  NEWS_API_KEY: string;
  BRAVE_API_KEY: string;
  THE_GUARDIAN_KEY: string;
}> = async ({ request, env }) => {
  const { messages, prompted } = await request.json();

  // Function Definition für umfassende News-Suche
  const functions = [
    {
      name: "search_news_comprehensive",
      description: "Sucht umfassend nach aktuellen Nachrichten aus mehreren vertrauenswürdigen Quellen",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Das Suchthema"
          },
          language: {
            type: "string",
            description: "Sprache (de, en, fr, etc.)",
            default: "de"
          }
        },
        required: ["query"]
      }
    }
  ];

  try {
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
      const functionCall = data.choices[0].message.function_call;
      const functionArgs = JSON.parse(functionCall.arguments);

      let combinedNewsData = "";

      if (functionCall.name === "search_news_comprehensive") {
        // Parallele Abfragen an alle APIs
        const newsPromises = [];

        // 1. Brave Search (UNLIMITED! - können wir großzügig nutzen)
        newsPromises.push(
          fetch(
            `https://api.search.brave.com/res/v1/news/search?` +
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&count=10` + // Mehr Ergebnisse da unlimited!
            `&freshness=pd` + // Past day für aktuelle News
            `&lang=${functionArgs.language || 'de'}`,
            {
              headers: {
                "X-Subscription-Token": env.BRAVE_API_KEY,
                "Accept": "application/json"
              }
            }
          ).then(r => r.json())
        );

        // 2. NewsAPI.org
        newsPromises.push(
          fetch(
            `https://newsapi.org/v2/everything?` + 
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&language=${functionArgs.language || 'de'}` +
            `&sortBy=publishedAt` +
            `&pageSize=5` +
            `&apiKey=${env.NEWS_API_KEY}`
          ).then(r => r.json())
        );

        // 3. The Guardian
        newsPromises.push(
          fetch(
            `https://content.guardianapis.com/search?` +
            `q=${encodeURIComponent(functionArgs.query)}` +
            `&show-fields=all` +
            `&page-size=5` +
            `&order-by=newest` +
            `&api-key=${env.THE_GUARDIAN_KEY}`
          ).then(r => r.json())
        );

        // Zusätzlich: Brave Web Search für Kontext (da unlimited!)
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
          ).then(r => r.json())
        );

        // Warte auf alle Ergebnisse
        const results = await Promise.allSettled(newsPromises);

        // Verarbeite Brave News Ergebnisse
        if (results[0].status === 'fulfilled' && results[0].value.results) {
          combinedNewsData += "=== 🦁 BRAVE NEWS SEARCH ===\n";
          combinedNewsData += `(${results[0].value.results.length} Artikel gefunden)\n\n`;
          
          results[0].value.results.forEach((article, index) => {
            combinedNewsData += `
📰 Artikel ${index + 1}:
Titel: ${article.title}
Quelle: ${article.source || 'Unbekannt'}
Zeitpunkt: ${article.age || 'Kürzlich'}
Beschreibung: ${article.description || 'Keine Beschreibung'}
URL: ${article.url}
${article.extra_snippets ? `Zusatzinfo: ${article.extra_snippets.join(' ')}` : ''}
---
`;
          });
        }

        // Verarbeite NewsAPI Ergebnisse
        if (results[1].status === 'fulfilled' && results[1].value.articles) {
          combinedNewsData += "\n\n=== 📡 NEWSAPI.ORG ===\n";
          combinedNewsData += `(${results[1].value.articles.length} Artikel gefunden)\n\n`;
          
          results[1].value.articles.forEach((article, index) => {
            combinedNewsData += `
📰 Artikel ${index + 1}:
Titel: ${article.title}
Quelle: ${article.source.name}
Datum: ${new Date(article.publishedAt).toLocaleString('de-DE')}
Autor: ${article.author || 'Unbekannt'}
Beschreibung: ${article.description || 'Keine Beschreibung'}
URL: ${article.url}
${article.content ? `Inhalt-Vorschau: ${article.content.substring(0, 200)}...` : ''}
---
`;
          });
        }

        // Verarbeite Guardian Ergebnisse
        if (results[2].status === 'fulfilled' && results[2].value.response?.results) {
          combinedNewsData += "\n\n=== 📰 THE GUARDIAN ===\n";
          combinedNewsData += `(${results[2].value.response.results.length} Artikel gefunden)\n\n`;
          
          results[2].value.response.results.forEach((article, index) => {
            combinedNewsData += `
📰 Artikel ${index + 1}:
Titel: ${article.webTitle}
Sektion: ${article.sectionName}
Datum: ${new Date(article.webPublicationDate).toLocaleString('de-DE')}
Typ: ${article.type}
URL: ${article.webUrl}
${article.fields?.bodyText ? `Inhalt-Vorschau: ${article.fields.bodyText.substring(0, 300)}...` : ''}
${article.fields?.standfirst ? `Zusammenfassung: ${article.fields.standfirst}` : ''}
---
`;
          });
        }

        // Brave Web Search für zusätzlichen Kontext
        if (results[3].status === 'fulfilled' && results[3].value.web?.results) {
          combinedNewsData += "\n\n=== 🌐 BRAVE WEB SEARCH (Zusatzkontext) ===\n";
          combinedNewsData += `(${results[3].value.web.results.length} Webseiten gefunden)\n\n`;
          
          results[3].value.web.results.forEach((result, index) => {
            combinedNewsData += `
🔍 Quelle ${index + 1}:
Titel: ${result.title}
URL: ${result.url}
Beschreibung: ${result.description}
${result.extra_snippets ? `Relevante Passagen: ${result.extra_snippets.join(' | ')}` : ''}
---
`;
          });
        }

        // Zusammenfassung der Suche
        const totalArticles = 
          (results[0].value?.results?.length || 0) +
          (results[1].value?.articles?.length || 0) +
          (results[2].value?.response?.results?.length || 0) +
          (results[3].value?.web?.results?.length || 0);

        combinedNewsData += `\n\n=== 📊 ZUSAMMENFASSUNG ===
🔍 Suchbegriff: "${functionArgs.query}"
📅 Zeitpunkt: ${new Date().toLocaleString('de-DE')}
📰 Quellen abgefragt: ${results.filter(r => r.status === 'fulfilled').length} von 4
📄 Artikel/Quellen gefunden: ${totalArticles}
🌐 Sprache: ${functionArgs.language || 'de'}

Hinweis: Die Ergebnisse stammen aus verschiedenen internationalen und nationalen Quellen. 
Brave Search liefert unbegrenzte Suchergebnisse für maximale Abdeckung.`;

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
            {
              role: "system",
              content: `Du bist ein Experte für Nachrichtenverifikation. Analysiere die bereitgestellten Nachrichtenquellen und:
1. Fasse die wichtigsten Informationen zusammen
2. Identifiziere Übereinstimmungen zwischen verschiedenen Quellen
3. Weise auf Widersprüche oder unterschiedliche Darstellungen hin
4. Bewerte die Glaubwürdigkeit basierend auf Quellenvielfalt
5. Gib das Publikationsdatum jeder relevanten Information an

Strukturiere deine Antwort klar und verwende Zwischenüberschriften.`
            },
            ...messages,
            data.choices[0].message,
            {
              role: "function",
              name: functionCall.name,
              content: combinedNewsData
            }
          ],
          temperature: 0.3,
          max_tokens: 2000 // Mehr Tokens für ausführliche Analyse
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