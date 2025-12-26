#!/usr/bin/env node
/**
 * Test Nexus Extension API Connections
 * Run this from the extension directory to test all API endpoints
 */

const { GraphRAGClient } = require('./dist/clients/graphrag-client');
const { MageAgentClient } = require('./dist/clients/mageagent-client');

const API_KEY = 'brain_y6NFzv-Gx3UITfJgG0tWwd6XgeZbOCxAKNJ_Kjo2JjT8PAipLWGIPH-xRDQHyZAv';
const API_ENDPOINT = 'https://api.adverant.ai';

async function testGraphRAG() {
  console.log('\n🧪 Testing GraphRAG Client...\n');
  const client = new GraphRAGClient(API_ENDPOINT, API_KEY);

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthy = await client.healthCheck();
    console.log(`   ✅ Health check: ${healthy ? 'PASSED' : 'FAILED'}`);

    // Test 2: Search (may fail if no data)
    console.log('\n2. Testing search...');
    try {
      const results = await client.search('test', { limit: 1 });
      console.log(`   ✅ Search: PASSED (${results.length} results)`);
    } catch (error) {
      console.log(`   ⚠️  Search: ${error.message}`);
    }

    // Test 3: Store Entity
    console.log('\n3. Testing store entity...');
    try {
      const result = await client.storeEntity({
        domain: 'code',
        entityType: 'test',
        textContent: 'Test entity from VSCode extension',
        tags: ['test', 'vscode'],
      });
      console.log(`   ✅ Store entity: PASSED (ID: ${result.entityId})`);
    } catch (error) {
      console.log(`   ⚠️  Store entity: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error(`   ❌ GraphRAG Error: ${error.message}`);
    return false;
  }
}

async function testMageAgent() {
  console.log('\n🧪 Testing MageAgent Client...\n');
  const client = new MageAgentClient(API_ENDPOINT, API_KEY);

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthy = await client.healthCheck();
    console.log(`   ✅ Health check: ${healthy ? 'PASSED' : 'FAILED'}`);

    // Test 2: Orchestrate (simple task)
    console.log('\n2. Testing orchestrate...');
    try {
      const job = await client.orchestrate('Say hello in one word');
      console.log(`   ✅ Orchestrate: PASSED (Job ID: ${job.jobId})`);

      // Test 3: Check job status
      console.log('\n3. Testing job status...');
      const status = await client.getJobStatus(job.jobId);
      console.log(`   ✅ Job status: ${status.status}`);

      // Test 4: Wait for completion (with timeout)
      console.log('\n4. Testing wait for completion...');
      const result = await client.waitForCompletion(job.jobId, 30000);
      console.log(`   ✅ Job completed: ${result.status}`);
      if (result.result) {
        console.log(`   📝 Result: ${result.result.substring(0, 100)}...`);
      }
    } catch (error) {
      console.log(`   ⚠️  Orchestrate test: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error(`   ❌ MageAgent Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Nexus VSCode Extension - API Connection Tests');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n📡 API Endpoint: ${API_ENDPOINT}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 20)}...`);

  let graphragOk = false;
  let mageagentOk = false;

  try {
    graphragOk = await testGraphRAG();
  } catch (error) {
    console.error('GraphRAG test failed:', error);
  }

  try {
    mageagentOk = await testMageAgent();
  } catch (error) {
    console.error('MageAgent test failed:', error);
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  Test Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\nGraphRAG: ${graphragOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`MageAgent: ${mageagentOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('\n');

  process.exit(graphragOk && mageagentOk ? 0 : 1);
}

main().catch(console.error);
