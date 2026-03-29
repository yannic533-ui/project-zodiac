import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const ref = new URL(request.url).searchParams.get("ref");
  const maxwidth = new URL(request.url).searchParams.get("maxwidth") ?? "800";
  if (!ref?.trim()) {
    return NextResponse.json({ error: "Missing ref" }, { status: 400 });
  }

  const u = new URL("https://maps.googleapis.com/maps/api/place/photo");
  u.searchParams.set("maxwidth", maxwidth);
  u.searchParams.set("photo_reference", ref.trim());
  u.searchParams.set("key", key);

  const res = await fetch(u.toString(), { redirect: "manual" });
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
