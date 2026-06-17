# DCC Vercel Audit App

Aplikasi MVP untuk Daily Cycle Count:

- Login Google via NextAuth
- Lookup SKU + Location dari sheet `STOCK_MASTER`
- Operator hanya input `Qty Aktual Fisik`
- Submit ke `DCC_Task`
- Audit trail otomatis: email, nama, timestamp, device, session

## 1. Setup Google Cloud

1. Buat Google Cloud Project.
2. Enable Google Sheets API.
3. Buat Service Account.
4. Buat JSON key.
5. Ambil `client_email` dan `private_key`.
6. Share Google Sheet ke `client_email` sebagai Editor.

## 2. Setup Google OAuth

1. Buka Google Cloud Console.
2. APIs & Services -> Credentials.
3. Create OAuth Client ID.
4. Application type: Web application.
5. Authorized redirect URI lokal:
   `http://localhost:3000/api/auth/callback/google`
6. Authorized redirect URI production:
   `https://DOMAIN-VERCEL-KAMU.vercel.app/api/auth/callback/google`

## 3. Environment Variables

Copy `.env.example` ke `.env.local` untuk local development.

Di Vercel, isi variable yang sama di Project Settings -> Environment Variables.

Wajib:

- `SPREADSHEET_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ALLOWED_EMAILS` atau `ALLOWED_DOMAIN`

## 4. Local Run

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## 5. Deploy ke Vercel

1. Push folder ini ke GitHub.
2. Import project di Vercel.
3. Isi Environment Variables.
4. Deploy.
5. Tambahkan redirect URI production di Google OAuth.
6. Redeploy.

## 6. Catatan Mapping Sheet

Aplikasi menulis ke `DCC_Task` dengan urutan kolom:

1. Timestamp
2. SKU
3. Product_Name
4. Location/Sloc
5. System_Qty
6. Counted_Qty
7. Gap
8. Status_Sloc
9. Counter_ID
10. Note
11. Price
12. Product_Type
13. Counter_Name
14. Source
15. Task_ID
16. Input_Email
17. Input_Name
18. Input_User_ID
19. Input_At
20. Input_Source
21. Device_Info
22. Session_ID
23. Submit_Mode

Pastikan header `DCC_Task` di spreadsheet sesuai dengan mapping ini.
