const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto("http://localhost:1420/");
    await page.waitForTimeout(1500);

    const library = page.locator("a, button", { hasText: /Library/i }).first();
    if (await library.count() > 0) {
      await library.click();
      await page.waitForTimeout(800);
    }

    await page.waitForSelector("text=Scanned Models", { timeout: 10000 });
    await page.screenshot({ path: "verify_runner_library.png", fullPage: true });

    // Select preferred runner from inline dropdown
    const select = page.locator("select", { has: page.locator("option", { hasText: "Ollama" }) }).first();
    await select.selectOption("ollama");
    await page.waitForTimeout(500);
    await page.screenshot({ path: "verify_runner_preferred.png", fullPage: true });

    // Open launcher modal
    const terminalBtn = page.locator("button[title='Launch with external runner']").first();
    await terminalBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "verify_runner_modal.png", fullPage: true });

    // Copy a command
    const copyBtn = page.locator("button", { hasText: "Copy command" }).first();
    if (await copyBtn.count() > 0) {
      await copyBtn.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: "verify_runner_copied.png", fullPage: true });
    }

    console.log("verification complete");
  } catch (err) {
    console.error("verification failed:", err.message);
    await page.screenshot({ path: "verify_runner_error.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
