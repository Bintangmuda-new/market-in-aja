# 🌾 Market-In Aja — Platform Agritech Sama-Tani

Platform lokapasar tiga sisi (three-sided marketplace) yang menghubungkan **Petani**, **Pengepul**, dan **Distributor** secara real-time di Indonesia.

---

## 🏗️ Tech Stack

| Layer | Teknologi |
|---|---|
| Mobile Frontend | React Native (Expo SDK 50+) + NativeWind |
| State Management | Zustand + React Query (TanStack) |
| Backend / Database | Supabase (PostgreSQL + PostGIS) |
| Real-Time | Supabase Realtime (WebSocket) |
| Video / Audio Call | Agora React Native SDK |
| Payment / Escrow | Xendit (xenplatform) |
| Location Tracking | @react-native-community/geolocation |

---

## 📂 Struktur Proyek

```
market-in-aja/
├── src/
│   ├── components/        # UI components yang dapat digunakan ulang
│   ├── screens/           # Screen utama per fitur
│   ├── store/             # Zustand global state stores
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API service layer (Supabase, Xendit, Agora)
│   ├── navigation/        # React Navigation stack & tab config
│   ├── types/             # TypeScript type definitions
│   └── utils/             # Helper functions
├── supabase/
│   ├── migrations/        # SQL migration files
│   └── functions/         # Edge Functions (Deno)
├── app.json
├── package.json
└── tailwind.config.js
```

---

## 🚀 Cara Menjalankan

```bash
# 1. Install dependencies
npm install

# 2. Salin environment variables
cp .env.example .env
# Isi nilai di .env dengan kredensial Supabase, Agora, dan Xendit Anda

# 3. Jalankan migrasi database
npx supabase db push

# 4. Deploy Edge Functions
npx supabase functions deploy location-tracker
npx supabase functions deploy generate-agora-token
npx supabase functions deploy xendit-webhook

# 5. Jalankan aplikasi
npx expo start
```

---

## 🔐 Fitur Keamanan

- **ACC Validitas Data**: Setiap akun baru berstatus `pending` dan harus dikurasi admin sebelum aktif
- **Row Level Security (RLS)**: Akun `pending` diblokir dari semua operasi tulis di level database
- **Idempotency Keys**: Mencegah duplikasi posting via UUID v4 di header `Idempotency-Key`
- **Escrow Xendit**: Dana Pengepul ditahan platform hingga Petani mengkonfirmasi penerimaan barang
- **Edit Timeout**: Produk tidak dapat diedit setelah 24 jam dari waktu pembuatan

---

## 👥 Peran Pengguna

| Peran | Aksi Utama |
|---|---|
| **Petani** | Membuat etalase digital, mengunggah panen, menerima pembayaran escrow |
| **Pengepul** | Mencari panen berdasarkan lokasi, bernegosiasi via chat/video, membeli via escrow |
| **Distributor** | Menawarkan jasa logistik, melacak posisi GPS real-time, menerima split payment |
| **Admin** | Mengkurasi akun baru, memoderasi konten, memantau transaksi |

---

*Proyek ini merupakan bagian dari inisiatif **Sama-Tani** untuk digitalisasi ekosistem pertanian Indonesia.*
