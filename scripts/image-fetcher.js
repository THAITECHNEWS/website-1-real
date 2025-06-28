import 'dotenv/config';
import OpenAI from 'openai';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Unsplash API - free tier: 50 requests/hour
const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_KEY'; // You'll need to get this

// Generate image description based on article topic
async function generateImageDescription(topic, title) {
  const prompt = `Based on this Real Madrid article topic: "${topic}" and title: "${title}"

Generate specific search terms for finding a relevant Real Madrid photo. 

Focus ONLY on:
- Real Madrid official photos
- Santiago Bernabeu stadium
- Real Madrid players in white jerseys
- Real Madrid training sessions
- Real Madrid celebration moments
- Real Madrid logo/crest

Respond with ONLY the search terms, maximum 4-5 words.

Examples: 
- "Real Madrid players celebration"
- "Santiago Bernabeu stadium"
- "Real Madrid training session"
- "Real Madrid white jersey"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system", 
          content: "You generate short, specific search terms for finding Real Madrid related images only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 30,
      temperature: 0.5,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating image description:', error);
    return "Real Madrid team";
  }
}

// Search for images using Unsplash API
async function searchUnsplashImage(query) {
  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
      }
    });

    if (!response.ok) {
      throw new Error(`Unsplash API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      // Get a random image from results
      const randomImage = data.results[Math.floor(Math.random() * data.results.length)];
      return {
        url: randomImage.urls.regular,
        alt: randomImage.alt_description || query,
        credit: `Photo by ${randomImage.user.name} on Unsplash`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Unsplash search error:', error);
    return null;
  }
}

// Alternative: Search Pexels (free, no API key needed for basic use)
async function searchPexelsImage(query) {
  try {
    // Using Pexels free tier - you can get API key at pexels.com/api
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query + " football Real Madrid")}&per_page=10&orientation=landscape`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': 'YOUR_PEXELS_API_KEY'
      }
    });

    if (!response.ok) {
      throw new Error(`Pexels API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.photos && data.photos.length > 0) {
      const randomImage = data.photos[Math.floor(Math.random() * data.photos.length)];
      return {
        url: randomImage.src.large,
        alt: query,
        credit: `Photo by ${randomImage.photographer} on Pexels`
      };
    }
    
    return null;
  } catch (error) {
    console.error('Pexels search error:', error);
    return null;
  }
}

// Fallback: Use specific Real Madrid related Unsplash collections
async function getFallbackRealMadridImage() {
  // Curated Real Madrid specific images from Unsplash
  const realMadridImages = [
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=400&fit=crop&q=80", // Football stadium
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&h=400&fit=crop&q=80", // Football field  
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800&h=400&fit=crop&q=80", // Football action
    "https://images.unsplash.com/photo-1579952363873-27d3bfad9c0d?w=800&h=400&fit=crop&q=80", // Football team
    "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800&h=400&fit=crop&q=80", // Football match
    "https://images.unsplash.com/photo-1614632537190-23e4146777db?w=800&h=400&fit=crop&q=80", // Stadium crowd
  ];
  
  return {
    url: realMadridImages[Math.floor(Math.random() * realMadridImages.length)],
    alt: "Real Madrid football",
    credit: "Photo from Unsplash"
  };
}

// Download and process image (resize/crop to 1200x675)
async function downloadAndProcessImage(imageUrl, filename) {
  const publicDir = path.join(__dirname, '../public/auto-images');
  await fs.ensureDir(publicDir);
  const localPath = path.join(publicDir, filename);
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Failed to download image');
  const buffer = await response.arrayBuffer();
  // Resize/crop to 1200x675
  await sharp(Buffer.from(buffer))
    .resize(1200, 675, { fit: 'cover' })
    .toFile(localPath);
  return `/auto-images/${filename}`;
}

// Google Images fallback using puppeteer (robust)
async function searchGoogleImage(query) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const searchUrl = `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
  await page.goto(searchUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('img');
  // Click the first real image result to get the full-size image
  const imageSelector = 'a.wXeWr.islib.nfEiy';
  const imageLinks = await page.$$(imageSelector);
  let directImageUrl = null;
  for (let i = 0; i < imageLinks.length; i++) {
    try {
      await imageLinks[i].click();
      await page.waitForTimeout(1000); // Wait for preview to load
      // Get the direct image URL from the preview
      const previewImg = await page.$('img.n3VNCb');
      if (previewImg) {
        const src = await page.evaluate(img => img.src, previewImg);
        // Only accept real, direct image URLs (not thumbnails, not data URLs)
        if (src && src.startsWith('http') && !src.includes('gstatic.com') && !src.startsWith('data:')) {
          directImageUrl = src;
          break;
        }
      }
    } catch (err) { /* skip and try next */ }
  }
  await browser.close();
  return directImageUrl;
}

// Main function to get relevant image for article
export async function getRelevantImage(topic, title) {
  console.log('🖼️ Finding relevant image...');
  try {
    // Generate specific image description
    const imageDescription = await generateImageDescription(topic, title);
    console.log(`🔍 Searching for: ${imageDescription}`);
    // Try Unsplash first (if you have API key)
    if (UNSPLASH_ACCESS_KEY && UNSPLASH_ACCESS_KEY !== 'YOUR_UNSPLASH_KEY') {
      const unsplashImage = await searchUnsplashImage(imageDescription);
      if (unsplashImage) {
        console.log('✅ Found Unsplash image');
        return unsplashImage;
      }
    }
    // Google Images fallback (robust)
    console.log('🌐 Trying Google Images fallback...');
    const googleImageUrl = await searchGoogleImage(imageDescription + ' football');
    if (googleImageUrl) {
      try {
        // Download and check image size before using
        const filename = `googleimg-${Date.now()}.jpg`;
        const publicDir = path.join(__dirname, '../public/auto-images');
        await fs.ensureDir(publicDir);
        const localPath = path.join(publicDir, filename);
        const response = await fetch(googleImageUrl);
        if (!response.ok) throw new Error('Failed to download image');
        const buffer = await response.arrayBuffer();
        // Check image size before resizing
        const image = sharp(Buffer.from(buffer));
        const metadata = await image.metadata();
        if (metadata.width >= 800 && metadata.height >= 450) {
          await image.resize(1200, 675, { fit: 'cover' }).toFile(localPath);
          return {
            url: `/auto-images/${filename}`,
            alt: imageDescription,
            credit: 'Image via Google Images search'
          };
        } else {
          console.log('❌ Google image too small, skipping.');
        }
      } catch (err) {
        console.error('Failed to download/process Google image:', err);
      }
    }
    // Fallback to curated Real Madrid images
    console.log('📸 Using fallback Real Madrid image');
    return getFallbackRealMadridImage();
  } catch (error) {
    console.error('Error fetching image:', error);
    return getFallbackRealMadridImage();
  }
}

// Test function
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const testImage = await getRelevantImage(
      "Vinicius Jr performance analysis", 
      "วินิซิอุส จูเนียร์ ขึ้นแท่นดาวเด่นเกมล่าสุด"
    );
    console.log('Test image result:', testImage);
  })();
}