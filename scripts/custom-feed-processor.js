import 'dotenv/config';
import Parser from 'rss-parser';
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import OpenAI from 'openai';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parser = new Parser();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const REAL_MADRID_FEED = 'https://rss.app/feeds/tQzBDrDjRWRQArVY.xml';
const GENERAL_FOOTBALL_FEED = 'https://rss.app/feeds/tnSixxUg3xJ9OdKY.xml';

// Load used topics to avoid duplicates
async function loadUsedTopics() {
  const topicsPath = path.join(__dirname, '../data/used-topics.json');
  try {
    return await fs.readJson(topicsPath);
  } catch (error) {
    return { topics: [] };
  }
}

// Save used topics
async function saveUsedTopics(topics) {
  const topicsPath = path.join(__dirname, '../data/used-topics.json');
  await fs.writeJson(topicsPath, { topics }, { spaces: 2 });
}

// Check if article was already processed
function isArticleProcessed(title, usedTopics) {
  return usedTopics.some(topic => {
    const similarity = calculateSimilarity(title.toLowerCase(), topic.title.toLowerCase());
    return similarity > 0.8; // High similarity threshold
  });
}

// Simple similarity check
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Fetch fresh articles from your custom RSS
export async function fetchCustomRSSArticles() {
  const usedTopics = await loadUsedTopics();
  let allArticles = [];
  
  // 1. Try Real Madrid feed first
  try {
    console.log(`📡 Checking: ${REAL_MADRID_FEED}`);
    const feed = await parser.parseURL(REAL_MADRID_FEED);
    console.log(`📊 Found ${feed.items.length} items in Real Madrid feed`);
    for (const item of feed.items.slice(0, 10)) {
      allArticles.push({
        title: item.title,
        description: item.contentSnippet || item.description || '',
        link: item.link,
        pubDate: item.pubDate,
        source: feed.title || 'RSS Feed'
      });
    }
  } catch (error) {
    console.error(`❌ Error fetching from Real Madrid feed:`, error);
  }

  // Deduplicate by title
  const seenTitles = new Set();
  const dedupedArticles = allArticles.filter(article => {
    if (seenTitles.has(article.title)) return false;
    seenTitles.add(article.title);
    return true;
  });

  // Filter out already processed topics
  let freshArticles = dedupedArticles.filter(article => !isArticleProcessed(article.title, usedTopics.topics));

  // Log skipped articles
  dedupedArticles.forEach(article => {
    if (isArticleProcessed(article.title, usedTopics.topics)) {
      console.log(`⏭️ Skipping processed article: ${article.title}`);
    }
  });

  if (freshArticles.length > 0) {
    console.log(`✅ Found ${freshArticles.length} new Real Madrid articles to process`);
    return freshArticles;
  }

  // 2. If no new Real Madrid articles, try general football feed
  allArticles = [];
  try {
    console.log(`📡 Checking: ${GENERAL_FOOTBALL_FEED}`);
    const feed = await parser.parseURL(GENERAL_FOOTBALL_FEED);
    console.log(`📊 Found ${feed.items.length} items in General Football feed`);
    for (const item of feed.items.slice(0, 10)) {
      allArticles.push({
        title: item.title,
        description: item.contentSnippet || item.description || '',
        link: item.link,
        pubDate: item.pubDate,
        source: feed.title || 'RSS Feed'
      });
    }
  } catch (error) {
    console.error(`❌ Error fetching from General Football feed:`, error);
  }

  // Deduplicate by title
  const seenTitles2 = new Set();
  const dedupedArticles2 = allArticles.filter(article => {
    if (seenTitles2.has(article.title)) return false;
    seenTitles2.add(article.title);
    return true;
  });

  // Filter out already processed topics
  freshArticles = dedupedArticles2.filter(article => !isArticleProcessed(article.title, usedTopics.topics));

  // Log skipped articles
  dedupedArticles2.forEach(article => {
    if (isArticleProcessed(article.title, usedTopics.topics)) {
      console.log(`⏭️ Skipping processed article: ${article.title}`);
    }
  });

  console.log(`✅ Found ${freshArticles.length} new General Football articles to process`);
  return freshArticles;
}

// Scrape full article content and images with retry logic
async function scrapeArticleContentAndImages(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🕷️ Scraping attempt ${attempt}/${retries}: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        timeout: 15000 // 15 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;
      
      // Extract main content
      let content = '';
      const contentSelectors = [
        'article',
        '.article-body',
        '.article-content',
        '.entry-content',
        '.post-content',
        '.content',
        '[role="main"]',
        'main',
        '.story-body',
        '.article-text',
        '.post-body',
        '.single-content'
      ];
      
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.length > 200) {
          content = element.textContent.trim();
          console.log(`📝 Found content using selector: ${selector}`);
          break;
        }
      }
      
      // If no content found with selectors, try getting all paragraphs
      if (!content || content.length < 200) {
        const paragraphs = Array.from(document.querySelectorAll('p'))
          .map(p => p.textContent.trim())
          .filter(text => text.length > 50)
          .join(' ');
        
        if (paragraphs.length > content.length) {
          content = paragraphs;
          console.log('📝 Found content using paragraph extraction');
        }
      }
      
      // Extract images more aggressively
      const images = [];
      const imgElements = document.querySelectorAll('img');
      
      console.log(`🖼️ Found ${imgElements.length} images on page`);
      
      for (const img of imgElements) {
        let src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('srcset');
        const alt = img.alt || img.getAttribute('title') || '';
        
        // Handle srcset - get largest image
        if (src && src.includes(',')) {
          const srcsetArray = src.split(',');
          src = srcsetArray[srcsetArray.length - 1].trim().split(' ')[0];
        }
        
        if (src) {
          // Make relative URLs absolute
          if (src.startsWith('//')) {
            src = 'https:' + src;
          } else if (src.startsWith('/')) {
            const baseUrl = new URL(url);
            src = baseUrl.origin + src;
          } else if (!src.startsWith('http')) {
            const baseUrl = new URL(url);
            src = baseUrl.origin + '/' + src;
          }
          
          // Filter out unwanted images
          const unwantedPatterns = [
            'icon', 'logo', 'avatar', 'profile', 'advertisement', 'ad-', 'banner',
            'social', 'share', 'facebook', 'twitter', 'instagram', 'youtube',
            'placeholder', 'loading', 'spinner', '1x1', 'pixel'
          ];
          
          const isUnwanted = unwantedPatterns.some(pattern => 
            src.toLowerCase().includes(pattern) || alt.toLowerCase().includes(pattern)
          );
          
          // Only include larger images that seem relevant
          if (!isUnwanted && src.startsWith('http') && 
              (img.width > 200 || img.height > 200 || 
               alt.toLowerCase().includes('real madrid') || 
               alt.toLowerCase().includes('football') ||
               alt.toLowerCase().includes('soccer') ||
               src.toLowerCase().includes('real-madrid') ||
               src.toLowerCase().includes('football'))) {
            
            images.push({
              src: src,
              alt: alt,
              width: img.width || 0,
              height: img.height || 0,
              credit: new URL(url).hostname
            });
            
            console.log(`📸 Found image: ${src} (${img.width}x${img.height})`);
          }
        }
      }
      
      // Clean up content
      content = content
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/Advertisement/gi, '')
        .replace(/Subscribe/gi, '')
        .replace(/Sign up/gi, '')
        .replace(/Follow us/gi, '')
        .trim();
      
      console.log(`✅ Scraped ${content.length} characters and ${images.length} relevant images`);
      
      return {
        content: content,
        images: images
      };
      
    } catch (error) {
      console.log(`❌ Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === retries) {
        console.log('❌ All scraping attempts failed');
        return {
          content: null,
          images: []
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// Translate English article to Thai with Real Madrid focus
async function translateToThai(englishContent, originalTitle, anchors) {
  const bettingAnchor = anchors.sports_betting?.[0];
  const sportsAnchor = anchors.general_sports?.[0];
  
  const prompt = `You are a professional Thai sports journalist. Your task is to create a comprehensive, well-researched Thai article based on this English news content.

ORIGINAL CONTENT: "${englishContent}"

INSTRUCTIONS:
1. TITLE:
   - The article title will be provided separately and used as the H1. Do NOT repeat or restate the title in the article body. Do NOT start the article with the title.

2. CONTENT REQUIREMENTS:
   - Fully understand the complete context and background of the story
   - Provide wider context when needed (historical background, player stats, team dynamics, etc.)
   - Write in simple, clear, native Thai that's easy to understand
   - Length: 600-800 words
   - Structure: Introduction + 3-4 detailed sections with ## subheadings
   - Include relevant statistics, quotes, and background information
   - Make it comprehensive and informative, not just a direct translation

3. ANCHOR/LINK INTEGRATION (CRITICAL):
   - You will be given a list of links (anchors) to insert in the article.
   - **Branded/Promotional Anchors (e.g., "รีวิว 1xbet")**:
     - Only insert if you can write a natural, promotional sentence (e.g., "If you want to bet on Real Madrid, check out our 1xbet review here…").
     - Use a call-to-action (CTA) style.
     - Do NOT just drop the anchor at the end of a random sentence.
     - If it doesn't fit, SKIP IT.
   - **Informational Anchors (e.g., "ข่าวกีฬา")**:
     - Insert naturally when discussing news, updates, or general football context.
     - Use as a reference, not a forced link.
   - Each link must flow naturally and logically with the text. If you cannot insert a link naturally, do not use it.
   - Maximum 1 link per paragraph, placed where it adds value.

4. WRITING STYLE:
   - Professional but accessible Thai
   - Clear explanations for complex football concepts
   - Engaging and informative tone
   - No main # headings in content

EXAMPLE STRUCTURE:
[Introduction paragraph - set the scene and context]

## [Relevant subheading based on content]
[Detailed paragraph with natural link placement where it makes sense]

## [Another relevant subheading]
[Another detailed paragraph with context and possibly another link]

## [Final subheading]
[Concluding paragraph with summary and final thoughts]

ANCHORS TO USE:
- [${bettingAnchor?.text}](${bettingAnchor?.url})
- [${sportsAnchor?.text}](${sportsAnchor?.url})`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert Thai sports journalist with deep knowledge of Real Madrid, football tactics, and Thai language. You create comprehensive, well-researched articles that provide full context and naturally integrate relevant links. You never repeat the title in the body, and you only insert branded/affiliate links with a natural CTA if it fits."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    let thaiContent = completion.choices[0].message.content.trim();

    // Remove any prompt instructions or placeholders like [Introduction paragraph - ...]
    thaiContent = thaiContent.replace(/^\[.*?\]$/gm, '').replace(/^\[.*?\]$/gm, '').replace(/\n{2,}/g, '\n').trim();

    return thaiContent;
  } catch (error) {
    console.error('Error translating content:', error);
    throw error;
  }
}

// Generate Thai title from English title
async function generateThaiTitle(englishTitle) {
  const prompt = `Create an engaging, clear Thai headline for this English news story: "${englishTitle}"

REQUIREMENTS:
- Thai language only
- 6-12 words maximum
- Clear, descriptive, and engaging
- Focus on Real Madrid when relevant
- No special characters or quotes
- Should immediately tell readers what the story is about
- Use natural Thai that sounds professional

EXAMPLES OF GOOD THAI HEADLINES:
- "เรอัล มาดริด ชนะครึ่งแรก 2-0"
- "วินิซิอุส ซัดประตูสวย คว้าชัย"
- "มาดริด เตรียมดวลบาร์ซา ในเอล คลาสิโก"
- "อันเชลอตติ เปิดใจเรื่องแผนการเล่นใหม่"
- "แฟนบอลมาดริด ตื่นเต้นกับนักเตะใหม่"`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are an expert Thai headline writer who creates clear, engaging, and descriptive headlines for sports news."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 50,
      temperature: 0.8,
    });

    return completion.choices[0].message.content.trim().replace(/["""]/g, '');
  } catch (error) {
    console.error('Error generating Thai title:', error);
    return `ข่าว Real Madrid ${new Date().toLocaleDateString('th-TH')}`;
  }
}

// Process a single article from RSS
export async function processRSSArticle(article, anchors) {
  try {
    console.log(`\n🔄 Processing: ${article.title}`);
    
    // Scrape full content and images
    const scraped = await scrapeArticleContentAndImages(article.link);
    
    if (!scraped.content) {
      console.log('❌ Could not scrape content, skipping...');
      return null;
    }
    
    // Generate Thai title
    console.log('🏷️ Generating Thai title...');
    const thaiTitle = await generateThaiTitle(article.title);
    
    // Translate content to Thai
    console.log('🔄 Translating to Thai...');
    let thaiContent = await translateToThai(scraped.content, article.title, anchors);
    
    // Select best image
    let selectedImage = null;
    if (scraped.images && scraped.images.length > 0) {
      // Prefer larger images and Real Madrid related ones
      const validImages = scraped.images.filter(img => img && img.src); // Ensure image has src
      
      if (validImages.length > 0) {
        selectedImage = validImages
          .filter(img => img.width > 300 || img.height > 200) // Filter for decent size
          .sort((a, b) => {
            // Prioritize Real Madrid related images
            const aRelevant = (a.alt && a.alt.toLowerCase().includes('real madrid') || 
                             a.alt && a.alt.toLowerCase().includes('football') ||
                             a.alt && a.alt.toLowerCase().includes('soccer')) ? 1000 : 0;
            const bRelevant = (b.alt && b.alt.toLowerCase().includes('real madrid') || 
                             b.alt && b.alt.toLowerCase().includes('football') ||
                             b.alt && b.alt.toLowerCase().includes('soccer')) ? 1000 : 0;
            
            // Then by size
            const aSize = (a.width || 0) * (a.height || 0);
            const bSize = (b.width || 0) * (b.height || 0);
            
            return (bRelevant + bSize) - (aRelevant + aSize);
          })[0];
        
        // If no large images found, use the first valid image
        if (!selectedImage && validImages.length > 0) {
          selectedImage = validImages[0];
        }
      }
      
      if (selectedImage && selectedImage.src) {
        console.log(`🖼️ Selected image: ${selectedImage.src}`);
      } else {
        console.log('📷 No suitable images found, will use fallback');
      }
    } else {
      console.log('📷 No images found, will use fallback');
    }
    
    // Mark as processed
    const usedTopics = await loadUsedTopics();
    usedTopics.topics.push({
      title: article.title,
      date: new Date().toISOString()
    });
    await saveUsedTopics(usedTopics.topics);
    
    return {
      title: thaiTitle,
      content: thaiContent,
      image: selectedImage,
      originalTitle: article.title,
      originalLink: article.link,
      source: article.source
    };
    
  } catch (error) {
    console.error('❌ Error processing article:', error);
    return null;
  }
}

// Test function
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const articles = await fetchCustomRSSArticles();
    console.log(`Found ${articles.length} articles to process`);
    
    if (articles.length > 0) {
      const mockAnchors = {
        sports_betting: [{"text": "รีวิว 1xbet", "url": "https://sportchai.com/1xbet"}],
        general_sports: [{"text": "ข่าวกีฬา", "url": "https://sportchai.com/news"}]
      };
      
      const processed = await processRSSArticle(articles[0], mockAnchors);
      console.log('Processed article:', processed);
    }
  })();
}