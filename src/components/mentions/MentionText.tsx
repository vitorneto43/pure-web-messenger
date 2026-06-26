import { Fragment } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const MENTION_REGEX = /(^|[^A-Za-z0-9_])@([A-Za-z0-9_]{2,30})/g;

interface Props {
  text: string;
  className?: string;
  mentionClassName?: string;
}

/**
 * Renders text with @username turned into bold, clickable links
 * pointing to the user's profile.
 */
export function MentionText({ text, className, mentionClassName }: Props) {
  if (!text) return null;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  for (const m of text.matchAll(MENTION_REGEX)) {
    const idx = m.index ?? 0;
    const prefix = m[1] ?? "";
    const username = m[2];
    const start = idx + prefix.length;
    if (start > last) nodes.push(<Fragment key={key++}>{text.slice(last, start)}</Fragment>);
    nodes.push(
      <Link
        key={key++}
        to="/u/$username"
        params={{ username }}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "font-bold text-primary hover:underline underline-offset-2",
          mentionClassName,
        )}
      >
        @{username}
      </Link>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) nodes.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return <span className={className}>{nodes}</span>;
}
