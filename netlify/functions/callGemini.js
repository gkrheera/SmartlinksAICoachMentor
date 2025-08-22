// /netlify/functions/callGemini.js

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { history, systemPrompt } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("API key is not configured.");
    }
    
    // Format messages for the Gemini API
    const contents = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const payload = {
        contents,
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        }
    };

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("API Error:", errorBody);
        return { statusCode: response.status, body: JSON.stringify({ error: `API request failed: ${errorBody}` }) };
    }

    const result = await response.json();
    const aiContent = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";

    return {
        statusCode: 200,
        body: JSON.stringify({ response: aiContent }),
    };

  } catch (error) {
    console.error("Function Error:", error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
    };
  }
};
