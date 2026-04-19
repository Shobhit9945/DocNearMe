const OPTIMIZED_IMAGE_PROXY_PREFIX = "/api/images/optimized?src=";

const isExternalHttpImage = (value: string) => {
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  if (value.startsWith("/")) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const getOptimizedClinicImageSrc = (value?: string, fallback?: string) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return fallback ?? "";
  if (!isExternalHttpImage(normalized)) return normalized;
  return `${OPTIMIZED_IMAGE_PROXY_PREFIX}${encodeURIComponent(normalized)}`;
};