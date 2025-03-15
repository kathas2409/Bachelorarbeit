import { A } from "solid-start";

export default function NotFound() {
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="max-6-xs text-6xl text-blue-400 font-thin uppercase my-16">
        Not Found
      </h1>

      <p class="my-4">
        <A href="/" class="text-blue-400 hover:underline">
          Home
        </A>
      </p>
    </main>
  );
}
