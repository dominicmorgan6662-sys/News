import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string' || !url.startsWith('https://mp.weixin.qq.com/')) {
    return res.status(400).json({ error: 'Invalid URL — only WeChat article URLs are supported' });
  }

  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://mp.weixin.qq.com/',
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `HTTP ${resp.status}` });
    }

    let text = await resp.text();

    // WeChat may serve GBK even when charset header says UTF-8
    if (!text.includes('charset') && !text.includes('encoding')) {
      try {
        const buf = Buffer.from(text, 'utf-8');
        const decoded = new TextDecoder('gbk').decode(buf);
        if (decoded.includes('微信公众号') || decoded.includes('wechat')) {
          text = decoded;
        }
      } catch (_) {}
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ contents: text });
  } catch (err: any) {
    return res.status(502).json({ error: err.message });
  }
}
