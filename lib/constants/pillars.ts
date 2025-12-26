/**
 * Content pillar configuration constants
 */

import type { Pillar, PillarId, PillarConfig } from "@/types/content"

// Pillar definitions with UI configuration
export const PILLARS: PillarConfig[] = [
  {
    id: "product",
    name: "Product Journey",
    pct: 20,
    color: "bg-blue-500",
    desc: "Features, launches, how it works",
  },
  {
    id: "founder",
    name: "Founder Story",
    pct: 15,
    color: "bg-purple-500",
    desc: "Origin, vision, lessons",
  },
  {
    id: "metrics",
    name: "Growth Metrics",
    pct: 15,
    color: "bg-green-500",
    desc: "Milestones, wins, traction",
  },
  {
    id: "insights",
    name: "Industry Insights",
    pct: 20,
    color: "bg-amber-500",
    desc: "Trends, education",
  },
  {
    id: "community",
    name: "Community Wins",
    pct: 15,
    color: "bg-pink-500",
    desc: "Customer stories",
  },
  {
    id: "culture",
    name: "Culture/BTS",
    pct: 10,
    color: "bg-cyan-500",
    desc: "Team, behind-the-scenes",
  },
  {
    id: "engagement",
    name: "Engagement",
    pct: 5,
    color: "bg-red-500",
    desc: "Polls, questions",
  },
]

// Pillar ID to name mapping
export const PILLAR_NAMES: Record<PillarId, Pillar> = {
  product: "Product Journey",
  founder: "Founder Story",
  metrics: "Growth Metrics",
  insights: "Industry Insights",
  community: "Community Wins",
  culture: "Culture/BTS",
  engagement: "Engagement",
}

// Pillar name to ID mapping
export const PILLAR_IDS: Record<Pillar, PillarId> = {
  "Product Journey": "product",
  "Founder Story": "founder",
  "Growth Metrics": "metrics",
  "Industry Insights": "insights",
  "Community Wins": "community",
  "Culture/BTS": "culture",
  Engagement: "engagement",
}

// Pillar ID to color mapping
export const PILLAR_COLORS: Record<PillarId, string> = {
  product: "bg-blue-500",
  founder: "bg-purple-500",
  metrics: "bg-green-500",
  insights: "bg-amber-500",
  community: "bg-pink-500",
  culture: "bg-cyan-500",
  engagement: "bg-red-500",
}

// Pillar ID to target percentage mapping
export const PILLAR_PERCENTAGES: Record<PillarId, number> = {
  product: 20,
  founder: 15,
  metrics: 15,
  insights: 20,
  community: 15,
  culture: 10,
  engagement: 5,
}

// Helper functions
export function getPillarById(id: PillarId): PillarConfig | undefined {
  return PILLARS.find((p) => p.id === id)
}

export function getPillarByName(name: Pillar): PillarConfig | undefined {
  return PILLARS.find((p) => p.name === name)
}

export function getPillarName(id: PillarId): Pillar {
  return PILLAR_NAMES[id]
}

export function getPillarId(name: Pillar): PillarId {
  return PILLAR_IDS[name]
}

export function getPillarColor(id: PillarId): string {
  return PILLAR_COLORS[id] || "bg-gray-500"
}

export function getPillarColorByName(name: Pillar): string {
  const id = PILLAR_IDS[name]
  return id ? PILLAR_COLORS[id] : "bg-gray-500"
}

export function getAllPillarIds(): PillarId[] {
  return PILLARS.map((p) => p.id)
}

export function getAllPillarNames(): Pillar[] {
  return PILLARS.map((p) => p.name)
}

// Calculate target post count for a pillar given total posts
export function getTargetPostCount(pillarId: PillarId, totalPosts: number): number {
  const pct = PILLAR_PERCENTAGES[pillarId] || 0
  return Math.round((totalPosts * pct) / 100)
}
