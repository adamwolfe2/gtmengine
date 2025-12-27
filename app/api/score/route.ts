import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FormData } from "@/types/form"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface ScoreRequest {
  content: string
  platform: string
  formData: FormData
}

export interface ContentScore {
  overallScore: number
  breakdown: {
    hook: { score: number; feedback: string }
    clarity: { score: number; feedback: string }
    value: { score: number; feedback: string }
    cta: { score: number; feedback: string }
    length: { score: number; feedback: string }
    readability: { score: number; feedback: string }
  }
  quickWins: string[]
  predictedPerformance: "viral" | "high" | "average" | "low"
  platformOptimization: number
}

/**
 * Extract JSON from Claude's response
 */
function extractJSON(text: string): string {
  let cleaned = text.trim()

  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n")
    lines.shift()
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop()
    }
    cleaned = lines.join("\n")
  }

  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")

  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured", code: "NO_API_KEY" },
        { status: 500 }
      )
    }

    const body: ScoreRequest = await request.json()
    const { content, platform, formData } = body

    if (!content || !platform || !formData) {
      return NextResponse.json(
        { error: "Missing required fields: content, platform, formData" },
        { status: 400 }
      )
    }

    console.log(`Scoring ${platform} content for ${formData.companyName}`)

    const prompt = buildScorePrompt(content, platform, formData)

    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    // Extract text content
    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude")
    }

    // Parse JSON from response
    const jsonStr = extractJSON(textBlock.text)
    let parsed: ContentScore

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Failed to parse score response" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      score: parsed,
    })
  } catch (error) {
    console.error("Score API error:", error)
    return NextResponse.json(
      { error: "Failed to score content", details: String(error) },
      { status: 500 }
    )
  }
}

function buildScorePrompt(
  content: string,
  platform: string,
  formData: FormData
): string {
  const platformCriteria: Record<string, string> = {
    linkedin: `LinkedIn Scoring Criteria:
- Hook: Does the first line grab attention? (pattern interrupt, question, bold statement)
- Length: Is it between 1000-2000 characters? (optimal range)
- Line breaks: Uses white space for readability?
- CTA: Clear engagement driver at the end?
- Hashtags: 3-5 relevant tags?
- Professional yet personal tone?`,
    twitter: `Twitter/X Scoring Criteria:
- Hook: Immediate attention in first line
- Length: Under 280 characters per tweet
- Punchy and concise
- Clear point or value
- Minimal hashtags (0-2)`,
    threads: `Threads Scoring Criteria:
- Authentic, casual tone
- Storytelling format
- Under 500 characters
- Personal perspective
- Conversational style`,
    email: `Email Scoring Criteria:
- Subject line (if title) creates curiosity
- Personal, one-to-one feeling
- Clear single CTA
- Scannable paragraphs
- Value-first approach
- 200-400 words optimal`,
    ads: `Ad Copy Scoring Criteria:
- Pain point or desire lead
- Specific claims
- Clear value proposition
- Strong CTA
- Under 125 characters primary text`,
  }

  return `You are a content performance analyst. Score this ${platform} post against best practices.

## POST CONTENT
${content}

## COMPANY CONTEXT
- Company: ${formData.companyName}
- Audience: ${formData.targetAudience}
- Goal: ${formData.primaryGoal || "engagement"}
- Tone: ${formData.contentTone || "professional"}

## PLATFORM CRITERIA
${platformCriteria[platform] || "Standard social media best practices."}

## SCORING RUBRIC
Score each dimension 1-10:
- **Hook (1-10)**: How attention-grabbing is the opening?
- **Clarity (1-10)**: How clear is the message?
- **Value (1-10)**: How much value does it provide to the reader?
- **CTA (1-10)**: How strong is the call-to-action or engagement driver?
- **Length (1-10)**: Is the length optimal for ${platform}?
- **Readability (1-10)**: How easy is it to scan and read?

Return ONLY valid JSON:
{
  "overallScore": 7.5,
  "breakdown": {
    "hook": { "score": 8, "feedback": "Strong opening question" },
    "clarity": { "score": 7, "feedback": "Message is clear but could be more focused" },
    "value": { "score": 8, "feedback": "Provides actionable insight" },
    "cta": { "score": 6, "feedback": "CTA could be more specific" },
    "length": { "score": 9, "feedback": "Optimal length for ${platform}" },
    "readability": { "score": 7, "feedback": "Good use of line breaks" }
  },
  "quickWins": [
    "Add a specific question at the end to drive comments",
    "Shorten the second paragraph by 20%"
  ],
  "predictedPerformance": "high" | "average" | "low" | "viral",
  "platformOptimization": 85
}`
}
