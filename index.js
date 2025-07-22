const fs = require('fs');
const axios = require('axios');

// Load environment variables from .env file
require('dotenv').config();

// Configuration
const CONFIG = {
  // You'll need to set these values based on your Drift API credentials
  DRIFT_API_TOKEN: process.env.DRIFT_API_TOKEN || 'your_drift_api_token_here',
  DRIFT_ORG_ID: process.env.DRIFT_ORG_ID || 'your_org_id_here',
  INPUT_CSV_FILE: 'Drift_Chats_03_01_2025_to_06_26_2025.csv',
  OUTPUT_CSV_FILE: 'conversation_transcripts.csv',
  RATE_LIMIT_DELAY: 500, // Delay between API calls in milliseconds
  MAX_RETRIES: 3
};

// Function to read and parse the input CSV file
function readConversationIds() {
  try {
    const csvContent = fs.readFileSync(CONFIG.INPUT_CSV_FILE, 'utf8');
    const lines = csvContent.trim().split('\n');

    // Skip the header row and extract conversation IDs
    const conversationIds = lines.slice(1).filter(line => line.trim() !== '');

    console.log(`Found ${conversationIds.length} conversation IDs to process`);
    return conversationIds;
  } catch (error) {
    console.error('Error reading CSV file:', error.message);
    process.exit(1);
  }
}

// Function to fetch conversation transcript from Drift API
async function fetchConversationTranscript(conversationId) {
  const url = `https://driftapi.com/conversations/${conversationId}/transcript`;

  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${CONFIG.DRIFT_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (response.data) {
      // Return the transcript string directly without any modification
      const transcript = response.data.transcript || response.data.data || response.data;
      // Return as-is without any processing
      if (typeof transcript === 'string') {
        return transcript;
      } else {
        console.warn(`Unexpected response format for conversation ${conversationId}`);
        return 'Unexpected response format';
      }
    } else {
      console.warn(`No transcript found for conversation ${conversationId}`);
      return 'No transcript found';
    }
  } catch (error) {
    if (error.response) {
      console.error(`API Error for conversation ${conversationId}: ${error.response.status} - ${error.response.statusText}`);
      return `Error: ${error.response.status} - ${error.response.statusText}`;
    } else if (error.request) {
      console.error(`Network Error for conversation ${conversationId}: No response received`);
      return 'Error: Network timeout';
    } else {
      console.error(`Error for conversation ${conversationId}: ${error.message}`);
      return `Error: ${error.message}`;
    }
  }
}

// Function to strip HTML tags from text
function stripHtmlTags(html) {
  if (!html || typeof html !== 'string') {
    return html;
  }

  // Remove HTML tags and decode common HTML entities
  return html
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    // Handle specific numeric entities first (before generic replacement)
    .replace(/&#64;/g, '@') // Replace @ symbol entity
    .replace(/&#39;/g, "'") // Replace apostrophes
    .replace(/&#8217;/g, "'") // Replace right single quotation mark (another apostrophe)
    .replace(/&#8216;/g, "'") // Replace left single quotation mark
    .replace(/&#8220;/g, '"') // Replace left double quotation mark
    .replace(/&#8221;/g, '"') // Replace right double quotation mark
    .replace(/&#8211;/g, '-') // Replace en dash
    .replace(/&#8212;/g, '—') // Replace em dash
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec)) // Replace remaining numeric entities
    // Handle named entities
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/&amp;/g, '&') // Replace ampersands
    .replace(/&lt;/g, '<') // Replace less than
    .replace(/&gt;/g, '>') // Replace greater than
    .replace(/&quot;/g, '"') // Replace quotes
    .replace(/&apos;/g, "'") // Replace apostrophes (XML style)
    .replace(/&hellip;/g, '...') // Replace ellipsis
    // Fix common character encoding issues
    .replace(/‚Äô/g, "'") // Fix mangled apostrophe
    .replace(/‚Äú/g, '"') // Fix mangled left quote
    .replace(/‚Äù/g, '"') // Fix mangled right quote
    .replace(/‚Äì/g, '-') // Fix mangled dash
    .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
    .trim(); // Remove leading/trailing whitespace
}

// Function to format messages into a readable transcript
function formatTranscript(messages) {
  if (!messages || messages.length === 0) {
    return 'No messages in conversation';
  }

  const formattedMessages = messages.map(message => {
    const timestamp = new Date(message.createdAt).toLocaleString();
    const author = message.author?.displayName || message.author?.email || 'Unknown';
    const rawContent = message.body || message.content || '[No content]';
    const content = stripHtmlTags(rawContent);

    return `[${timestamp}] ${author}: ${content}`;
  }).join('\n');

  return formattedMessages;
}

// Function to escape CSV content (handle quotes and commas)
function escapeCsvContent(content) {
  if (typeof content !== 'string') {
    content = String(content);
  }

  // Replace quotes with double quotes and wrap in quotes if contains comma, quote, or newline
  if (content.includes('"') || content.includes(',') || content.includes('\n')) {
    return '"' + content.replace(/"/g, '""') + '"';
  }
  return content;
}

// Function to write results to CSV file
function writeResultsToCsv(results) {
  try {
    // Create CSV header
    let csvContent = 'Conversation Id,Transcript\n';

    // Add each result
    results.forEach(result => {
      const escapedTranscript = escapeCsvContent(result.transcript);
      csvContent += `${result.conversationId},${escapedTranscript}\n`;
    });

    fs.writeFileSync(CONFIG.OUTPUT_CSV_FILE, csvContent, 'utf8');
    console.log(`\nResults written to ${CONFIG.OUTPUT_CSV_FILE}`);
  } catch (error) {
    console.error('Error writing CSV file:', error.message);
  }
}

// Function to add delay between API calls
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main function to process all conversations
async function processConversations() {
  console.log('Starting conversation transcript extraction...\n');

  // Validate configuration
  if (CONFIG.DRIFT_API_TOKEN === 'your_drift_api_token_here') {
    console.error('Error: Please set your DRIFT_API_TOKEN in the environment variables or update the CONFIG object');
    process.exit(1);
  }

  const conversationIds = readConversationIds();
  const results = [];

  for (let i = 0; i < conversationIds.length; i++) {
    const conversationId = conversationIds[i].trim();
    console.log(`Processing conversation ${i + 1}/${conversationIds.length}: ${conversationId}`);

    let transcript = null;
    let retryCount = 0;

    // Retry logic for failed requests
    while (retryCount < CONFIG.MAX_RETRIES && transcript === null) {
      try {
        transcript = await fetchConversationTranscript(conversationId);

        if (transcript && !transcript.startsWith('Error:')) {
          console.log(`✓ Successfully fetched transcript for ${conversationId}`);
        } else {
          console.log(`⚠ Issues with conversation ${conversationId}: ${transcript}`);
        }

        results.push({
          conversationId: conversationId,
          transcript: transcript || 'Failed to retrieve'
        });

      } catch (error) {
        retryCount++;
        console.log(`Retry ${retryCount}/${CONFIG.MAX_RETRIES} for conversation ${conversationId}`);

        if (retryCount >= CONFIG.MAX_RETRIES) {
          console.error(`Failed to fetch conversation ${conversationId} after ${CONFIG.MAX_RETRIES} retries`);
          results.push({
            conversationId: conversationId,
            transcript: 'Failed after retries'
          });
        } else {
          await delay(CONFIG.RATE_LIMIT_DELAY * retryCount); // Exponential backoff
        }
      }
    }

    // Rate limiting
    if (i < conversationIds.length - 1) {
      await delay(CONFIG.RATE_LIMIT_DELAY);
    }
  }

  // Write results to CSV
  writeResultsToCsv(results);

  console.log('\n=== Summary ===');
  console.log(`Total conversations processed: ${results.length}`);
  console.log(`Successful extractions: ${results.filter(r => r.transcript && !r.transcript.startsWith('Error:') && !r.transcript.startsWith('Failed')).length}`);
  console.log(`Failed extractions: ${results.filter(r => r.transcript && (r.transcript.startsWith('Error:') || r.transcript.startsWith('Failed'))).length}`);
}

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Run the script
if (require.main === module) {
  processConversations().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  processConversations,
  fetchConversationTranscript,
  formatTranscript
};
