#!/usr/bin/env node
/**
 * Test AI Context Generation locally
 */

const path = require('path');
const fs = require('fs').promises;

// Import from repochief-core
const { AIContextGenerator } = require('./repochief-core/src/ai-context');

async function testLocalAIContext() {
  console.log('🧪 Testing Local AI Context Generation\n');
  
  try {
    // Define test task directly
    const task = {
      id: 'test-task-001',
      objective: 'Fix error handling in the Intent creation API',
      description: 'The /api/intents POST endpoint needs proper error handling for validation failures',
      acceptanceCriteria: [
        'Validate required fields (objective, businessValue)',
        'Return appropriate HTTP status codes',
        'Include descriptive error messages',
        'Add tests for error cases'
      ],
      priority: 'high',
      type: 'bugfix',
      estimatedHours: 4
    };
    
    console.log('📋 Task loaded:');
    console.log(`   Objective: ${task.objective}`);
    console.log(`   Type: ${task.type}`);
    console.log(`   Priority: ${task.priority}\n`);
    
    // Test different formats
    const formats = ['claude', 'cursor', 'universal'];
    
    for (const format of formats) {
      console.log(`🤖 Generating ${format} format...`);
      
      const generator = new AIContextGenerator({
        format: format,
        maxFiles: 10,
        includeInstructions: true
      });
      
      const context = await generator.generateContext(
        task,
        path.join(__dirname, 'repochief-core')
      );
      
      // Save output
      const ext = format === 'universal' ? 'json' : 'md';
      const outputFile = `test-output-${format}.${ext}`;
      
      if (typeof context === 'object') {
        await fs.writeFile(outputFile, JSON.stringify(context, null, 2));
      } else {
        await fs.writeFile(outputFile, context);
      }
      
      console.log(`   ✅ Saved to ${outputFile}`);
      
      // Show excerpt
      const excerpt = typeof context === 'object' 
        ? JSON.stringify(context, null, 2).substring(0, 200)
        : context.substring(0, 200);
      console.log(`   Preview: ${excerpt}...\n`);
    }
    
    console.log('✅ All AI context formats generated successfully!');
    console.log('\n📁 Generated files:');
    console.log('   - test-output-claude.md');
    console.log('   - test-output-cursor.md');
    console.log('   - test-output-universal.json');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }
}

testLocalAIContext();