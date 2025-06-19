import { Accessor, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { SolidMarkdown } from "solid-markdown";
import { GrowingTextarea } from "~/components/GrowingTextarea";
import { SendIcon } from "~/components/icons/SendIcon";
import "~/css/chat-markdown.css"
import { API } from "~/ts/api";
import { ReloadIcon } from "~/components/icons/ReloadIcon";
import { downloadFile } from "~/ts/util";
import { NotesIcon } from "~/components/icons/NotesIcon";

export type UserMessage = {
  time: number,
  role: "user"
  content: string
}
export type AssistantMessage = {
  time: number,
  role: "assistant"
  content: Accessor<string>
  done: Accessor<boolean> // always check if it is done due to an error!
  error: Accessor<null | string>
  retry: () => void
}
export type ChatMessage = UserMessage | AssistantMessage;

export default function Home() {
  const [debug, setDebug] = createSignal(new URLSearchParams(window.location.search).has('debug'))
  const [showConfig, setShowConfig] = createSignal(false)
  const [showNotes, setShowNotes] = createSignal(false)

  const [prompted, setPrompted] = createSignal<boolean>(false)
  const api = createMemo(() => new API(prompted()))

  const [messages, setMessages] = createSignal<ChatMessage[]>([])
  const [message, setMessage] = createSignal("")
  const lastMessage = () => {
    const msgs = messages()
    return  msgs[msgs.length - 1]
  }
  const latestMessagePending = createMemo<boolean>(() => {
    const message = lastMessage()
    return message && message.role === "assistant" && (!message.done() || message.error() !== null)
  })

  window.onbeforeunload = () => {
    if (messages().length > 0) {
      return ""
    }
  }

  let autoScroll = true

  const chatMessageScroller: HTMLDivElement = (
    <div
      class="w-full h-full overflow-x-hidden overflow-y-auto"
      style="scrollbar-gutter: stable"
      onScroll={() => {
        autoScroll = chatMessageScroller.scrollHeight - chatMessageScroller.scrollTop === chatMessageScroller.clientHeight
      }}
    >
      <div class="my-4 w-full flex flex-col gap-4 items-center">
        <For each={messages()}>{(message) =>
          <div class={`max-w-3xl px-8 w-full break-words py-3 rounded-xl`}>
            <div class="text-lg font-bold mb-1">{message.role === "user" ? "Nutzer" : "Assistent"}</div>
            {
              message.role === "user" ?
                <p class="whitespace-pre-wrap">{message.content}</p>
                :
                <>
                  <SolidMarkdown class={"md" + (message.error() ? " opacity-50" : "")}>
                    {message.content() + (message.done() ? (message.error() !== null ? " ❌" : "") : " ⬤")}
                  </SolidMarkdown>
                  <Show when={message.error() !== null}>
                    <div class="flex flex-row justify-between items-center gap-4">
                      <div class="text-red-500">
                        Error: {message.error()}
                      </div>
                      <button class="p-1 my-1 w-8 h-8 flex justify-center items-center border-1 align-start animate-pulse hover:animate-none
                          bg-gray-850 text-gray-400 border-gray-900 disabled:text-gray-600 not-disabled:(border-green-400 hover:(bg-gray-850/60 text-gray-200) active:(border-blue-400 bg-gray-850/20))
                            rounded-lg"
                          onclick={() => message.retry()}
                      >
                        <ReloadIcon />
                      </button>
                    </div>
                  </Show>
                </>
            }
          </div>
        }</For>
      </div>
    </div>
  ) as HTMLDivElement

  createEffect(() => {
    // Register triggers
    for (const message of messages()) {
      if (message.role === "assistant") {
        createEffect(() => {
          message.content();
          message.error();
          message.done();

          // Execute action
          if (autoScroll) {
            chatMessageScroller.scrollTop = chatMessageScroller.scrollHeight
          }
        })
      }
    }
  })

  if (document) {
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.shiftKey && event.key === "I") {
        event.preventDefault();
        setShowConfig(show => !show)
      } else if (!event.ctrlKey && /^[a-zA-Z]$/.test(event.key) && !showConfig()) {
        const textArea = document.getElementById(showNotes() ? "notes-textarea" : "chat-input")
        if (!textArea) return

        textArea.focus()
      } else if (event.key === "Escape") {
        if (showConfig()) {
          setShowConfig(false)
        } else {
          setShowNotes(notes => !notes)
        }
      }
    });
  }

  const onsubmit = async () => {
  const messageText = message()
  if (messageText.length === 0) return

  const timestamp = Date.now()

  // 1. Nutzer-Nachricht direkt anzeigen
  setMessage("")
  setMessages([...messages(), {
    time: timestamp,
    role: "user",
    content: messageText
  }])

  // 2. Nachricht speichern
  fetch("/api/saveMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: messageText })
  }).catch((err) => console.warn("Fehler beim Speichern:", err))

  // 3. GPT-Antwort von /api/chat holen (mit Webseiteninhalt)
  t// 3. GPT-Antwort von /api/chat holen
try {
  // Sammle alle bisherigen Nachrichten für den Kontext
  const allMessages = [];
  
  // Füge System-Prompt hinzu wenn "prompted" aktiviert ist
  if (prompted()) {
    allMessages.push({
      role: "system",
      content: "Du bist ein hilfreicher Assistent. Antworte auf Deutsch."
    });
  }
  
  // Füge alle bisherigen Nachrichten hinzu
  for (const msg of messages()) {
    if (msg.role === "user") {
      allMessages.push({
        role: "user",
        content: msg.content
      });
    } else {
      allMessages.push({
        role: "assistant", 
        content: msg.content()
      });
    }
  }
  
  // Füge die neue Nachricht hinzu
  allMessages.push({
    role: "user",
    content: messageText
  });

  console.log("Sende an API:", { messages: allMessages });

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ 
      messages: allMessages,
      prompted: prompted() 
    })
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  const replyText = data.reply || "Ich konnte leider keine Antwort generieren.";

  // 4. GPT-Antwort anzeigen
  setMessages(m => [...m, {
    time: Date.now(),
    role: "assistant",
    content: () => replyText,
    done: () => true,
    error: () => null,
    retry: () => { }
  }]);
} catch (err) {
  console.error("Fehler bei GPT-Antwort:", err);
  setMessages(m => [...m, {
    time: Date.now(),
    role: "assistant",
    content: () => "",
    done: () => true,
    error: () => "Fehler beim Abrufen der Antwort",
    retry: () => onsubmit()
  }]);
}
    // 4. GPT-Antwort anzeigen
    setMessages(m => [...m, {
      time: Date.now(),
      role: "assistant",
      content: () => replyText,
      done: () => true,
      error: () => null,
      retry: () => { }
    }])
  } catch (err) {
    console.error("Fehler bei GPT-Antwort:", err)
    setMessages(m => [...m, {
      time: Date.now(),
      role: "assistant",
      content: () => "",
      done: () => true,
      error: () => "Fehler beim Abrufen der Antwort",
      retry: () => onsubmit()
    }])
  }
}

  return (
    <div class="flex flex-col w-screen h-screen h-svh bg-gray-800">
      <div class="h-4" />

      <div class="fixed flex flex-col gap-4 left-2 top-2 z-1 group">
        <div class="absolute left-8 inset-y-0 flex flex-row items-center text-sm text-gray-500 opacity-0 group-hover:(opacity-100 left-12) transition-all duration-200 pointer-events-none">
          [ESC]
        </div>
        <button class="relative p-1 bg-gray-750 hover:bg-gray-700 rounded-xl outline-none" onclick={() => setShowNotes(true)}>
          <NotesIcon />
        </button>
        <Show when={debug()}>
          <button onclick={() => setShowConfig(true)}>DEV</button>
        </Show>
      </div>

      <Show when={showConfig()}>
        <div class="fixed inset-2 z-10 p-2 flex flex-col items-center gap-4 bg-gray-750 rounded-xl">
          <div class="flex flex-row gap-2">
            <div>MODEL VARIANT: </div>
            <button class="p-0.5 px-2 bg-gray-700 rounded-lg" onclick={() => setPrompted(p => !p)}>
              {prompted() ? "Prompted" : "Base"}
            </button>
          </div>

          <button class="p-0.5 px-2 bg-gray-700 rounded-lg" onclick={() => {
            const date = messages().length === 0 ? new Date() : new Date(messages()[0].time)
            let output = "# ChatGPT Log " + (prompted() ? "Prompted" : "Base") + " " + date.toLocaleString("de-DE") + "\n\n"
            for (let message of messages()) {
              output += "**" + (message.role === "user" ? "User" : "Assistent") + "**: (" + new Date(message.time).toLocaleString("de-DE") + ")  \n"
              output += message.role === "user" ? message.content : message.content()
              output += "\n\n---\n\n"
            }
            output += "\n\n# Notes:\n\n" + (document.getElementById("notes-textarea")! as HTMLTextAreaElement).value
            downloadFile( [output], "text/markdown", "Chatbot-Log-" + (prompted() ? "prompted" : "base") + "-" + date.getTime() + ".md");
          }}>Download Markdown</button>

          <button class="p-0.5 px-2 bg-gray-700 rounded-lg" onclick={() => {
            const date = messages().length === 0 ? new Date() : new Date(messages()[0].time)
            let output: { time: number, role: "user" | "assistant" | "notes", content: string }[] = []
            for (let message of messages()) {
              output.push({
                time: message.time,
                role: message.role,
                content: message.role === "user" ? message.content : message.content()
              })
            }
            output.push({
              time: 0,
              role: "notes",
              content: (document.getElementById("notes-textarea")! as HTMLTextAreaElement).value
            })
            downloadFile( [JSON.stringify(output)], "application/json", "Chatbot-Log-" + (prompted() ? "prompted" : "base") + "-" + date.getTime() + ".json");
          }}>Download JSON</button>

          <button class="mt-8 px-1 py-0.5 bg-blue-400 hover:bg-blue-500 rounded-lg" onclick={() => setShowConfig(false)}>
            Back
          </button>
        </div>
      </Show>

      <div class={`${showNotes() ? "" : "invisible"} fixed inset-2 z-5 flex flex-col items-stretch bg-gray-750 rounded-xl`}>
        <div class="p-4 flex flex-row justify-between text-gray-100">
          <div class="text-xl">
            Notizen
          </div>
          <div>
            <button class="px-1 py-0.5 bg-blue-400 hover:bg-blue-500 rounded-lg" onclick={() => setShowNotes(false)}>
              Zurück
            </button>
            {" "}
            <span class="text-sm text-gray-400">[ESC]</span>
          </div>
        </div>
        <div class="flex-1">
            <textarea
              id="notes-textarea"
              class="w-full h-full resize-none p-4 outline-none border-0 bg-gray-800/30"
            />
        </div>
      </div>

      <div class="relative flex-1 overflow-hidden">
        <ScrollOverflowFadeout top />
        { chatMessageScroller }
        <ScrollOverflowFadeout />
      </div>

      <div class="overflow-x-hidden w-full p-4 flex flex-row justify-center items-end gap-2">
        <div class="max-w-2xl w-full flex flex-col gap-4 items-center">
          <GrowingTextarea
            id="chat-input"
            accessor={message}
            setter={setMessage}
            onsubmit={onsubmit}
            disabled={latestMessagePending()}
            color="#ff00ff"
            class="bg-gray-850 rounded-lg outline-none border-0 ring focus-visible:ring-blue-400 ring-gray-900 disabled:(text-gray-700 placeholder:text-gray-700)"
            placeholder="Schreibe dem Assistenten…"
          />
        </div>
        <button
          class="my-1 w-12 h-12 flex justify-center items-center border-1 align-start
          bg-gray-850 text-gray-400 border-gray-900 disabled:text-gray-600 not-disabled:(hover:(bg-gray-850/60 text-gray-200) active:(border-blue-400 bg-gray-850/20))
          rounded-lg"
          disabled={message().length === 0 || latestMessagePending()}
          onclick={onsubmit}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function ScrollOverflowFadeout(props: { top?: boolean }) {
  return (
    <div class={`absolute inset-x-0 ${props.top ? "top-0" : "bottom-0"} h-8 flex flex-row justify-center`}>
      {/* mr-10px makes sure that the scrollbar isn't affected by the fadeout on small screens */}
      <div class={`max-w-3xl w-full mr-10px ${props.top ? "bg-gradient-to-b" : "bg-gradient-to-t"} from-gray-800 to-transparent`} />
    </div>
  )
}
