import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg', resolution = '4K', enhanceMode = 'deblur' } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'No image data provided' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        success: false,
        fallbackToLocal: true,
        error: 'GEMINI_API_KEY is not configured. Using local 4K engine.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');

    let promptText = 'Restore, unblur, sharpen, and super-resolve this image into ultra-crisp 4K high definition master quality. ';
    if (enhanceMode === 'deblur') {
      promptText += 'Eliminate all motion blur, focus blur, lens aberrations, and soft edges. Sharpen fine details, textures, hair, eyes, and micro-contrasts with crystal clarity while maintaining exact original colors, composition, and subject identity.';
    } else if (enhanceMode === 'portrait' || enhanceMode === 'face') {
      promptText += 'Restore all facial features with extreme detail: crystal clear eyes, skin textures, hair strands, and lighting. Remove blurriness, compression artifacts, and pixelation while preserving natural identity faithfully.';
    } else if (enhanceMode === 'denoise') {
      promptText += 'Remove all digital noise, ISO grain, JPEG artifacts, and blur. Produce an ultra-clean, sharp, high-fidelity 4K output with smooth gradients and crisp edges.';
    } else {
      promptText += 'Perform 4K super-resolution upscaling with deep detail reconstruction, crystal-clear edges, vivid balanced contrast, and no blur.';
    }

    const targetSize = resolution === '2K' ? '2K' : resolution === '1K' ? '1K' : '4K';

    let response = null;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
              },
            },
            {
              text: promptText,
            },
          ],
        },
        config: {
          imageConfig: {
            imageSize: targetSize,
          },
        },
      });
    } catch (primaryError) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: {
            parts: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
                },
              },
              {
                text: promptText,
              },
            ],
          },
        });
      } catch (fallbackError) {
        return res.json({
          success: false,
          fallbackToLocal: true,
          quotaExceeded: true,
          error: 'Cloud AI quota limit reached. Automatically processed using High-Speed 4K Clarifier.',
        });
      }
    }

    let resultImage = null;
    let resultMime = 'image/png';

    if (response && response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          resultMime = part.inlineData.mimeType || 'image/png';
          resultImage = `data:${resultMime};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!resultImage) {
      return res.json({
        success: false,
        fallbackToLocal: true,
        error: 'No image returned by AI model. Using Local 4K engine.',
      });
    }

    return res.json({
      success: true,
      enhancedImage: resultImage,
      mimeType: resultMime,
      resolution: targetSize,
    });
  } catch (error) {
    return res.json({
      success: false,
      fallbackToLocal: true,
      error: error.message || 'Handled error during AI processing',
    });
  }
}
