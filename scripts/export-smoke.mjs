import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://localhost:3000";
const original = (await fetch(`${base}/api/notes`).then((response) => response.json())).notes.find(
  (note) => note.id === "note-focused-writing",
);
assert.ok(original, "the seeded note is available for the export check");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".document-title").fill("Draft/Final:01");
  await page.locator(".document-prose").click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("\n\nExport checkpoint for regression.");

  const downloadStarted = page.waitForEvent("download");
  await page.getByRole("button", { name: "Document actions", exact: true }).click();
  const exportButton = page.getByRole("button", { name: "Export Markdown", exact: true });
  await exportButton.focus();
  await page.keyboard.press("Enter");
  const download = await downloadStarted;

  assert.equal(download.suggestedFilename(), "Draft-Final-01.md");
  const downloadPath = await download.path();
  assert.ok(downloadPath, "the browser completed the Markdown download");
  const markdown = await readFile(downloadPath, "utf8");
  assert.ok(markdown.includes("Export checkpoint for regression."));
  console.log("PASS Markdown export includes current editor content and a safe filename");
} finally {
  await page.waitForTimeout(800);
  const restore = await fetch(`${base}/api/notes/${original.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(original),
  });
  assert.ok(restore.ok, "the seeded note was restored after the export check");
  await browser.close();
}
