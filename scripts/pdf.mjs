// Export the print view to a vector PDF with headless Chrome.
// Usage: npm run build && npm run preview  (in another terminal)  then  npm run pdf [url] [out.pdf]
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

const url = process.argv[2] || "http://127.0.0.1:4173/print.html";
const out = process.argv[3] || "dist/environmental-supply-chain-radar-2026-q4-v0.1.pdf";
const chrome = ["google-chrome", "chromium", "chromium-browser"].find((c) => {
  try {
    execFileSync("which", [c], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
});
if (!chrome) throw new Error("No Chrome/Chromium found");

execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--virtual-time-budget=8000",
    `--print-to-pdf=${out}`,
    url,
  ],
  { stdio: "inherit" },
);
console.log(existsSync(out) ? `PDF written: ${out}` : "PDF export failed");
