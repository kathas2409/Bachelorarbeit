import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractTextFromUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    return article?.textContent || "Kein Inhalt gefunden.";
  } catch (err) {
    return "Fehler beim Abrufen der Seite.";
  }
}

export const onRequestPost: PagesFunction = async (context) => {
  const { message } = await context.request.json();
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = message.match(urlRegex);

  let webText = "";

  if (urls) {
    const contents = await Promise.all(urls.map(extractTextFromUrl));
    webText = contents.join("\n\n");
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Du bewertest Webseiteninhalte auf ihre Glaubwürdigkeit, Verständlichkeit und Seriosität." },
      { role: "user", content: `Nutzerfrage: ${message}\n\nInhalt der Webseite(n):\n${webText}` },
    ],
  });

  return new Response(JSON.stringify({ reply: completion.choices[0].message.content }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
