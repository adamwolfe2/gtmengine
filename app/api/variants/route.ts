import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FormData } from "@/types/form"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface VariantsRequest {
  content: string
  platform: string
  formData: FormData
  numVariants?: number
}

export interface HeadlineVariant {
  headline: string
  hook: string
  angle: string
  predictedEngagement: "high" | "medium" | "low"
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

    const body: VariantsRequest = await request.json()
    const { content, platform, formData, numVariants = 3 } = body

    if (!content || !platform || !formData) {
      return NextResponse.json(
        { error: "Missing required fields: content, platform, formData" },
        { status: 400 }
      )
    }

    console.log(`Generating ${numVariants} headline variants for ${platform}`)

    const prompt = buildVariantsPrompt(content, platform, formData, numVariants)

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
    let parsed: { variants: HeadlineVariant[] }

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json(
        { error: "Failed to parse variants response" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      variants: parsed.variants,
    })
  } catch (error) {
    console.error("Variants API error:", error)
    return NextResponse.json(
      { error: "Failed to generate variants", details: String(error) },
      { status: 500 }
    )
  }
}

function buildVariantsPrompt(
  content: string,
  platform: string,
  formData: FormData,
  numVariants: number
): string {
  return `You are an expert B2B content strategist specializing in A/B testing headlines for maximum engagement.

## CURRENT POST
Platform: ${platform}
Content:
${content}

## COMPANY CONTEXT
- Company: ${formData.companyName}
- Product: ${formData.productDescription}
- Audience: ${formData.targetAudience}
- Tone: ${formData.contentTone || "professional"}

## TASK
Generate ${numVariants} alternative headline/hook variations for this ${platform} post. Each variant should:
1. Take a different angle or approach
2. Maintain the same core message
3. Be optimized for ${platform}'s best practices
4. Be designed for A/B testing

## HEADLINE STRATEGIES TO USE
Mix of these approaches:
- **Pattern Interrupt**: Start with unexpected statement
- **Question Hook**: Open with curiosity-inducing question
- **Statistic Lead**: Begin with compelling number
- **Contrarian**: Challenge conventional wisdom
- **Story Opener**: Start with personal narrative
- **Direct Value**: Lead with clear benefit
- **Problem Agitation**: Highlight pain point immediately

Return ONLY valid JSON:
{
  "variants": [
    {
      "headline": "The new headline/hook (first 1-2 sentences)",
      "hook": "The type of hook used (pattern interrupt, question, statistic, etc.)",
      "angle": "Brief description of the angle taken",
      "predictedEngagement": "high" | "medium" | "low"
    }
  ]
}`
}
