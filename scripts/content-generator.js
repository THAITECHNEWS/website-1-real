import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchCustomRSSArticles, processRSSArticle } from './custom-feed-processor.js';
import Parser from 'rss-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load anchor data
async function loadAnchors() {
  const anchorsPath = path.join(__dirname, '../data/anchors.json');
  try {
    return await fs.readJson(anchorsPath);
  } catch (error) {
    console.log('Creating new anchors file...');
    const defaultAnchors = {
      sports_betting: [
        {"text": "รีวิว 1xbet", "url": "https://sportchai.com/%E0%B8%A3%E0%B8%B5%E0%B8%A7%E0%B8%B4%E0%B8%A7%E0%B8%84%E0%B8%B2%E0%B8%AA%E0%B8%B4%E0%B9%82%E0%B8%99/1xbet-%E0%B8%A3%E0%B8%A7%E0%B8%A7/", "used": 0},
        {"text": "1xbet", "url": "https://sportchai.com/%E0%B8%A3%E0%B8%B5%E0%B8%A7%E0%B8%B4%E0%B8%A7%E0%B8%84%E0%B8%B2%E0%B8%AA%E0%B8%B4%E0%B9%82%E0%B8%99/1xbet-%E0%B8%A3%E0%B8%A7%E0%B8%A7/", "used": 0}
      ],
      general_sports: [
        {"text": "ข่าวกีฬา", "url": "https://sportchai.com/%e0%b8%82%e0%b9%88%e0%b8%b2%e0%b8%a7%e0%b8%9f%e0%b8%b8%e0%b8%95%e0%b8%9a%e0%b8%ad%e0%b8%a5/", "used": 0},
        {"text": "ข่าวบอล", "url": "https://sportchai.com/%e0%b8%82%e0%b9%88%e0%b8%b2%e0%b8%a7%e0%b8%9f%e0%b8%b8%e0%b8%95%e0%b8%9a%e0%b8%ad%e0%b8%a5/", "used": 0}
      ]
    };
    await fs.writeJson(anchorsPath, defaultAnchors, { spaces: 2 });
    return defaultAnchors;
  }
}

// Update anchor usage
async function updateAnchorUsage(anchorText) {
  const anchorsPath = path.join(__dirname, '../data/anchors.json');
  const anchors = await loadAnchors();
  
  // Find and update the anchor
  for (const category in anchors) {
    const anchor = anchors[category].find(a => a.text === anchorText);
    if (anchor) {
      anchor.used += 1;
      break;
    }
  }
  
  await fs.writeJson(anchorsPath, anchors, { spaces: 2 });
}

// Helper function to escape YAML strings
function escapeYamlString(str) {
  if (!str) return '""';
  
  // Replace double quotes with escaped quotes
  const escaped = str.replace(/"/g, '\\"');
  
  // If the string contains special characters that need quoting, wrap in quotes
  if (escaped.includes(':') || escaped.includes('"') || escaped.includes("'") || 
      escaped.includes('\n') || escaped.includes('\\') || escaped.includes('[') || 
      escaped.includes(']') || escaped.includes('{') || escaped.includes('}') ||
      escaped.includes(',') || escaped.includes('&') || escaped.includes('*') ||
      escaped.includes('#') || escaped.includes('?') || escaped.includes('|') ||
      escaped.includes('-') || escaped.includes('>') || escaped.includes('!')) {
    return `"${escaped}"`;
  }
  
  return escaped;
}

// Create blog post from processed article
async function createBlogPost(processedArticle) {
  const postsDir = path.join(__dirname, '../src/content/blog');
  await fs.ensureDir(postsDir);
  
  // Create slug from Thai title
  const slug = processedArticle.title
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 80);
  
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${slug}.md`;
  
  // Image and credit info
  let heroImage = "/blog-placeholder-3.jpg"; // fallback
  let imageCredit = "";
  let imageAlt = "Real Madrid news";
  
  if (processedArticle.image) {
    heroImage = processedArticle.image.src;
    imageCredit = processedArticle.image.credit;
    imageAlt = processedArticle.image.alt || "Real Madrid news";
  }
  
  const frontmatter = `---
title: "${escapeYamlString(processedArticle.title).replace(/^"|"$/g, '')}"
description: "ข่าวล่าสุดของ Real Madrid แปลจากแหล่งข่าวต่างประเทศ"
pubDate: "${new Date().toISOString()}"
heroImage: "${escapeYamlString(heroImage).replace(/^"|"$/g, '')}"
imageAlt: "${escapeYamlString(imageAlt).replace(/^"|"$/g, '')}"
imageCredit: "${escapeYamlString(imageCredit).replace(/^"|"$/g, '')}"
tags: ["Real Madrid", "ฟุตบอล", "ลาลีกา", "เรอัล มาดริด"]
category: "football"
author: "SportChai News"
originalTitle: "${escapeYamlString(processedArticle.originalTitle).replace(/^"|"$/g, '')}"
originalSource: "${escapeYamlString(processedArticle.originalLink).replace(/^"|"$/g, '')}"
---

${processedArticle.content}

---

**อ่านข่าวกีฬาและการเดิมพันเพิ่มเติม:** [SportChai.com](https://sportchai.com) - ศูนย์รวมข่าวกีฬาและการวิเคราะห์ครบครัน`;

  const filepath = path.join(postsDir, filename);
  await fs.writeFile(filepath, frontmatter);
  
  console.log(`✅ Created blog post: ${filename}`);
  console.log(`📝 Title: ${processedArticle.title}`);
  console.log(`🖼️ Image: ${heroImage}`);
  console.log(`📷 Credit: ${imageCredit}`);
  
  return filepath;
}

// Helper to pick a random anchor from a group
function pickRandomAnchor(anchorArray) {
  if (!anchorArray || anchorArray.length === 0) return null;
  return anchorArray[Math.floor(Math.random() * anchorArray.length)];
}

// Helper to fetch general football articles only
async function fetchGeneralFootballArticles() {
  const parser = new Parser();
  const GENERAL_FOOTBALL_FEED = 'https://rss.app/feeds/tnSixxUg3xJ9OdKY.xml';
  const usedTopicsPath = path.join(__dirname, '../data/used-topics.json');
  let usedTopics = { topics: [] };
  try {
    usedTopics = await fs.readJson(usedTopicsPath);
  } catch {}
  const feed = await parser.parseURL(GENERAL_FOOTBALL_FEED);
  const allArticles = feed.items.map(item => ({
    title: item.title,
    description: item.contentSnippet || item.description || '',
    link: item.link,
    pubDate: item.pubDate,
    source: feed.title || 'RSS Feed'
  }));
  // Deduplicate and filter out already processed
  const seenTitles = new Set();
  const deduped = allArticles.filter(article => {
    if (seenTitles.has(article.title)) return false;
    seenTitles.add(article.title);
    return true;
  });
  const fresh = deduped.filter(article => !usedTopics.topics.some(topic => topic.title === article.title));
  return fresh;
}

// Main function - process fresh RSS articles
export async function generateDailyContent() {
  try {
    console.log('🎯 Fetching fresh articles from custom RSS...');
    // Get fresh articles from your RSS feed (Real Madrid preferred)
    const freshArticles = await fetchCustomRSSArticles();
    if (freshArticles.length === 0) {
      console.log('📰 No new articles found in RSS feed.');
      // Try general football feed as fallback
      const fallbackArticles = await fetchGeneralFootballArticles();
      if (fallbackArticles.length === 0) {
        console.log('❌ No new general football articles found.');
        return;
      }
      console.log('⚽ Trying general football articles as fallback...');
      await tryProcessArticles(fallbackArticles);
      return;
    }
    // Load anchor data
    const anchors = await loadAnchors();
    // Randomly select one anchor from each group
    const selectedAnchors = {
      sports_betting: [pickRandomAnchor(anchors.sports_betting)].filter(Boolean),
      general_sports: [pickRandomAnchor(anchors.general_sports)].filter(Boolean),
    };
    // Try to process Real Madrid articles
    const success = await tryProcessArticles(freshArticles, selectedAnchors);
    if (!success) {
      // If all fail, try general football feed
      const fallbackArticles = await fetchGeneralFootballArticles();
      if (fallbackArticles.length === 0) {
        console.log('❌ No new general football articles found.');
        return;
      }
      console.log('⚽ All Real Madrid articles failed, trying general football articles...');
      await tryProcessArticles(fallbackArticles, selectedAnchors);
    }
  } catch (error) {
    console.error('❌ Error generating content:', error);
  }
}

// Helper to try processing a list of articles, returns true if any succeed
async function tryProcessArticles(articles, selectedAnchors) {
  for (let i = 0; i < articles.length; i++) {
    const articleToProcess = articles[i];
    console.log(`\n🔄 Trying article ${i + 1}: "${articleToProcess.title}"`);
    const processedArticle = await processRSSArticle(articleToProcess, selectedAnchors);
    if (processedArticle) {
      // Success! Update anchor usage and create blog post
      if (selectedAnchors?.sports_betting?.[0]) {
        await updateAnchorUsage(selectedAnchors.sports_betting[0].text);
      }
      if (selectedAnchors?.general_sports?.[0]) {
        await updateAnchorUsage(selectedAnchors.general_sports[0].text);
      }
      // Create blog post
      await createBlogPost(processedArticle);
      console.log('✅ Content generation completed!');
      console.log(`📄 Processed: ${processedArticle.originalTitle}`);
      console.log(`🇹🇭 Thai title: ${processedArticle.title}`);
      return true;
    } else {
      console.log(`❌ Failed to process article ${i + 1}, trying next...`);
    }
  }
  console.log('❌ Failed to process any articles from this feed');
  return false;
}

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateDailyContent();
}