import React from "react";
import { Link } from "@tanstack/react-router";

// Matches http(s) URLs, www.* URLs, and bare domains like example.com/path
const URL_REGEX =
  /(\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}(?:\/[^\s<>"']*)?|\b[a-z0-9-]+\.[a-z]{2,}(?:\/[^\s<>"']*)?)/gi;

// Matches @username (2-30 chars, alphanumeric + underscore)
const MENTION_REGEX = /(^|[^A-Za-z0-9_/])@([A-Za-z0-9_]{2,30})\b/g;

function normalize(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

// Trim common trailing punctuation that's usually not part of the URL
function stripTrailing(url: string): { url: string; trailing: string } {
  const m = url.match(/[)\].,;:!?]+$/);
  if (!m) return { url, trailing: "" };
  return { url: url.slice(0, -m[0].length), trailing: m[0] };
}

export function extractFirstUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(URL_REGEX);
  if (!m || !m[0]) return null;
  const { url } = stripTrailing(m[0]);
  return normalize(url);
}

function renderMentionsAndText(
  text: string,
  keyPrefix: string,
  mentionClassName = "font-bold text-primary hover:underline",
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(MENTION_REGEX)) {
    const idx = m.index ?? 0;
    const prefix = m[1] ?? "";
    const username = m[2];
    const start = idx + prefix.length;
    if (start > last) {
      out.push(<span key={`${keyPrefix}-t-${i++}`}>{text.slice(last, start)}</span>);
    }
    out.push(
      <Link
        key={`${keyPrefix}-m-${i++}`}
        to="/u/$username"
        params={{ username }}
        className={mentionClassName}
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </Link>,
    );
    last = idx + m[0].length;
  }
  if (last < text.length) {
    out.push(<span key={`${keyPrefix}-t-${i++}`}>{text.slice(last)}</span>);
  }
  return out;
}

export function linkify(
  text: string | null | undefined,
  linkClassName = "underline text-primary break-all",
  mentionClassName?: string,
): React.ReactNode[] {
  if (!text) return [];
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(URL_REGEX)) {
    const start = m.index!;
    if (start > last) {
      out.push(
        <React.Fragment key={`seg-${i++}`}>
          {renderMentionsAndText(text.slice(last, start), `seg-${i}`, mentionClassName)}
        </React.Fragment>,
      );
    }
    const { url: clean, trailing } = stripTrailing(m[0]);
    out.push(
      <a
        key={`l-${i++}`}
        href={normalize(clean)}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
        onClick={(e) => e.stopPropagation()}
      >
        {clean}
      </a>,
    );
    if (trailing) out.push(<span key={`tr-${i++}`}>{trailing}</span>);
    last = start + m[0].length;
  }
  if (last < text.length) {
    out.push(
      <React.Fragment key={`seg-${i++}`}>
        {renderMentionsAndText(text.slice(last), `seg-${i}`, mentionClassName)}
      </React.Fragment>,
    );
  }
  return out;
}
