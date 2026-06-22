"use client";

import { useEffect, useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { SessionProvider } from "next-auth/react";

type FilterMode = "all" | "open" | "done" | "variance";
type SortMode = "location" | "sku" | "product" | "system_desc" | "system_asc" | "status";

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
  sales_qty?: number | null;
  adjusted_count?: number | null;
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
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [sortMode, setSortMode] = useState<SortMode>("location");
  const [selected, setSelected] = useState<StockListItem | null>(null);
  const [physicalQty, setPhysicalQty] = useState("0");
  const [salesQty, setSalesQty] = useState("0");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sessionId = useMemo(() => `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = items.filter((item) => {
      const matchesQuery = !q ||
        item.location.toLowerCase().includes(q) ||
        item.sku_number.toLowerCase().includes(q) ||
        item.product_name.toLowerCase().includes(q);

      if (!matchesQuery) return false;
      if (filterMode === "open") return !item.counted;
      if (filterMode === "done") return item.counted;
      if (filterMode === "variance") return item.counted && Number(item.gap || 0) !== 0;
      return true;
    });

    return [...base].sort((a, b) => {
      if (sortMode === "sku") return a.sku_number.localeCompare(b.sku_number);
      if (sortMode === "product") return a.product_name.localeCompare(b.product_name);
      if (sortMode === "system_desc") return b.system_qty - a.system_qty;
      if (sortMode === "system_asc") return a.system_qty - b.system_qty;
      if (sortMode === "status") return `${a.status || "ZZZ"}-${a.location}`.localeCompare(`${b.status || "ZZZ"}-${b.location}`);
      return a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [items, query, filterMode, sortMode]);

  const progress = total ? Math.min(100, (done / total) * 100) : 0;
  const openCount = total - done;
  const varianceCount = items.filter((item) => item.counted && Number(item.gap || 0) !== 0).length;

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
    setSalesQty(item.sales_qty !== null && item.sales_qty !== undefined ? String(item.sales_qty) : "0");
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
      const adjustedCount = json.result.adjusted_count ?? physical + sales;
      const nextItems = items.map((item) => {
        const same = item.sku_number === selected.sku_number && item.location === selected.location;
        return same
          ? { ...item, counted: true, counted_qty: physical, sales_qty: sales, adjusted_count: adjustedCount, status: nextStatus, gap: nextGap, input_at: new Date().toISOString() }
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
  const currentAdjusted = selected ? Number(physicalQty || 0) + Number(salesQty || 0) : 0;

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
        <div className="header-actions labeled-actions">
          <button className="header-action-btn refresh-action" type="button" onClick={loadStockList} disabled={loading} aria-label="Refresh data">
            <span className="header-action-icon">↻</span>
            <span className="header-action-label">Refresh</span>
          </button>
          <button className="header-action-btn logout-action" type="button" onClick={() => signOut()} aria-label="Logout">
            <span className="header-action-icon">↱</span>
            <span className="header-action-label">Logout</span>
          </button>
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

      <section className="toolbar-area">
        <div className="chip-row" aria-label="Filter list">
          <button className={filterMode === "all" ? "chip active" : "chip"} type="button" onClick={() => setFilterMode("all")}>Semua {total}</button>
          <button className={filterMode === "open" ? "chip active" : "chip"} type="button" onClick={() => setFilterMode("open")}>Belum {openCount}</button>
          <button className={filterMode === "done" ? "chip active" : "chip"} type="button" onClick={() => setFilterMode("done")}>Selesai {done}</button>
          <button className={filterMode === "variance" ? "chip active danger" : "chip danger"} type="button" onClick={() => setFilterMode("variance")}>Selisih {varianceCount}</button>
        </div>
        <label className="sort-select">
          <span>Sort</span>
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}>
            <option value="location">SLOC A-Z</option>
            <option value="sku">SKU A-Z</option>
            <option value="product">Produk A-Z</option>
            <option value="system_desc">System Qty terbesar</option>
            <option value="system_asc">System Qty terkecil</option>
            <option value="status">Status</option>
          </select>
        </label>
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
                <p className="meta-line">▧ QTY: {item.counted_qty ?? 0} + SALES: {item.sales_qty ?? 0} = {item.adjusted_count ?? 0} &nbsp; ◷ {formatDateTime(item.input_at)}</p>
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

            <div className="detail-grid qty-grid">
              <label className="number-field">
                <span>KUANTITI FISIK</span>
                <input inputMode="numeric" pattern="[0-9]*" value={physicalQty} onChange={(e) => setPhysicalQty(e.target.value)} />
              </label>
              <label className="number-field">
                <span>SALES</span>
                <input inputMode="numeric" pattern="[0-9]*" value={salesQty} onChange={(e) => setSalesQty(e.target.value)} />
              </label>
            </div>

            <div className="gap-box">
              <span>(FISIK + SALES) - SYSTEM<br /><small>Adjusted Count: {currentAdjusted}</small></span>
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
