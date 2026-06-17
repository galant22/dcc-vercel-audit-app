"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ScanTarget = "location" | "sku" | null;

function DccPage() {
  const { data: session, status } = useSession();
  const [location, setLocation] = useState("");
  const [sku, setSku] = useState("");
  const [countedQty, setCountedQty] = useState("");
  const [note, setNote] = useState("");
  const [item, setItem] = useState<LookupItem | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget>(null);
  const [scanStatus, setScanStatus] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);

  const sessionId = useMemo(() => `WEB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  function normalizeScanValue(value: string) {
    return value.trim();
  }

  function stopScanner() {
    if (scanFrameRef.current) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanTarget(null);
    setScanStatus("");
  }

  async function startScanner(target: Exclude<ScanTarget, null>) {
    const win = window as unknown as {
      BarcodeDetector?: new (options?: { formats?: string[] }) => {
        detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
      };
    };

    if (!win.BarcodeDetector) {
      setMessage("Browser belum support scan kamera. Silakan input manual, atau pakai Chrome Android terbaru.");
      return;
    }

    try {
      stopScanner();
      setMessage("");
      setScanTarget(target);
      setScanStatus(target === "location" ? "Arahkan kamera ke barcode/QR rack/bin." : "Arahkan kamera ke barcode SKU produk.");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      streamRef.current = stream;

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new win.BarcodeDetector({
        formats: ["qr_code", "ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "itf"]
      });

      const scanLoop = async () => {
        const video = videoRef.current;
        if (!video || !streamRef.current) return;

        try {
          const codes = await detector.detect(video);
          const rawValue = codes[0]?.rawValue;
          if (rawValue) {
            const value = normalizeScanValue(rawValue);
            if (target === "location") {
              setLocation(value.toUpperCase());
            } else {
              setSku(value);
            }
            setItem(null);
            setMessage((target === "location" ? "Location/Rack/Bin" : "SKU/Barcode") + " berhasil discan: " + value);
            stopScanner();
            return;
          }
        } catch {
          // Continue scanning until user stops it.
        }

        scanFrameRef.current = requestAnimationFrame(scanLoop);
      };

      scanFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      stopScanner();
      setMessage(err instanceof Error ? err.message : "Kamera tidak bisa dibuka. Coba izinkan permission kamera atau input manual.");
    }
  }

  useEffect(() => {
    return () => stopScanner();
  }, []);

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
      <div className="inputrow">
        <input value={location} onChange={(e) => { setLocation(e.target.value.toUpperCase()); setItem(null); }} placeholder="Contoh: L1-AMD-A7-T5-10" />
        <button className="scanbtn" type="button" onClick={() => startScanner("location")}>Scan</button>
      </div>

      <label>SKU / Barcode</label>
      <div className="inputrow">
        <input value={sku} onChange={(e) => { setSku(e.target.value); setItem(null); }} placeholder="Scan atau ketik SKU" />
        <button className="scanbtn" type="button" onClick={() => startScanner("sku")}>Scan</button>
      </div>

      {scanTarget && (
        <section className="scannerbox">
          <video ref={videoRef} className="scanner" muted playsInline />
          <p>{scanStatus}</p>
          <button className="secondary wide" type="button" onClick={stopScanner}>Stop Scanner</button>
        </section>
      )}

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
