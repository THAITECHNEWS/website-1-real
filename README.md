# Automated Real Madrid News Blog

An automated Astro-based news blog that fetches, translates, and publishes Real Madrid news articles in Thai with affiliate/informational anchor links. The system uses AI-powered content generation, web scraping, and automated deployment.

## 🚀 Features

- **Automated Content Generation**: Fetches news from RSS feeds and translates to Thai
- **AI-Powered Translation**: Uses OpenAI API for natural Thai translations
- **Smart Anchor Insertion**: Automatically inserts affiliate/informational links naturally
- **Robust Image Handling**: Web scraping + Google Images fallback for high-quality images
- **SEO Optimized**: Sitemap, meta tags, and proper frontmatter
- **Automated Deployment**: Cloudflare Pages integration with GitHub
- **Content Deduplication**: Tracks used topics to avoid duplicates
- **Fallback Feeds**: Multiple news sources for content reliability

## 📁 Project Structure

```
website-1-real/
├── scripts/                    # Automation scripts
│   ├── content-generator.js    # Main content generation script
│   ├── news-fetcher.js         # RSS feed fetching
│   ├── web-scraper.js          # Web scraping utilities
│   ├── image-fetcher.js        # Image downloading and processing
│   ├── custom-feed-processor.js # Feed processing and translation
│   └── anchor-manager.js       # Anchor link management
├── data/                       # Configuration and tracking
│   ├── anchors.json           # Affiliate/informational links
│   └── used-topics.json       # Tracks published topics
├── src/
│   ├── content/blog/          # Generated blog posts
│   ├── layouts/               # Astro layouts
│   └── pages/                 # Astro pages
├── public/                    # Static assets
└── package.json               # Dependencies and scripts
```

## 🛠️ Setup Instructions

### 1. Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- OpenAI API key
- GitHub account
- Cloudflare account (for deployment)

### 2. Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd website-1-real

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your OpenAI API key
```

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 4. Configuration

#### RSS Feeds (`scripts/news-fetcher.js`)
Edit the feeds array to customize news sources:

```javascript
const feeds = [
  {
    name: 'Real Madrid',
    url: 'https://www.realmadrid.com/en/rss/news',
    priority: 1
  },
  {
    name: 'General Football',
    url: 'https://www.goal.com/en/rss/news',
    priority: 2
  }
];
```

#### Anchor Links (`data/anchors.json`)
Configure your affiliate/informational links:

```json
{
  "affiliate": [
    {
      "text": "ซื้อเสื้อเรอัล มาดริด",
      "url": "https://affiliate-link.com/real-madrid-jersey"
    }
  ],
  "informational": [
    {
      "text": "ประวัติเรอัล มาดริด",
      "url": "https://wikipedia.org/real-madrid"
    }
  ]
}
```

## 🚀 Usage Commands

### Development

```bash
# Start local development server
npm run dev

# Build for production (local)
npm run build

# Preview production build
npm run preview
```

### Content Generation

```bash
# Generate new content from RSS feeds
node scripts/content-generator.js

# Fetch and process news feeds
node scripts/news-fetcher.js

# Scrape images for existing posts
node scripts/image-fetcher.js
```

### Perplexity Content Generator

This script generates a Thai football news article using Perplexity.ai and OpenAI. It:
- Selects a random query from `data/perplexity-queries.json`
- Scrapes the main answer and top sources from Perplexity
- Scrapes the full text of the top 2 source articles
- Passes all this data to OpenAI to generate a fact-based, anchor-integrated Thai article
- Saves the article as a Markdown file in `src/content/blog/` with correct Astro frontmatter

### Usage

```sh
node scripts/perplexity-generator.js
```

This will generate one new article per run. Make sure your `.env` file contains a valid `OPENAI_API_KEY`.

### Git Operations

```bash
# Add all changes
git add .

# Commit changes
git commit -m "Add new posts"

# Push to GitHub (triggers Cloudflare deployment)
git push origin main

# Check status
git status

# View recent commits
git log --oneline -10
```

### Deployment

```bash
# Build and deploy to Cloudflare (if using Wrangler)
npm run build && npm run deploy

# Or simply push to GitHub for automatic deployment
git push origin main
```

## 🔧 Customization Guide

### For Different Sports/Teams

1. **Update RSS Feeds**: Modify `scripts/news-fetcher.js` with new feed URLs
2. **Change Site Title**: Update `astro.config.mjs` and layout files
3. **Update Anchors**: Modify `data/anchors.json` with relevant affiliate links
4. **Customize Prompts**: Edit translation prompts in `scripts/custom-feed-processor.js`

### For Different Languages

1. **Update Translation Prompts**: Modify the OpenAI prompts in `scripts/custom-feed-processor.js`
2. **Change Site Language**: Update `astro.config.mjs` and meta tags
3. **Adjust Anchor Text**: Update anchor text in `data/anchors.json`

### For Different Niches

1. **Modify Content Filters**: Update topic filtering in `scripts/custom-feed-processor.js`
2. **Change Image Search**: Update image search terms in `scripts/image-fetcher.js`
3. **Adjust SEO Keywords**: Update meta descriptions and titles

## 📊 Monitoring and Maintenance

### Content Quality
- Review generated posts in `src/content/blog/`
- Check `data/used-topics.json` for duplicate prevention
- Monitor image quality in `public/images/`

### Performance
- Check Cloudflare Pages dashboard for build status
- Monitor OpenAI API usage and costs
- Review site analytics in Cloudflare

### Troubleshooting

#### Common Issues

1. **Build Failures**: Check for YAML frontmatter errors in generated posts
2. **Missing Images**: Verify image URLs and fallback mechanisms
3. **Translation Errors**: Check OpenAI API key and rate limits
4. **Deployment Issues**: Verify GitHub integration and Cloudflare settings

#### Debug Commands

```bash
# Check for build errors
npm run build

# Validate markdown files
npm run astro check

# Test RSS feeds
node scripts/news-fetcher.js --test

# Check image downloads
node scripts/image-fetcher.js --debug
```

## 🔒 Security Considerations

- Keep API keys secure in environment variables
- Regularly rotate OpenAI API keys
- Monitor for unauthorized access to your deployment
- Review affiliate links for compliance

## 📈 Scaling Considerations

- Implement rate limiting for API calls
- Add caching for RSS feeds
- Consider database storage for larger content volumes
- Set up monitoring and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Astro](https://astro.build)
- Powered by [OpenAI](https://openai.com)
- Deployed on [Cloudflare Pages](https://pages.cloudflare.com)
- RSS parsing with [rss-parser](https://github.com/rbren/rss-parser)

---

**Note**: This is a template system. Remember to customize feeds, anchors, and prompts for your specific use case before deploying.
