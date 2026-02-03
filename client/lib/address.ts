export const formatShortAddress = (address: string) => {
  const normalized = address.trim();
  if (!normalized) return "";
  const parts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[1]}`;
  }

  return normalized;
};
