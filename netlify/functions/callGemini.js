const jwt = require('jsonwebtoken');

// Helper function to validate the Supabase JWT
const validateToken = (token) => {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('Supabase JWT Secret is not set in environment variables.');
  }

  return new Promise((resolve, reject) => {
    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        return reject(err);
      }
      // You can add additional checks here if needed, like checking the 'aud' or 'iss' claims
      resolve(decoded);
    });
  });
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Token Validation
    const authHeader = event.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: No token provided.' }) };
    }
    const token = authHeader.substring(7);

    try {
        await validateToken(token);
    } catch (error) {
        console.error("Token validation error:", error);
        return { statusCode: 401, body: JSON.stringify({ error: `Unauthorized: ${error.message}` }) };
    }

    // 2. Call Gemini API (only if token is valid)
    const { history, systemPrompt } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key is not configured on the server.");
    }

    const contents = history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
    }));

    const payload = {
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] }
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
    console.error("Netlify Function Error:", error);
    return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
    };
  }
};
