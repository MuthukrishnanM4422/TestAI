require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// TEMPORARY: Hardcoded API key for testing
const GROQ_API_KEY = process.env.GROQ_API_KEY || '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';

console.log('API Key status:', GROQ_API_KEY ? 'LOADED ✅' : 'MISSING ❌');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

app.post('/api/generate', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages) {
      return res.status(400).json({ error: 'Missing messages array.' });
    }

    console.log('Sending request to Groq API...');
    
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    const data = await groqResponse.json();
    console.log('Groq response status:', groqResponse.status);
    
    if (!groqResponse.ok) {
      console.error('Groq error:', data);
      return res.status(groqResponse.status).json({ 
        error: data.error?.message || 'LLM API error' 
      });
    }

    console.log('Response received successfully');
    res.json(data);
    
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname,'index.html'));
});

app.listen(PORT, () => {
  console.log('✅ Server running at http://192.168.1.105:3000/api/generate:' + PORT);
});
