import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FormData } from "@/types/form"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface HashtagsRequest {
  content: string
  platform: string
  formData: FormData
}

export interface HashtagSuggestion {
  hashtag: string
  category: "industry" | "topic" | "trending" | "branded" | "engagement"
  reach: "high" | "medium" | "niche"
  reason: string
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

    const body: HashtagsRequest = await request.json()
    const { content, platform, formData } = body

    if (!content || !platform || !formData) {
      return NextResponse.json(
        { error: "Missing required fields: content, platform, formData" },
        { status: 400 }
      )
    }

    console.log(`Generating hashtag suggestions for ${platform}`)

    const prompt = buildHashtagPrompt(content, platform, formData)

    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
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
    let parsed: { hashtags: HashtagSuggestion[]; recommendedCount: number; strategy: string }

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Failed to parse hashtags response" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      hashtags: parsed.hashtags,
      recommendedCount: parsed.recommendedCount,
      strategy: parsed.strategy,
    })
  } catch (error) {
    console.error("Hashtags API error:", error)
    return NextResponse.json(
      { error: "Failed to generate hashtags", details: String(error) },
      { status: 500 }
    )
  }
}

function buildHashtagPrompt(
  content: string,
  platform: string,
  formData: FormData
): string {
  const platformGuidelines: Record<string, string> = {
    linkedin: `LinkedIn best practices:
- 3-5 hashtags maximum for best reach
- Mix of broad industry and specific niche tags
- Place at end of post, not in body
- Include at least one high-reach hashtag`,
    twitter: `Twitter/X best practices:
- 1-2 hashtags maximum (more hurts engagement)
- Can be woven into content naturally
- Focus on trending or community hashtags
- Avoid hashtag spam`,
    threads: `Threads best practices:
- 0-2 hashtags (platform de-emphasizes them)
- Only use if highly relevant
- Natural placement preferred`,
    instagram: `Instagram best practices:
- Up to 5 hashtags for best engagement
- Mix of popular and niche
- Research competitor hashtags
- Include location if relevant`,
  }

  return `You are a social media hashtag strategist. Generate optimal hashtags for this ${platform} post.

## POST CONTENT
${content}

## COMPANY CONTEXT
- Company: ${formData.companyName}
- Industry: ${formData.industry}
- Product: ${formData.productDescription}
- Audience: ${formData.targetAudience}

## PLATFORM GUIDELINES
${platformGuidelines[platform] || "Standard hashtag practices apply."}

## TASK
Generate hashtag suggestions with:
1. A mix of reach levels (high, medium, niche)
2. Relevant categories
3. Platform-appropriate quantity

Return ONLY valid JSON:
{
  "hashtags": [
    {
      "hashtag": "#HashtagName",
      "category": "industry" | "topic" | "trending" | "branded" | "engagement",
      "reach": "high" | "medium" | "niche",
      "reason": "Why this hashtag is recommended"
    }
  ],
  "recommendedCount": 3,
  "strategy": "Brief explanation of the hashtag strategy for this post"
}`
}
