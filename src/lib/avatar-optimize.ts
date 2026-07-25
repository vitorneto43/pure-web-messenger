/**
 * Otimiza URLs de avatar do Supabase Storage para reduzir tempo de download.
 * Adiciona parâmetros de transformação quando a URL vem do bucket público.
 */
export function optimizeAvatarUrl(
  url: string | null | undefined,
  width: number = 96,
): string | undefined {
  if (!url) return undefined;

  // Não tentar transformar URLs externas / não-Supabase
  if (
    url.includes("gravatar.com") ||
    url.includes("googleusercontent.com") ||
    url.includes("facebook.com") ||
    url.startsWith("data:")
  ) {
    return url;
  }

  try {
    const parsed = new URL(url);
    // Supabase Storage transformer endpoint: /storage/v1/object/public/... ou /storage/v1/render/image/public/...
    const isSupabaseObject = parsed.pathname.includes("/storage/v1/object/public/");
    const isSupabaseRender = parsed.pathname.includes("/storage/v1/render/image/public/");

    if (isSupabaseRender) {
      // Já é render; garante tamanho
      parsed.searchParams.set("width", String(width));
      parsed.searchParams.set("height", String(width));
      parsed.searchParams.set("resize", "cover");
      return parsed.toString();
    }

    if (isSupabaseObject) {
      // Converter para render/image para transformação on-the-fly
      const renderPath = parsed.pathname.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/",
      );
      parsed.pathname = renderPath;
      parsed.searchParams.set("width", String(width));
      parsed.searchParams.set("height", String(width));
      parsed.searchParams.set("resize", "cover");
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
}
