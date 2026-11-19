import { NextResponse, type NextRequest } from "next/server";
import { requireStudent } from "@/lib/auth/session";
import { loadCv } from "@/lib/cv/data";
import { cvFileName, type CvLocale } from "@/lib/cv/model";
import { renderCvPdf } from "@/lib/cv/pdf";

/**
 * The signed-in student's CV as a PDF, built from their saved profile.
 * Free; nothing is stored.
 *
 *   /cv            → Portuguese, opens in the browser
 *   /cv?lang=en    → English
 *   /cv?download=1 → download
 */
export async function GET(request: NextRequest) {
  // Same guard as the dashboard: signed in, not suspended, legal documents accepted, student profile.
  const user = await requireStudent("/dashboard/cv");

  const locale: CvLocale = request.nextUrl.searchParams.get("lang") === "en" ? "en" : "pt";
  const cv = await loadCv(user.id, locale);
  if (!cv) return NextResponse.redirect(new URL("/workspaces", request.url));

  const pdf = await renderCvPdf(cv, locale);
  const name = cvFileName(cv.name);
  const disposition = request.nextUrl.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
