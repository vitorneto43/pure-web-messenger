import { useEffect, useRef, useState, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

type AnyInput = HTMLInputElement | HTMLTextAreaElement;

/**
 * Adds @mention autocomplete to a controlled input or textarea.
 *
 * Usage:
 *   const m = useMentionSuggest({ value, setValue, inputRef });
 *   <div className="relative flex-1">
 *     <Input ref={inputRef} value={value}
 *       onChange={m.onChange} onKeyDown={m.onKeyDown} />
 *     {m.popover}
 *   </div>
 */
export function useMentionSuggest({
  value,
  setValue,
  inputRef,
  variant = "light",
}: {
  value: string;
  setValue: (v: string) => void;
  inputRef: RefObject<AnyInput | null>;
  variant?: "light" | "dark";
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [results, setResults] = useState<Profile[]>([]);
  const [active, setActive] = useState(0);
  const caretRef = useRef(0);

  function detect(text: string, caret: number) {
    const upto = text.slice(0, caret);
    const m = upto.match(/(?:^|\s)@([A-Za-z0-9_]{0,30})$/);
    setQuery(m ? m[1] : null);
    setActive(0);
  }

  function onChange(e: React.ChangeEvent<AnyInput>) {
    const v = e.target.value;
    caretRef.current = e.target.selectionStart ?? v.length;
    setValue(v);
    detect(v, caretRef.current);
  }

  useEffect(() => {
    if (query === null) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const q = query.toLowerCase();
    const handle = setTimeout(async () => {
      const builder = supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .not("username", "is", null);
      const { data } = q
        ? await builder.ilike("username", `${q}%`).limit(6)
        : await builder.order("last_seen", { ascending: false }).limit(6);
      if (cancelled) return;
      setResults((data ?? []) as Profile[]);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  function select(p: Profile) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const newBefore = before.replace(/@([A-Za-z0-9_]{0,30})$/, `@${p.username} `);
    const newValue = newBefore + after;
    setValue(newValue);
    setQuery(null);
    setResults([]);
    requestAnimationFrame(() => {
      el?.focus();
      const pos = newBefore.length;
      try {
        el?.setSelectionRange(pos, pos);
      } catch {}
    });
  }

  function onKeyDown(e: React.KeyboardEvent<AnyInput>) {
    if (query === null || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      select(results[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
    }
  }

  const dark = variant === "dark";
  const popover =
    query !== null && results.length > 0 ? (
      <div
        className={cn(
          "absolute z-50 bottom-full mb-1 left-0 w-64 max-w-[80vw] rounded-lg overflow-hidden shadow-lg border",
          dark
            ? "bg-black/90 border-white/15 text-white"
            : "bg-popover border-border text-popover-foreground",
        )}
        onMouseDown={(e) => e.preventDefault()}
      >
        {results.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => select(p)}
            className={cn(
              "flex items-center gap-2 w-full px-2 py-1.5 text-left transition-colors",
              i === active
                ? dark
                  ? "bg-white/15"
                  : "bg-accent"
                : dark
                  ? "hover:bg-white/10"
                  : "hover:bg-accent/60",
            )}
          >
            <Avatar className="size-7 shrink-0">
              <AvatarImage src={p.avatar_url ?? undefined} />
              <AvatarFallback>
                {(p.display_name || p.username)?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {p.display_name || p.username}
              </div>
              <div
                className={cn(
                  "text-xs truncate",
                  dark ? "text-white/60" : "text-muted-foreground",
                )}
              >
                @{p.username}
              </div>
            </div>
          </button>
        ))}
      </div>
    ) : null;

  return { onChange, onKeyDown, popover };
}
