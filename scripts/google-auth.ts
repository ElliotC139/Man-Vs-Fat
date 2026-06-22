import "dotenv/config";
import http from "node:http";
import { URL } from "node:url";
import { google } from "googleapis";

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:8080/callback";

if (!clientId || !clientSecret) {
  console.error(
    "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first (from a Google Cloud OAuth client of type 'Desktop app').",
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

const redirectUrl = new URL(redirectUri);
const port = Number(redirectUrl.port) || 8080;

const server = http.createServer((req, res) => {
  void (async () => {
    if (!req.url) return;
    const url = new URL(req.url, redirectUri);
    if (url.pathname !== redirectUrl.pathname) {
      res.writeHead(404).end();
      return;
    }

    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400).end("Missing ?code in redirect");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<html><body>All set — you can close this tab and go back to the terminal.</body></html>");

    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log("\nAdd this to your .env:\n");
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
      if (!tokens.refresh_token) {
        console.warn(
          "No refresh_token was returned. If you've authorised this app before, revoke access at " +
            "https://myaccount.google.com/permissions and run this again so Google issues a fresh one.",
        );
      }
    } catch (error) {
      console.error("Failed to exchange code for tokens:", error);
    } finally {
      server.close();
    }
  })();
});

server.listen(port, () => {
  console.log("Open this URL in a browser signed in to the Google account you want Drive uploads to go to:\n");
  console.log(authUrl);
  console.log(`\nWaiting for the redirect on ${redirectUri} ...`);
});
