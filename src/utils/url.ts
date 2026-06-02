export const openExternalUrl = (url: string): void => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      window.open(parsed.href, "_blank", "noopener,noreferrer");
    }
  } catch {
    // Invalid URL — ignore
  }
};
