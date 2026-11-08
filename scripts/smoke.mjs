import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

const base = process.env.TEST_URL || "http://localhost:3000";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error" && !message.text().includes("favicon")) errors.push(message.text()); });
const report = [];
const pass = (name) => { report.push(name); console.log(`PASS ${name}`); };
const waitSave = () => page.waitForTimeout(1000);
const getNotes = async () => (await fetch(`${base}/api/notes`).then((response) => response.json())).notes;
const original = (await getNotes()).find((note) => note.id === "note-focused-writing");

try {
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  assert.equal(await page.locator(".document-title").inputValue(), "The art of focused writing");
  assert.equal(await page.locator(".inline-suggestion").count(), 1);
  await page.screenshot({ path: "artifacts/liquidscribe-desktop.png" });
  console.log("LAYOUT", await page.evaluate(() => ({ width: innerWidth, sidebar: document.querySelector(".sidebar").getBoundingClientRect().width, document: document.querySelector(".document-sheet").getBoundingClientRect().width, scrollHeight: document.querySelector(".document-scroll").scrollHeight, clientHeight: document.querySelector(".document-scroll").clientHeight, font: getComputedStyle(document.querySelector(".document-prose")).fontFamily })));
  pass("Desktop document and seeded inline suggestion render");

  await page.getByRole("button", { name: "Accept suggestion", exact: true }).click();
  assert.equal(await page.locator(".inline-suggestion").count(), 0);
  assert.ok((await page.locator(".document-prose").innerText()).includes("a thoughtful nudge"));
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator(".inline-suggestion").count(), 1);
  await page.getByRole("button", { name: "Reject suggestion", exact: true }).click();
  assert.equal(await page.locator(".inline-suggestion").count(), 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.equal(await page.locator(".inline-suggestion").count(), 1);
  pass("Accept, reject, and undo preserve user control");

  await page.keyboard.press("Control+k");
  await page.locator(".search-dialog-input input").fill("Maya");
  assert.equal(await page.locator(".search-result").count(), 1);
  await page.locator(".search-result").click();
  assert.equal(await page.locator(".document-title").inputValue(), "A conversation with Maya");
  pass("Keyboard search finds and opens a note");

  await page.keyboard.press("Control+j");
  await page.locator(".document-title").fill("Browser smoke test");
  await page.locator(".document-prose").click();
  await page.keyboard.insertText("This is a very important thought in order to test persistence.");
  await waitSave();
  const created = (await getNotes()).find((note) => note.title === "Browser smoke test");
  assert.ok(created);
  assert.ok(created.content.includes("test persistence"));
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator(".document-title").inputValue(), "Browser smoke test");
  assert.ok((await page.locator(".document-prose").innerText()).includes("test persistence"));
  pass("New notes persist to PostgreSQL and survive reload");

  await page.getByRole("textbox", { name: "Message the assistant" }).fill("Rewrite this paragraph");
  await page.getByRole("button", { name: "Send to assistant", exact: true }).click();
  await page.locator(".inline-suggestion").waitFor({ timeout: 15000 });
  assert.ok((await page.locator(".inline-suggestion ins").innerText()).includes("This is an important thought to test persistence."));
  await page.getByRole("button", { name: "Accept suggestion", exact: true }).click();
  assert.equal(await page.locator(".inline-suggestion").count(), 0);
  pass("Assistant creates a localized, reviewable edit");

  await page.getByRole("button", { name: "Document actions", exact: true }).click();
  await page.getByRole("button", { name: "Move to trash", exact: true }).click();
  await page.locator(".trash-link").click();
  await page.locator(".note-row").filter({ hasText: "Browser smoke test" }).click();
  assert.ok(await page.locator(".trash-banner").isVisible());
  await page.locator(".trash-banner").getByRole("button", { name: "Restore note" }).click();
  assert.equal(await page.locator(".trash-banner").count(), 0);
  await page.getByRole("button", { name: "Document actions", exact: true }).click();
  await page.getByRole("button", { name: "Move to trash", exact: true }).click();
  await page.locator(".trash-link").click();
  await page.locator(".note-row").filter({ hasText: "Browser smoke test" }).click();
  await page.locator(".trash-banner").getByRole("button", { name: "Delete permanently" }).click();
  await page.locator(".confirm-modal").getByRole("button", { name: "Delete permanently" }).click();
  await waitSave();
  assert.ok(!(await getNotes()).some((note) => note.id === created.id));
  pass("Trash, restore, and confirmed permanent deletion work");

  await page.locator(".note-row").filter({ hasText: "The art of focused writing" }).click();
  await page.getByRole("textbox", { name: "Message the assistant" }).fill("Summarize this document");
  await page.getByRole("button", { name: "Send to assistant", exact: true }).click();
  await page.locator(".chat-message.assistant").waitFor({ timeout: 15000 });
  assert.ok((await page.locator(".chat-message.assistant").last().innerText()).includes("The best ideas"));
  assert.ok(await page.getByRole("button", { name: "Insert into note", exact: true }).isVisible());
  pass("Document summary stays in the assistant until inserted");

  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await page.locator(".capture-preview").waitFor();
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  assert.equal(await page.locator(".capture-preview").count(), 0);
  pass("Camera preview opens and closes without changing layout");

  await page.getByRole("button", { name: "Settings & preferences", exact: true }).click();
  await page.getByRole("button", { name: "Local assistant", exact: true }).click();
  assert.ok(await page.getByRole("button", { name: "Check connection", exact: true }).isVisible());
  await page.getByRole("dialog").getByRole("button", { name: "Writing", exact: true }).click();
  await page.getByRole("button", { name: "Sans serif", exact: true }).click();
  assert.ok((await page.locator(".app-shell").getAttribute("style")).includes("DM Sans"));
  await page.getByRole("button", { name: "Serif", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  pass("Writing preferences and runtime configuration are interactive");

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  mobile.on("pageerror", (error) => errors.push(error.message));
  await mobile.goto(base, { waitUntil: "networkidle" });
  await mobile.evaluate(() => document.fonts.ready);
  await mobile.waitForTimeout(300);
  assert.ok((await mobile.locator(".sidebar").getAttribute("class")).includes("is-collapsed"));
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth), 390);
  await mobile.screenshot({ path: "artifacts/liquidscribe-mobile.png" });
  await mobile.getByRole("button", { name: "Open sidebar", exact: true }).click();
  assert.ok(!(await mobile.locator(".sidebar").getAttribute("class")).includes("is-collapsed"));
  await mobile.locator(".note-row").filter({ hasText: "The art of focused writing" }).click();
  assert.ok((await mobile.locator(".sidebar").getAttribute("class")).includes("is-collapsed"));
  pass("Mobile keeps the document primary and navigation contextual");
  await mobileContext.close();
  assert.deepEqual(errors, []);
  pass("No browser runtime or hydration errors");
  console.log(`\n${report.length} checks passed.`);
} finally {
  if (original) await fetch(`${base}/api/notes/${original.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(original) });
  for (const note of await getNotes()) if (note.title === "Browser smoke test") await fetch(`${base}/api/notes/${note.id}`, { method: "DELETE" });
  await browser.close();
}
