// api/audio-token.js
//
// Endpoint ini TIDAK pernah menaruh token GitHub di kode atau di repo.
// Token diambil dari Environment Variable Vercel (process.env.GITHUB_TOKEN)
// dan HANYA dikirim ke browser setelah request dipastikan berasal dari
// admin yang sudah login (diverifikasi via Firebase ID Token).
//
// WAJIB: set Environment Variables ini di Vercel Dashboard -> Settings -> Environment Variables
//   GITHUB_TOKEN                  -> fine-grained PAT, scope: repo Web-Asset saja, permission Contents R/W
//   FIREBASE_SERVICE_ACCOUNT_KEY  -> isi file JSON service account Firebase (dalam satu baris / stringified JSON)
//
// Cara dapat FIREBASE_SERVICE_ACCOUNT_KEY:
//   Firebase Console -> Project Settings -> Service Accounts -> Generate new private key
//   Lalu paste seluruh isi file .json itu sebagai value environment variable ini.

const admin = require("firebase-admin");

// Inisialisasi Firebase Admin SDK sekali saja (cache antar invocation)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Daftar email admin yang diizinkan melakukan upload/hapus audio.
// Ganti / tambah sesuai kebutuhan, atau ganti logikanya dengan custom claims
// kalau jumlah admin banyak dan sering berubah.
const ALLOWED_ADMIN_EMAILS = (process.env.ALLOWED_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

module.exports = async function handler(req, res) {
  // Hanya izinkan POST agar tidak ter-cache / ter-index secara tidak sengaja
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    // 1. Ambil Firebase ID Token dari header Authorization
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!idToken) {
      return res.status(401).json({ success: false, error: "Token otentikasi tidak ditemukan." });
    }

    // 2. Verifikasi token ke Firebase (menolak token palsu/expired/revoked)
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    const email = (decoded.email || "").toLowerCase();

    // 3. (Opsional tapi disarankan) Batasi hanya email admin tertentu
    if (ALLOWED_ADMIN_EMAILS.length > 0 && !ALLOWED_ADMIN_EMAILS.includes(email)) {
      return res.status(403).json({ success: false, error: "Akun ini tidak memiliki akses admin." });
    }

    // 4. Pastikan token GitHub sudah dikonfigurasi di server
    const githubToken = process.env.GITHUB_ACCESS_TOKEN;
    if (!githubToken) {
      console.error("GITHUB_TOKEN belum diset di Environment Variables Vercel.");
      return res.status(500).json({ success: false, error: "Konfigurasi server belum lengkap." });
    }

    // 5. Kembalikan token ke browser HANYA untuk dipakai sesaat (tidak disimpan permanen di client)
    //    Browser akan memakainya langsung untuk request ke GitHub API, lalu membuangnya dari memory.
    return res.status(200).json({
      success: true,
      token: githubToken,
      // ikut sertakan info repo agar konsisten & tidak perlu hardcode lagi di client
      owner: process.env.GITHUB_REPO_OWNER || "salafypalembangsp-creator",
      repo: process.env.GITHUB_REPO_NAME || "Web-Asset",
    });
  } catch (err) {
    console.error("audio-token error:", err);
    return res.status(401).json({ success: false, error: "Otentikasi gagal atau token tidak valid." });
  }
};