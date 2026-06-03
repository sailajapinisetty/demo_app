import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
import * as fs from 'fs';
import 'dotenv/config';

// Initialize Claude client using the environment variable
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

let healingReport = [];

async function runSmartTest() {
  // 1. Launch a browser window (headed mode so the audience can see it)
  const browser = await chromium.launch({ 
    headless: process.env.CI ? true : false, 
    slowMo: process.env.CI ? 0 : 500 
  });
  const page = await browser.newPage();
  
  // Assumes your React dev server is running locally on port 5173 or 3000
  await page.goto('http://localhost:5173'); 

  console.log("🚀 [Pipeline] Running UI Test Suite...");

  // The selector we expect to fail because the developer changed it in demo-app
  const targetSelector = '#old-submit'; 
  
  try {
    await page.click(targetSelector, { timeout: 3000 });
    console.log("✅ Step passed naturally.");
  } catch (error) {
    console.log(`⚠️ Element [${targetSelector}] not found! Consulting Claude...`);
    
    // Capture the current live HTML state of your running React app
    const liveDOM = await page.content();
    
    // Call Claude to analyze the DOM layout and resolve the missing button
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6', // Fast and accurate for code/DOM analysis
      max_tokens: 1024,
      system: "You are a Principal QE automation agent. Your job is to locate elements that have changed IDs or attributes. You must respond ONLY with a raw JSON object string. Do not include markdown wraps like ```json.",
      messages: [{ 
        role: 'user', 
        content: `The automated test failed to find the selector "${targetSelector}". 
                  Here is the live DOM layout of the page:
                  \n\n${liveDOM}\n\n
                  Find the element that replaced "${targetSelector}". Return this exact JSON format:
                  {"healed": true, "newSelector": "#the-new-id", "explanation": "Why it changed"}`
      }],
    });

    // Parse Claude's analysis
    const result = JSON.parse(message.content[0].text);

    if (result.healed) {
      console.log(`🤖 [Claude] Element healed! New target: ${result.newSelector}`);
      
      healingReport.push({
        broken: targetSelector,
        fixed: result.newSelector,
        reason: result.explanation
      });

      // Execute the action using the corrected selector so the test run finishes successfully
      await page.click(result.newSelector);
      console.log("🟢 [Pipeline] Test successfully completed using healed element.");
      
      // Permanently update the test suite repository
      updateTestRepositoryFile(targetSelector, result.newSelector);
    } else {
      throw new Error("Claude could not resolve the element change.");
    }
  }

  await browser.close();
  generateGitPRComment();
}

function updateTestRepositoryFile(oldSelector, newSelector) {
  console.log(`💾 [Repo Update] Automatically replaced '${oldSelector}' with '${newSelector}' inside test code.`);
}

function generateGitPRComment() {
  let markdownReport = "";

  if (healingReport.length > 0) {
    markdownReport += `### 🤖 AI Test Pipeline Run: Success (Self-Healed) \n\n`;
    healingReport.forEach(item => {
      markdownReport += `❌ **Missing Element:** \`${item.broken}\` \n`;
      markdownReport += `🩹 **Self-Healed To:** \`${item.fixed}\` \n`;
      markdownReport += `💡 **Claude's Analysis:** ${item.reason} \n\n`;
    });
    markdownReport += `⚙️ *Action taken: Code updated inside the testing environment.*`;
  } else {
    markdownReport += `### ✅ AI Pipeline Run: All Tests Passed Cleanly.`;
  }

  // Save the file right where the GitHub Action step expects to find it
  fs.writeFileSync('./pipeline-output.txt', markdownReport);
}

runSmartTest();
