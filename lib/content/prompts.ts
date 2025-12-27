/**
 * Prompt builders for LLM-powered content generation
 */

import type { FormData, ContentLanguage } from "@/types/form"
import type { Pillar } from "@/types/content"
import { PILLARS } from "@/lib/constants/pillars"
import { PLATFORM_CONTENT_TARGETS } from "@/lib/constants/platforms"
import { getToneConfig } from "@/lib/constants/industries"

// Language-specific writing guidelines
const LANGUAGE_GUIDELINES: Record<string, string> = {
  en: "",
  es: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Spanish (Español)
- Use appropriate regional neutral Spanish that works across Latin America and Spain
- Adapt idioms and expressions to feel natural in Spanish
- Maintain professional tone while respecting Spanish linguistic conventions`,
  fr: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural French (Français)
- Use modern, professional French appropriate for business communication
- Adapt expressions to feel natural for French-speaking audiences
- Maintain the formal "vous" form for professional content`,
  de: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural German (Deutsch)
- Use Sie-form for professional tone
- Adapt expressions to feel natural for German-speaking markets
- Follow German conventions for business communication`,
  pt: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Portuguese (Português)
- Use Brazilian Portuguese style unless specified otherwise
- Adapt expressions to feel natural for Portuguese-speaking audiences
- Maintain professional tone with appropriate formality`,
  it: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Italian (Italiano)
- Use appropriate formal register for professional content
- Adapt expressions to feel natural for Italian audiences
- Follow Italian business communication conventions`,
  nl: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Dutch (Nederlands)
- Use appropriate professional tone for business communication
- Adapt expressions to feel natural for Dutch-speaking audiences`,
  ja: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Japanese (日本語)
- Use appropriate politeness levels (丁寧語) for professional content
- Adapt to Japanese business communication conventions
- Consider cultural context and expression styles`,
  ko: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Korean (한국어)
- Use appropriate honorifics and politeness levels for business
- Adapt expressions to Korean business communication style
- Consider cultural nuances in content presentation`,
  zh: `
## LANGUAGE REQUIREMENTS
- Write ALL content in fluent, natural Simplified Chinese (简体中文)
- Use appropriate formal register for professional content
- Adapt expressions to feel natural for Chinese audiences
- Consider cultural context and business communication norms`,
}

// Content pillar descriptions for the LLM
const PILLAR_GUIDELINES: Record<Pillar, string> = {
  "Product Journey": `Product-focused content: feature announcements, how the product works, use cases, product updates, behind-the-scenes of building. Focus on solving real problems.`,
  "Founder Story": `Personal founder narrative: origin story, lessons learned, failures and pivots, vision for the future, personal struggles and wins. Be authentic and vulnerable.`,
  "Growth Metrics": `Traction and milestones: revenue updates, user growth, key wins, fundraising news, team growth. Use specific numbers when possible.`,
  "Industry Insights": `Thought leadership: market trends, industry analysis, predictions, educational content, hot takes on industry news. Position as an expert.`,
  "Community Wins": `Customer success stories: testimonials, case studies, user achievements, community highlights. Let customers be the hero.`,
  "Culture/BTS": `Company culture: team highlights, office/remote life, hiring updates, values in action, day-in-the-life content. Show the human side.`,
  "Engagement": `Interactive content: polls, questions, debates, fill-in-the-blank, hot takes that invite discussion. Optimize for comments.`,
}

// Platform-specific writing guidelines
const PLATFORM_GUIDELINES = {
  linkedin: `
- Professional but personable tone
- Hook in first line (pattern interrupt, bold statement, or question)
- Use line breaks for readability (no walls of text)
- 1300-1500 characters ideal, max 3000
- End with a question or clear CTA
- Avoid hashtags in body, add 3-5 relevant ones at the end
- Use "I" statements for authenticity`,

  twitter: `
- Punchy, concise, high-impact
- Max 280 characters per tweet
- Hook must grab attention immediately
- Use threads for longer narratives (mark as "1/" etc)
- Conversational tone, no corporate speak
- Strategic use of emojis (1-2 max)
- No hashtags in main text unless trending`,

  threads: `
- Casual, authentic, Instagram-adjacent tone
- More personal and raw than LinkedIn
- Storytelling format works well
- 500 characters max per post
- Behind-the-scenes content performs well
- Emoji-friendly but not excessive`,

  email: `
- Subject line is critical (curiosity, urgency, or value)
- Personal, one-to-one feeling
- Clear single CTA per email
- Scannable with short paragraphs
- Value-first, pitch second
- 200-400 words ideal`,

  ads: `
- Lead with the biggest pain point or desire
- Specific, measurable claims when possible
- Clear value proposition in first line
- Strong CTA (Learn More, Get Started, etc)
- A/B test hooks: question vs statement vs statistic
- Keep under 125 characters for primary text`,
}

export interface ContentGenerationContext {
  formData: FormData
  competitorInsights?: string
  previousHighPerformers?: string[]
  customInstructions?: string
}

/**
 * Build the main content generation prompt
 */
export function buildContentPrompt(context: ContentGenerationContext): string {
  const { formData, competitorInsights, customInstructions } = context

  const toneConfig = getToneConfig(formData.contentTone as any) || { opener: "", cta: "" }

  // Calculate target counts per platform
  const targets = {
    linkedin: PLATFORM_CONTENT_TARGETS.linkedin.target,
    twitter: PLATFORM_CONTENT_TARGETS.twitter.target,
    threads: PLATFORM_CONTENT_TARGETS.threads.target,
    email: PLATFORM_CONTENT_TARGETS.email.target,
    ads: PLATFORM_CONTENT_TARGETS.ads.target,
  }

  return `You are an expert B2B content strategist and copywriter. Generate a complete content library for a startup based on their company profile.

## COMPANY PROFILE

**Company:** ${formData.companyName}
**Website:** ${formData.website || "Not provided"}
**Industry:** ${formData.industry}

**Product/Service:**
${formData.productDescription}

**Target Audience:**
${formData.targetAudience}
- Job Titles: ${formData.jobTitles || "Not specified"}
- Company Size: ${formData.companySize || "Not specified"}

**Pain Points They Solve:**
${formData.painPoints}

**Unique Value Proposition:**
${formData.uniqueValue}

**Key Benefits:**
${formData.keyBenefits || "Not specified"}

**Competitors:**
${formData.competitors || "Not specified"}

**Pricing Model:** ${formData.pricingModel || "Not specified"}

**Content Tone:** ${formData.contentTone || "professional"}
- Typical opener style: "${toneConfig.opener}"
- Typical CTA style: "${toneConfig.cta}"

**Primary Goal:** ${formData.primaryGoal}
${LANGUAGE_GUIDELINES[formData.contentLanguage || "en"] || ""}
${competitorInsights ? `
## COMPETITOR INSIGHTS
Use these insights to differentiate and counter-position:
${competitorInsights}
` : ""}

${customInstructions ? `
## CUSTOM INSTRUCTIONS
${customInstructions}
` : ""}

## CONTENT PILLARS
Distribute content across these pillars with approximate percentages:
${PILLARS.map(p => `- **${p.name}** (${p.pct}%): ${PILLAR_GUIDELINES[p.name]}`).join("\n")}

## PLATFORM REQUIREMENTS

Generate content for each platform following these guidelines:

### LinkedIn (${targets.linkedin} posts)
${PLATFORM_GUIDELINES.linkedin}

### Twitter/X (${targets.twitter} posts)
${PLATFORM_GUIDELINES.twitter}

### Threads (${targets.threads} posts)
${PLATFORM_GUIDELINES.threads}

### Email (${targets.email} emails)
${PLATFORM_GUIDELINES.email}

### Ad Copy (${targets.ads} ads)
${PLATFORM_GUIDELINES.ads}

## OUTPUT FORMAT

Return ONLY valid JSON matching this exact structure. No markdown, no explanation, just JSON:

{
  "linkedin": [
    {"id": 1, "title": "Brief descriptive title", "pillar": "Pillar Name", "status": "ready", "content": "Full post content here..."}
  ],
  "twitter": [...],
  "threads": [...],
  "email": [
    {"id": 1, "title": "Subject Line Here", "pillar": "Pillar Name", "status": "ready", "content": "Email body content..."}
  ],
  "ads": [...]
}

## QUALITY REQUIREMENTS

1. Every post must be SPECIFIC to ${formData.companyName} - no generic templates
2. Reference actual pain points: ${formData.painPoints.split("\n")[0]}
3. Include specific benefits and value props
4. Vary the hooks - don't start every post the same way
5. Mix content pillars across platforms
6. Make LinkedIn posts 1000-2000 characters
7. Twitter posts must be under 280 characters each
8. Email subject lines should create curiosity or urgency
9. Ad copy should lead with the strongest pain point

Generate the content now:`
}

/**
 * Build a prompt for regenerating a single post
 */
export function buildSinglePostPrompt(
  formData: FormData,
  platform: string,
  pillar: Pillar,
  currentContent?: string,
  feedback?: string
): string {
  const guidelines = PLATFORM_GUIDELINES[platform as keyof typeof PLATFORM_GUIDELINES] || ""
  const pillarGuideline = PILLAR_GUIDELINES[pillar]

  const languageGuideline = LANGUAGE_GUIDELINES[formData.contentLanguage || "en"] || ""

  return `You are an expert B2B content strategist. Generate a single ${platform} post for ${formData.companyName}.

## COMPANY CONTEXT
- Product: ${formData.productDescription}
- Audience: ${formData.targetAudience}
- Pain Points: ${formData.painPoints}
- Value Prop: ${formData.uniqueValue}
- Tone: ${formData.contentTone || "professional"}
${languageGuideline}
## CONTENT PILLAR: ${pillar}
${pillarGuideline}

## PLATFORM GUIDELINES (${platform.toUpperCase()})
${guidelines}

${currentContent ? `
## CURRENT VERSION (to improve)
${currentContent}
` : ""}

${feedback ? `
## FEEDBACK TO ADDRESS
${feedback}
` : ""}

Return ONLY valid JSON:
{"title": "Brief title", "pillar": "${pillar}", "status": "ready", "content": "Full post content..."}`
}

/**
 * Build a prompt for analyzing competitor content
 */
export function buildCompetitorAnalysisPrompt(
  companyName: string,
  competitors: string[],
  competitorContent: Array<{ competitor: string; posts: string[] }>
): string {
  return `Analyze the content strategy of these competitors and provide actionable insights for ${companyName}.

## COMPETITORS TO ANALYZE
${competitors.join(", ")}

## COMPETITOR CONTENT SAMPLES
${competitorContent.map(c => `
### ${c.competitor}
${c.posts.map((p, i) => `${i + 1}. ${p}`).join("\n")}
`).join("\n")}

## ANALYSIS REQUIRED

Provide insights in this JSON format:
{
  "competitorStrengths": [
    {"competitor": "Name", "strength": "What they do well", "example": "Specific example"}
  ],
  "competitorWeaknesses": [
    {"competitor": "Name", "weakness": "Gap or weakness", "opportunity": "How ${companyName} can exploit this"}
  ],
  "contentPatterns": [
    {"pattern": "Common pattern observed", "frequency": "How often used", "effectiveness": "High/Medium/Low"}
  ],
  "recommendedAngles": [
    {"angle": "Content angle to try", "rationale": "Why this would work", "differentiator": "How it sets ${companyName} apart"}
  ],
  "avoidList": [
    {"tactic": "What to avoid", "reason": "Why it won't work for ${companyName}"}
  ],
  "summary": "2-3 sentence executive summary of competitive positioning opportunity"
}`
}

/**
 * Build a prompt for critiquing user's content
 */
export function buildContentCritiquePrompt(
  formData: FormData,
  content: string,
  platform: string,
  competitorBenchmark?: string
): string {
  return `You are a harsh but constructive content critic. Review this ${platform} post for ${formData.companyName} and provide specific, actionable feedback.

## THE POST TO CRITIQUE
${content}

## COMPANY CONTEXT
- Product: ${formData.productDescription}
- Audience: ${formData.targetAudience}
- Value Prop: ${formData.uniqueValue}
- Goal: ${formData.primaryGoal}

${competitorBenchmark ? `
## COMPETITOR BENCHMARK
This is what competitors are doing well:
${competitorBenchmark}
` : ""}

## CRITIQUE FORMAT

Return JSON:
{
  "overallScore": 7,
  "hookScore": 8,
  "clarityScore": 6,
  "ctaScore": 5,
  "strengths": ["What works well"],
  "weaknesses": ["What needs improvement"],
  "specificFixes": [
    {"issue": "Problem identified", "currentText": "The problematic text", "suggestedText": "Improved version"}
  ],
  "rewrittenVersion": "Complete rewritten post incorporating all feedback"
}`
}
