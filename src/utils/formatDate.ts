export const formatDate = (s: string | null): string => {
  if (!s) return '-';
  return new Date(s).toLocaleString();
};
