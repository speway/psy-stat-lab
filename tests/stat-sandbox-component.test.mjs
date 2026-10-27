import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import cp from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const esbuild = require(path.resolve("node_modules/esbuild"));

/**
 * Resolves a supported Chromium-based browser executable across Windows, macOS, and Linux.
 * Returns null if no supported browser executable could be located.
 */
function findBrowserExecutable() {
  if (process.env.EDGE_PATH) {
    if (fs.existsSync(process.env.EDGE_PATH)) return process.env.EDGE_PATH;
    return null; // Explicitly specified EDGE_PATH does not exist
  }
  if (process.env.BROWSER_PATH) {
    if (fs.existsSync(process.env.BROWSER_PATH)) return process.env.BROWSER_PATH;
    return null;
  }

  if (process.platform === "win32") {
    const candidates = [
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Microsoft\\Edge\\Application\\msedge.exe"),
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google\\Chrome\\Application\\chrome.exe"),
    ].filter(Boolean);

    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else if (process.platform === "darwin") {
    const candidates = [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    // Linux candidates
    const candidates = [
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
      "/snap/bin/chromium",
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }

  return null;
}

test("Real StatSandbox component mounting in Chromium/Edge headless --dump-dom (selection, activeElement focus tracking, synthetic arrow navigation, and programmatic click selection)", async () => {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    assert.fail(
      "Supported Chromium browser executable (Microsoft Edge / Google Chrome / Chromium) not found. " +
      "Set EDGE_PATH or BROWSER_PATH environment variable to point to an installed Chromium binary."
    );
  }

  // Create isolated temporary directory for stand artifacts and isolated user profile
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "psy-stat-stand-"));
  const userDataDir = path.join(tmpDir, "browser-profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  const standEntryFile = path.join(tmpDir, "stand-entry.tsx");
  const standHtmlFile = path.join(tmpDir, "stand.html");

  // Client stand code mounting the actual StatSandbox component in real React runtime
  const standClientCode = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import StatSandbox from '${path.resolve("app/StatSandbox.tsx").replace(/\\/g, "/")}';

function runComponentTests() {
  const log = [];
  const report = (msg, ok) => {
    log.push((ok ? 'PASS: ' : 'FAIL: ') + msg);
    if (!ok) throw new Error(msg);
  };

  try {
    const container = document.getElementById('root');
    const root = createRoot(container);

    // Mount real StatSandbox component with initialTab="power"
    flushSync(() => {
      root.render(React.createElement(StatSandbox, { initialTab: 'power' }));
    });

    // --- 1. ALPHA RADIO GROUP SELECTION & KEYBOARD ROVING ---
    const alpha005 = document.getElementById('power-alpha-0.05');
    const alpha001 = document.getElementById('power-alpha-0.01');
    const alpha0001 = document.getElementById('power-alpha-0.001');

    report('Alpha radios exist in DOM', !!(alpha005 && alpha001 && alpha0001));
    report('Initial alpha 0.05 is checked', alpha005.checked === true && !alpha001.checked && !alpha0001.checked);

    // Focus initial radio
    alpha005.focus();
    report('Focus on alpha 0.05', document.activeElement === alpha005);

    // Synthetic ArrowRight on alpha 0.05 -> shifts focus to 0.01 and checks it
    flushSync(() => {
      alpha005.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    report('ArrowRight moved focus to alpha 0.01', document.activeElement === alpha001);
    report('Alpha 0.01 is checked after ArrowRight', alpha001.checked === true && !alpha005.checked);

    // Synthetic ArrowDown on alpha 0.01 -> shifts focus to 0.001 and checks it
    flushSync(() => {
      alpha001.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    });
    report('ArrowDown moved focus to alpha 0.001', document.activeElement === alpha0001);
    report('Alpha 0.001 is checked after ArrowDown', alpha0001.checked === true);

    // Synthetic ArrowRight on alpha 0.001 -> cyclic wrap-around to 0.05
    flushSync(() => {
      alpha0001.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    report('ArrowRight wrapped focus back to alpha 0.05', document.activeElement === alpha005);
    report('Alpha 0.05 is checked after wrap', alpha005.checked === true);

    // Synthetic ArrowLeft on alpha 0.05 -> backward wrap-around to 0.001
    flushSync(() => {
      alpha005.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    });
    report('ArrowLeft wrapped focus back to alpha 0.001', document.activeElement === alpha0001);
    report('Alpha 0.001 is checked after backward wrap', alpha0001.checked === true);

    // Synthetic ArrowUp on alpha 0.001 -> backward move to 0.01
    flushSync(() => {
      alpha0001.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    });
    report('ArrowUp moved focus to alpha 0.01', document.activeElement === alpha001);
    report('Alpha 0.01 is checked after ArrowUp', alpha001.checked === true);

    // Programmatic click selection restoring alpha 0.05
    flushSync(() => {
      alpha005.click();
    });
    report('Programmatic click restores alpha 0.05 selection', alpha005.checked === true);

    // --- 2. DIRECTION RADIO GROUP SELECTION & KEYBOARD ROVING ---
    const dirTwo = document.getElementById('power-direction-two-tailed');
    const dirOne = document.getElementById('power-direction-one-tailed');

    report('Direction radios exist in DOM', !!(dirTwo && dirOne));
    report('Initial direction two-tailed is checked', dirTwo.checked === true && !dirOne.checked);

    // Focus two-tailed radio
    dirTwo.focus();
    report('Focus on two-tailed', document.activeElement === dirTwo);

    // Synthetic ArrowRight on two-tailed -> shifts focus to one-tailed and checks it
    flushSync(() => {
      dirTwo.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    });
    report('ArrowRight moved focus to one-tailed', document.activeElement === dirOne);
    report('One-tailed is checked after ArrowRight', dirOne.checked === true && !dirTwo.checked);

    // Synthetic ArrowLeft on one-tailed -> shifts focus back to two-tailed and checks it
    flushSync(() => {
      dirOne.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    });
    report('ArrowLeft moved focus back to two-tailed', document.activeElement === dirTwo);
    report('Two-tailed is checked after ArrowLeft', dirTwo.checked === true && !dirOne.checked);

    // Programmatic click on one-tailed
    flushSync(() => {
      dirOne.click();
    });
    report('Programmatic click on one-tailed selects it', dirOne.checked === true);

    // --- 3. SWITCH TO PAIRED SAMPLES LAB & VERIFY RENDERING ---
    const pairedTabBtn = Array.from(document.querySelectorAll('.sandbox-tabs button')).find(b => b.textContent.includes('Парные'));
    report('Paired tab button exists', !!pairedTabBtn);
    flushSync(() => {
      pairedTabBtn.click();
    });
    const spaghettiPlot = document.querySelector('.paired-svg');
    report('Paired spaghetti plot rendered in browser', !!spaghettiPlot);
    const simBadge = document.querySelector('.badge-simulated');
    report('Simulated data badge rendered', !!simBadge);
    const spssBtn = document.querySelector('.spss-guide-btn');
    report('SPSS guide transition link rendered', !!spssBtn && spssBtn.getAttribute('href') === '/guides#paired-t');

    // Append successful results tag into DOM for --dump-dom extraction
    const resDiv = document.createElement('div');
    resDiv.id = 'stand-results';
    resDiv.setAttribute('data-passed', 'true');
    resDiv.setAttribute('data-log', log.join(' | '));
    resDiv.textContent = 'ALL TESTS PASSED: ' + log.length + ' assertions';
    document.body.appendChild(resDiv);
  } catch (err) {
    const resDiv = document.createElement('div');
    resDiv.id = 'stand-results';
    resDiv.setAttribute('data-passed', 'false');
    resDiv.setAttribute('data-error', String(err && err.message ? err.message : err));
    resDiv.textContent = 'TEST FAILED: ' + (err && err.message ? err.message : err);
    document.body.appendChild(resDiv);
  }
}

runComponentTests();
`;

  try {
    fs.writeFileSync(standEntryFile, standClientCode, "utf8");

    // Bundle stand using esbuild with project node_modules resolution
    const bundleRes = esbuild.buildSync({
      entryPoints: [standEntryFile],
      bundle: true,
      format: "iife",
      write: false,
      define: { "process.env.NODE_ENV": '"development"' },
      loader: { ".tsx": "tsx", ".ts": "ts" },
      nodePaths: [path.resolve("node_modules")],
    });

    const bundleCode = bundleRes.outputFiles[0].text;
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>StatSandbox Component Stand</title>
</head>
<body>
  <div id="root"></div>
  <script>${bundleCode}<\/script>
</body>
</html>`;

    fs.writeFileSync(standHtmlFile, html, "utf8");

    // Execute via headless Chromium/Edge with isolated user-data-dir and timeout
    const stdout = cp.execFileSync(
      browserPath,
      [
        "--headless",
        "--dump-dom",
        "--disable-gpu",
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-extensions",
        "file:///" + standHtmlFile.replace(/\\/g, "/"),
      ],
      {
        encoding: "utf8",
        maxBuffer: 30 * 1024 * 1024,
        timeout: 15000, // 15-second bounded execution
      }
    );

    const match = stdout.match(/<div id="stand-results"[^>]*data-passed="([^"]+)"[^>]*>([\s\S]*?)<\/div>/);
    assert.ok(match, "Stand output must contain <div id='stand-results'>");
    const passed = match[1] === "true";
    assert.equal(passed, true, `Component stand failed: ${match[2]}`);
    assert.match(match[2], /ALL TESTS PASSED: 26 assertions/);
  } finally {
    // Clean up temporary files and isolated profile
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
});
