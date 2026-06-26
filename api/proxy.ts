import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED_HOSTS = [
  'mp.weixin.qq.com',
  'mmbiz.qpic.cn',
  'mmbiz.url.cn',
  'mmsns.qpic.cn',
  'res.wx.qq.com',
  'szthumbnail.weixin.qq.com',
  'wqbrand.thumb.weixin.qq.com',
  'file.weixin.qq.com',
  'qqfile.weixin.qq.com',
];

function isAllowedUrl(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).send('');
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  if (!isAllowedUrl(url)) {
    return res.status(400).json({ error: 'URL not allowed — only WeChat CDN domains are permitted' });
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://mp.weixin.qq.com/',
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `HTTP ${resp.status}` });
    }

    const contentType = resp.headers.get('content-type') || '';
    const buffer = await resp.arrayBuffer();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    if (contentType.includes('text/html') || contentType.includes('application/json')) {
      let text = Buffer.from(buffer).toString('utf-8');
      if (!text.includes('charset') && !text.includes('encoding')) {
        try {
          const decoded = new TextDecoder('gbk').decode(Buffer.from(buffer));
          if (decoded.includes('微信公众号') || decoded.includes('wechat')) {
            text = decoded;
          }
        } catch (_) {}
      }
      return res.status(200).json({ contents: text });
    }

    res.setHeader('Content-Type', contentType);
    return res.status(200).send(Buffer.from(buffer));
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
}
