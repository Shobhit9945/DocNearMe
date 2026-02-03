import { z } from "zod";

const notificationEmailSchema = z.string().trim().email();

export const isValidNotificationEmail = (value: string) =>
  notificationEmailSchema.safeParse(value).success;
