import "dotenv/config";

// Device Authorization Grant (RFC 8628): the script and the browser that
// completes consent don't need to share a network or a localhost port — the
// user visits a generic URL on any device and types in a short code. That's
// required here because this script may run somewhere other than the user's
// own machine. Needs an OAuth client of type "TVs and Limited Input devices"
// in Google Cloud Console (not "Desktop app", which assumes a loopback
// redirect this flow doesn't use).

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first (from a Google Cloud OAuth client of type 'TVs and Limited Input devices').",
  );
  process.exit(1);
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const res = await fetch("https://oauth2.googleapis.com/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId!,
      scope: "https://www.googleapis.com/auth/drive.file",
    }),
  });
  if (!res.ok) {
    throw new Error(`Device code request failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<DeviceCodeResponse>;
}

async function pollForToken(deviceCode: string, intervalSeconds: number): Promise<TokenResponse> {
  let interval = intervalSeconds;
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, interval * 1000));

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const body = (await res.json()) as TokenResponse;

    if (res.ok) return body;

    if (body.error === "authorization_pending") continue;
    if (body.error === "slow_down") {
      interval += 5;
      continue;
    }
    throw new Error(`Authorization failed: ${body.error} ${body.error_description ?? ""}`.trim());
  }
}

async function main() {
  const device = await requestDeviceCode();

  console.log("\nOn any device, go to:\n");
  console.log(`  ${device.verification_url}`);
  console.log("\nand enter this code:\n");
  console.log(`  ${device.user_code}\n`);
  console.log("Sign in with the Google account you want Drive uploads to go to, then approve access.");
  console.log("Waiting for approval...");

  const tokens = await pollForToken(device.device_code, device.interval);

  console.log("\nAdd this to your .env:\n");
  console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
  if (!tokens.refresh_token) {
    console.warn(
      "No refresh_token was returned. If you've authorised this app before, revoke access at " +
        "https://myaccount.google.com/permissions and run this again so Google issues a fresh one.",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
