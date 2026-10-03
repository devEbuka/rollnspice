import { NextResponse } from "next/server";

export function reply(body, status) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", Vary: "Authorization, Cookie" } });
}
