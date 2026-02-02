import { randomInt } from "crypto";
import bcryptjs from "bcryptjs";

const DEFAULT_TTL_MINUTES = 10;

export const getOtpTtlMinutes = () => {
  const raw = process.env.OTP_TTL_MINUTES;
  const parsed = raw ? Number(raw) : DEFAULT_TTL_MINUTES;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MINUTES;
};

export const generateOtpCode = () => {
  const code = randomInt(100000, 1000000);
  return String(code);
};

export const hashOtp = (otp: string) => bcryptjs.hash(otp, 10);

export const verifyOtp = (otp: string, hash: string) => bcryptjs.compare(otp, hash);

export const buildOtpEmail = (otp: string) => {
  const ttl = getOtpTtlMinutes();
  return {
    subject: "Your DocNearMe verification code",
    text: `Your DocNearMe verification code is ${otp}. It expires in ${ttl} minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5;">
        <h2 style="margin-bottom: 12px;">Verify your email</h2>
        <p>Your DocNearMe verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
        <p>This code expires in ${ttl} minutes.</p>
      </div>
    `,
  };
};
