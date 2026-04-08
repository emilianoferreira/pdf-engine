const express = require("express");
const puppeteer = require("puppeteer");
const app = express();
app.use(express.json({ limit: "50mb" }));

let browser;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath:
        process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--font-render-hinting=medium",
      ],
    });
  }
  return browser;
}

app.post("/generate-pdf", async (req, res) => {
  const { html, options = {} } = req.body;
  if (!html) return res.status(400).json({ error: "html requerido" });
  try {
    const b = await getBrowser();
    const page = await b.newPage();
    await page.setViewport({
      width: options.viewportWidth || 1240,
      height: options.viewportHeight || 1754,
      deviceScaleFactor: options.deviceScaleFactor || 2,
    });
    await page.emulateMediaType("screen");
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      const images = Array.from(document.images || []);
      await Promise.all(
        images.map(async (img) => {
          if (img.complete && img.naturalWidth > 0) return;

          await new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
          });
        }),
      );
    });
    const bodyHeight = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      return Math.max(
        body.scrollHeight,
        body.offsetHeight,
        doc.clientHeight,
        doc.scrollHeight,
        doc.offsetHeight,
      );
    });
    const pdfBuffer = await page.pdf({
      width: options.width || "210mm",
      height: options.height || `${bodyHeight}px`,
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await page.close();
    if (options.format === "base64") {
      return res.json({ pdf: pdfBuffer.toString("base64") });
    }
    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (_, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("PDF engine en :" + PORT);
});
