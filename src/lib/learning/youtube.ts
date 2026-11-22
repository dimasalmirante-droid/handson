/**
 * YouTube links → privacy-enhanced embed URLs (youtube-nocookie.com), which
 * set no tracking cookies until the student plays the video.
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id from a watch, short, embed or shorts link; null for anything else. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1);
  else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else {
      const m = /^\/(embed|shorts|live)\/([^/]+)/.exec(u.pathname);
      id = m ? m[2] : null;
    }
  }
  return id && ID.test(id) ? id : null;
}

/** Embed URL for an iframe, or null when the link is not a YouTube video. */
export function youtubeEmbedUrl(url: string | null | undefined): string | null {
  const id = youtubeId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1` : null;
}
