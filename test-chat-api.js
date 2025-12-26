#!/usr/bin/env node
/**
 * Test Nexus Chat API directly
 * Tests code explanation feature
 */

const axios = require('axios');

const API_ENDPOINT = 'https://api.adverant.ai';
const API_KEY = 'brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv';

async function testChatAPI() {
  console.log('🧪 Testing Nexus Chat API...\n');

  try {
    // Test 1: Simple code explanation
    console.log('Test 1: Code Explanation');
    console.log('========================');

    const response = await axios.post(
      `${API_ENDPOINT}/api/chat`,
      {
        message: `Explain this code:\n\n\`\`\`typescript\nexport async function activate(context: vscode.ExtensionContext) {\n  console.log('Nexus VSCode extension is now active');\n}\n\`\`\``,
        options: {
          model: 'claude-3-5-sonnet-20241022'
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000
      }
    );

    console.log('✅ SUCCESS!');
    console.log('Response Type:', response.data.type);
    console.log('Message ID:', response.data.messageId);
    console.log('Session ID:', response.data.sessionId);
    console.log('\nContent Preview:');
    console.log(response.data.content.substring(0, 200) + '...');
    console.log('\nRouting Info:');
    console.log('- Service:', response.data.routing?.service);
    console.log('- Operation:', response.data.routing?.operation);
    console.log('- Confidence:', response.data.routing?.confidence);

  } catch (error) {
    console.log('❌ FAILED!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');

  try {
    // Test 2: Natural language query
    console.log('Test 2: Natural Language Query');
    console.log('===============================');

    const response = await axios.post(
      `${API_ENDPOINT}/api/chat`,
      {
        message: 'What are the main features of this VSCode extension?',
        context: {
          repository: {
            path: '/Users/don/Adverant/nexus-vscode-plugin'
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000
      }
    );

    console.log('✅ SUCCESS!');
    console.log('Response Type:', response.data.type);
    console.log('\nContent Preview:');
    console.log(response.data.content.substring(0, 200) + '...');
    console.log('\nRouting Info:');
    console.log('- Service:', response.data.routing?.service);
    console.log('- Confidence:', response.data.routing?.confidence);

  } catch (error) {
    console.log('❌ FAILED!');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
  }
}

testChatAPI().catch(console.error);
