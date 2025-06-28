import Parser from 'rss-parser';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parser = new Parser();

// Working Real Madrid news sources
const NEWS_SOURCES = [
  'https://www.managingmadrid.com/rss/current',
  'https://bernabeudigital.com/rss',
  'https://realmadridnews.com/feed',
  'https://feeds.elpais.com/mrss-s/list/ep/site/english.elpais.com/section/sports/real-madrid',
  'https://e00-marca.uecdn.es/rss/en/football/real-madrid.xml'
];

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

// Check if topic was already used (last 30 days)
function isTopicUsed(title, usedTopics) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return usedTopics.some(topic => {
    const topicDate = new Date(topic.date);
    const similarity = calculateSimilarity(title.toLowerCase(), topic.title.toLowerCase());
    return similarity > 0.7 && topicDate > thirtyDaysAgo;
  });
}

// Simple similarity check
function calculateSimilarity(str1, str2) {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  const commonWords = words1.filter(word => words2.includes(word));
  return commonWords.length / Math.max(words1.length, words2.length);
}

// Fetch fresh Real Madrid news
export async function fetchFreshNews() {
  const usedTopics = await loadUsedTopics();
  const freshNews = [];
  
  console.log('🔍 Fetching fresh Real Madrid news...');
  
  for (const sourceUrl of NEWS_SOURCES) {
    try {
      console.log(`📡 Checking: ${sourceUrl}`);
      const feed = await parser.parseURL(sourceUrl);
      
      for (const item of feed.items.slice(0, 15)) {
        const publishDate = new Date(item.pubDate || item.isoDate);
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3); // Extended to 3 days
        
        if (publishDate > threeDaysAgo && !isTopicUsed(item.title, usedTopics.topics)) {
          freshNews.push({
            title: item.title,
            description: item.contentSnippet || item.description || '',
            link: item.link,
            pubDate: item.pubDate,
            source: sourceUrl
          });
        }
      }
    } catch (error) {
      console.log(`⚠️ Error fetching from ${sourceUrl}:`, error.message);
    }
  }
  
  console.log(`✅ Found ${freshNews.length} fresh news items`);
  return freshNews;
}

// Get news topics for content generation
export async function getNewsTopics() {
  const freshNews = await fetchFreshNews();
  const usedTopics = await loadUsedTopics();
  
  if (freshNews.length === 0) {
    console.log('📰 No fresh news found, using enhanced fallback topics...');
    return [
      "Real Madrid's latest tactical setup under Carlo Ancelotti and formation changes",
      "Vinicius Jr performance analysis and his role in upcoming matches", 
      "Jude Bellingham's impact on Real Madrid's midfield dynamics",
      "Real Madrid's preparation for Champions League knockout stages",
      "Transfer window updates and potential new signings for Real Madrid",
      "Kylian Mbappé's adaptation to Real Madrid playing style",
      "Real Madrid vs Barcelona El Clasico preview and tactical analysis",
      "Luka Modrić's continued influence despite his age in Real Madrid squad",
      "Real Madrid's youth academy prospects and future stars",
      "Santiago Bernabéu Stadium renovations and their impact on match atmosphere"
    ];
  }
  
  // Convert news to topics for AI generation
  const topics = freshNews.slice(0, 5).map(news => ({
    topic: `${news.title}: ${news.description}`,
    originalTitle: news.title,
    source: news.source
  }));
  
  // Mark topics as used
  const newUsedTopics = freshNews.map(news => ({
    title: news.title,
    date: new Date().toISOString()
  }));
  
  usedTopics.topics.push(...newUsedTopics);
  await saveUsedTopics(usedTopics.topics);
  
  return topics;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const topics = await getNewsTopics();
    console.log('📊 Available topics:', topics);
  })();
}