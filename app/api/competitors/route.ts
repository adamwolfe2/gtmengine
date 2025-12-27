import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { buildCompetitorAnalysisPrompt } from "@/lib/content/prompts"

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface CompetitorResearchRequest {
  companyName: string
  industry: string
  competitors: string[]
  website?: string
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

    const body: CompetitorResearchRequest = await request.json()
    const { companyName, industry, competitors, website } = body

    if (!competitors || competitors.length === 0) {
      return NextResponse.json(
        { error: "No competitors provided" },
        { status: 400 }
      )
    }

    console.log(`Analyzing competitors for ${companyName}:`, competitors)

    // Use Claude to research and analyze competitors
    // Claude has web search capabilities via the tool, but for now we'll use its knowledge
    const researchPrompt = `You are a competitive intelligence analyst. Research and analyze these competitors for ${companyName}, a company in the ${industry} industry${website ? ` (website: ${website})` : ""}.

## COMPETITORS TO ANALYZE
${competitors.map((c, i) => `${i + 1}. ${c}`).join("\n")}

## YOUR TASK

Based on your knowledge of these companies, provide a comprehensive competitive analysis. For each competitor, identify:
1. Their content strategy strengths (what they do well on LinkedIn/Twitter)
2. Their weaknesses or gaps in content (opportunities for ${companyName})
3. Common content patterns they use
4. Their messaging and positioning

Then provide strategic recommendations for ${companyName} to differentiate.

## OUTPUT FORMAT

Return ONLY valid JSON in this exact structure:
{
  "competitors": [
    {
      "competitor": "Competitor Name",
      "strengths": [
        {"strength": "What they do well", "example": "Specific example of their content"}
      ],
      "weaknesses": [
        {"weakness": "Gap or weakness", "opportunity": "How ${companyName} can exploit this"}
      ],
      "contentPatterns": [
        {"pattern": "Pattern description", "frequency": "How often", "effectiveness": "High/Medium/Low"}
      ],
      "topPerformingContent": ["Example content type that works for them"]
    }
  ],
  "recommendedAngles": [
    {"angle": "Content angle", "rationale": "Why this works", "differentiator": "How it sets ${companyName} apart"}
  ],
  "avoidList": [
    {"tactic": "What to avoid", "reason": "Why it won't work"}
  ],
  "summary": "2-3 sentence executive summary of competitive positioning opportunity for ${companyName}"
}`

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      messages: [
        {
          role: "user",
          content: researchPrompt,
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
    let parsed: unknown

    try {
      parsed = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      console.error("Raw response:", textBlock.text.slice(0, 500))

      return NextResponse.json(
        { error: "Failed to parse competitor analysis" },
        { status: 500 }
      )
    }

    // Add metadata
    const insights = {
      ...(parsed as object),
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json({
      success: true,
      insights,
    })
  } catch (error) {
    console.error("Competitor research error:", error)
    return NextResponse.json(
      { error: "Failed to analyze competitors", details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check if competitor research is available
 */
export async function GET() {
  const hasApiKey = !!process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    available: hasApiKey,
    message: hasApiKey
      ? "Competitor research is available"
      : "ANTHROPIC_API_KEY not configured",
  })
}
