import { getCallSettingsCollection } from "../db";
import type { CallSettings } from "../types";

export type ClinicCallProvider = "twilio" | "elevenlabs";

export type ResolvedCallSettings = {
  provider: ClinicCallProvider;
  fallbackToTwilio: boolean;
};

const SETTINGS_KEY = "clinic_call";

const normalizeProvider = (value?: string): ClinicCallProvider =>
  value?.trim().toLowerCase() === "twilio" ? "twilio" : "elevenlabs";

const normalizeFallback = (value?: string) => {
  if (!value) return true;
  return value.trim().toLowerCase() !== "false";
};

const defaultSettings = (): ResolvedCallSettings => ({
  provider: "elevenlabs",
  fallbackToTwilio: true,
});

export const getResolvedCallSettings = async (): Promise<ResolvedCallSettings> => {
  const settingsCollection = await getCallSettingsCollection();
  const saved = await settingsCollection.findOne({ key: SETTINGS_KEY });
  if (!saved) {
    const defaultValue = defaultSettings();
    await settingsCollection.updateOne(
      { key: SETTINGS_KEY },
      {
        $set: {
          key: SETTINGS_KEY,
          provider: defaultValue.provider,
          fallbackToTwilio: defaultValue.fallbackToTwilio,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

    return defaultValue;
  }

  return {
    provider: saved.provider ?? defaultSettings().provider,
    fallbackToTwilio: typeof saved.fallbackToTwilio === "boolean" ? saved.fallbackToTwilio : defaultSettings().fallbackToTwilio,
  };
};

export const saveCallSettings = async (
  input: ResolvedCallSettings,
  updatedBy?: string,
): Promise<ResolvedCallSettings> => {
  const settingsCollection = await getCallSettingsCollection();
  const now = new Date();
  const document: CallSettings = {
    key: SETTINGS_KEY,
    provider: input.provider,
    fallbackToTwilio: input.fallbackToTwilio,
    updatedAt: now,
    updatedBy,
  };

  await settingsCollection.updateOne(
    { key: SETTINGS_KEY },
    {
      $set: document,
    },
    { upsert: true } as any,
  );

  return {
    provider: document.provider,
    fallbackToTwilio: document.fallbackToTwilio,
  };
};
