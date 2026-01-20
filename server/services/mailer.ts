import net from "net";
import tls from "tls";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type SmtpSocket = net.Socket | tls.TLSSocket;

const CRLF = "\r\n";

const readResponse = (socket: SmtpSocket) =>
  new Promise<{ code: number; message: string }>((resolve, reject) => {
    let buffer = "";

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line) continue;
        const match = line.match(/^(\d{3})([\s-])(.*)$/);
        if (!match) continue;
        const code = Number(match[1]);
        const separator = match[2];
        const message = match[3];
        if (separator === " ") {
          cleanup();
          resolve({ code, message });
          return;
        }
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onEnd = () => {
      cleanup();
      reject(new Error("SMTP connection closed unexpectedly."));
    };

    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("end", onEnd);
    };

    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("end", onEnd);
  });

const sendCommand = async (socket: SmtpSocket, command: string, expect: number[]) => {
  socket.write(`${command}${CRLF}`);
  const response = await readResponse(socket);
  if (!expect.includes(response.code)) {
    throw new Error(`SMTP command failed (${command}): ${response.code} ${response.message}`);
  }
};

const buildMessage = ({ from, to, subject, text, html }: SendEmailInput & { from: string }) => {
  if (!html) {
    return [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      text,
      "",
    ].join(CRLF);
  }

  const boundary = `docnearme-${Date.now().toString(36)}`;
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    text,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
    "",
    `--${boundary}--`,
    "",
  ].join(CRLF);
};

const createConnection = (host: string, port: number) =>
  new Promise<SmtpSocket>((resolve, reject) => {
    const socket = net.connect(port, host);
    const onError = (err: Error) => {
      socket.off("connect", onConnect);
      reject(err);
    };
    const onConnect = () => {
      socket.off("error", onError);
      resolve(socket);
    };
    socket.once("error", onError);
    socket.once("connect", onConnect);
  });

const upgradeToTls = (socket: net.Socket, host: string) =>
  new Promise<tls.TLSSocket>((resolve, reject) => {
    const tlsSocket = tls.connect({ socket, servername: host });
    const onSecure = () => {
      tlsSocket.off("error", onError);
      resolve(tlsSocket);
    };
    const onError = (err: Error) => {
      tlsSocket.off("secureConnect", onSecure);
      reject(err);
    };
    tlsSocket.once("secureConnect", onSecure);
    tlsSocket.once("error", onError);
  });

export async function sendEmail({ to, subject, text, html }: SendEmailInput): Promise<boolean> {
  if (process.env.SMTP_LOG_ONLY === "true") {
    console.info("[mailer] SMTP_LOG_ONLY enabled. Email not sent.", { to, subject });
    return true;
  }

  const host = process.env.SMTP_HOST;
  const portValue = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !portValue || !user || !pass) {
    console.warn("[mailer] SMTP credentials are not fully configured.");
    return false;
  }

  const port = Number(portValue);
  const from = process.env.SMTP_FROM ?? user;
  const message = buildMessage({ from, to, subject, text, html });

  let socket: SmtpSocket | null = null;

  try {
    socket =
      port === 465
        ? tls.connect({ host, port, servername: host })
        : await createConnection(host, port);

    await readResponse(socket);
    await sendCommand(socket, `EHLO ${host}`, [250]);

    if (port !== 465) {
      await sendCommand(socket, "STARTTLS", [220]);
      if (socket instanceof net.Socket) {
        socket = await upgradeToTls(socket, host);
      }
      await sendCommand(socket, `EHLO ${host}`, [250]);
    }

    await sendCommand(socket, "AUTH LOGIN", [334]);
    await sendCommand(socket, Buffer.from(user).toString("base64"), [334]);
    await sendCommand(socket, Buffer.from(pass).toString("base64"), [235]);
    await sendCommand(socket, `MAIL FROM:<${from}>`, [250]);
    await sendCommand(socket, `RCPT TO:<${to}>`, [250, 251]);
    await sendCommand(socket, "DATA", [354]);
    socket.write(`${message}${CRLF}.${CRLF}`);
    const dataResponse = await readResponse(socket);
    if (dataResponse.code !== 250) {
      throw new Error(`SMTP DATA rejected: ${dataResponse.code} ${dataResponse.message}`);
    }
    await sendCommand(socket, "QUIT", [221]);
    socket.end();
    return true;
  } catch (error) {
    console.error("[mailer] SMTP send failed", error);
    if (socket) socket.end();
    return false;
  }
}
