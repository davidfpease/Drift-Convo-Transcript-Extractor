# Drift API Configuration

## Setup Instructions

1. **Get your Drift API Token:**
   - Log into your Drift account
   - Go to Settings > App Store > Build Your Own App
   - Create a new app or use an existing one
   - Copy your OAuth Token or API Key

2. **Find your Organization ID:**
   - This is usually available in your Drift dashboard URL or API documentation
   - You might need to contact Drift support if you can't locate it

3. **Set Environment Variables:**
   ```bash
   export DRIFT_API_TOKEN="your_actual_api_token_here"
   export DRIFT_ORG_ID="your_org_id_here"
   ```

4. **Or edit the CONFIG object in index.js directly:**
   ```javascript
   const CONFIG = {
     DRIFT_API_TOKEN: 'your_actual_api_token_here',
     DRIFT_ORG_ID: 'your_org_id_here',
     INPUT_CSV_FILE: 'your input file of drift convo ids',
     OUTPUT_CSV_FILE: 'name of the output file of transcripts'
     // ... rest of config
   };
   ```

## Running the Script

Before running the script, be sure to have the csv file referenced in the CONFIG object as "INPUT_CSV_FILE" available. See the included csv as an example. To retrieve a list of conversation Ids from Drift, use the Chat Data [report](https://app.drift.com/reports/conversations/data).

```bash
# Install dependencies (if not already installed)
npm install

# Run the script
npm start

# Or directly with node
node index.js
```

## Output

The script will create a new file called `conversation_transcripts.csv` with:
- Column 1: Conversation Id
- Column 2: Complete conversation transcript with timestamps and participant names

## Notes

- The script includes rate limiting (1 second between requests) to respect Drift's API limits
- It handles errors gracefully and will retry failed requests up to 3 times
- Progress is logged to the console so you can track the extraction process
- Large transcripts are properly escaped for CSV format

## API Documentation

For more information about Drift's API:
- Drift API Documentation: https://devdocs.drift.com/
- Conversations API: https://devdocs.drift.com/docs/conversation-model
