import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { ClerkProvider } from "@clerk/clerk-react";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl text-ink">404</h1>
        <h2 className="mt-4 text-xl text-ink">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-bone hover:bg-sage transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl text-ink">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. You can retry or head home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-sm bg-ink px-5 py-2.5 text-sm font-medium text-bone hover:bg-sage transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-sm border border-ink/10 px-5 py-2.5 text-sm font-medium hover:bg-parchment transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ThesisPro AI — Verified academic thesis & dissertation writing" },
      {
        name: "description",
        content:
          "Generate university-grade research topics, proposals, and theses with citations verified against OpenAlex and Crossref.",
      },
      { property: "og:title", content: "ThesisPro AI — Verified academic thesis & dissertation writing" },
      {
        property: "og:description",
        content: "Verified academic thesis & dissertation writing, powered by AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "ThesisPro AI — Verified academic thesis & dissertation writing" },
      { name: "description", content: "ThesisPro AI is a SaaS platform that generates academic theses and dissertations from proposal to completion." },
      { property: "og:description", content: "ThesisPro AI is a SaaS platform that generates academic theses and dissertations from proposal to completion." },
      { name: "twitter:description", content: "ThesisPro AI is a SaaS platform that generates academic theses and dissertations from proposal to completion." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4c0d5e38-e8bf-47bc-b447-ea259822b476/id-preview-62eeb6e3--ea7c23ab-faa4-4923-be18-021aa6bd5e40.lovable.app-1780473278507.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4c0d5e38-e8bf-47bc-b447-ea259822b476/id-preview-62eeb6e3--ea7c23ab-faa4-4923-be18-021aa6bd5e40.lovable.app-1780473278507.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_Y2hvaWNlLWdvcGhlci0xMC5jbGVyay5hY2NvdW50cy5kZXYk";
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={publishableKey} signInUrl="/auth" signUpUrl="/auth">
        <Outlet />
        <Toaster />
      </ClerkProvider>
    </QueryClientProvider>
  );
}
