import { google } from "googleapis";
import { Readable } from "node:stream";
import { config } from "../config";
import { prisma } from "../db";

const FOLDER_NAME = "Food Diary";
const FOLDER_ID_SETTING_KEY = "googleDriveFolderId";

function getOAuthClient() {
  if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REFRESH_TOKEN) {
    throw new Error(
      "Google Drive isn't configured. Run `npm run google:auth` once to obtain a refresh token, then set GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.",
    );
  }
  const client = new google.auth.OAuth2(config.GOOGLE_CLIENT_ID, config.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ refresh_token: config.GOOGLE_REFRESH_TOKEN });
  return client;
}

async function resolveFolderId(drive: ReturnType<typeof google.drive>): Promise<string> {
  if (config.GOOGLE_DRIVE_FOLDER_ID) {
    return config.GOOGLE_DRIVE_FOLDER_ID;
  }

  const cached = await prisma.setting.findUnique({ where: { key: FOLDER_ID_SETTING_KEY } });
  if (cached) {
    return cached.value;
  }

  const existing = await drive.files.list({
    q: `name = '${FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  let folderId = existing.data.files?.[0]?.id;

  if (!folderId) {
    const created = await drive.files.create({
      requestBody: { name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
      fields: "id",
    });
    folderId = created.data.id ?? undefined;
  }

  if (!folderId) {
    throw new Error("Could not resolve or create the Food Diary Drive folder");
  }

  await prisma.setting.upsert({
    where: { key: FOLDER_ID_SETTING_KEY },
    update: { value: folderId },
    create: { key: FOLDER_ID_SETTING_KEY, value: folderId },
  });

  return folderId;
}

export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

export async function uploadReportToDrive(fileName: string, pdfBuffer: Buffer): Promise<DriveUploadResult> {
  const auth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth });
  const folderId = await resolveFolderId(drive);

  const response = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: "application/pdf", body: Readable.from(pdfBuffer) },
    fields: "id, webViewLink",
  });

  const fileId = response.data.id;
  const webViewLink = response.data.webViewLink;
  if (!fileId || !webViewLink) {
    throw new Error("Drive upload succeeded but returned no file id/link");
  }

  return { fileId, webViewLink };
}
