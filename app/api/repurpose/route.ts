import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import type { FormData } from "@/types/form"

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

interface RepurposeRequest {
  content: string
  sourcePlatform: string
  targetPlatform: string
  formData: FormData
}

function extractContent(text: string): string {
  let cleaned = text.trim()

  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n")
    lines.shift()
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop()
    }
    cleaned = lines.join("\n")
  }

  return cleaned.trim()
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY not configured", code: "NO_API_KEY" },
        { status: 500 }
      )
    }

    const body: RepurposeRequest = await request.json()
    const { content, sourcePlatform, targetPlatform, formData } = body

    if (!content || !sourcePlatform || !targetPlatform || !formData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    console.log(`Repurposing ${sourcePlatform} content to ${targetPlatform}`)

    const prompt = buildRepurposePrompt(content, sourcePlatform, targetPlatform, formData)

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

    const textBlock = message.content.find((block) => block.type === "text")
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from Claude")
    }

    const newContent = extractContent(textBlock.text)

    return NextResponse.json({
      success: true,
      content: newContent,
      sourcePlatform,
      targetPlatform,
    })
  } catch (error) {
    console.error("Repurpose API error:", error)
    return NextResponse.json(
      { error: "Failed to repurpose content", details: String(error) },
      { status: 500 }
    )
  }
}

function buildRepurposePrompt(
  content: string,
  sourcePlatform: string,
  targetPlatform: string,
  formData: FormData
): string {
  const platformGuidelines: Record<string, string> = {
    linkedin: `LinkedIn Guidelines:
- Professional but personable tone
- 1300-2000 characters optimal
- Use line breaks for readability
- Strong hook in first line
- End with engagement question or CTA
- 3-5 hashtags at the end`,
    twitter: `Twitter/X Guidelines:
- 240-280 characters max
- Punchy and direct
- No hashtags or max 1-2
- Strong opening hook
- Clear single point`,
    threads: `Threads Guidelines:
- Casual, authentic tone
- 400-500 characters optimal
- Personal storytelling style
- Conversational language
- No hashtags`,
    email: `Email Guidelines:
- Personal, one-to-one feeling
- Clear single CTA
- 200-400 words optimal
- Scannable paragraphs
- Value-first approach`,
    ads: `Ad Copy Guidelines:
- Lead with pain point or desire
- Specific claims
- Under 125 characters primary text
- Clear value proposition
- Strong CTA`,
  }

  return `You are a content repurposing expert. Transform the following ${sourcePlatform} content into ${targetPlatform} format.

## ORIGINAL ${sourcePlatform.toUpperCase()} CONTENT
${content}

## COMPANY CONTEXT
- Company: ${formData.companyName}
- Industry: ${formData.industry || "Not specified"}
- Audience: ${formData.targetAudience || "Not specified"}
- Tone: ${formData.contentTone || "professional"}

## SOURCE PLATFORM CONTEXT
Original was written for ${sourcePlatform}:
${platformGuidelines[sourcePlatform] || "Standard platform practices."}

## TARGET PLATFORM REQUIREMENTS
Adapt for ${targetPlatform}:
${platformGuidelines[targetPlatform] || "Standard platform practices."}

## TRANSFORMATION GUIDELINES
1. Preserve the core message and value proposition
2. Adjust length to match target platform norms
3. Modify tone to fit the platform culture
4. Reformat structure (paragraphs, line breaks)
5. Update CTA style for the platform
6. Add/remove hashtags as appropriate

Return ONLY the transformed content. No explanation, no markdown code blocks, just the ready-to-post content for ${targetPlatform}.`
}
