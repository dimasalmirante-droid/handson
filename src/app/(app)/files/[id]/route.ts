import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Open or download a document. Access is checked by Row Level Security (the
 * student's own documents, or any document for an administrator). The file is
 * served through a signed URL that expires after 60 seconds, so links cannot
 * be shared or reused.
 *
 *   /files/<id>            → open in the browser
 *   /files/<id>?download=1 → download
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, original_filename").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("Not found", { status: 404 });

  const download = request.nextUrl.searchParams.get("download") === "1";
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(doc.storage_path, 60, download ? { download: doc.original_filename } : undefined);
  if (error || !data) return new NextResponse("The file could not be opened.", { status: 500 });

  const res = NextResponse.redirect(data.signedUrl, 303);
  res.headers.set("Cache-Control", "private, no-store");
  return res;
}
