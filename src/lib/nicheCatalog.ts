import type {
  AccountProfile,
  AudiencePersona,
  BrandBrain,
  GhostPilotStore,
  MonetizationOffer,
} from './types';
import { DEFAULT_BANNED_CLICHES } from './copyScorer';

export interface SubNicheDefinition {
  id: string;
  name: string;
  microAngles: string[];
  subreddits: string[];
  buyerRole: string;
  fears: string[];
  desires: string[];
  keywords: string[];
  tone: string;
  defaultKeyword: string;
}

export interface MarketCategoryDefinition {
  id: string;
  name: string;
  tagline: string;
  subNiches: SubNicheDefinition[];
}

export const BUYER_GOALS = [
  'Sell a Whop or Affiliate Course',
  'Sell My Own Digital Product / PDF / Template',
  'Grow an Authority Audience & Newsletter',
  'Book High-Ticket Coaching or Agency Clients',
  'Drive Users to a SaaS / AI Tool / GitHub Repo',
] as const;

export const MARKET_NICHE_CATALOG: MarketCategoryDefinition[] = [
  {
    id: 'ai-tech',
    name: 'AI, Tech & Software',
    tagline: 'AI agents, vibe coding, open-source GitHub tools, SaaS & automation',
    subNiches: [
      {
        id: 'ai-agents-vibe-coding',
        name: 'AI Agents & Vibe Coding',
        microAngles: [
          'Building $0 AI apps with Antigravity & Gemini',
          'Open-source AI agent workflows & GitHub repos',
          'No-code to full-stack vibe coding for beginners',
          'Local LLMs & zero-cost AI automation stacks',
        ],
        subreddits: ['LocalLLaMA', 'artificial', 'SideProject', 'singularity'],
        buyerRole: 'Indie builders, solo founders & beginner vibe coders',
        fears: ['falling behind on AI tools', 'wasting money on paid API subscriptions', 'getting stuck on technical errors'],
        desires: ['launch profitable AI apps fast', 'automate work at $0/month', 'discover breakout GitHub repos early'],
        keywords: ['agent', 'github', 'workflow', 'local', 'prompt', 'automate', 'free', 'repo', 'stack'],
        tone: 'Sharp, builder-first curator sharing tested tools, exact workflows, and zero hype.',
        defaultKeyword: 'STACK',
      },
      {
        id: 'saas-micro-saas',
        name: 'SaaS & Micro-SaaS Growth',
        microAngles: [
          'Validating $1k–$10k/mo micro-SaaS ideas',
          'Building in public & X distribution for founders',
          'SaaS onboarding, pricing & churn reduction',
          'Solo bootstrapping without VC funding',
        ],
        subreddits: ['SaaS', 'indiehackers', 'Entrepreneur', 'microsaas'],
        buyerRole: 'Solo SaaS founders and technical indie hackers',
        fears: ['building a product nobody buys', 'high churn killing MRR', 'zero traffic after launch day'],
        desires: ['predictable $10k MRR', 'organic customer acquisition from X', 'high-converting landing pages'],
        keywords: ['mrr', 'churn', 'saas', 'founder', 'launch', 'pricing', 'users', 'retention'],
        tone: 'Transparent operator sharing real revenue numbers, experiments, and product lessons.',
        defaultKeyword: 'SAAS',
      },
      {
        id: 'workflow-automation',
        name: 'No-Code & Business Automation',
        microAngles: [
          'n8n, Make & Zapier workflows that save 20 hrs/wk',
          'AI automations for small business owners',
          'Selling $2k+ automation setups to local agencies',
          'Replacing manual spreadsheets with automated bots',
        ],
        subreddits: ['automation', 'n8n', 'nocode', 'smallbusiness'],
        buyerRole: 'Operations leads, freelancers & automation agency owners',
        fears: ['drowning in repetitive manual tasks', 'fragile automations breaking', 'competing on low hourly rates'],
        desires: ['save 15+ hours every week', 'sell high-margin automation retainers', 'copy plug-and-play blueprints'],
        keywords: ['automation', 'workflow', 'n8n', 'hours', 'client', 'template', 'blueprint', 'system'],
        tone: 'Practical systems architect who breaks complex automations into 3-step visual blueprints.',
        defaultKeyword: 'FLOW',
      },
      {
        id: 'cybersecurity-devops',
        name: 'Cybersecurity, Cloud & DevOps',
        microAngles: [
          'Practical security checklists for startups & devs',
          'Breaking into high-paying cybersecurity roles',
          'Self-hosting & privacy tools on a budget',
          'Cloud cost reduction & DevOps architecture',
        ],
        subreddits: ['cybersecurity', 'netsec', 'selfhosted', 'devops'],
        buyerRole: 'Developers, IT engineers & aspiring security analysts',
        fears: ['getting breached or leaking API keys', 'failing technical certifications', 'bloated cloud bills'],
        desires: ['bulletproof infrastructure', 'six-figure security career', 'clean self-hosted setups'],
        keywords: ['security', 'cloud', 'server', 'privacy', 'audit', 'self-host', 'zero-trust'],
        tone: 'Calm, authoritative engineer giving actionable security teardowns and checklists.',
        defaultKeyword: 'AUDIT',
      },
    ],
  },
  {
    id: 'sales-marketing',
    name: 'Sales, Marketing & Copywriting',
    tagline: 'High-ticket closing, direct-response copy, cold outreach, ads & SEO',
    subNiches: [
      {
        id: 'high-ticket-sales',
        name: 'High-Ticket Sales & Appointment Setting',
        microAngles: [
          'Objection handling & calm closing on $3k–$25k calls',
          'Remote closer & DM setter career roadmaps',
          'Discovery call psychology & pain diagnosis',
          'Following up with ghosted proposals without sounding needy',
        ],
        subreddits: ['sales', 'entrepreneur', 'SaaS', 'consulting'],
        buyerRole: 'Remote closers, appointment setters & B2B founders',
        fears: ['getting ghosted after sending proposals', 'freezing on price objections', 'inconsistent commission checks'],
        desires: ['30%+ close rates without pushiness', '$10k+/mo remote closing income', 'word-for-word rebuttal scripts'],
        keywords: ['close', 'objection', 'discovery', 'call', 'prospect', 'deal', 'script', 'setter', 'pipeline'],
        tone: 'Direct, tactical sales operator sharing real call notes, exact word tracks, and zero fluff.',
        defaultKeyword: 'CLOSE',
      },
      {
        id: 'copywriting-persuasion',
        name: 'Direct-Response Copywriting & Funnels',
        microAngles: [
          'High-converting landing pages & sales letters',
          'Email marketing sequences that print revenue',
          'Psychological hooks & buyer persuasion triggers',
          'Freelance copywriting client acquisition',
        ],
        subreddits: ['copywriting', 'marketing', 'Entrepreneur', 'emailmarketing'],
        buyerRole: 'Freelance copywriters, marketers & digital product sellers',
        fears: ['writing copy that gets zero clicks', 'being replaced by generic AI slop', 'charging low rates'],
        desires: ['proven swipe files that convert', 'high-retainer copywriting clients', 'irresistible hooks'],
        keywords: ['hook', 'copy', 'conversion', 'email', 'headline', 'offer', 'swipe', 'sales'],
        tone: 'Sharp direct-response strategist using crisp punchy lines and real conversion teardowns.',
        defaultKeyword: 'SWIPE',
      },
      {
        id: 'cold-outreach-leadgen',
        name: 'Cold Email, Cold DM & B2B Lead Gen',
        microAngles: [
          'Cold email deliverability & inbox placement systems',
          'Warm X & LinkedIn DM scripts that book meetings',
          'Scraping verified B2B lead lists on a $0 budget',
          'Building outbound engines for agencies',
        ],
        subreddits: ['coldemail', 'leadgeneration', 'B2BMarketing', 'agency'],
        buyerRole: 'B2B agency owners, SDRs & outbound lead-gen specialists',
        fears: ['landing in spam folders', 'under 1% reply rates', 'burning domains'],
        desires: ['book 10+ qualified B2B calls per week', 'high-reply personalized scripts', 'repeatable outbound systems'],
        keywords: ['cold email', 'dm', 'reply rate', 'lead', 'deliverability', 'outbound', 'booked call'],
        tone: 'Data-driven outbound specialist sharing real split-test percentages and raw DM templates.',
        defaultKeyword: 'OUTBOUND',
      },
      {
        id: 'paid-ads-seo',
        name: 'Paid Ads, Meta/Google & Organic SEO',
        microAngles: [
          'Meta & TikTok ad creative hooks that scale ROAS',
          'Programmatic SEO & organic traffic flywheels',
          'Local business Google Ads & lead funnels',
          'Fixing leaking checkout & conversion rates',
        ],
        subreddits: ['PPC', 'SEO', 'FacebookAds', 'digital_marketing'],
        buyerRole: 'Media buyers, e-com founders & SEO growth marketers',
        fears: ['burning ad spend with negative ROAS', 'Google algorithm updates wiping traffic', 'creative fatigue'],
        desires: ['profitable scalable ad creatives', 'compounding free search traffic', 'clear attribution'],
        keywords: ['roas', 'creative', 'seo', 'traffic', 'funnel', 'cpa', 'ads', 'ranking'],
        tone: 'Analytical growth marketer breaking down ad creatives, funnels, and live traffic charts.',
        defaultKeyword: 'ADS',
      },
    ],
  },
  {
    id: 'money-investing',
    name: 'Money, Investing & Personal Finance',
    tagline: 'Stocks, options, crypto, dividends, personal finance & tax strategy',
    subNiches: [
      {
        id: 'stocks-dividends',
        name: 'Stock Market, Index & Dividend Investing',
        microAngles: [
          'Simple long-term wealth building for beginners',
          'Analyzing company balance sheets & moats in 5 minutes',
          'Dividend cashflow portfolios & compounding math',
          'Avoiding emotional retail investing mistakes',
        ],
        subreddits: ['investing', 'stocks', 'dividends', 'ValueInvesting'],
        buyerRole: 'Everyday investors and professionals building long-term wealth',
        fears: ['buying at the top and losing savings', 'missing out on compounding years', 'falling for hype stocks'],
        desires: ['calm repeatable portfolio growth', 'clear financial breakdowns', 'passive dividend income'],
        keywords: ['portfolio', 'dividend', 'compound', 'etf', 'earnings', 'cashflow', 'valuation', 'wealth'],
        tone: 'Calm, numbers-first educator translating Wall Street math into plain-English takeaways.',
        defaultKeyword: 'WEALTH',
      },
      {
        id: 'trading-options-futures',
        name: 'Day Trading, Options & Futures Systems',
        microAngles: [
          'Risk management & position sizing rules that prevent blowups',
          'Prop firm evaluation passing playbooks',
          'Price action, liquidity & trading psychology',
          'Journaling & backtesting setups like a pro',
        ],
        subreddits: ['Daytrading', 'options', 'FuturesTrading', 'Forex'],
        buyerRole: 'Active retail traders & funded prop-firm candidates',
        fears: ['blowing funded accounts on tilt', 'overtrading choppy sessions', 'inconsistent entries'],
        desires: ['strict mechanical rules', 'consistent prop payouts', 'calm trading psychology'],
        keywords: ['risk', 'setup', 'drawdown', 'prop firm', 'liquidity', 'journal', 'edge', 'trade'],
        tone: 'Disciplined risk-first trader focused on rules, psychology, and brutal honesty over lambos.',
        defaultKeyword: 'EDGE',
      },
      {
        id: 'crypto-web3',
        name: 'Crypto, Web3 & On-Chain Research',
        microAngles: [
          'On-chain data & narrative rotation breakdowns',
          'DeFi yield & wallet security for beginners',
          'Bitcoin macro cycles & accumulation frameworks',
          'Airdrop & ecosystem research checklists',
        ],
        subreddits: ['CryptoCurrency', 'defi', 'Bitcoin', 'ethereum'],
        buyerRole: 'Crypto investors, DeFi users & Web3 builders',
        fears: ['getting rugged or drained', 'buying dead narratives late', 'missing cycle tops'],
        desires: ['early high-conviction research', 'ironclad wallet safety', 'clear macro cycle maps'],
        keywords: ['on-chain', 'cycle', 'btc', 'defi', 'narrative', 'wallet', 'liquidity', 'macro'],
        tone: 'Sharp on-chain analyst cutting through crypto noise with clean data and cycle history.',
        defaultKeyword: 'ALPHA',
      },
      {
        id: 'personal-finance-tax',
        name: 'Personal Finance, Debt-Free & Tax Strategy',
        microAngles: [
          'Escaping paycheck-to-paycheck on a normal salary',
          'Small business LLC, S-Corp & legal tax savings',
          'High-yield cashflow & emergency fund blueprints',
          'Credit score optimization & 0% business funding',
        ],
        subreddits: ['personalfinance', 'financialindependence', 'tax', 'CreditCards'],
        buyerRole: 'Salaried earners, side-hustlers & new business owners',
        fears: ['overpaying taxes', 'living paycheck to paycheck forever', 'hidden debt traps'],
        desires: ['save thousands legally', 'clear monthly budget automation', 'financial breathing room'],
        keywords: ['budget', 'tax', 'savings', 'credit', 'debt', 'income', 'llc', 'net worth'],
        tone: 'Approachable, zero-shame money mentor breaking down exact dollar math anyone can follow.',
        defaultKeyword: 'MONEY',
      },
    ],
  },
  {
    id: 'real-estate',
    name: 'Real Estate & Property',
    tagline: 'Wholesaling, rentals, Airbnb, commercial & real estate agents',
    subNiches: [
      {
        id: 'rental-cashflow-airbnb',
        name: 'Rental Cashflow, BRRRR & Short-Term Rentals',
        microAngles: [
          'Analyzing rental property cashflow in 3 minutes',
          'Buying your first house-hack with minimal down payment',
          'Airbnb / STR occupancy & pricing optimization',
          'Avoiding costly rehab & bad tenant disasters',
        ],
        subreddits: ['realestateinvesting', 'RealEstate', 'Landlord', 'airbnb_hosts'],
        buyerRole: 'Aspiring and active rental property investors',
        fears: ['buying a negative-cashflow money pit', 'nightmare tenants', 'high interest rates'],
        desires: ['replace W2 income with rental cashflow', 'accurate deal calculators', 'repeatable acquisitions'],
        keywords: ['cashflow', 'rental', 'cap rate', 'tenant', 'brrrr', 'equity', 'property', 'deal'],
        tone: 'Grounded investor sharing real property math, rehab lessons, and deal calculators.',
        defaultKeyword: 'DEAL',
      },
      {
        id: 'wholesaling-flipping',
        name: 'Real Estate Wholesaling & Fix-and-Flip',
        microAngles: [
          'Finding off-market motivated sellers for free',
          'Seller negotiation scripts & contract structuring',
          'Estimating rehab budgets without getting burned',
          'Building a reliable cash buyers list',
        ],
        subreddits: ['WholesaleRealestate', 'realestateinvesting', 'Flipping'],
        buyerRole: 'Beginner wholesalers, flippers & real estate hustlers',
        fears: ['making zero deals after months of cold calls', 'underestimating repair costs', 'legal contract mistakes'],
        desires: ['close first $10k+ assignment fee', 'proven seller scripts', 'off-market deal pipeline'],
        keywords: ['wholesale', 'seller', 'off-market', 'arv', 'rehab', 'contract', 'buyer', 'flip'],
        tone: 'Tactical dealmaker sharing real off-market breakdowns and seller call scripts.',
        defaultKeyword: 'FLIP',
      },
      {
        id: 'realtor-broker-growth',
        name: 'Real Estate Agents & Mortgage Brokers',
        microAngles: [
          'Organic social media leads for realtors (no Zillow spend)',
          'Listing presentation frameworks that win sellers',
          'First-time homebuyer education & local authority',
          'Follow-up systems that turn cold leads into closings',
        ],
        subreddits: ['realtors', 'RealEstate', 'FirstTimeHomeBuyer'],
        buyerRole: 'Licensed real estate agents, brokers & loan officers',
        fears: ['paying thousands for cold Zillow leads', 'dry commission months', 'losing listings to discount brokers'],
        desires: ['inbound local buyer/seller DMs', 'standout personal brand', 'predictable closings'],
        keywords: ['listing', 'realtor', 'buyer', 'market', 'mortgage', 'closing', 'local', 'commission'],
        tone: 'Modern local market authority who educates buyers clearly and avoids cheesy realtor clichés.',
        defaultKeyword: 'LISTING',
      },
    ],
  },
  {
    id: 'ecommerce-business',
    name: 'E-Commerce & Online Business',
    tagline: 'Shopify DTC, Amazon FBA, TikTok Shop, Etsy & UGC',
    subNiches: [
      {
        id: 'shopify-dtc',
        name: 'Shopify & DTC Brand Building',
        microAngles: [
          'Product page CRO tweaks that double conversion rate',
          'Finding winning products with real repeat demand',
          'Klaviyo email & SMS retention flows for e-com',
          'Scaling from $0 to $50k/mo without blowing ad budget',
        ],
        subreddits: ['shopify', 'ecommerce', 'dropship', 'DTC'],
        buyerRole: 'Shopify store owners & aspiring DTC brand founders',
        fears: ['zero sales after launching ads', 'razor-thin profit margins', 'high refund rates'],
        desires: ['high-converting store layout', 'profitable unit economics', 'repeat brand customers'],
        keywords: ['shopify', 'aov', 'cro', 'product', 'store', 'margin', 'klaviyo', 'checkout'],
        tone: 'Hands-on e-com operator breaking down real product pages, unit margins, and retention flows.',
        defaultKeyword: 'STORE',
      },
      {
        id: 'tiktok-shop-ugc',
        name: 'TikTok Shop, Short-Form Commerce & UGC',
        microAngles: [
          'Viral 3-second TikTok Shop product hooks',
          'Making $3k–$10k/mo as a TikTok Shop affiliate',
          'Landing paid UGC brand retainers from scratch',
          'Scripting shoppable videos that convert cold viewers',
        ],
        subreddits: ['TikTokShop', 'UGCcreators', 'ecommerce', 'sidehustle'],
        buyerRole: 'TikTok Shop affiliates, UGC creators & e-com sellers',
        fears: ['posting 50 videos with 200 views', 'picking saturated products', 'account violations'],
        desires: ['daily affiliate commissions', 'repeatable viral video scripts', 'inbound brand deals'],
        keywords: ['tiktok shop', 'ugc', 'hook', 'commission', 'viral', 'brand', 'script', 'product'],
        tone: 'Fast-paced creator strategist sharing exact video hook templates and commission math.',
        defaultKeyword: 'SHOP',
      },
      {
        id: 'amazon-etsy-pod',
        name: 'Amazon FBA, Etsy & Print-on-Demand',
        microAngles: [
          'Low-competition keyword & niche discovery',
          'Listing images & A+ copy that steal market share',
          'Digital downloads & Print-on-Demand passive catalogs',
          'Managing inventory & PPC without losing profit',
        ],
        subreddits: ['FulfillmentByAmazon', 'EtsySellers', 'printondemand', 'AmazonSeller'],
        buyerRole: 'Marketplace sellers on Amazon, Etsy & POD platforms',
        fears: ['inventory sitting unsold', 'copycat competitors', 'rising PPC ad costs'],
        desires: ['page-1 organic rankings', 'high-margin digital or physical SKUs', 'predictable daily orders'],
        keywords: ['amazon', 'etsy', 'listing', 'keyword', 'ppc', 'ranking', 'sku', 'margin'],
        tone: 'Practical marketplace analyst focused on search volume, listing CTR, and net profit.',
        defaultKeyword: 'RANK',
      },
    ],
  },
  {
    id: 'creator-economy',
    name: 'Creator Economy & Digital Products',
    tagline: 'Whop communities, X growth, YouTube automation, newsletters & courses',
    subNiches: [
      {
        id: 'whop-digital-products',
        name: 'Whop, Skool & Digital Product Funnels',
        microAngles: [
          'Turning free PDF lead magnets into $49–$299 Whop sales',
          'Building high-retention paid communities from scratch',
          'Affiliate marketing top Whop courses using X threads',
          'Validating digital templates before building them',
        ],
        subreddits: ['Entrepreneur', 'digitalmarketing', 'passive_income', 'SideProject'],
        buyerRole: 'Solo creators, digital product sellers & Whop affiliates',
        fears: ['launching to crickets', 'spending weeks building products nobody buys', 'relying only on ads'],
        desires: ['daily Stripe/Whop notifications', 'automated free-to-paid X funnels', 'high-ticket affiliate income'],
        keywords: ['whop', 'digital product', 'pdf', 'funnel', 'offer', 'affiliate', 'community', 'lead magnet'],
        tone: 'Transparent indie creator breaking down exact free-to-paid funnel math and conversion levers.',
        defaultKeyword: 'FUNNEL',
      },
      {
        id: 'x-twitter-ghostwriting',
        name: 'X (Twitter) Growth & Ghostwriting',
        microAngles: [
          'Growing from 0 to 10,000 targeted buyers on X',
          'Landing $2k–$5k/mo ghostwriting retainers for founders',
          'Viral hook engineering & bookmark-worthy threads',
          'Turning replies into warm DM conversations',
        ],
        subreddits: ['Twitter', 'socialmedia', 'freelanceWriters', 'copywriting'],
        buyerRole: 'Founders, personal brand builders & ghostwriters',
        fears: ['posting daily into the void with 40 views', 'sounding generic or salesy', 'running out of ideas'],
        desires: ['inbound client DMs every week', 'viral authority posts', 'high-paying ghostwriting retainers'],
        keywords: ['hook', 'thread', 'bookmarks', 'ghostwriting', 'profile', 'algorithm', 'followers', 'dm'],
        tone: 'Punchy editorial strategist dissecting viral posts, hooks, and founder brand funnels.',
        defaultKeyword: 'GROWTH',
      },
      {
        id: 'youtube-shortform-faceless',
        name: 'YouTube Automation, Faceless & Short-Form',
        microAngles: [
          'High-RPM faceless YouTube niches & script retention',
          'Thumbnail psychology & CTR optimization',
          'Repurposing 1 long video into 20 viral Shorts/Reels',
          'Monetizing small channels with sponsors & products',
        ],
        subreddits: ['NewTubers', 'PartneredYoutube', 'YouTubeCreators', 'ContentCreation'],
        buyerRole: 'YouTubers, faceless channel operators & video creators',
        fears: ['low CTR killing good videos', 'viewer drop-off in the first 30 seconds', 'demonetization'],
        desires: ['60%+ retention scripts', '10%+ CTR thumbnails', 'scalable faceless channel revenue'],
        keywords: ['youtube', 'ctr', 'retention', 'thumbnail', 'script', 'rpm', 'faceless', 'shorts'],
        tone: 'Retention-obsessed YouTube strategist breaking down pacing, thumbnails, and RPM math.',
        defaultKeyword: 'VIDEO',
      },
      {
        id: 'newsletters-courses',
        name: 'Newsletters, Coaching & Online Courses',
        microAngles: [
          'Growing a Beehiiv/Substack newsletter from X traffic',
          'Landing newsletter sponsors with under 5,000 subscribers',
          'Designing cohort courses with 80%+ completion rates',
          'Evergreen email welcome sequences that sell daily',
        ],
        subreddits: ['Newsletters', 'Substack', 'CourseCreation', 'coaching'],
        buyerRole: 'Newsletter writers, educators & online coaches',
        fears: ['low open rates', 'unsubscribes when pitching', 'stuck trading hours for money'],
        desires: ['owned audience independent of algorithms', 'sponsor & course revenue', 'high-trust readers'],
        keywords: ['newsletter', 'subscriber', 'email', 'course', 'sponsor', 'open rate', 'cohort'],
        tone: 'Thoughtful media builder sharing exact subscriber acquisition cost and monetization playbooks.',
        defaultKeyword: 'LIST',
      },
    ],
  },
  {
    id: 'career-freelance',
    name: 'Career, Freelancing & Agencies',
    tagline: 'Agencies, freelance skills, tech careers & remote work',
    subNiches: [
      {
        id: 'agencies-smma',
        name: 'Agencies, SMMA & Productized Services',
        microAngles: [
          'Productizing your skill into a $3k/mo flat retainer',
          'Client onboarding & delivery systems that stop churn',
          'Signing your first 3 agency clients with zero case studies',
          'Hiring A-player contractors without breaking margins',
        ],
        subreddits: ['agency', 'Entrepreneur', 'freelance', 'marketing'],
        buyerRole: 'Solo freelancers scaling to $10k–$50k/mo agencies',
        fears: ['client churn wiping monthly revenue', 'scope creep', 'stuck doing all fulfillment yourself'],
        desires: ['predictable retainer income', 'clean SOPs', 'high-margin productized offers'],
        keywords: ['retainer', 'agency', 'client', 'onboarding', 'churn', 'offer', 'productized', 'sop'],
        tone: 'No-BS agency operator sharing pricing math, SOPs, and client retention scripts.',
        defaultKeyword: 'AGENCY',
      },
      {
        id: 'freelance-creative',
        name: 'Freelance Video Editing, Design & Web Dev',
        microAngles: [
          'Portfolio positioning that doubles freelance rates',
          'Cold pitching YouTubers & founders with Loom teardowns',
          'Escaping Upwork/Fiverr race-to-the-bottom pricing',
          'Packaging fast turnaround retainers for creators',
        ],
        subreddits: ['freelance', 'VideoEditing', 'web_design', 'Upwork'],
        buyerRole: 'Freelance editors, designers & web developers',
        fears: ['competing on $15/hr marketplaces', 'feast-or-famine income', 'picky low-budget clients'],
        desires: ['premium $2k+ clients off-platform', 'clear portfolio positioning', 'steady monthly bookings'],
        keywords: ['freelance', 'portfolio', 'client', 'rate', 'pitch', 'retainer', 'editing', 'design'],
        tone: 'Practical independent creative who teaches business positioning, not just software buttons.',
        defaultKeyword: 'CLIENT',
      },
      {
        id: 'tech-remote-careers',
        name: 'Tech Careers, Interviews & Remote Jobs',
        microAngles: [
          'Resumes & LinkedIn profiles that beat ATS filters',
          'Salary negotiation scripts worth +$20k/year',
          'Landing high-paying remote jobs from anywhere',
          'Acing system design & behavioral interviews',
        ],
        subreddits: ['cscareerquestions', 'jobs', 'remotework', 'careerguidance'],
        buyerRole: 'Job seekers, software engineers & ambitious corporate professionals',
        fears: ['sending 200 applications with zero callbacks', 'leaving money on the table in negotiations', 'layoffs'],
        desires: ['multiple competing offers', 'remote flexibility', 'fast promotions'],
        keywords: ['resume', 'interview', 'salary', 'remote', 'offer', 'hiring', 'career', 'negotiation'],
        tone: 'Former hiring-manager style mentor giving blunt, actionable job-search tactics.',
        defaultKeyword: 'OFFER',
      },
    ],
  },
  {
    id: 'health-fitness',
    name: 'Health, Fitness & Longevity',
    tagline: 'Fat loss, strength, biohacking, nutrition & athletic performance',
    subNiches: [
      {
        id: 'fat-loss-aesthetics',
        name: 'Fat Loss & Busy-Professional Fitness',
        microAngles: [
          'Losing 20 lbs with 3x/week workouts & zero crash diets',
          'High-protein restaurant & travel survival guides',
          'Sustainable calorie deficit math without starving',
          'Fixing stubborn belly fat & energy crashes',
        ],
        subreddits: ['Fitness', 'loseit', 'progresspics', 'nutrition'],
        buyerRole: 'Busy founders, professionals & beginners wanting sustainable fat loss',
        fears: ['yo-yo dieting and regaining weight', 'no time for 2-hour gym sessions', 'conflicting nutrition advice'],
        desires: ['lean athletic physique', 'simple 45-minute workouts', 'all-day energy'],
        keywords: ['fat loss', 'protein', 'calories', 'workout', 'steps', 'metabolism', 'lean', 'habit'],
        tone: 'Evidence-based coach cutting through fitness myths with simple, zero-BS routines.',
        defaultKeyword: 'LEAN',
      },
      {
        id: 'strength-hypertrophy',
        name: 'Strength Training, Bodybuilding & Calisthenics',
        microAngles: [
          'Science-based hypertrophy & progressive overload splits',
          'Fixing lagging muscle groups & lifting form',
          'Home gym & bodyweight calisthenics progressions',
          'Breaking strength plateaus safely without joint pain',
        ],
        subreddits: ['bodybuilding', 'weightroom', 'bodyweightfitness', 'powerlifting'],
        buyerRole: 'Lifters, gym-goers & calisthenics athletes',
        fears: ['spinning wheels for years with no muscle gain', 'shoulder or lower-back injuries', 'junk volume'],
        desires: ['visible muscle growth', 'clean 4-day training programs', 'stronger compound lifts'],
        keywords: ['hypertrophy', 'muscle', 'sets', 'progressive overload', 'strength', 'recovery', 'split'],
        tone: 'Knowledgeable strength coach blending sports science with real gym-floor simplicity.',
        defaultKeyword: 'LIFT',
      },
      {
        id: 'biohacking-longevity-sleep',
        name: 'Biohacking, Sleep & Longevity Science',
        microAngles: [
          'Deep sleep protocols for high performers',
          'Bloodwork biomarkers & evidence-based supplements',
          'VO2 max, Zone 2 cardio & healthspan routines',
          'Eliminating afternoon brain fog & cortisol spikes',
        ],
        subreddits: ['Biohackers', 'longevity', 'sleep', 'Nootropics'],
        buyerRole: 'Health-conscious founders, executives & longevity enthusiasts',
        fears: ['burnout and poor sleep ruining focus', 'wasting money on useless supplements', 'chronic fatigue'],
        desires: ['waking up energized at 6 AM', 'sharp cognitive stamina', 'science-backed daily protocols'],
        keywords: ['sleep', 'longevity', 'zone 2', 'biomarkers', 'cortisol', 'focus', 'protocol', 'energy'],
        tone: 'Curious science-literate optimizer translating clinical studies into 5-minute daily protocols.',
        defaultKeyword: 'PROTOCOL',
      },
    ],
  },
  {
    id: 'mindset-productivity',
    name: 'Mindset, Productivity & Self-Improvement',
    tagline: 'Deep work, habits, discipline, stoicism & accelerated learning',
    subNiches: [
      {
        id: 'deep-work-systems',
        name: 'Deep Work, Notion & Focus Systems',
        microAngles: [
          'Getting 8 hours of output in a 4-hour deep work block',
          'Beating phone addiction & dopamine distraction',
          'Minimalist Notion / Obsidian second-brain templates',
          'Weekly review routines that keep goals on track',
        ],
        subreddits: ['productivity', 'Notion', 'ObsidianMD', 'getdisciplined'],
        buyerRole: 'Knowledge workers, students & solo builders fighting distraction',
        fears: ['ending every week busy yet accomplishing nothing', 'doomscrolling hours away', 'overcomplicated apps'],
        desires: ['laser-sharp daily focus', 'simple repeatable operating system', 'guilt-free free time'],
        keywords: ['focus', 'deep work', 'system', 'habit', 'dopamine', 'routine', 'template', 'time'],
        tone: 'Crisp minimalist thinker delivering clear frameworks and zero toxic hustle clichés.',
        defaultKeyword: 'FOCUS',
      },
      {
        id: 'discipline-stoicism',
        name: 'Habits, Discipline & Stoic Resilience',
        microAngles: [
          'Rebuilding self-trust & breaking procrastination loops',
          'Practical Stoic mental models for stressful days',
          '90-day personal reinvention blueprints',
          'Overcoming overthinking & perfectionism',
        ],
        subreddits: ['selfimprovement', 'Stoicism', 'DecidingToBeBetter', 'habits'],
        buyerRole: 'Ambitious young professionals & self-improvers',
        fears: ['staying stuck in the same place next year', 'paralysis by analysis', 'quitting after 2 weeks'],
        desires: ['unshakeable daily consistency', 'calm under pressure', 'clear personal standards'],
        keywords: ['discipline', 'mindset', 'procrastination', 'habit', 'clarity', 'stoic', 'consistency'],
        tone: 'Calm, memorable philosophical voice using punchy contrasts and lived wisdom.',
        defaultKeyword: 'RESET',
      },
    ],
  },
  {
    id: 'relationships-social',
    name: 'Relationships, Dating & Social Skills',
    tagline: 'Communication, charisma, dating confidence & family',
    subNiches: [
      {
        id: 'communication-charisma',
        name: 'Communication, Storytelling & Charisma',
        microAngles: [
          'How to command any room & speak with calm authority',
          'Storytelling frameworks for leaders & creators',
          'Networking & making high-value friends naturally',
          'Handling difficult conversations without conflict',
        ],
        subreddits: ['socialskills', 'communication', 'PublicSpeaking', 'Charisma'],
        buyerRole: 'Professionals, introverts & aspiring leaders',
        fears: ['freezing in conversations', 'being overlooked in meetings', 'sounding awkward or nervous'],
        desires: ['effortless confidence', 'magnetic storytelling', 'instant rapport with anyone'],
        keywords: ['communication', 'charisma', 'storytelling', 'confidence', 'speaking', 'rapport', 'listen'],
        tone: 'Observant, empathetic coach breaking human psychology into simple conversational habits.',
        defaultKeyword: 'SPEAK',
      },
      {
        id: 'dating-relationships',
        name: 'Modern Dating, Marriage & Parenting',
        microAngles: [
          'Healthy boundaries & green flags in modern dating',
          'Communication habits that strengthen long-term relationships',
          'Calm, practical parenting frameworks for modern families',
          'Building genuine confidence without manipulative tricks',
        ],
        subreddits: ['relationships', 'dating_advice', 'Parenting', 'Marriage'],
        buyerRole: 'Adults seeking healthier relationships, dating clarity or parenting tools',
        fears: ['repeating toxic patterns', 'drifting apart with a partner', 'feeling misunderstood'],
        desires: ['deep emotional connection', 'respectful communication', 'calm home life'],
        keywords: ['relationship', 'boundaries', 'trust', 'dating', 'partner', 'communication', 'respect'],
        tone: 'Warm, honest and grounded — insightful human truths without cynical clickbait.',
        defaultKeyword: 'GUIDE',
      },
    ],
  },
  {
    id: 'design-creative',
    name: 'Design, Art & Creative Craft',
    tagline: 'UI/UX design, branding, photography, filmmaking & architecture',
    subNiches: [
      {
        id: 'ui-ux-brand-design',
        name: 'UI/UX, Web & Brand Identity Design',
        microAngles: [
          'Before-and-after UI teardowns that boost conversion',
          'Typography, spacing & color hierarchy rules',
          'Figma workflow shortcuts & design systems',
          'Pricing $5k+ brand & landing page projects',
        ],
        subreddits: ['UI_Design', 'UXDesign', 'graphic_design', 'web_design'],
        buyerRole: 'UI/UX designers, brand designers & design-curious founders',
        fears: ['designs looking amateur or generic', 'undercharging clients', 'endless revision cycles'],
        desires: ['editorial studio-grade polish', 'high-ticket design retainers', 'faster Figma execution'],
        keywords: ['ui', 'ux', 'typography', 'figma', 'layout', 'design system', 'brand', 'contrast'],
        tone: 'Visual craftsperson sharing crisp before/after critiques and timeless design rules.',
        defaultKeyword: 'DESIGN',
      },
      {
        id: 'photo-film-interior',
        name: 'Photography, Filmmaking & Interior Design',
        microAngles: [
          'Lighting & framing techniques using affordable gear',
          'Color grading & cinematic editing workflows',
          'Small-space interior & desk setup transformations',
          'Booking commercial photo/video shoots',
        ],
        subreddits: ['Filmmakers', 'photography', 'InteriorDesign', 'videography'],
        buyerRole: 'Photographers, filmmakers & interior design enthusiasts',
        fears: ['flat amateur-looking visuals', 'gear obsession without skill growth', 'low local bookings'],
        desires: ['cinematic visual signature', 'high-paying commercial shoots', 'inspiring spaces'],
        keywords: ['lighting', 'framing', 'cinematic', 'camera', 'color grade', 'space', 'visual'],
        tone: 'Artful visual storyteller focused on lighting, composition, and practical craft.',
        defaultKeyword: 'FRAME',
      },
    ],
  },
  {
    id: 'education-languages',
    name: 'Education, Languages & Exam Prep',
    tagline: 'Language fluency, coding bootcamps, study systems & test prep',
    subNiches: [
      {
        id: 'language-learning',
        name: 'Language Fluency & Immersion Systems',
        microAngles: [
          'Reaching conversational fluency in 90 days via immersion',
          'Spaced repetition & Anki decks that actually stick',
          'Overcoming fear of speaking with native speakers',
          'Learning English, Spanish, Japanese or Arabic efficiently',
        ],
        subreddits: ['languagelearning', 'LearnJapanese', 'Spanish', 'Anki'],
        buyerRole: 'Self-taught language learners & international professionals',
        fears: ['spending years on apps and still unable to speak', 'forgetting vocabulary', 'sounding awkward'],
        desires: ['real conversational fluency', 'fun daily immersion routine', 'clear 90-day roadmap'],
        keywords: ['fluency', 'immersion', 'vocabulary', 'anki', 'speaking', 'language', 'daily'],
        tone: 'Encouraging polyglot mentor sharing tested immersion frameworks and memory hacks.',
        defaultKeyword: 'FLUENT',
      },
      {
        id: 'study-exams-coding',
        name: 'Study Systems, Exams & Self-Taught Coding',
        microAngles: [
          'Active recall & exam prep methods that halve study time',
          'Self-taught coding roadmaps for career switchers',
          'Medical, law, SAT/IELTS & certification study playbooks',
          'Note-taking workflows that boost memory retention',
        ],
        subreddits: ['GetStudying', 'learnprogramming', 'Anki', 'GradSchool'],
        buyerRole: 'University students, exam takers & self-taught learners',
        fears: ['cramming all night and blanking on exams', 'tutorial hell in coding', 'burnout'],
        desires: ['top scores in fewer hours', 'clear step-by-step curriculum', 'real mastery'],
        keywords: ['study', 'recall', 'exam', 'roadmap', 'memory', 'coding', 'notes', 'score'],
        tone: 'Clear, structured educator turning dense study science into simple daily checklists.',
        defaultKeyword: 'STUDY',
      },
    ],
  },
  {
    id: 'travel-lifestyle',
    name: 'Travel, Nomadism & Lifestyle',
    tagline: 'Digital nomad life, travel hacking, points & solo living',
    subNiches: [
      {
        id: 'travel-points-nomad',
        name: 'Travel Hacking, Points & Digital Nomad Life',
        microAngles: [
          'Flying business class for pennies using credit card points',
          'Best low-cost high-quality cities for remote workers',
          'Packing light & running an online business from abroad',
          'Hidden travel mistakes that drain budgets',
        ],
        subreddits: ['awardtravel', 'digitalnomad', 'solotravel', 'onebag'],
        buyerRole: 'Remote workers, frequent travelers & points optimizers',
        fears: ['overpaying thousands for flights', 'bad Wi-Fi or visa surprises', 'travel burnout'],
        desires: ['free luxury flights with points', 'freedom to work from anywhere', 'smart itineraries'],
        keywords: ['points', 'miles', 'flights', 'nomad', 'remote', 'travel', 'visa', 'budget'],
        tone: 'Savvy world traveler sharing real point redemptions, cost breakdowns, and city guides.',
        defaultKeyword: 'TRAVEL',
      },
    ],
  },
  {
    id: 'food-hospitality',
    name: 'Food, Cooking & Hospitality',
    tagline: 'High-protein meal prep, specialty coffee & food businesses',
    subNiches: [
      {
        id: 'quick-cooking-recipes',
        name: '15-Minute High-Protein Cooking & Meal Prep',
        microAngles: [
          '15-minute high-protein dinners under $5 per serving',
          'Sunday meal prep systems that taste restaurant-grade',
          'Essential knife, pan & flavor ratios for home cooks',
          'Specialty coffee & espresso dialing at home',
        ],
        subreddits: ['MealPrepSunday', 'Cooking', 'EatCheapAndHealthy', 'espresso'],
        buyerRole: 'Busy home cooks, fitness meal-preppers & coffee lovers',
        fears: ['spending $500+/mo on takeout', 'bland dry meal-prep chicken', 'hours spent cleaning the kitchen'],
        desires: ['fast delicious meals', 'budget-friendly grocery lists', 'printable recipe playbooks'],
        keywords: ['recipe', 'protein', 'meal prep', 'minutes', 'budget', 'flavor', 'kitchen', 'coffee'],
        tone: 'Warm, punchy kitchen pro sharing exact ratios, time-savers, and mouthwatering checklists.',
        defaultKeyword: 'RECIPE',
      },
    ],
  },
  {
    id: 'sports-gaming',
    name: 'Sports, Gaming & Entertainment',
    tagline: 'Streaming growth, esports, sports analytics & culture',
    subNiches: [
      {
        id: 'gaming-streaming-sports',
        name: 'Streaming Growth, Gaming & Sports Breakdowns',
        microAngles: [
          'Growing a Twitch/Kick/YouTube gaming channel from 0 viewers',
          'Tactical film & analytics breakdowns for sports fans',
          'Game dev, indie game marketing & Steam wishlists',
          'Building loyal gaming communities & Discord servers',
        ],
        subreddits: ['Twitch', 'gamedev', 'sportsbook', 'esports'],
        buyerRole: 'Gamers, streamers, indie game devs & sports enthusiasts',
        fears: ['streaming to 0 viewers for months', 'zero Steam wishlists', 'getting buried in saturated games'],
        desires: ['active loyal community', 'viral clip hooks', 'monetized passion channel'],
        keywords: ['stream', 'clips', 'community', 'analytics', 'game', 'twitch', 'clips', 'audience'],
        tone: 'High-energy insider breaking down film, numbers, and community growth plays.',
        defaultKeyword: 'PLAYBOOK',
      },
    ],
  },
  {
    id: 'local-trades-science',
    name: 'Local Services, Trades & Science',
    tagline: 'Home service businesses, trades, CleanTech & science explainers',
    subNiches: [
      {
        id: 'local-home-services',
        name: 'Boring Local & Home Service Businesses',
        microAngles: [
          'Scaling $100k–$1M/yr pressure washing, HVAC, cleaning & landscaping',
          'Google Business Profile & local SEO lead engines',
          'Hiring reliable crews & automating customer quotes',
          'Acquiring boring cash-flowing small businesses',
        ],
        subreddits: ['sweatystartup', 'smallbusiness', 'Entrepreneur', 'HVAC'],
        buyerRole: 'Local business owners, trades founders & small-business buyers',
        fears: ['feast-or-famine local leads', 'unreliable workers', 'stuck on the truck forever'],
        desires: ['fully booked local calendar', 'high-margin recurring contracts', 'real cashflow freedom'],
        keywords: ['local', 'service', 'leads', 'crew', 'quote', 'google', 'cashflow', 'business'],
        tone: 'Down-to-earth operator sharing real P&L numbers, local marketing wins, and hiring lessons.',
        defaultKeyword: 'LOCAL',
      },
      {
        id: 'science-space-cleantech',
        name: 'Science, Space & Energy Breakdowns',
        microAngles: [
          'Explaining breakthrough physics, space & biotech in plain English',
          'EV, battery & solar economics without politics',
          'Weekly frontier technology & research paper digests',
          'Visual threads that make complex science unforgettable',
        ],
        subreddits: ['science', 'space', 'energy', 'Futurology'],
        buyerRole: 'Curious minds, STEM enthusiasts & frontier-tech investors',
        fears: ['missing major scientific breakthroughs', 'drowning in dense unreadable papers'],
        desires: ['crystal-clear 60-second explainers', 'accurate data-backed threads'],
        keywords: ['breakthrough', 'energy', 'research', 'space', 'physics', 'data', 'future'],
        tone: 'Clear, awe-inspiring science communicator making complex papers effortless to read.',
        defaultKeyword: 'DIGEST',
      },
    ],
  },
];

export function getNicheCatalogStats() {
  const markets = MARKET_NICHE_CATALOG.length;
  const subNiches = MARKET_NICHE_CATALOG.reduce((sum, m) => sum + m.subNiches.length, 0);
  const microAngles = MARKET_NICHE_CATALOG.reduce(
    (sum, m) => sum + m.subNiches.reduce((s2, sub) => s2 + sub.microAngles.length, 0),
    0
  );
  return { markets, subNiches, microAngles };
}

export function findMarketAndSubNiche(marketId: string, subNicheId: string) {
  const market = MARKET_NICHE_CATALOG.find((m) => m.id === marketId);
  const subNiche = market?.subNiches.find((s) => s.id === subNicheId);
  return { market, subNiche };
}

export function buildAccountBrandBrainFromNiche(params: {
  marketId: string;
  subNicheId: string;
  microAngle: string;
  buyerGoal: string;
  offerName?: string;
  offerUrl?: string;
  offerPrice?: string;
  giveawayKeyword?: string;
}): {
  brandBrain: BrandBrain;
  nicheProfile: NonNullable<AccountProfile['nicheProfile']>;
} {
  const { market, subNiche } = findMarketAndSubNiche(params.marketId, params.subNicheId);
  const marketName = market?.name || 'Custom Market';
  const subNicheName = subNiche?.name || params.microAngle || 'Focused Niche';
  const microAngle = params.microAngle.trim() || subNiche?.microAngles[0] || subNicheName;
  const keyword = (params.giveawayKeyword?.trim() || subNiche?.defaultKeyword || 'PLAYBOOK')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  const persona: AudiencePersona = {
    id: `persona-${params.subNicheId || 'custom'}`,
    name: subNiche?.buyerRole.split(',')[0] || `${subNicheName} Buyers`,
    role: subNiche?.buyerRole || `People actively solving problems in ${subNicheName}`,
    fears: subNiche?.fears || [
      `wasting time with generic ${subNicheName} advice`,
      'missing proven shortcuts',
    ],
    desires: subNiche?.desires || [
      `clear repeatable results in ${microAngle}`,
      'step-by-step playbooks they can execute today',
    ],
    keywords: subNiche?.keywords || [subNicheName.toLowerCase(), 'playbook', 'system', 'free'],
  };

  const offerName =
    params.offerName?.trim() ||
    `${subNicheName} Starter Offer (${params.buyerGoal.includes('Whop') ? 'Whop' : 'Offer'})`;
  const offerUrl = params.offerUrl?.trim() || 'https://whop.com/';
  const offerPrice = params.offerPrice?.trim() || '$49';

  const primaryOffer: MonetizationOffer = {
    id: `offer-${Date.now()}`,
    name: offerName,
    platform: offerUrl.includes('whop')
      ? 'Whop'
      : offerUrl.includes('gumroad')
        ? 'Gumroad'
        : params.buyerGoal.includes('Whop')
          ? 'Whop'
          : 'Direct',
    url: offerUrl,
    priceLabel: offerPrice,
    promise: `Help ${persona.name.toLowerCase()} master ${microAngle} without guesswork.`,
    autoPlugTemplate: `P.S. If you want the complete step-by-step ${subNicheName} toolkit (${offerName}), grab it here → ${offerUrl}`,
    giveawayKeyword: keyword,
    clicks: 0,
    leads: 0,
    estimatedRevenue: 0,
  };

  const brandBrain: BrandBrain = {
    niche: subNicheName,
    subNiches: [microAngle],
    subreddits: subNiche?.subreddits || ['Entrepreneur', 'SideProject'],
    customRssUrls: [],
    tone:
      subNiche?.tone ||
      `Direct, deeply authoritative operator focused strictly on ${subNicheName} (${microAngle}).`,
    voiceRules: [
      `Stay 100% locked onto ${subNicheName}: ${microAngle}. Never drift into unrelated topics.`,
      `Primary business goal: ${params.buyerGoal}.`,
      'Lead every post with a concrete number, buyer pain point, or contrarian proof.',
      'Write in crisp Grade 5–7 readability with generous whitespace and zero robotic AI fluff.',
    ],
    bannedCliches: [...DEFAULT_BANNED_CLICHES],
    winningPhrases: subNiche?.keywords.slice(0, 6) || ['exact', 'playbook', 'system'],
    weeklyMix: {
      singlePosts: 3,
      threads: 2,
      carousels: 1,
      giveaways: 1,
    },
    personas: [persona],
    activePersonaId: persona.id,
    offers: [primaryOffer],
  };

  return {
    brandBrain,
    nicheProfile: {
      locked: true,
      marketId: market?.id || 'custom',
      marketName,
      subNicheId: subNiche?.id || 'custom',
      subNicheName,
      microAngle,
      buyerGoal: params.buyerGoal,
      lockedAt: new Date().toISOString(),
    },
  };
}

/**
 * Resolves the active account's isolated BrandBrain, cleanly falling back
 * to the top-level store.brandBrain for backwards compatibility.
 */
export function getActiveAccountBrain(store: GhostPilotStore): BrandBrain {
  const active =
    store.accounts.find((a) => a.id === store.activeAccountId) || store.accounts[0];
  return active?.brandBrain ?? store.brandBrain;
}
