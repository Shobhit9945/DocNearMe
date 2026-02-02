const getVerifyServiceSid = () => {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!serviceSid) {
    throw new Error("Twilio Verify service SID is not configured.");
  }
  return serviceSid;
};

const getTwilioAuthHeader = () => {
  const sid = process.env.TWILIO_SID;
  const secret = process.env.TWILIO_SECRET;
  if (!sid || !secret) {
    throw new Error("Twilio credentials are not configured.");
  }
  return `Basic ${Buffer.from(`${sid}:${secret}`).toString("base64")}`;
};

const createTwilioRequest = async (path: string, body: Record<string, string>) => {
  const params = new URLSearchParams(body);
  const response = await fetch(`https://verify.twilio.com/v2/Services/${getVerifyServiceSid()}${path}`, {
    method: "POST",
    headers: {
      Authorization: getTwilioAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await response.json()) as { status?: string; message?: string };
  if (!response.ok) {
    const message = data?.message ?? "Twilio verification failed.";
    throw new Error(message);
  }
  return data;
};

export const requestPhoneVerification = async (phone: string) => {
  const data = await createTwilioRequest("/Verifications", {
    To: phone,
    Channel: "sms",
  });
  return data.status ?? "unknown";
};

export const checkPhoneVerification = async (phone: string, code: string) => {
  const data = await createTwilioRequest("/VerificationCheck", {
    To: phone,
    Code: code,
  });
  return data.status ?? "unknown";
};
