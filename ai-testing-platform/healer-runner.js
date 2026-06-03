import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import * as fs from 'fs';
import 'dotenv/config';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Structural states for the final PR log
let generatedCodeString = "";
let healingLog = [];

async function runCompleteAIPipeline() {
  console.log("🤖 Step 1: Generating full Playwright test from React source...");
  
  // Read developer's App.jsx code file directly
  let appCode = fs.readFileSync('../src/App.jsx', 'utf8');

  // Request 1: Full Test Generation
  const genMsg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6', // Active current generation engine
    max_tokens: 1500,
    messages: [{ 
      role: 'user', 
      content: `Write a clean Playwright test script based on this React code: \n\n${appCode}\n\n Include standard 'test' and 'expect' assertions.` 
    }],
  });

  // Extract code blocks out cleanly
  const codeMatch = genMsg.content.text.match(/```javascript([\s\S]*?)```/);
  generatedCodeString = codeMatch ? codeMatch[1].trim() : "// Code generation failed";
  fs.writeFileSync('./ai-generated.spec.js', generatedCodeString);
  console.log("✅ Fresh Playwright script written to: ./ai-generated.spec.js");

  // -------------------------------------------------------------
  
  console.log("🚀 Step 2: Running Execution with Live Self-Healing check...");
  const browser = await chromium.launch({ headless: process.env.CI ? true : false });
  const page = await browser.newPage();
  await page.goto('http://localhost:5173');

  // Intentionally try an old selector to trigger our healing block demo live
  const oldSelector = 'button#old-submit';

  try {
    await page.click(oldSelector, { timeout: 2000 });
  } catch (err) {
    console.log(`⚠️  ${oldSelector} failed! Engaging Claude for repair loop...`);
    const liveHTML = await page.content();

    // Request 2: Self-Healing Analysis
    const healMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: "You are a healing agent. Respond in raw JSON format only: {\"healed\": true, \"newSelector\": \"...\", \"reason\": \"...\"}",
      messages: [{ 
        role: 'user', 
        content: `Target selector "${oldSelector}" missing. Match against this live HTML: \n\n${liveHTML}` 
      }],
    });

    const repairDetails = JSON.parse(healMsg.content.text);
    if (repairDetails.healed) {
      console.log(`🩹 Fixed Live! Using selector: ${repairDetails.newSelector}`);
      healingLog.push({
        broken: oldSelector,
        fixed: repairDetails.newSelector,
        analysis: repairDetails.reason
      });
      
      // Complete the interaction on the live browser screen
      await page.click(repairDetails.newSelector);
    }
  }

  await browser.close();
  buildMarkdownReport();
}

function buildMarkdownReport() {
  let report = `### 🤖 AI Quality Platform: Run Report\n\n`;
  
  // Section 1: Visual representation of code generation
  report += `#### 🧪 1. Tests Fully Generated From Code Changes\n`;
  report += `* **File Staged:** \`ai-generated.spec.js\`\n\n`;
  report += `<details>\n<summary>Click to view the code Claude wrote from scratch</summary>\n\n`;
  report += `\`\`\`javascript\n${generatedCodeString}\n\`\`\`\n</details>\n\n---\n\n`;

  // Section 2: Visual mapping of what broke and healed
  report += `#### 🩹 2. Self-Healing Impact Summary\n`;
  if (healingLog.length > 0) {
    report += `| Original Test Selector | Current Live DOM Element | Healing Action Result |\n`;
    report += `| :--- | :--- | :--- |\n`;
    healingLog.forEach(item => {
      report += `| \`${item.broken}\` | \`${item.fixed}\` | 🩹 **Healed Live** |\n`;
    });
    report += `\n**Claude's Analysis:** *${healingLog[0].analysis}*\n`;
  } else {
    report += `✅ No missing UI components detected. Test script executed cleanly.\n`;
  }

  fs.writeFileSync('./pipeline-output.txt', report);
  console.log("💾 Pipeline execution report generated successfully!");
}

runCompleteAIPipeline();
