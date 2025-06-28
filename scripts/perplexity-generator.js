import 'dotenv/config';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Load anchor data (same as RSS generator)
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

// Update anchor usage (same as RSS generator)
async function updateAnchorUsage(anchorText) {
  const anchorsPath = path.join(__dirname, '../data/anchors.json');
  const anchors = await loadAnchors();
  for (const category in anchors) {
    const anchor = anchors[category].find(a => a.text === anchorText);
    if (anchor) {
      anchor.used += 1;
      break;
    }
  }
  await fs.writeJson(anchorsPath, anchors, { spaces: 2 });
}

// Helper function to escape YAML strings (same as RSS generator)
function escapeYamlString(str) {
  if (!str) return '""';
  const escaped = str.replace(/"/g, '\\"');
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

// Create blog post from processed article (same as RSS generator)
async function createBlogPost(processedArticle) {
  const postsDir = path.join(__dirname, '../src/content/blog');
  await fs.ensureDir(postsDir);
  const slug = processedArticle.title
    .toLowerCase()
    .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 80);
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${slug}.md`;
  let heroImage = "/placeholder-hero.jpg";
  let imageCredit = "";
  let imageAlt = "Real Madrid news";
  if (processedArticle.image && processedArticle.image.src && processedArticle.image.src !== "") {
    heroImage = processedArticle.image.src;
    if (processedArticle.image.credit && processedArticle.image.credit !== "SportChai") {
      imageCredit = processedArticle.image.credit;
    } else {
      imageCredit = "";
    }
    imageAlt = processedArticle.image.alt || "Real Madrid news";
  }
  const yamlTitle = escapeYamlString(processedArticle.title);
  const yamlDescription = escapeYamlString("ข่าวล่าสุดของ Real Madrid แปลจากแหล่งข่าวต่างประเทศ");
  const yamlHeroImage = escapeYamlString(heroImage);
  const yamlImageAlt = escapeYamlString(imageAlt);
  const yamlImageCredit = imageCredit ? `imageCredit: ${escapeYamlString(imageCredit)}\n` : '';
  const yamlOriginalTitle = escapeYamlString(processedArticle.originalTitle);
  const frontmatter = `---\ntitle: ${yamlTitle}\ndescription: ${yamlDescription}\npubDate: \"${new Date().toISOString()}\"\nheroImage: ${yamlHeroImage}\nimageAlt: ${yamlImageAlt}\n${yamlImageCredit}tags: [\"Real Madrid\", \"ฟุตบอล\", \"ลาลีกา\", \"เรอัล มาดริด\"]\ncategory: \"football\"\nauthor: \"SportChai News\"\noriginalTitle: ${yamlOriginalTitle}\noriginalSource: \"OpenAI Search\"\n---\n\n${processedArticle.content}\n\n---\n\n**อ่านข่าวกีฬาและการเดิมพันเพิ่มเติม:** [SportChai.com](https://sportchai.com) - ศูนย์รวมข่าวกีฬาและการวิเคราะห์ครบครัน`;
  const filepath = path.join(postsDir, filename);
  await fs.writeFile(filepath, frontmatter);
  console.log(`✅ Created blog post: ${filename}`);
  console.log(`📝 Title: ${processedArticle.title}`);
  console.log(`🖼️ Image: ${heroImage}`);
  if (imageCredit) console.log(`📷 Credit: ${imageCredit}`);
  return filepath;
}

function pickRandomAnchor(anchorArray) {
  if (!anchorArray || anchorArray.length === 0) return null;
  return anchorArray[Math.floor(Math.random() * anchorArray.length)];
}

// Get random query from perplexity queries
async function getRandomQuery() {
  try {
    const queriesPath = path.join(__dirname, '../data/perplexity-queries.json');
    const queriesData = await fs.readFile(queriesPath, 'utf8');
    const queries = JSON.parse(queriesData);
    const randomIndex = Math.floor(Math.random() * queries.length);
    return queries[randomIndex];
  } catch (error) {
    console.error('Error loading queries:', error);
    throw error;
  }
}

// Generate Thai title from English title (same as RSS generator)
async function generateThaiTitle(englishTitle) {
  const prompt = `Create an engaging, clear Thai headline for this English news story: "${englishTitle}"

REQUIREMENTS:
- Thai language only
- 6-12 words maximum
- Clear, descriptive, and engaging
- Focus on Real Madrid when relevant
- No special characters or quotes
- Should immediately tell readers what the story is about
- Use natural Thai that sounds professional`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert Thai sports journalist. Create engaging, clear Thai headlines for Real Madrid and football news."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating Thai title:', error);
    return englishTitle; // Fallback to English title
  }
}

// Use OpenAI with search/browsing to generate a fact-based Thai article
async function generateArticleWithOpenAISearch(query, anchors) {
  const bettingAnchor = anchors.sports_betting?.[0];
  const sportsAnchor = anchors.general_sports?.[0];
  const prompt = `You are a professional Thai sports journalist. Search the web for the latest, most relevant information about: ${query}

Write a comprehensive, fact-based news article in Thai (600-800 words) using only the information you find. Include all names, dates, and events. Use markdown with headings and lists if appropriate.

Insert the following anchor links naturally in the article:
- [${bettingAnchor?.text}](${bettingAnchor?.url})
- [${sportsAnchor?.text}](${sportsAnchor?.url})

Do NOT invent or generalize. Do NOT repeat the title in the body.`;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      tools: [{ type: "web_search" }],
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
      max_tokens: 1800,
      temperature: 0.7,
    });
    let thaiContent = completion.choices[0].message.content.trim();
    thaiContent = thaiContent.replace(/^[\[].*?[\]]$/gm, '').replace(/\n{2,}/g, '\n').trim();
    // Ensure at least one anchor is present
    const bettingAnchorMarkdown = bettingAnchor ? `[${bettingAnchor.text}](${bettingAnchor.url})` : '';
    const sportsAnchorMarkdown = sportsAnchor ? `[${sportsAnchor.text}](${sportsAnchor.url})` : '';
    if (bettingAnchor && !thaiContent.includes(bettingAnchorMarkdown)) {
      thaiContent += `\n\n> สนใจเดิมพันเรอัลมาดริด? อ่านรีวิวที่นี่: ${bettingAnchorMarkdown}`;
    }
    if (sportsAnchor && !thaiContent.includes(sportsAnchorMarkdown)) {
      thaiContent += `\n\n> ติดตามข่าวฟุตบอลเพิ่มเติม: ${sportsAnchorMarkdown}`;
    }
    return thaiContent;
  } catch (error) {
    console.error('Error generating article with OpenAI search:', error);
    throw error;
  }
}

// Main workflow
async function processSearchArticle() {
  try {
    const query = await getRandomQuery();
    console.log(`📋 Processing query: ${query.substring(0, 100)}...`);
    const thaiTitle = await generateThaiTitle(query);
    const anchors = await loadAnchors();
    const selectedAnchors = {
      sports_betting: [pickRandomAnchor(anchors.sports_betting)].filter(Boolean),
      general_sports: [pickRandomAnchor(anchors.general_sports)].filter(Boolean),
    };
    const thaiContent = await generateArticleWithOpenAISearch(query, selectedAnchors);
    const processedArticle = {
      title: thaiTitle,
      content: thaiContent,
      image: {
        src: "/placeholder-hero.jpg",
        alt: "Real Madrid news",
        credit: ""
      },
      originalTitle: query,
      originalLink: 'OpenAI Search'
    };
    if (selectedAnchors.sports_betting?.[0]) {
      await updateAnchorUsage(selectedAnchors.sports_betting[0].text);
    }
    if (selectedAnchors.general_sports?.[0]) {
      await updateAnchorUsage(selectedAnchors.general_sports[0].text);
    }
    const filePath = await createBlogPost(processedArticle);
    console.log('✅ Content generation completed!');
    console.log(`📄 Processed: ${processedArticle.originalTitle}`);
    console.log(`🇹🇭 Thai title: ${processedArticle.title}`);
    console.log(`📍 File: ${filePath}`);
    return {
      filename: path.basename(filePath),
      filePath,
      title: thaiTitle
    };
  } catch (error) {
    console.error('❌ Error processing article:', error);
    return null;
  }
}

export async function generatePerplexityContent() {
  try {
    console.log('🎯 Generating Search-based content...');
    const result = await processSearchArticle();
    if (result) {
      console.log('\n🎉 SUCCESS! Article is now live in your Astro content folder!');
      console.log(`📄 File: ${result.filename}`);
      console.log(`📝 Title: ${result.title}`);
      return result;
    } else {
      console.log('❌ Failed to generate article');
      return null;
    }
  } catch (error) {
    console.error('❌ Error generating content:', error);
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generatePerplexityContent();
} 