import { NextRequest, NextResponse } from "next/server";
import lighthouse from "@lighthouse-web3/sdk";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { note, summary } = await req.json();
    if (!note) {
      return NextResponse.json({ error: "Missing note" }, { status: 400 });
    }
    const apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server missing LIGHTHOUSE_API_KEY" }, { status: 500 });
    }

    const payload = JSON.stringify({ note, summary: summary ?? "", createdAt: new Date().toISOString() });
    const uploadRes = await lighthouse.uploadText(payload, apiKey);
    const cid = uploadRes?.data?.Hash;
    if (!cid) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
    const url = `https://gateway.lighthouse.storage/ipfs/${cid}`;
    return NextResponse.json({ cid, url });
  } catch (err: unknown) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}


