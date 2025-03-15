// @refresh reload
import {createSignal, For, Show, Suspense} from "solid-js";
import {
  useLocation,
  A,
  Body,
  ErrorBoundary,
  FileRoutes,
  Head,
  Html,
  Meta,
  Routes,
  Scripts,
  Title,
} from "solid-start";

import "./css/font.css"
import "virtual:uno.css"
import '@unocss/reset/tailwind.css'

export default function Root() {
  return (
    <Html lang="en">
      <Head>
        <Title>FoIR</Title>
        <Meta charset="utf-8" />
        <Meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Body class="font-sans font-normal bg-gray-800 text-gray-300">
        <Suspense>
          <ErrorBoundary>
            <Routes>
              <FileRoutes />
            </Routes>
          </ErrorBoundary>
        </Suspense>
        <Scripts />
      </Body>
    </Html>
  );
}
