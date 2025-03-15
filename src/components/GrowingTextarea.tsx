import { Portal } from "solid-js/web";
import { createEffect } from "solid-js";

export function GrowingTextarea(props: {
  accessor: () => string,
  setter: (value: string) => void,
  id?: string,
  onsubmit?: () => void,
  disabled?: boolean,
  color?: string,
  class?: string
  placeholder?: string
}) {
  const id = (Math.random() + 1).toString(36).substring(2)

  const value = () => {
    const text = props.accessor()
    // this fixes an issue where the height is incorrect in cases where there is a new empty line
    return text.endsWith("\n") ? text + "." : text
  }

  const textarea = (
    <textarea
      id={props.id}
      rows="1"
      class={`w-full max-w-2xl p-4 break-words resize-none overflow-hidden ${props.class || ""}`}
      placeholder={props.placeholder}
      disabled={props.disabled || false}
      value={props.accessor()}
      onInput={(e) => {
        props.setter(e.currentTarget.value)
      }}
      onKeyDown={(e) => {
        if (props.onsubmit && e.key === "Enter" && !e.shiftKey) {
          e.preventDefault()

          props.onsubmit()
        }
      }}
    />
  ) as HTMLTextAreaElement
  createEffect(() => {
    if (!props.disabled) {
      textarea.focus()
    }
  })

  // Using: https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/
  return (
    <>
      <Portal>
        <style>{
          `.grow-wrap-${id} > textarea, .grow-wrap-${id}::after {` +
            'padding: 1rem; font: inherit; grid-area: 1 / 1 / 2 / 2; }'
        }</style>
      </Portal>
      <div
        class={`w-full grid grow-wrap-${id} after:(invisible w-full max-w-2xl break-words whitespace-pre-wrap content-[attr(data-replicated-value)])`}
        data-replicated-value={value()}
      >
        { textarea }
      </div>
    </>
  )
}