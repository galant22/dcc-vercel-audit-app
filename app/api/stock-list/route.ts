import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSheetsClient, spreadsheetId } from "@/lib/googleSheets";

function toNumber(value: unknown): number {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function taskKey(sku: string, location: string): string {
  return `${sku}|${location}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const sheets = await getSheetsClient();
  const id = spreadsheetId();
  const [stockRes, taskRes] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: "STOCK_MASTER!A2:J50000" }),
    sheets.spreadsheets.values.get({ spreadsheetId: id, range: "DCC_Task!A5:AB50000" })
  ]);

  const taskRows = taskRes.data.values || [];
  const taskMap = new Map<string, { status: string; counted_qty: number; sales_qty: number; adjusted_count: number; gap: number; input_at: string }>();
  for (const row of taskRows) {
    const key = String(row[0] || "").trim();
    if (!key) continue;
    taskMap.set(key, {
      counted_qty: toNumber(row[7]),
      sales_qty: toNumber(row[8]),
      adjusted_count: toNumber(row[9]),
      gap: toNumber(row[10]),
      status: String(row[11] || ""),
      input_at: String(row[18] || "")
    });
  }

  const rows = stockRes.data.values || [];
  const items = rows
    .map((row, index) => {
      const sku = String(row[2] || "");
      const location = String(row[5] || "");
      const task = taskMap.get(taskKey(sku, location));
      return {
        row_number: index + 2,
        location_name: String(row[0] || ""),
        product_id: String(row[1] || ""),
        sku_number: sku,
        product_name: String(row[3] || ""),
        system_qty: toNumber(row[4]),
        location,
        last_update: String(row[6] || ""),
        active: String(row[7] || ""),
        price: toNumber(row[8]),
        product_type_name: String(row[9] || ""),
        counted: Boolean(task),
        counted_qty: task?.counted_qty ?? null,
        sales_qty: task?.sales_qty ?? null,
        adjusted_count: task?.adjusted_count ?? null,
        status: task?.status || "",
        gap: task?.gap ?? null,
        input_at: task?.input_at || ""
      };
    })
    .filter((item) => {
      const active = item.active.trim().toUpperCase();
      return item.sku_number.trim() && item.location.trim() && (active === "TRUE" || active === "");
    });

  const done = items.filter((item) => item.counted).length;
  return NextResponse.json({ success: true, items, total: items.length, done });
}
