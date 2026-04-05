const TOKEN_BYTES = 24

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return toBase64Url(bytes)
}

