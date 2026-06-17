import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { appendDccTask, lookupStock } from "@/lib/googleSheets";

const SubmitSchema = z.object({
  sku: z.string().min(1),
  location: z.string().min(1),
  counted_qty: z.coerce.number().min(0),
  note: z.string().optional().default(""),
  device_info: z.string().optional().default("WEB"),
  session_id: z.string().optional().default("")
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email || "";
  const name = session?.user?.name || "";

  if (!email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = SubmitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const data = parsed.data;
  const stock = await lookupStock(data.sku, data.location);
  if (!stock) {
    return NextResponse.json({ success: false, error: "SKU + location tidak ditemukan di STOCK_MASTER" }, { status: 404 });
  }

  const inputAt = new Date().toISOString();
  const gap = data.counted_qty - stock.quantity;
  const status = gap === 0 ? "Sesuai" : "Selisih";
  const taskId = stock.sku_number + "|" + stock.rack_name;
  const sessionId = data.session_id || "S-" + Date.now();

  await appendDccTask([
    inputAt,
    stock.sku_number,
    stock.product_name,
    stock.rack_name,
    stock.quantity,
    data.counted_qty,
    gap,
    status,
    email,
    data.note,
    stock.price,
    stock.product_type_name,
    name,
    "VERCEL_DCC_APP",
    taskId,
    email,
    name,
    email,
    inputAt,
    "VERCEL_DCC_APP",
    data.device_info,
    sessionId,
    "SINGLE"
  ]);

  return NextResponse.json({
    success: true,
    message: "DCC count submitted",
    result: { task_id: taskId, status, gap, input_email: email, input_at: inputAt }
  });
}
