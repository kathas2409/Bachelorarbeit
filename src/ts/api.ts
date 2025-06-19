import { ChatMessage } from "~/routes";
import { createSignal } from "solid-js";

export class API {
  prompted: boolean;

  constructor(prompted: boolean) {
    this.prompted = prompted;
  }

  sendMessage(messages: ChatMessage[], message: string): ChatMessage {
    const [content, setContent] = createSignal("");
    const [done, setDone] = createSignal(false);
    const [error, setError] = createSignal<string | null>(null);

    const fetchResponse = async () => {
      try {
        // Bereite die Nachrichten für die API vor
        const apiMessages = [];
        
        if (this.prompted) {
          apiMessages.push({
            role: "system",
            content: "You are a helpful assistant following these rules:\n" +
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

        // Sende an unsere API Funktion
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            messages: apiMessages,
            prompted: this.prompted
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setContent(data.reply || "Keine Antwort erhalten");
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