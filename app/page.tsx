"use client";

import { useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

type LookupItem = {
  sku_number: string;
  product_name: string;
  location: string;
  system_qty: number;
  price: number;
  product_type_name: string;
};

function DccPage() {
  const { data: session, status } = useSession();
  const [location, setLocation] = useState("");
  const [sku, setSku] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [note, setNote] = useState("");
  const [item, setItem] = useState<LookupItem | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sessionId = useMemo(() => `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  async function lookup() {
    setLoading(true);
    setMessage("");
    setItem(null);
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, location })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Lookup gagal");
      if (!json.found) {
        setMessage("SKU + location tidak ditemukan di STOCK_MASTER.");
        return;
      }
      setItem(json.item);
      setMessage("Item ditemukan. Input qty aktual lalu submit.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Lookup gagal");
    } finally {
      setLoading(false);
    }
  }

  async function submitCount() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/submit-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku,
          location,
          counted_qty: Number(countedQty),
          note,
          device_info: navigator.userAgent,
          session_id: sessionId
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Submit gagal");
      setMessage(`Submit berhasil. Status: ${json.result.status}, Gap: ${json.result.gap}`);
      setSku("");
      setCountedQty("");
      setNote("");
      setItem(null);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Submit gagal");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") return <main className="card">Loading...</main>;

  if (!session) {
    return (
      <main className="card">
        <h1>DCC Audit App</h1>
        <p>Login pakai akun Google operator. Identitas akun akan otomatis masuk ke audit trail.</p>
        <button onClick={() => signIn("google")}>Login Google</button>
      </main>
    );
  }

  return (
    <main className="card">
      <div className="topbar">
        <div>
          <h1>DCC Audit App</h1>
          <p className="muted">Login sebagai {session.user?.email}</p>
        </div>
        <button className="secondary" onClick={() => signOut()}>Logout</button>
      </div>

      <label>Location / Rack / Bin</label>
      <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Contoh: L1-AMD-A7-T5-10" />

      <label>SKU / Barcode</label>
      <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Scan atau ketik SKU" />

      <button disabled={loading || !sku || !location} onClick={lookup}>Lookup Item</button>

      {item && (
        <section className="itembox">
          <b>{item.product_name}</b>
          <p>SKU: {item.sku_number}</p>
          <p>Location: {item.location}</p>
          <p>System Qty: {item.system_qty}</p>
          <p>Type: {item.product_type_name}</p>
        </section>
      )}

      <label>Qty Aktual Fisik</label>
      <input inputMode="numeric" value={countedQty} onChange={(e) => setCountedQty(e.target.value)} placeholder="Input qty aktual" />

      <label>Note Opsional</label>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: box sobek, barcode tidak jelas" />

      <button disabled={loading || !item || countedQty === ""} onClick={submitCount}>Submit Count</button>

      {message && <p className="message">{message}</p>}
    </main>
  );
}

export default function Page() {
  return (
    <SessionProvider>
      <DccPage />
    </SessionProvider>
  );
}
