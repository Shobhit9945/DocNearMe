import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast } from "@/components/ui/use-toast";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function copyToClipboard(text: string, t: (key: string) => string = (k) => k): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: t("Copied"), description: t("Text copied to clipboard") });
  } catch {
    toast({ title: t("Copy failed"), description: t("Unable to copy to clipboard"), variant: "destructive" });
  }
}
