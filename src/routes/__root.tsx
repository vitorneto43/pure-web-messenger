import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { InstallPrompt } from "@/components/InstallPrompt";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0c2340" },
      { title: "Wavechat — chat em tempo real direto do navegador" },
      {
        name: "description",
        content:
          "Plataforma de chat moderna, sem app, sem celular, sem SMS. Conversas privadas e em grupo direto do navegador.",
      },
      { property: "og:title", content: "Wavechat — chat em tempo real direto do navegador" },
      { property: "og:description", content: "Web Connect Chat is a full-featured, browser-based messaging platform for real-time conversations." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Wavechat — chat em tempo real direto do navegador" },
      { name: "description", content: "Web Connect Chat is a full-featured, browser-based messaging platform for real-time conversations." },
      { name: "twitter:description", content: "Web Connect Chat is a full-featured, browser-based messaging platform for real-time conversations." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/611c8190-7892-42f2-a762-682c8f840c7e/id-preview-aab16bd3--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app-1779216602177.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/611c8190-7892-42f2-a762-682c8f840c7e/id-preview-aab16bd3--84e5b2ed-fe1c-4906-b46d-5e198f0c6c1c.lovable.app-1779216602177.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "/icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
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

function AuthInvalidator() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthInvalidator />
        <Outlet />
        <InstallPrompt />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
