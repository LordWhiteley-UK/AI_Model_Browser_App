const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto("http://localhost:1420/");
    await page.waitForTimeout(1500);

    // Verify Runner Settings shortcut on Dashboard
    await page.waitForSelector("text=Detect installed runners", {
      timeout: 10000,
    });
    await page.screenshot({ path: "verify_runner_settings_dashboard.png", fullPage: true });

    // Navigate to Runner Settings
    const runnersLink = page.locator("button", { hasText: /^Runners$/i }).first();
    await runnersLink.click();
    await page.waitForTimeout(1000);

    await page.waitForSelector("text=Runner Settings", { timeout: 10000 });
    await page.screenshot({ path: "verify_runner_settings_view.png", fullPage: true });

    // Verify detected runners are listed
    for (const name of ["Ollama", "LM Studio", "llama.cpp"]) {
      await page.waitForSelector(`text=${name}`, { timeout: 10000 });
    }

    console.log("verification complete");
  } catch (err) {
    console.error("verification failed:", err.message);
    await page.screenshot({ path: "verify_runner_settings_error.png", fullPage: true });
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
