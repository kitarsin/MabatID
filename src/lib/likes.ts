"use client";

import { isTally, type LikeTally } from "./engagement/protocol";
export type { LikeTally } from "./engagement/protocol";

export async function fetchLikes(signal?: AbortSignal): Promise<LikeTally> {
  const res = await fetch("/api/likes", { cache: "no-store", credentials: "same-origin", signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok || !isTally(body)) throw new Error("Likes are unavailable right now. Please try again.");
  return body;
}

export async function sendLike(): Promise<LikeTally> {
  const res = await fetch("/api/likes", { method: "POST", cache: "no-store", credentials: "same-origin" });
  const body: unknown = await res.json().catch(() => null);
  if ((res.ok || res.status === 409) && isTally(body)) return body;
  if (res.status === 428) throw new Error("Allow cookies and reload this page to leave a like.");
  if (res.status === 429) throw new Error("Too many requests. Please try again later.");
  throw new Error("Couldn't send your like. Please try again.");
}
