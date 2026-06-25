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
      { title: "Mybrainpadi — Your complete education ecosystem" },
      {
        name: "description",
        content:
          "Topics, proposals, theses, assignments, exam prep, presentations, and CVs — all in one platform powered by 200M+ verified scholarly sources.",
      },
      { property: "og:title", content: "Mybrainpadi — Your complete education ecosystem" },
      {
        property: "og:description",
        content: "An all-in-one academic toolkit for students: research, assignments, exams, presentations, and career tools backed by verified citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Mybrainpadi — Your complete education ecosystem" },
      { name: "description", content: "Mybrainpadi is an all-in-one education ecosystem that helps students with research topics, proposals, theses, assignments, exam prep, presentations, and CV building." },
      { property: "og:description", content: "Mybrainpadi is an all-in-one education ecosystem that helps students with research topics, proposals, theses, assignments, exam prep, presentations, and CV building." },
      { name: "twitter:description", content: "Mybrainpadi is an all-in-one education ecosystem that helps students with research topics, proposals, theses, assignments, exam prep, presentations, and CV building." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4c0d5e38-e8bf-47bc-b447-ea259822b476/id-preview-62eeb6e3--ea7c23ab-faa4-4923-be18-021aa6bd5e40.lovable.app-1780473278507.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4c0d5e38-e8bf-47bc-b447-ea259822b476/id-preview-62eeb6e3--ea7c23ab-faa4-4923-be18-021aa6bd5e40.lovable.app-1780473278507.png" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,500;0,8..60,600;0,8..60,700;1,8..60,400;1,8..60,500;1,8..60,600;1,8..60,700&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@300;400;500;600;700&display=swap",
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
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_live_Y2xlcmsubXlicmFpbnBhZGkuY29tJA";

  // Store referral code from URL on first page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      sessionStorage.setItem("ref_code", ref);
      localStorage.setItem("ref_code", ref);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider publishableKey={publishableKey} signInUrl="/auth" signUpUrl="/auth">
        <Outlet />
        <Toaster />
      </ClerkProvider>
    </QueryClientProvider>
  );
}
