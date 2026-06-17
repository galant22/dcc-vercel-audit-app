import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const DCC_START_ROW = 5;
const DCC_END_ROW = 1000;

function getPrivateKey(): string {
  const key = process.env.GOOGLE_PRIVATE_KEY || "";
  return key.replace(/\\n/g, "\n");
}

export async function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: getPrivateKey(),
    scopes: SCOPES
  });

  await auth.authorize();
  return google.sheets({ version: "v4", auth });
}

export function spreadsheetId(): string {
  const id = process.env.SPREADSHEET_ID;
  if (!id) throw new Error("SPREADSHEET_ID is missing");
  return id;
}

export type StockRow = {
  location_name: string;
  product_id: string;
  sku_number: string;
  product_name: string;
  quantity: number;
  rack_name: string;
  last_update: string;
  active: string;
  price: number;
  product_type_name: string;
};

export async function lookupStock(sku: string, location: string): Promise<StockRow | null> {
  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId(),
    range: "STOCK_MASTER!A2:J50000"
  });

  const rows = res.data.values || [];
  const targetSku = sku.trim();
  const targetLocation = location.trim().toUpperCase();

  for (const row of rows) {
    const rackName = String(row[5] || "").trim().toUpperCase();
    const skuNumber = String(row[2] || "").trim();
    if (skuNumber === targetSku && rackName === targetLocation) {
      return {
        location_name: String(row[0] || ""),
        product_id: String(row[1] || ""),
        sku_number: skuNumber,
        product_name: String(row[3] || ""),
        quantity: Number(row[4] || 0),
        rack_name: String(row[5] || ""),
        last_update: String(row[6] || ""),
        active: String(row[7] || ""),
        price: Number(row[8] || 0),
        product_type_name: String(row[9] || "")
      };
    }
  }

  return null;
}

export async function writeDccTask(taskId: string, values: unknown[]) {
  const sheets = await getSheetsClient();
  const id = spreadsheetId();
  const readRange = "DCC_Task!A" + DCC_START_ROW + ":W" + DCC_END_ROW;

  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId: id,
    range: readRange
  });

  const rows = existing.data.values || [];
  let targetRow = DCC_START_ROW;

  const existingIndex = rows.findIndex((row) => String(row[0] || "") === taskId);
  if (existingIndex >= 0) {
    targetRow = DCC_START_ROW + existingIndex;
  } else {
    const emptyIndex = rows.findIndex((row) => {
      const task = String(row[0] || "").trim();
      const sku = String(row[4] || "").trim();
      const countedQty = String(row[7] || "").trim();
      return !task && !sku && !countedQty;
    });
    targetRow = emptyIndex >= 0 ? DCC_START_ROW + emptyIndex : DCC_START_ROW + rows.length;
  }

  const writeRange = "DCC_Task!A" + targetRow + ":W" + targetRow;
  return sheets.spreadsheets.values.update({
    spreadsheetId: id,
    range: writeRange,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] }
  });
}
