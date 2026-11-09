"use client";

/** Last-resort error screen when the root layout itself fails. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F7F5F0", color: "#16131F", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#5B5766" }}>Please try again in a moment.</p>
          <button onClick={() => retry()} style={{ background: "#3A2BD6", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontSize: 16, fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
