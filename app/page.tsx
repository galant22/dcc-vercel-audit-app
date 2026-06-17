"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

type StockListItem = {
  row_number: number;
  sku_number: string;
  product_name: string;
  location: string;
  system_qty: number;
  price: number;
  product_type_name: string;
  counted: boolean;
  counted_qty: number | null;
  status: string;
  gap: number | null;
  input_at: string;
};

function formatDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" });
}

function DccPage() {
  const { data: session, status } = useSession();
  const [items, setItems] = useState<StockListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [done, setDone] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<StockListItem | null>(null);
  const [physicalQty, setPhysicalQty] = useState("0");
  const [salesQty, setSalesQty] = useState("0");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sessionId = useMemo(() => `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      item.location.toLowerCase().includes(q) ||
      item.sku_number.toLowerCase().includes(q) ||
      item.product_name.toLowerCase().includes(q)
    );
  }, [items, query]);

  const progress = total ? Math.min(100, (done / total) * 100) : 0;

  async function loadStockList() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/stock-list", { cache: "no-store" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Gagal load STOCK_MASTER");
      setItems(json.items || []);
      setTotal(json.total || 0);
      setDone(json.done || 0);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Gagal load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.user?.email) loadStockList();
  }, [session?.user?.email]);

  function openItem(item: StockListItem) {
    setSelected(item);
    setPhysicalQty(item.counted_qty !== null ? String(item.counted_qty) : "0");
    setSalesQty("0");
    setMessage("");
  }

  function closeItem() {
    setSelected(null);
    setMessage("");
  }

  async function submitSelected(forceStatus?: "Sesuai" | "Selisih") {
    if (!selected) return;
    setLoading(true);
    setMessage("");

    const physical = Number(physicalQty || 0);
    const sales = Number(salesQty || 0);
    const calculatedGap = physical + sales - selected.system_qty;
    const note = forceStatus === "Sesuai" && calculatedGap !== 0
      ? "Force sesuai dari DCC panel"
      : "";

    try {
      const res = await fetch("/api/submit-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sku: selected.sku_number,
          location: selected.location,
          counted_qty: physical,
          sales_qty: sales,
          note,
          device_info: navigator.userAgent,
          session_id: sessionId
        })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Submit gagal");

      const nextStatus = json.result.status;
      const nextGap = json.result.gap;
      const nextItems = items.map((item) => {
        const same = item.sku_number === selected.sku_number && item.location === selected.location;
        return same
          ? { ...item, counted: true, counted_qty: physical, status: nextStatus, gap: nextGap, input_at: new Date().toISOString() }
          : item;
      });
      setItems(nextItems);
      setDone(nextItems.filter((item) => item.counted).length);
      setSelected(null);
      setMessage(`Submit berhasil. Status: ${nextStatus}, Gap: ${nextGap}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Submit gagal");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading") return <main className="panel-shell">Loading...</main>;

  if (!session) {
    return (
      <main className="login-card">
        <h1>DCC PANEL</h1>
        <p>Login pakai akun Google operator. Identitas akun otomatis masuk audit trail.</p>
        <button onClick={() => signIn("google")}>Login Google</button>
      </main>
    );
  }

  const currentGap = selected ? Number(physicalQty || 0) + Number(salesQty || 0) - selected.system_qty : 0;

  return (
    <main className="panel-shell">
      <header className="panel-header">
        <div>
          <div className="title-row">
            <span className="back-icon">‹</span>
            <h1>DCC PANEL</h1>
          </div>
          <p className="user-line">✉ {session.user?.email}</p>
        </div>
        <div className="header-actions">
          <button className="icon-btn" type="button" onClick={loadStockList} disabled={loading}>↻</button>
          <button className="logout-btn" type="button" onClick={() => signOut()}>↱</button>
        </div>
      </header>

      <section className="progress-area">
        <div className="progress-label">
          <span>CYCLE COUNT PROGRESS</span>
          <b>{done}/{total}</b>
        </div>
        <div className="progress-track">
          <div className="progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </section>

      <section className="search-area">
        <span>⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari SLOC, SKU, atau produk..."
        />
      </section>

      <section className="list-area">
        {filteredItems.map((item) => (
          <button
            key={`${item.sku_number}|${item.location}`}
            className={`stock-card ${item.counted ? "done" : ""}`}
            type="button"
            onClick={() => openItem(item)}
          >
            <div>
              <div className="loc-pill">{item.location}</div>
              {item.counted && <span className="status-pill">{item.status || "SELESAI"}</span>}
              <p className="sku-line">SKU: {item.sku_number}</p>
              <h2>{item.product_name}</h2>
              {item.counted && (
                <p className="meta-line">▧ QTY: {item.counted_qty ?? 0} &nbsp; ◷ {formatDateTime(item.input_at)}</p>
              )}
            </div>
            <span className={`circle ${item.counted ? "checked" : ""}`}>{item.counted ? "✓" : ""}</span>
          </button>
        ))}
        {!loading && filteredItems.length === 0 && <p className="empty-state">Data tidak ditemukan.</p>}
      </section>

      {selected && (
        <div className="modal-backdrop">
          <section className="detail-modal">
            <div className="modal-head">
              <div className="cube-icon">▧</div>
              <div>
                <h2>Detail Cycle Count</h2>
                <p>ROW #{selected.row_number}</p>
              </div>
              <button className="close-btn" type="button" onClick={closeItem}>×</button>
            </div>

            <div className="detail-grid two">
              <div className="detail-box">
                <span>SLOC</span>
                <b>{selected.location}</b>
              </div>
              <div className="detail-box">
                <span>SYSTEM STOCK</span>
                <b>{selected.system_qty}</b>
              </div>
            </div>

            <div className="detail-box product-box">
              <span>PRODUK</span>
              <b>{selected.sku_number}</b>
              <strong>{selected.product_name}</strong>
            </div>

            <div className="detail-grid two">
              <label className="number-field">
                <span>KUANTITI FISIK</span>
                <input inputMode="numeric" value={physicalQty} onChange={(e) => setPhysicalQty(e.target.value)} />
              </label>
              <label className="number-field">
                <span>SALES</span>
                <input inputMode="numeric" value={salesQty} onChange={(e) => setSalesQty(e.target.value)} />
              </label>
            </div>

            <div className="gap-box">
              <span>(FISIK + SALES) - SYSTEM</span>
              <b className={currentGap === 0 ? "ok-gap" : "bad-gap"}>{currentGap}</b>
            </div>

            <div className="action-grid">
              <button className="ok-btn" type="button" disabled={loading} onClick={() => submitSelected("Sesuai")}>✓ SESUAI</button>
              <button className="bad-btn" type="button" disabled={loading} onClick={() => submitSelected("Selisih")}>⊗ TIDAK SESUAI</button>
            </div>
          </section>
        </div>
      )}

      {message && <p className="toast-message">{message}</p>}
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
