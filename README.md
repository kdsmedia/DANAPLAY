# 🎮 DANAPLAY — Reward Platform

Platform reward di mana pengguna mendapatkan poin dengan menyelesaikan campaign aplikasi/game pihak ketiga. Poin ditukar menjadi uang via payout **DANA**.

> ⚠️ **Integrasi pihak ketiga (attribution & DANA payout) berjalan dalam mode MOCK / DEVELOPMENT.** Tidak ada klaim install terverifikasi atau uang benar-benar dipindahkan. Provider abstraction siap dipasang ke API resmi tanpa mengubah arsitektur utama.

---

## 📦 Stack

| Komponen | Teknologi |
|---|---|
| Backend | Node.js + Express + SQLite (better-sqlite3) |
| Auth | bcrypt (password hash) + JWT (Bearer token) |
| Mobile App | PWA (HTML/CSS/vanilla JS) — tanpa build step |
| Admin Panel | Responsive web (HTML/CSS/vanilla JS) — tanpa build step |
| Database | SQLite (file: `backend/data/danaplay.db`) |
| Provider | Attribution (mock) + Payout/DANA (mock) — swap via env |

---

## 📁 Struktur Folder

```
DANAPLAY/
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── src/
│   │   ├── config/index.js          # env config + defaults
│   │   ├── db/{index.js, schema.js, migrate.js, seed.js}
│   │   ├── middleware/auth.js       # JWT verify (user + admin)
│   │   ├── providers/{attribution.js, payout.js, index.js}
│   │   ├── routes/                  # auth, user, points, notifications,
│   │   │                            # campaigns, attribution, referrals,
│   │   │                            # withdrawals, adminAuth, admin
│   │   ├── services/                # audit, notifications, pointLedger,
│   │   │                            # campaignEngine, referral, fraud
│   │   ├── server.js                # Express app (serves /mobile + /admin)
│   │   └── utils/{index.js, http.js}
│   └── tests/e2e.js                 # 40 assertions end-to-end
├── mobile/                          # PWA mobile app
│   ├── index.html  app.css  manifest.json  app.js
│   └── src/{api/client.js, store.js, components.js, components/nav.js, pages.js, router.js}
├── admin/                           # admin web panel
│   ├── index.html  app.css
│   └── src/{api.js, ui.js, pages.js, app.js}
└── README.md
```

---

## 🗄️ Database Schema

Tabel (lihat `backend/src/db/schema.js` untuk DDL lengkap):

| Tabel | Kunci | Tujuan |
|---|---|---|
| `users` | id, phone (unique) | Akun pengguna + saldo poin |
| `admin_users` | id, username (unique) | Akun admin |
| `campaigns` | id | Definisi campaign |
| `campaign_milestones` | id, **(campaign_id, milestone_id) unique** | Reward bertahap |
| `campaign_users` | id, **(user_id, campaign_id) unique**, tracking_session_id | Enrollment + progress |
| `campaign_events` | id, **event_id unique** | Event attribution (idempotent) |
| `campaign_active_days` | id, **(campaign_user_id, day_date) unique** | Hari aktif unik |
| `milestone_rewards` | id, **(campaign_user_id, milestone_id) unique** | Anti double reward |
| `point_transactions` | id | Ledger (balance_before/after) |
| `withdrawals` | id | Permintaan payout DANA |
| `referrals` | id, **(inviter_id, invitee_id) unique** | Referral tracking |
| `notifications` | id | Notifikasi in-app |
| `fraud_flags` | id | Fraud detection |
| `audit_logs` | id | Audit trail (append-only) |
| `settings` | key | Konfigurasi dinamis |

**Poin disimpan sebagai integer** (tidak ada floating point). `points_per_rupiah = 1000` → `1 poin = Rp0,001`.

---

## 🔐 Environment Variables

Salin `backend/.env.example` → `backend/.env`:

```env
PORT=12000
JWT_SECRET=change-this-to-a-long-random-secret
JWT_EXPIRES_IN=7d
ADMIN_JWT_SECRET=change-this-admin-secret
ADMIN_JWT_EXPIRES_IN=12h

# Provider mode
ATTRIBUTION_PROVIDER=mock        # mock | real
ATTRIBUTION_API_KEY=
ATTRIBUTION_POSTBACK_SECRET=     # HMAC secret untuk verifikasi postback real

PAYOUT_PROVIDER=mock             # mock | dana
PAYOUT_API_KEY=
PAYOUT_MERCHANT_ID=

# Kurs & nominal (jangan hardcode di client)
POINTS_PER_RUPIAH=1000
WITHDRAWAL_DENOMINATIONS=200,500,1000,2000,5000,10000
WITHDRAWAL_MIN_POINTS=200000

# Referral
REFERRAL_BONUS_INVITER=50000
REFERRAL_BONUS_INVITEE=0
REFERRAL_QUALIFY_FIRST_CAMPAIGN=true
CAMPAIGN_TIMEZONE=Asia/Jakarta

# DB
DB_PATH=./data/danaplay.db
```

---

## ▶️ Cara Menjalankan

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env       # edit secrets
npm run seed               # buat admin + demo user + campaign
npm start                  # http://localhost:12000
```

Saat boot, server otomatis:
- Menjalankan migrations (`runMigrations()`)
- Melayani API di `/api/*`
- Melayani mobile app di `/mobile/`
- Melayani admin panel di `/admin/`

### 2. Mobile App (PWA)

Setelah backend berjalan, buka browser:
```
http://localhost:12000/mobile/
```
Atau dari Android: "Add to Home Screen" untuk pengalaman full-screen PWA.

**Demo login:** `081234567890` / `password123`

### 3. Admin Panel

```
http://localhost:12000/admin/
```
**Demo login:** `admin` / `admin123`

### 4. Jalankan Tests

```bash
cd backend
node tests/e2e.js           # 40 assertions
```

---

## 🔌 Menghubungkan Attribution Provider

Provider abstraction ada di `backend/src/providers/attribution.js`. Implementasi default: `MockAttributionProvider`.

Untuk provider real (mis. Adjust / AppsFlyer / Singular):

1. Set `ATTRIBUTION_PROVIDER=real` di `.env`
2. Implementasikan `RealAttributionProvider` dengan method:
   - `verifyPostback(rawBody, signature, headers)` — verifikasi HMAC/signature partner
   - `parseEvent(payload)` — normalisasi event ke schema internal
3. Partner mengirim postback server-to-server ke:
   ```
   POST /api/attribution/postback
   ```
   Body berisi: `event_id` (idempotency), `tracking_session_id` / `user_id`, `campaign_id`, `event_type` (INSTALL/FIRST_OPEN/DAILY_ACTIVE/LEVEL_REACHED/CAMPAIGN_COMPLETED/UNINSTALL), `event_time`, `device identifiers` (sesuai kebijakan privasi).

Backend mencari tracking session → cocokkan user_id + campaign_id → validasi → update status. **Tidak ada reward hanya dari klik download.**

> Saat `ATTRIBUTION_PROVIDER=mock`, gunakan endpoint test: `POST /api/attribution/postback` dengan body JSON (lihat `tests/e2e.js` untuk contoh). Tidak ada verifikasi HMAC.

---

## 💳 Menghubungkan Payout DANA

Provider abstraction ada di `backend/src/providers/payout.js`. Implementasi default: `MockPayoutProvider`.

Untuk DANA real (mis. DANA Disbursement API):

1. Set `PAYOUT_PROVIDER=dana` di `.env`
2. Isi `PAYOUT_API_KEY`, `PAYOUT_MERCHANT_ID`
3. Implementasikan `DanaPayoutProvider.disburse({ amount, destination, reference })`:
   - Panggil API DANA Disbursement
   - Return `{ success, providerReference, failureReason }`
4. Withdrawal flow:
   - User pilih nominal → input nomor DANA → konfirmasi
   - Backend **atomic**: lock saldo → debit poin (REDEEM) → buat withdrawal (PENDING)
   - Panggil `payoutProvider.disburse()`
   - Jika sukses → status COMPLETED
   - Jika gagal → status FAILED → **refund poin** (REFUND transaction) → user tidak kehilangan poin

> Saat `PAYOUT_PROVIDER=mock`, nomor DANA berakhirkang `0` menyimulasikan kegagalan (untuk testing refund). Tidak ada uang yang dipindahkan.

---

## 🌐 API Endpoints

### Auth
| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/auth/register` | Daftar (name, phone, password, referralCode?) |
| POST | `/api/auth/login` | Login (phone, password) → token |
| GET | `/api/auth/me` | Profil + saldo |
| POST | `/api/auth/logout` | Logout |

### User
| Method | Path | Deskripsi |
|---|---|---|
| PUT | `/api/user/profile` | Update nama |
| POST | `/api/user/change-password` | Ganti password |

### Points
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/points/balance` | Saldo poin + rupiah |
| GET | `/api/points/transactions` | Ledger (limit, offset, type) |

### Campaigns
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/campaigns` | Daftar campaign aktif |
| GET | `/api/campaigns/:id` | Detail + enrollment status |
| POST | `/api/campaigns/:id/click` | Catat click → tracking session → redirect URL |
| GET | `/api/campaigns/my/active` | Campaign aktif user |
| GET | `/api/campaigns/my/:id` | Detail progress (milestones, active days) |

### Attribution (partner → backend)
| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/attribution/postback` | Terima event attribution (idempotent via event_id) |

### Withdrawals
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/withdrawals/denominations` | Nominal tetap + status enabled |
| POST | `/api/withdrawals` | Buat withdrawal (amount, destination) |
| GET | `/api/withdrawals` | Riwayat withdrawal |

### Referrals & Notifications
| Method | Path | Deskripsi |
|---|---|---|
| GET | `/api/referrals` | Kode referral + statistik + daftar |
| GET | `/api/notifications` | Notifikasi in-app |
| POST | `/api/notifications/:id/read` | Tandai dibaca |

### Admin (`/api/admin/*`)
| Method | Path | Deskripsi |
|---|---|---|
| POST | `/api/admin/auth/login` | Admin login |
| GET | `/api/admin/auth/me` | Admin profil |
| GET | `/api/admin/dashboard` | Statistik agregat |
| GET/POST/PUT/PATCH | `/api/admin/users`, `/campaigns`, `/withdrawals`, ... | CRUD + status |
| GET | `/api/admin/points`, `/audit-logs`, `/referrals`, `/fraud` | Read-only lists |
| PUT | `/api/admin/settings` | Update setting |
| GET | `/api/admin/providers` | Status provider (mock/real) |

---

## 🔁 Authentication Flow

```
Register → hash password (bcrypt) → insert user → issue JWT
Login → verify bcrypt → issue JWT (7d)
Request → Authorization: Bearer <jwt> → middleware/auth.js → req.user
Logout → client drop token (stateless)
```

Password **tidak pernah** disimpan plaintext. JWT signed dengan `JWT_SECRET`.

---

## 🎯 Campaign Flow

```
User lihat campaign → klik DOWNLOAD
  → backend catat click + generate tracking_session_id
  → status: CLICKED
  → redirect ke tracking_url (Google Play)

Partner kirim INSTALL postback (event_id unik)
  → cari tracking session → cocokkan user_id + campaign_id
  → status: INSTALLED → award install milestone (EARN)

Partner kirim FIRST_OPEN → status: ACTIVE → catat active day

Setiap hari: DAILY_ACTIVE event
  → catat active day unik (campaign_user_id + day_date unique)
  → cek milestone (day 5/10/15) → award reward (unique constraint)

active_days >= required_days → status: COMPLETED → award final reward

UNINSTALL signal (jika partner menyediakan) sebelum selesai
  → status: FAILED → reward penyelesaian tidak diberikan
```

**Reward tidak diberikan hanya karena klik download.** Semua reward diverifikasi server-side via event attribution.

---

## 💰 Reward Calculation

- `reward_total` disimpan di campaign (integer poin)
- Milestone reward: `milestone_rewards` table, **unique (campaign_user_id, milestone_id)** → anti double reward
- Poin masuk via `pointLedger.credit()` → record EARN dengan balance_before/after
- Kurs: `1 Rp = 1000 poin` (configurable via `POINTS_PER_RUPIAH`)
- **Tidak ada floating point** — semua poin & rupiah integer

---

## 💸 Withdrawal Flow (Atomic)

```
User pilih nominal tetap (Rp200/500/1000/2000/5000/10000)
  → cek saldo cukup (server-side)
  → cek nominal valid (hanya dari daftar, no custom)
  → DB TRANSACTION (atomic):
      - lock user row
      - cek saldo lagi (race condition safe)
      - debit poin (REDEEM ledger)
      - insert withdrawal (PENDING)
  → panggil payoutProvider.disburse()
  → sukses: status COMPLETED
  → gagal: status FAILED → refund poin (REFUND ledger) → user tidak rugi
```

---

## 🎁 Referral Flow (Anti-Fraud)

```
User A punya kode referral unik (e.g. KDS8291)
User B daftar dengan kode A → referral record (inviter=A, invitee=B)
  → unique (inviter_id, invitee_id) → anti duplikat
  → self-referral dicegah (invitee != inviter)
Bonus referral TIDAK langsung diberikan saat daftar.

User B menyelesaikan campaign pertama
  → campaignEngine.tryReferralQualification()
  → jika REFERRAL_QUALIFY_FIRST_CAMPAIGN=true → award bonus
  → EARN (inviter) + optional EARN (invitee), type=REFERRAL
  → status referral: BONUS_PAID
```

Anti-abuse: self-referral, referral berulang, multi-account detection (fraud flags).

---

## 🛡️ Fraud Prevention

- **Idempotency**: `event_id` unique di `campaign_events` → postback duplikat diabaikan
- **Double reward**: `milestone_rewards` unique constraint
- **Self-referral**: cek `inviter_id != invitee_id`
- **Multi-account**: fraud flag berdasarkan device/app identifiers (jika tersedia, sesuai privasi) — tidak hanya IP
- **Install berulang**: `campaign_users` unique (user_id, campaign_id)
- **Active day unik**: `campaign_active_days` unique (campaign_user_id, day_date)
- **Server-side authority**: client tidak menentukan saldo/reward — semua via backend
- **Rate limiting**: auth endpoints dibatasi
- **Audit log**: semua aksi admin & perubahan penting tercatat (append-only, tidak bisa dihapus)

> Admin **tidak dapat** menghapus transaksi keuangan permanen. Hanya adjust via ledger (ADJUSTMENT type) dengan audit trail.

---

## 🧪 Testing Instructions

```bash
cd backend
node tests/e2e.js
```

Test mencakup (40 assertions):
1. Register + duplicate phone rejection + weak password rejection
2. Referral code validation + self-referral block
3. Login + JWT auth
4. Campaign list + milestones
5. Attribution: install → first_open → 15 daily active days
6. Milestone rewards (4 milestones, unique constraint)
7. Campaign completion → final reward
8. Duplicate event (idempotency) → no double reward
9. Referral bonus triggered on invitee first campaign
10. Withdrawal denominations gating (enabled/disabled by balance)
11. Custom nominal rejection + invalid DANA rejection
12. Withdrawal COMPLETED + FAILED + refund
13. Ledger types (EARN, REDEEM, REFUND) + balance_before/after
14. Notifications present
15. Admin dashboard stats
16. No DELETE on transactions (audit trail)
17. No client-side balance mutation endpoint

---

## 🚀 Production Deployment

1. **Backend**:
   - Set semua env secrets (`JWT_SECRET`, `ADMIN_JWT_SECRET` panjang & acak)
   - Ganti `admin/admin123` password default (seed admin) — atau hapus seed admin, buat via CLI
   - Gunakan PostgreSQL/MySQL untuk skala (ganti better-sqlite3 → driver lain; schema.js DDL kompatibel)
   - Jalankan di belakang reverse proxy (nginx) dengan TLS/HTTPS
   - `ATTRIBUTION_PROVIDER=real`, `PAYOUT_PROVIDER=dana`
   - Set `ATTRIBUTION_POSTBACK_SECRET` untuk verifikasi HMAC postback partner

2. **Mobile App**: build ke Android via WebView wrapper (Capacitor/Cordova) membungkus PWA, atau deploy sebagai PWA. Karena sudah PWA, "Add to Home Screen" di Android menghasilkan app-like experience.

3. **Admin Panel**: serve sebagai static files (sudah di-serve backend di `/admin/`)

4. **Database backup**: `backend/data/danaplay.db` — schedule backup rutin

5. **Monitoring**: audit_logs + fraud_flags untuk deteksi anomali

---

## ⚠️ Catatan Provider

| Provider | Status | Deskripsi |
|---|---|---|
| Attribution | **MOCK / DEVELOPMENT** | Simulated events. Tidak ada klaim install terverifikasi. |
| Payout (DANA) | **MOCK / DEVELOPMENT** | Tidak ada uang dipindahkan. Nomor berakhirkang `0` simulasikan kegagalan. |

Saat mode MOCK aktif, UI admin menampilkan badge `MOCK / DEVELOPMENT` agar jelas terpisah dari production. Ganti ke provider real hanya saat credential/API resmi tersedia.

---

## 📱 Halaman Aplikasi (Mobile)

```
/splash  /login  /register  /home
/campaigns  /campaign/:id  /my-campaigns  /campaign/:id/progress
/redeem  /withdrawals  /points-history  /referral
/profile  /change-password  /notifications
```

## 🖥️ Halaman Admin

```
/admin/login  /admin/dashboard
/admin/users  /admin/campaigns  /admin/campaign-users
/admin/points  /admin/withdrawals  /admin/referrals
/admin/fraud  /admin/settings  /admin/audit-logs
```

---

Dibuat oleh OpenHands AI agent atas permintaan user.
