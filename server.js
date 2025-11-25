const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
// Increase payload limit to handle base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Gemini Client
// CRITICAL: Ensure API_KEY is set in your Render Environment Variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

app.get('/', (req, res) => {
  res.send('HairGenius API is running');
});

app.post('/api/generate', async (req, res) => {
  try {
    const { image, prompt, referenceImage, mimeType } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ error: 'Missing image or prompt' });
    }

    if (!process.env.API_KEY) {
      console.error("API_KEY is missing on server");
      return res.status(500).json({ error: 'Server configuration error: API Key missing' });
    }

    // Strip the data:image/jpeg;base64, prefix if present
    const cleanBase64 = image.split(',')[1] || image;

    const parts = [
      {
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || 'image/jpeg',
        },
      }
    ];

    // Add Reference Image if provided
    if (referenceImage) {
      const cleanRefBase64 = referenceImage.split(',')[1] || referenceImage;
      parts.push({
        inlineData: {
          data: cleanRefBase64,
          mimeType: 'image/jpeg', // Assuming jpeg for simplicity, or pass mimeType from frontend
        },
      });
      // Context for reference image
      parts.push({
        text: `Edit the first image. Change the person's hairstyle to match the hairstyle shown in the second image. ${prompt}. Keep the face and background of the first image consistent. High quality, photorealistic.`
      });
    } else {
      // Standard Prompt
      parts.push({
        text: `Edit this image to change the person's hairstyle. ${prompt}. Keep the face and background consistent, only change the hair. High quality, photorealistic.`
      });
    }

    // Call Gemini
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
    });

    let imageUrl = null;
    let textResponse = null;

    if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        } else if (part.text) {
          textResponse = part.text;
        }
      }
    }

    if (!imageUrl && !textResponse) {
      throw new Error("No content generated from Gemini.");
    }

    res.json({ imageUrl, text: textResponse });

  } catch (error) {
    console.error('Generation Error:', error);
    
    // Send appropriate error status
    if (error.message && error.message.includes('429')) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    
    res.status(500).json({ 
      error: error.message || 'Internal Server Error',
      details: error.toString() 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});