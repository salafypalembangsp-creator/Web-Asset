import { Octokit } from "@octokit/rest";

export const config = {
  api: {
    bodyParser: { sizeLimit: '4.5mb' },
  },
};

export default async function handler(req, res) {
  const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
  const REPO_OWNER = "salafypalembangsp-creator";
  const REPO_NAME = "Web-Asset";

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ success: false, error: 'GITHUB_ACCESS_TOKEN belum terpasang!' });
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  if (req.method === 'POST') {
    try {
      // Sekarang backend akan menangkap tag dari frontend, jika kosong baru pakai default v1.4
      const { fileName, fileBase64, tagRelease } = req.body;
      const TARGET_TAG = tagRelease || "v1.0"; 

      if (!fileName || !fileBase64) {
        return res.status(400).json({ success: false, error: 'Data tidak lengkap.' });
      }

      const { data: release } = await octokit.repos.getReleaseByTag({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        tag: TARGET_TAG,
      });

      const bufferData = Buffer.from(fileBase64, 'base64');

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

      return res.status(200).json({
        success: true,
        assetId: uploadedAsset.id,
        githubUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${TARGET_TAG}/${fileName}`
      });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { assetId } = req.body;
      await octokit.repos.deleteReleaseAsset({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        asset_id: parseInt(assetId),
      });
      return res.status(200).json({ success: true, message: 'Berhasil dihapus!' });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(405).json({ success: false, error: 'Method not allowed' });
}