const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto("http://localhost:1420/");
    await page.waitForTimeout(1500);

    // Verify Dashboard shows Downloads shortcut
    await page.waitForSelector("text=Track queued and active model downloads", {
      timeout: 10000,
    });
    await page.screenshot({ path: "verify_downloads_dashboard.png", fullPage: true });

    // Open Downloads page from nav
    const downloadsLink = page.locator("button", { hasText: /^Downloads$/i }).first();
    await downloadsLink.click();
    await page.waitForTimeout(1000);

    await page.waitForSelector("text=Downloads", { timeout: 10000 });
    await page.screenshot({ path: "verify_downloads_list.png", fullPage: true });

    // Confirm the completed test job appears if present
    const jobRow = page.locator("text=test-model.gguf").first();
    if (await jobRow.count() > 0) {
      await page.screenshot({ path: "verify_downloads_job.png", fullPage: true });
    }

    console.log("verification complete");
  } catch (err) {
    console.error("verification failed:", err.message);
    await page.screenshot({ path: "verify_downloads_error.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
