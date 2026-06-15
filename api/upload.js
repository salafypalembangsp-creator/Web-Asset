// api/upload.js
import { Octokit } from "@octokit/rest";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4.5mb', // Batas maksimal mutlak untuk Vercel Hobby Plan
    },
  },
};

export default async function handler(req, res) {
  // Ambil Token Rahasia GitHub dari Environment Variable
  const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  const REPO_OWNER = "salafypalembangsp-creator";
  const REPO_NAME = "Web-Asset";
  const TAG_RELEASE = "v1.4";

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ success: false, error: 'Token rahasia GITHUB_ACCESS_TOKEN belum terpasang di Vercel Settings!' });
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // ==========================================
  // JALUR 1: FITUR UNGGAH GAMBAR (POST)
  // ==========================================
  if (req.method === 'POST') {
    try {
      const { fileName, fileBase64 } = req.body;

      if (!fileName || !fileBase64) {
        return res.status(400).json({ success: false, error: 'Data file atau nama file tidak lengkap.' });
      }

      // Cari ID Rilis untuk tag v1.4
      const { data: release } = await octokit.repos.getReleaseByTag({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        tag: TAG_RELEASE,
      });

      // Konversi data Base64 kembali menjadi buffer biner asli
      const bufferData = Buffer.from(fileBase64, 'base64');

      // Unggah langsung ke GitHub Release Assets API
      const { data: uploadedAsset } = await octokit.repos.uploadReleaseAsset({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        release_id: release.id,
        name: fileName,
        data: bufferData,
        headers: {
          'content-type': 'image/jpeg',
          'content-length': bufferData.length,
        },
      });

      // SEKARANG KITA KEMBALIKAN GITHUBURL SEKALIGUS ASSET_ID NYA UNTUK DISIMPAN DI FIREBASE
      return res.status(200).json({
        success: true,
        assetId: uploadedAsset.id, // ID unik berkas ini di server GitHub (Penting untuk hapus nanti)
        githubUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TAG_RELEASE}/${fileName}`
      });

    } catch (error) {
      console.error("Gagal melakukan proxy upload ke GitHub:", error);
      
      if (error.status === 422) {
        return res.status(422).json({ 
          success: false, 
          error: 'File dengan nama ini sudah ada di rilis GitHub v1.4. Ganti nama file Anda atau gunakan gambar lain.' 
        });
      }

      return res.status(500).json({ 
        success: false, 
        error: error.message || 'Gagal mengunggah biner ke repositori GitHub.' 
      });
    }
  }

  // ==========================================
  // JALUR 2: FITUR HAPUS GAMBAR (DELETE)
  // ==========================================
  if (req.method === 'DELETE') {
    try {
      const { assetId } = req.body;

      if (!assetId) {
        return res.status(400).json({ success: false, error: 'Parameter assetId wajib dikirim untuk menghapus file.' });
      }

      // Perintah langsung ke GitHub untuk melenyapkan file berdasarkan ID-nya
      await octokit.repos.deleteReleaseAsset({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        asset_id: parseInt(assetId), // Pastikan bertipe angka/integer
      });

      return res.status(200).json({
        success: true,
        message: 'Berkas lama berhasil dilenyapkan dari gudang rilis GitHub!'
      });

    } catch (error) {
      console.error("Gagal menghapus aset dari GitHub:", error);
      return res.status(500).json({
        success: false,
        error: error.message || 'Gagal menghapus berkas lama dari server GitHub.'
      });
    }
  }

  // Jika ada metode lain selain POST dan DELETE, tolak otomatis
  return res.status(405).json({ success: false, error: 'Method not allowed' });
}