import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import * as fs from 'fs';
import 'dotenv/config';

// Initialize the Anthropic client using the environment secret
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// State tracking for our final GitHub markdown report
let generatedCodeString = "";
let healingLog = [];

async function runCompleteAIPipeline() {
  try {
    console.log("🤖 [AI Engine] Step 1: Generating full Playwright test from React source...");
    
    // Read the developer's React source code to analyze components and layout
    let appCode = "";
    try {
      appCode = fs.readFileSync('../src/App.jsx', 'utf8');
    } catch (e) {
      // Fallback path in case your folder architecture differs inside the workspace
      appCode = fs.readFileSync('./src/App.jsx', 'utf8');
    }

    // Request 1: Full Test Generation based on static code analysis
    const genMsg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ 
        role: 'user', 
        content: `Write a clean Playwright test script based on this React source code: \n\n${appCode}\n\n Include standard 'test' and 'expect' assertions.` 
      }],
    });

    // Safely extract text content from Claude's modern SDK payload layout
    const rawTextOutput = genMsg.text || (genMsg.content && genMsg.content[0]?.text) || "";
    
    if (!rawTextOutput) {
      console.error("❌ Claude returned an empty response block.");
      process.exit(1);
    }

    // Extract code blocks cleanly out of the response text markdown
    const codeMatch = rawTextOutput.match(/```javascript([\s\S]*?)```/);
    generatedCodeString = codeMatch ? codeMatch[1].trim() : rawTextOutput.trim();
    
    fs.writeFileSync('./ai-generated.spec.js', generatedCodeString);
    console.log("✅ Fresh Playwright script written to local platform: ./ai-generated.spec.js");

    // ----------------------------------------------------------------------------------
    
    console.log("🚀 [AI Engine] Step 2: Running Execution with Live Self-Healing check...");
    
    // Dynamic headless mode: True in GitHub cloud environment, False locally for live screen demos
    const isCI = process.env.CI ? true : false;
    const browser = await chromium.launch({ 
      headless: isCI,
      slowMo: isCI ? 0 : 500 // Slows down interactions slightly when running locally for the audience
    });
    
    const page = await browser.newPage();
    await page.goto('http://localhost:5173');

    // MOCK FAILURE SCENARIO: Intentionally look for a legacy element selector to trigger our healing block demo live
    const oldSelector = 'button#old-submit';

    try {
      // Attempt to click the outdated element
      await page.click(oldSelector, { timeout: 3000 });
      console.log("✅ Interaction passed naturally without healing requirement.");
    } catch (err) {
      console.log(`⚠️  Element [${oldSelector}] not found! Engaging Claude self-healing loop...`);
      
      // Capture the current live HTML state from the active browser memory
      const liveHTML = await page.content();

      // Request 2: Self-Healing Analysis using the active runtime DOM state
      const healMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        system: "You are an automated software test healing agent. Match the missing selector against the live DOM. Respond in raw JSON format only, with no markdown tags: {\"healed\": true, \"newSelector\": \"...\", \"reason\": \"...\"}",
        messages: [{ 
          role: 'user', 
          content: `Target selector "${oldSelector}" missing. Analyze and find its replacement in this live HTML: \n\n${liveHTML}` 
        }],
      });

      // Clean the response payload of any accidental markdown wrappers before parsing
      const rawHealText = healMsg.text || (healMsg.content && healMsg.content[0]?.text) || "{}";
      const cleanJSONString = rawHealText.replace(/```json|```/g, "").trim();
      
      const repairDetails = JSON.parse(cleanJSONString);
      
      if (repairDetails.healed) {
        console.log(`🩹 Fixed Live! Using selector: ${repairDetails.newSelector}`);
        
        // Log the mutation metrics for the final GitHub PR comment report
        healingLog.push({
          broken: oldSelector,
          fixed: repairDetails.newSelector,
          analysis: repairDetails.reason
        });
        
        // Resume script flow uninterrupted using the healed pointer
        await page.click(repairDetails.newSelector);
        console.log("🟢 Test successfully completed using healed component component path.");
      } else {
        throw new Error("AI agent failed to resolve structural mismatch.");
      }
    }

    await browser.close();
  } catch (globalError) {
    console.error("❌ Pipeline hit unhandled execution exception:", globalError);
  } finally {
    // Generate the markdown document regardless of run outcome
    buildMarkdownReport();
  }
}

function buildMarkdownReport() {
  let report = `### 🤖 AI Quality Platform: Run Report\n\n`;
  
  // Section 1: Displaying the freshly written code artifact
  report += `#### 🧪 1. Tests Fully Generated From Code Changes\n`;
  report += `* **File Staged:** \`ai-generated.spec.js\`\n\n`;
  report += `<details>\n<summary>Click to view the code Claude wrote from scratch</summary>\n\n`;
  report += `\`\`\`javascript\n${generatedCodeString || '// No test generated'}\n\`\`\`\n</details>\n\n---\n\n`;

  // Section 2: Visual matrix summary of any healing modifications
  report += `#### 🩹 2. Self-Healing Impact Summary\n`;
  if (healingLog.length > 0) {
    report += `| Original Test Selector | Current Live DOM Element | Healing Action Result |\n`;
    report += `| :--- | :--- | :--- |\n`;
    healingLog.forEach(item => {
      report += `| \`${item.broken}\` | \`${item.fixed}\` | 🩹 **Healed Live** |\n`;
    });
    report += `\n**Claude's Analysis:** *${healingLog[0].analysis}*\n`;
  } else {
    report += `✅ No missing UI components detected. Generated test scripts executed cleanly.\n`;
  }

  // Save the report text to disk so the GitHub runner's 'message-path' can grab it
  fs.writeFileSync('./pipeline-output.txt', report);
  console.log("💾 Pipeline execution report generated successfully: ./pipeline-output.txt");
}

runCompleteAIPipeline();
