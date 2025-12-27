import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FormData } from "@/types/form"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface CalendarRequest {
  formData: FormData
  existingContent?: {
    platforms: string[]
    postCount: number
  }
}

interface CalendarWeek {
  week: number
  month: number
  phase: string
  posts: Array<{
    day: string
    type: string
    pillar: string
    topic: string
    platform: string
  }>
}

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

  const firstBrace = cleaned.indexOf("[")
  const lastBrace = cleaned.lastIndexOf("]")

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

    const body: CalendarRequest = await request.json()
    const { formData, existingContent } = body

    if (!formData) {
      return NextResponse.json(
        { error: "Missing formData" },
        { status: 400 }
      )
    }

    console.log(`Generating calendar for ${formData.companyName}`)

    const prompt = buildCalendarPrompt(formData, existingContent)

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude")
    }

    const jsonStr = extractJSON(textBlock.text)
    let parsed: CalendarWeek[]

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Failed to parse calendar response" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      calendar: parsed,
    })
  } catch (error) {
    console.error("Calendar autofill API error:", error)
    return NextResponse.json(
      { error: "Failed to generate calendar", details: String(error) },
      { status: 500 }
    )
  }
}

function buildCalendarPrompt(formData: FormData, existingContent?: { platforms: string[]; postCount: number }): string {
  const contentPillars = [
    "Thought Leadership",
    "Product Updates",
    "Industry Insights",
    "Customer Stories",
    "Behind the Scenes",
  ]

  return `You are a content strategist creating a 12-week (90-day) content calendar for a B2B company.

## COMPANY CONTEXT
- Company: ${formData.companyName}
- Industry: ${formData.industry || "Technology"}
- Target Audience: ${formData.targetAudience || "B2B decision makers"}
- Primary Goal: ${formData.primaryGoal || "Lead generation"}
- Content Tone: ${formData.contentTone || "Professional"}
- Unique Value: ${formData.uniqueValue || "Not specified"}
${existingContent ? `- Existing content: ${existingContent.postCount} posts across ${existingContent.platforms.join(", ")}` : ""}

## CONTENT PILLARS
${contentPillars.map((p: string, i: number) => `${i + 1}. ${p}`).join("\n")}

## CALENDAR STRUCTURE
Create a 12-week calendar with 3 posts per week (Monday, Wednesday, Friday).

Month 1 (Weeks 1-4): Foundation Phase - Build awareness and establish authority
Month 2 (Weeks 5-8): Growth Phase - Increase engagement and nurture leads
Month 3 (Weeks 9-12): Scale Phase - Drive conversions and expand reach

## POST TYPES
- Educational: How-to guides, tips, frameworks
- Story: Customer stories, team stories, journey posts
- Engagement: Questions, polls, industry opinions
- Promotional: Product features, offers, demos
- Trending: Industry news, trends commentary

## PLATFORMS
Rotate between: linkedin, twitter, threads, email

Return ONLY a valid JSON array with this structure:
[
  {
    "week": 1,
    "month": 1,
    "phase": "Foundation",
    "posts": [
      { "day": "Mon", "type": "Educational", "pillar": "Thought Leadership", "topic": "5 trends reshaping [industry]", "platform": "linkedin" },
      { "day": "Wed", "type": "Story", "pillar": "Behind the Scenes", "topic": "Why we started [company]", "platform": "twitter" },
      { "day": "Fri", "type": "Engagement", "pillar": "Industry Insights", "topic": "What's your biggest challenge with X?", "platform": "linkedin" }
    ]
  }
]

Generate all 12 weeks with specific, actionable topic ideas tailored to ${formData.companyName} in the ${formData.industry || "technology"} space.`
}
