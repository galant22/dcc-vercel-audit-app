import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { lookupStock } from "@/lib/googleSheets";

const LookupSchema = z.object({
  sku: z.string().min(1),
  location: z.string().min(1)
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const parsed = LookupSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid payload" }, { status: 400 });
  }

  const stock = await lookupStock(parsed.data.sku, parsed.data.location);
  if (!stock) {
    return NextResponse.json({ success: true, found: false });
  }

  return NextResponse.json({
    success: true,
    found: true,
    item: {
      sku_number: stock.sku_number,
      product_name: stock.product_name,
      location: stock.rack_name,
      system_qty: stock.quantity,
      price: stock.price,
      product_type_name: stock.product_type_name
    }
  });
}
