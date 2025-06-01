import { ChatMessage } from "~/routes";
import { createSignal } from "solid-js";
import OpenAI from 'openai';

function getSessionId(): string {
  let id = localStorage.getItem("sessionId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("sessionId", id);
  }
  return id;
}

async function getIpHash(): Promise<string> {
  const ip = await fetch("https://api.ipify.org?format=json")
    .then((res) => res.json())
    .then((data) => data.ip);

  const encoder = new TextEncoder();
  const data = encoder.encode(ip);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function saveMessageToServer(message: string) {
  const sessionId = getSessionId();
  const ipHash = await getIpHash();
  const timestamp = new Date().toISOString();

  console.log("Speichern ausgelöst für:", message); // Debug-Ausgabe

  await fetch("/api/saveMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      ipHash,
      message,
      timestamp,
    }),
  });
}

export class API {
  openai: OpenAI;
  prompted: boolean;

  constructor(prompted: boolean) {
    this.openai = new OpenAI({
      baseURL: "https://verifizierung-studie.pages.dev/openai/v1/",
      dangerouslyAllowBrowser: true,
      apiKey: "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",
    });

    this.prompted = prompted;
  }

  sendMessage(messages: ChatMessage[], message: string): ChatMessage {
    const [content, setContent] = createSignal("");
    const [done, setDone] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const fetchResponse = async () => {
      try {
        const apiMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

        if (this.prompted) {
          apiMessages.push({
            role: "system",
            content:
              "You are a helpful assistant following these rules:\n" +
              "- Aim for a conversational tone.\n" +
              "- Start by asking open-ended questions to gather necessary information for the task.\n" +
              "- Avoid asking overly broad questions or presenting more than 2 different questions at once.\n" +
              "- Rephrase your questions or provide more context if the user's answers are unclear.\n" +
              "- Avoid asking general questions like \"Still questions?\" or \"What do you think?\".\n" +
              "- Provide examples or recommendations only when requested by the user.\n" +
              "- Keep responses concise and relevant to the user's needs.\n" +
              "- Avoid overwhelming the user with too much information at once.\n" +
              "- All following chat will be in German.\n",
          });
        }

        for (let msg of messages) {
          if (msg.role === "assistant") {
            apiMessages.push({ role: "assistant", content: msg.content() });
          } else {
            apiMessages.push({ role: msg.role, content: msg.content });
          }
        }

        apiMessages.push({
          role: "user",
          content: message,
        });

        await saveMessageToServer(message);

        const stream = await this.openai.chat.completions.create({
          messages: apiMessages,
          model: "gpt-4o-2024-11-20",
          stream: true,
        });

        for await (const chunk of stream) {
          const newText = chunk.choices[0]?.delta?.content || "";
          setContent((content) => content + newText);
        }

        setDone(true);
      } catch (e) {
        setDone(true);
        setError(String(e));
      }
    };

    const retry = async () => {
      if (!done()) {
        throw new Error("Cannot restart when it isn't done!");
      }

      setDone(false);
      setError(null);
      setContent("");

      await fetchResponse();
    };

    fetchResponse();

    return {
      time: Date.now(),
      role: "assistant",
      content,
      done,
      error,
      retry,
    };
  }
}

function simulateApiResponse(
  answer: string,
  failureProbability: number,
  answerHandler: (token: string | true, error: null | string) => void
) {
  const naiveTokens = splitTextIntoParts(answer, 8);

  let tokenIndex = 0;
  const interval = setInterval(() => {
    if (Math.random() < failureProbability) {
      answerHandler("", "Something went wrong :(");
      clearInterval(interval);
      return;
    }

    answerHandler(naiveTokens[tokenIndex], null);
    tokenIndex++;

    if (tokenIndex >= naiveTokens.length) {
      answerHandler(true, null);
      clearInterval(interval);
    }
  }, 100);
}

function splitTextIntoParts(text: string, chunkSize: number): string[] {
  const parts: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    parts.push(text.slice(i, i + chunkSize));
  }
  return parts;
}
