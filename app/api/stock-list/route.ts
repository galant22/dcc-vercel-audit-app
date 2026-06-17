import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheetsClient, spreadsheetId } from "@/lib/googleSheets";

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "STOCK_MASTER!A2:J50000"
  });

  const rows = res.data.values || [];
  const items = rows
    .map((row, index) => ({
      row_number: index + 2,
      location_name: String(row[0] || ""),
      product_id: String(row[1] || ""),
      sku_number: String(row[2] || ""),
      product_name: String(row[3] || ""),
      system_qty: toNumber(row[4]),
      location: String(row[5] || ""),
      last_update: String(row[6] || ""),
      active: String(row[7] || ""),
      price: toNumber(row[8]),
      product_type_name: String(row[9] || "")
    }))
    .filter((item) => {
      const active = item.active.trim().toUpperCase();
      return item.sku_number.trim() && item.location.trim() && (active === "TRUE" || active === "");
    });

  return NextResponse.json({ success: true, items, total: items.length });
}
