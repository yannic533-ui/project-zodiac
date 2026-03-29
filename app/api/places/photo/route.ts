import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PHOTO_NAME_RE = /^places\/[^/]+\/photos\/.+$/;

export async function GET(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const name =
    url.searchParams.get("name")?.trim() ?? url.searchParams.get("ref")?.trim();
  const maxWidthPx =
    url.searchParams.get("maxWidthPx") ??
    url.searchParams.get("maxwidth") ??
    "800";

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  if (!PHOTO_NAME_RE.test(name)) {
    return NextResponse.json({ error: "Invalid photo name" }, { status: 400 });
  }

  const mediaUrl = new URL(
    `https://places.googleapis.com/v1/${name}/media`
  );
  mediaUrl.searchParams.set("maxWidthPx", maxWidthPx);
  mediaUrl.searchParams.set("key", key);

  const res = await fetch(mediaUrl.toString(), { redirect: "manual" });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      const img = await fetch(loc);
      if (!img.ok) {
        return NextResponse.json({ error: "Photo fetch failed" }, { status: 502 });
      }
      const buf = await img.arrayBuffer();
      const ct = img.headers.get("content-type") ?? "image/jpeg";
      return new NextResponse(buf, {
        headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400" },
      });
    }
  }

  if (!res.ok) {
    return NextResponse.json({ error: "Photo failed" }, { status: 502 });
  }

  const buf = await res.arrayBuffer();
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  return new NextResponse(buf, {
    headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400" },
  });
}
