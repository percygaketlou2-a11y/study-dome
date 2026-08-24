// Turns an admin-pasted YouTube/Vimeo link into an embeddable iframe URL.
// Students only ever see this derived embed URL, never the raw pasted link.

function parseVideoUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Enter a valid video URL');
  }

  const host = url.hostname.replace(/^www\.|^m\./, '');

  if (host === 'youtube.com') {
    if (url.pathname === '/watch') {
      const id = url.searchParams.get('v');
      if (id) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shortsMatch) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}` };
    const embedMatch = url.pathname.match(/^\/embed\/([\w-]+)/);
    if (embedMatch) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}` };
  }

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (id) return { provider: 'youtube', embedUrl: `https://www.youtube.com/embed/${id}` };
  }

  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  if (host === 'player.vimeo.com') {
    const match = url.pathname.match(/^\/video\/(\d+)/);
    if (match) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${match[1]}` };
  }

  throw new Error('Only YouTube or Vimeo links are supported');
}

module.exports = { parseVideoUrl };
