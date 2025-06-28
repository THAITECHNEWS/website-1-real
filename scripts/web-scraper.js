import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

// Scrape full article content from URL
export async function scrapeArticleContent(url, source) {
  try {
    console.log(`🕷️ Scraping: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;
    
    let content = '';
    
    // Different selectors for different sources
    if (source.includes('managingmadrid.com')) {
      const article = document.querySelector('.c-entry-content');
      if (article) {
        content = article.textContent.trim();
      }
    } else if (source.includes('marca.com')) {
      const article = document.querySelector('.ue-c-article__body');
      if (article) {
        content = article.textContent.trim();
      }
    } else if (source.includes('realmadridnews.com')) {
      const article = document.querySelector('.entry-content');
      if (article) {
        content = article.textContent.trim();
      }
    } else {
      // Generic fallback
      const selectors = [
        'article',
        '.article-content',
        '.entry-content', 
        '.post-content',
        '.content',
        'main'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.length > 200) {
          content = element.textContent.trim();
          break;
        }
      }
    }
    
    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, ' ')
      .substring(0, 2000); // Limit length
    
    console.log(`✅ Scraped ${content.length} characters`);
    return content;
    
  } catch (error) {
    console.log(`❌ Scraping failed: ${error.message}`);
    return null;
  }
}