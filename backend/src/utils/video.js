// Turns an admin-pasted YouTube/Vimeo link into an embeddable iframe URL.
// Students only ever see this derived embed URL, never the raw pasted link.

// Video ids are short alphanumeric tokens. Anything else (slashes, query
// strings, quotes) would let a pasted link steer the iframe to a different
// path on the video host, so it is rejected.
const VIDEO_ID = /^[\w-]{3,64}$/;

function embed(provider, id) {
  if (!VIDEO_ID.test(id)) throw new Error('That video link has an invalid video id');
  return provider === 'youtube'
    ? { provider, embedUrl: `https://www.youtube.com/embed/${id}` }
    : { provider, embedUrl: `https://player.vimeo.com/video/${id}` };
}

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
      if (id) return embed('youtube', id);
    }
    const shortsMatch = url.pathname.match(/^\/shorts\/([^/]+)/);
    if (shortsMatch) return embed('youtube', shortsMatch[1]);
    const embedMatch = url.pathname.match(/^\/embed\/([^/]+)/);
    if (embedMatch) return embed('youtube', embedMatch[1]);
  }

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (id) return embed('youtube', id);
  }

  if (host === 'vimeo.com') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) return embed('vimeo', id);
  }

  if (host === 'player.vimeo.com') {
    const match = url.pathname.match(/^\/video\/(\d+)/);
    if (match) return embed('vimeo', match[1]);
  }

  throw new Error('Only YouTube or Vimeo links are supported');
}

module.exports = { parseVideoUrl };
