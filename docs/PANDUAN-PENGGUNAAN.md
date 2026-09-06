# Panduan Penggunaan Kripta

Panduan lengkap memakai Kripta, brankas 2FA (OTP/TOTP) yang self-hosted dan zero-knowledge. Dokumen ini untuk pengguna akhir dan admin.

> Catatan bahasa: antarmuka default berbahasa Inggris dan bisa diganti ke Bahasa Indonesia lewat tombol bahasa. Label tombol di panduan ini ditulis dalam Bahasa Inggris (default), dengan padanan Indonesianya dalam tanda kurung bila perlu.

---

## Daftar isi

1. [Konsep penting sebelum mulai](#1-konsep-penting-sebelum-mulai)
2. [Instalasi pertama (membuat superadmin)](#2-instalasi-pertama-membuat-superadmin)
3. [Masuk dan membuka vault](#3-masuk-dan-membuka-vault)
4. [Menambahkan akun 2FA](#4-menambahkan-akun-2fa)
5. [Memakai kode OTP](#5-memakai-kode-otp)
6. [Mengelola akun (edit, hapus, urutkan)](#6-mengelola-akun-edit-hapus-urutkan)
7. [Pencarian cepat dan Command Palette](#7-pencarian-cepat-dan-command-palette)
8. [Mengunci vault](#8-mengunci-vault)
9. [Pengaturan (Settings)](#9-pengaturan-settings)
10. [Admin: mengelola pengguna, undangan, dan audit log](#10-admin-mengelola-pengguna-undangan-dan-audit-log)
11. [Bergabung lewat undangan (pengguna baru)](#11-bergabung-lewat-undangan-pengguna-baru)
12. [Lupa password dan pemulihan dengan recovery code](#12-lupa-password-dan-pemulihan-dengan-recovery-code)
13. [Memasang sebagai aplikasi (PWA)](#13-memasang-sebagai-aplikasi-pwa)
14. [Keamanan dan praktik terbaik](#14-keamanan-dan-praktik-terbaik)
15. [Pemecahan masalah (troubleshooting)](#15-pemecahan-masalah-troubleshooting)
16. [FAQ](#16-faq)

---

## 1. Konsep penting sebelum mulai

Kripta dirancang **zero-knowledge**: semua rahasia OTP dienkripsi di browser kamu sebelum dikirim ke server. Server hanya menyimpan ciphertext dan hash, tidak pernah tahu isi aslinya.

Tiga hal yang wajib kamu pahami:

- **Password kamu adalah kunci enkripsi.** Password bukan sekadar untuk login, tapi dipakai untuk membuka (mendekripsi) seluruh isi vault di perangkatmu.
- **Recovery code adalah satu-satunya cadangan.** Jika lupa password, hanya recovery code yang bisa memulihkan akses. Server tidak menyimpannya dan tidak bisa menampilkannya ulang.
- **Lupa password tanpa recovery code = data hilang permanen.** Ini konsekuensi dari desain zero-knowledge. Tidak ada admin yang bisa "mereset" isi vault kamu.

---

## 2. Instalasi pertama (membuat superadmin)

Langkah ini hanya dilakukan sekali, oleh orang yang memasang Kripta.

1. Buka URL Kripta (mis. `https://domain-kamu`). Kamu otomatis diarahkan ke halaman **/install**.
2. Isi:
   - **Superadmin email** (Email superadmin).
   - **Password** minimal 8 karakter. Pilih password yang kuat, karena ini menjadi kunci enkripsi vault dan tidak bisa direset tanpa recovery code.
   - **Repeat password** (Ulangi password).
3. Klik **Create superadmin** (Buat superadmin).
4. **Recovery code akan ditampilkan satu kali.** Klik **Copy recovery code** (Salin recovery code) dan simpan di tempat aman (password manager, kertas di brankas, dll).
5. Centang **"I have saved my recovery code..."** lalu klik **Continue to vault** (Lanjut ke vault).

Setelah ini, halaman `/install` tidak bisa dipakai lagi. Pendaftaran pengguna berikutnya hanya lewat undangan (lihat bagian Admin).

---

## 3. Masuk dan membuka vault

1. Buka halaman utama, kamu akan diarahkan ke **/login**.
2. Isi **Email** dan **Password**, klik **Sign in** (Masuk).
3. Setelah masuk, vault terbuka. Bila suatu saat vault dalam keadaan terkunci, akan muncul layar **Vault locked** (Vault terkunci): masukkan password lalu klik **Unlock vault** (Buka vault).

Kenapa kadang harus memasukkan password lagi meski sudah login? Karena kunci enkripsi hanya disimpan di memori browser, bukan di server. Saat kamu menutup/refresh tab atau menekan tombol kunci, kunci itu hilang dari memori dan perlu dimasukkan ulang untuk mendekripsi vault. Sesi login (identitas) dan kunci enkripsi (isi vault) adalah dua hal terpisah.

---

## 4. Menambahkan akun 2FA

Klik tombol tambah (**Add** / Tambah) atau **Add account** saat vault masih kosong. Ada tiga cara:

### a. Scan QR (tab "Scan")
1. Pilih tab **Scan**.
2. Izinkan akses kamera saat diminta.
3. Arahkan kamera ke QR code 2FA dari layanan (GitHub, Google, dll). Deteksi berjalan otomatis begitu QR terbaca.

> Jika muncul "Camera permission denied", aktifkan izin kamera di browser lalu coba lagi. Kamera hanya bisa diakses di konteks aman (HTTPS atau localhost).

### b. Unggah gambar QR (tab "Image" / Gambar)
1. Pilih tab **Image**.
2. Klik **Choose a QR code image** (Pilih gambar QR code) dan pilih file PNG/JPG atau screenshot yang berisi QR.
3. Kripta akan membaca QR dari gambar itu. Jika tidak terbaca, muncul "No QR code detected".

### c. Input manual (tab "Manual")
Dipakai kalau layanan memberi kode rahasia (secret) berupa teks, bukan QR.

1. Pilih tab **Manual**.
2. Isi:
   - **Service name (issuer)** — nama layanan, contoh: GitHub.
   - **Account / email (optional)** — akun/email, opsional.
   - **Secret key** — kunci rahasia dalam format Base32 (huruf A-Z dan angka 2-7). Jika salah format, muncul "Invalid Base32 secret".
3. (Opsional) Buka **Advanced options** (Opsi lanjutan) untuk menyesuaikan:
   - **Type**: `TOTP (time)` untuk kode berbasis waktu (paling umum) atau `HOTP (counter)` untuk berbasis penghitung.
   - **Algorithm**: SHA1 (default umum), SHA256, atau SHA512.
   - **Digits**: jumlah digit kode (biasanya 6).
   - **Period (seconds)**: masa berlaku kode TOTP (biasanya 30 detik).
4. Klik **Add account** / **Save** (Tambah akun/Simpan).

> Sesuaikan opsi lanjutan hanya jika layanan memintanya. Mayoritas layanan memakai TOTP, SHA1, 6 digit, 30 detik.

---

## 5. Memakai kode OTP

Di daftar vault, tiap akun menampilkan:

- **Kode OTP** yang sedang aktif.
- **Indikator waktu / countdown** untuk kode TOTP (kapan kode berganti).
- **Next code** (Kode berikutnya) sebagai pratinjau kode selanjutnya.

Cara memakai:

- Klik kartu akun atau ikon salin untuk **menyalin kode** ke clipboard (muncul notifikasi "Copied"/Tersalin). Tempel kode itu di halaman login layanan yang bersangkutan.
- Untuk akun **HOTP (counter)**, kode berganti tiap kali digunakan/di-generate, bukan berdasarkan waktu.

---

## 6. Mengelola akun (edit, hapus, urutkan)

Buka **menu akun** (Account menu) pada tiap kartu:

- **Edit** — ubah nama layanan (issuer) atau label akun, lalu **Save changes** (Simpan perubahan).
- **Delete** (Hapus) — muncul konfirmasi. Perhatikan peringatannya: menghapus berarti kamu kehilangan akses 2FA untuk akun itu bila belum punya cadangan. Tindakan ini tidak bisa dibatalkan.

**Mengurutkan (reorder):** tahan (drag) kartu untuk memindahkan posisinya. Urutan akan tersimpan. Petunjuk "Hold to reorder" (Tahan untuk geser) muncul sebagai bantuan.

---

## 7. Pencarian cepat dan Command Palette

- **Kotak pencarian** di halaman vault: ketik untuk memfilter akun berdasarkan nama layanan atau label.
- **Command Palette**: tekan **`Cmd + K`** (macOS) atau **`Ctrl + K`** (Windows/Linux). Ketik nama akun, lalu pilih untuk langsung menyalin kodenya tanpa perlu menggulir daftar. Tekan **`Esc`** untuk menutup.

Ini cara tercepat menyalin kode saat kamu punya banyak akun.

---

## 8. Mengunci vault

Klik tombol **Lock** (Kunci) untuk mengunci vault secara manual. Ini menghapus kunci enkripsi dari memori sehingga isi vault tidak bisa dibaca sampai kamu memasukkan password lagi lewat layar **Unlock vault**.

Gunakan ini ketika meninggalkan perangkat sejenak. Menutup atau me-refresh tab juga otomatis mengunci vault (kunci tidak pernah disimpan permanen di browser).

---

## 9. Pengaturan (Settings)

Buka menu **Settings** (Pengaturan). Tersedia:

### Ganti password
1. Bagian **Change password** (Ganti password).
2. Isi **Current password**, **New password** (minimal 8 karakter), dan **Repeat new password**.
3. Simpan. Setelah berhasil, **semua sesi lain otomatis dikeluarkan** demi keamanan.

> Karena password adalah kunci enkripsi, mengganti password akan membungkus ulang kunci vault dengan password baru. Vault harus dalam keadaan terbuka (unlocked) saat mengganti password.

### Export vault (username + secret)

Mengunduh seluruh akun beserta **secret TOTP mentahnya**, misalnya untuk pindah aplikasi, backup pribadi, atau mengisi konfigurasi otomasi.

1. Buka **Settings** > **Export vault**.
2. Vault harus dalam keadaan terbuka (unlocked).
3. Pilih format:
   - **JSON** - seluruh field (`issuer`, `label`, `secret`, `type`, `algorithm`, `digits`, `period`, `counter`). Paling mudah diolah skrip.
   - **CSV** - kolom yang sama, cocok dibuka di spreadsheet.
   - **URI otpauth** - satu baris `otpauth://` per akun, bisa diimpor aplikasi 2FA lain.
4. Berkas langsung terunduh dengan nama `kripta-export-<tanggal>-<jam>.<ekstensi>`.

Beberapa hal penting:

- Dekripsi terjadi **sepenuhnya di browser**. Berkas hasilnya tidak pernah melewati server, jadi model zero-knowledge tetap utuh.
- Yang dikirim ke server hanyalah jejak audit (`vault.exported`) berisi format dan jumlah akun - tanpa isi apa pun.
- Berkasnya berisi secret dalam teks biasa. Siapa pun yang memilikinya bisa membuat kode Anda selamanya, tanpa perlu password. Simpan terenkripsi dan hapus setelah dipakai.
- Pada format URI, akun dengan secret yang bukan Base32 valid akan dilewati dan jumlahnya dilaporkan. Format JSON dan CSV tetap memuat semuanya apa adanya.
- Export tidak tersedia lewat API. Token API hanya mengembalikan kode berjalan, bukan secret.

### Sesi aktif (Active sessions)
- Melihat daftar sesi aktif beserta IP dan perangkat, serta menandai **"this session"** (sesi ini).
- **Sign out other sessions** (Keluarkan sesi lain) untuk mengakhiri sesi di perangkat lain tanpa memengaruhi sesi saat ini.

### Keluar
- **Sign out of Kripta** (Keluar dari Kripta) untuk mengakhiri sesi ini.

### Bahasa dan tema
- **Language** (Bahasa): pilih English atau Bahasa Indonesia. Pilihan tersimpan di perangkat.
- **Tema**: tombol ganti tema untuk mode gelap/terang.

---

## 10. Admin: mengelola pengguna, undangan, dan audit log

Menu **Admin** hanya tersedia untuk **Superadmin**. Terdiri dari tiga tab.

### Tab Users (Pengguna)
Melihat semua pengguna beserta peran, jumlah item, dan info login terakhir. Tindakan:

- **Disable / Enable** (Nonaktifkan/Aktifkan) — pengguna nonaktif tidak bisa login (ditandai "Disabled").
- **Delete user** (Hapus user) — menghapus pengguna beserta **seluruh vault-nya** secara permanen. Ada konfirmasi.

### Tab Invites (Undangan)
Pendaftaran hanya lewat undangan.

1. Klik **Create invite** (Buat undangan).
2. (Opsional) isi **Email** calon pengguna dan pilih **Role** (Peran): User atau Superadmin.
3. Klik **Create** (Buat).
4. **Tautan undangan ditampilkan sekali saja.** Klik **Copy link** (Salin tautan) dan kirimkan ke calon pengguna melalui kanal yang aman.

Status undangan terlihat sebagai **Pending** (Menunggu), **Used** (Dipakai), atau **Expired** (Kedaluwarsa). Undangan yang belum dipakai bisa **Revoke invite** (Cabut undangan).

### Tab Audit log
Riwayat aktivitas penting: login berhasil/gagal, akun terkunci, undangan dibuat/dicabut/diterima, pengguna dinonaktifkan/dihapus, ganti password, pemulihan akun, sesi dicabut, dan item vault dibuat/diubah/dihapus. Audit log **tidak pernah** mencatat isi rahasia apa pun.

---

## 11. Bergabung lewat undangan (pengguna baru)

1. Buka tautan undangan yang kamu terima dari admin.
2. Jika tautan valid, muncul halaman **Create account** (Buat akun). (Jika sudah dipakai/kedaluwarsa, muncul "Invalid invitation".)
3. Buat **Password** (minimal 8 karakter) dan **Repeat password**. Ingat: password ini menjadi kunci enkripsi vault kamu.
4. Klik **Create account** (Buat akun).
5. **Simpan recovery code** yang ditampilkan, sama seperti alur superadmin. Ini satu-satunya cadangan akses kamu.

---

## 12. Lupa password dan pemulihan dengan recovery code

1. Di halaman login, klik **"Forgot password? Recover with a recovery code"** (Lupa password? Pulihkan dengan recovery code).
2. Masukkan **Email** dan **Recovery code** yang dulu kamu simpan, klik **Verify** (Verifikasi).
3. Setelah terverifikasi, buat **New password** (Password baru) dan **Repeat new password**, lalu **Save new password** (Simpan password baru).
4. Semua sesi lama otomatis dikeluarkan. Masuk kembali dengan password baru.

> Tanpa recovery code, akun **tidak bisa** dipulihkan dan isi vault hilang permanen. Tidak ada pengecualian, termasuk untuk superadmin.

---

## 13. Memasang sebagai aplikasi (PWA)

Kripta adalah Progressive Web App, bisa dipasang seperti aplikasi:

- **Desktop (Chrome/Edge):** klik ikon install di address bar, atau menu browser lalu "Install".
- **Android (Chrome):** menu tiga titik lalu "Add to Home screen" / "Install app".
- **iOS (Safari):** tombol Share lalu "Add to Home Screen".

Setelah dipasang, Kripta bisa dibuka dari ikon aplikasi dan tampil layar penuh.

---

## 14. Keamanan dan praktik terbaik

Perlindungan bawaan Kripta:

- **Enkripsi zero-knowledge:** rahasia OTP dienkripsi (AES-GCM) di perangkat; server hanya menyimpan ciphertext.
- **Kunci turunan password:** memakai Argon2id dan HKDF; server memverifikasi login lewat hash, bukan password asli.
- **Anti brute force:** setelah **8 kali** gagal login, akun terkunci sementara selama **15 menit**. Ada pula pembatasan laju (rate limit) per IP.
- **Sesi aman:** cookie httpOnly, proteksi CSRF, dan pengecekan origin. Masa sesi maksimal **30 hari** dengan idle timeout **12 jam** (otomatis logout bila tidak aktif).
- **Audit log** untuk aktivitas penting, tanpa mencatat rahasia.

Yang perlu kamu lakukan:

1. **Simpan recovery code** di tempat aman dan terpisah dari perangkat utama.
2. **Pakai password yang kuat dan unik.** Ini kunci enkripsi, bukan sekadar kata sandi login.
3. **Kunci vault** saat meninggalkan perangkat.
4. **Backup database** secara berkala (lihat README bagian Backup). Database hanya berisi ciphertext dan hash, jadi aman untuk dicadangkan, tetapi tetap simpan dengan hati-hati.
5. **Selalu akses lewat HTTPS.** Jangan memasukkan password di koneksi non-HTTPS.

---

## 15. Pemecahan masalah (troubleshooting)

| Gejala | Kemungkinan penyebab | Solusi |
| --- | --- | --- |
| Login/aksi ditolak "Origin tidak valid" (403) | `APP_URL` tidak sama dengan URL yang dibuka di browser | Set `APP_URL` ke origin publik yang benar (mis. `https://domain-kamu`), lalu jalankan ulang `docker-compose up -d` |
| Tidak bisa login lewat HTTP setelah HTTPS aktif | `AUTH_COOKIE_SECURE=true` membuat cookie hanya terkirim via HTTPS | Akses lewat `https://`, bukan `http://` |
| "Akun terkunci sementara" (429) | Terlalu banyak percobaan login gagal (8x) | Tunggu 15 menit, lalu coba lagi dengan password benar |
| "Terlalu banyak percobaan login" (429) | Rate limit per IP | Tunggu beberapa saat sebelum mencoba lagi |
| Kamera tidak bisa dipakai untuk scan | Izin kamera ditolak atau bukan konteks aman | Aktifkan izin kamera; pastikan diakses via HTTPS/localhost; atau pakai tab Image/Manual |
| "Invalid Base32 secret" saat input manual | Format secret salah | Pastikan secret hanya berisi A-Z dan 2-7, tanpa spasi |
| Kode OTP ditolak layanan | Jam perangkat tidak sinkron, atau parameter salah | Sinkronkan waktu perangkat; cek Type/Algorithm/Digits/Period di Advanced options |
| Halaman menampilkan 502 Bad Gateway | Reverse proxy tidak bisa menjangkau aplikasi | Pastikan container aplikasi berjalan dan port internalnya benar |
| Lupa password dan tidak punya recovery code | - | Data tidak bisa dipulihkan (desain zero-knowledge). Buat akun baru |

---

## 16. FAQ

**Apakah admin bisa melihat kode OTP saya?**
Tidak. Semua rahasia dienkripsi dengan kunci turunan password kamu. Bahkan operator server tidak bisa membacanya.

**Apakah bisa dipakai banyak orang?**
Ya. Superadmin mengundang pengguna lain lewat tautan undangan. Tiap pengguna punya vault terenkripsi sendiri.

**Apa beda TOTP dan HOTP?**
TOTP berganti berdasarkan waktu (umumnya tiap 30 detik). HOTP berganti berdasarkan penghitung (counter) tiap kali dipakai. Pilih sesuai yang diminta layanan.

**Kenapa harus memasukkan password lagi setelah refresh?**
Kunci enkripsi hanya ada di memori dan tidak pernah disimpan permanen. Refresh menghapusnya, jadi vault perlu dibuka ulang.

**Bagaimana kalau saya ganti password?**
Kunci vault dibungkus ulang dengan password baru dan semua sesi lain dikeluarkan. Recovery code lama tetap berlaku kecuali kamu memulihkan akun (yang menerbitkan alur baru).

**Bisakah mengekspor akun ke aplikasi lain?**
Saat ini fokus Kripta adalah penyimpanan aman di dalam vault. Simpan QR/secret asli dari layanan sebagai cadangan bila kamu butuh memindahkannya ke aplikasi lain.

---

Untuk instalasi, konfigurasi server, dan deployment, lihat `README.md`.
