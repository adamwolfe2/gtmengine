/**
 * Platform configuration constants
 */

import type { PlatformId } from "@/types/form"
import type { PlatformConfig } from "@/types/content"

// Platform definitions with UI configuration
export const PLATFORMS: PlatformConfig[] = [
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "Linkedin",
    color: "bg-blue-600",
  },
  {
    id: "twitter",
    name: "Twitter/X",
    icon: "Twitter",
    color: "bg-black",
  },
  {
    id: "threads",
    name: "Threads",
    icon: "MessageCircle",
    color: "bg-purple-600",
  },
  {
    id: "email",
    name: "Email",
    icon: "Mail",
    color: "bg-green-600",
  },
  {
    id: "ads",
    name: "Ad Copy",
    icon: "Megaphone",
    color: "bg-orange-500",
  },
]

// Platform ID to name mapping
export const PLATFORM_NAMES: Record<PlatformId, string> = {
  linkedin: "LinkedIn",
  twitter: "Twitter/X",
  threads: "Threads",
  email: "Email",
  ads: "Ad Copy",
}

// Platform ID to color mapping
export const PLATFORM_COLORS: Record<PlatformId, string> = {
  linkedin: "bg-blue-600",
  twitter: "bg-black",
  threads: "bg-purple-600",
  email: "bg-green-600",
  ads: "bg-orange-500",
}

// Platform ID to icon mapping (lucide-react icon names)
export const PLATFORM_ICONS: Record<PlatformId, string> = {
  linkedin: "Linkedin",
  twitter: "Twitter",
  threads: "MessageCircle",
  email: "Mail",
  ads: "Megaphone",
}

// Target content counts per platform
export const PLATFORM_CONTENT_TARGETS: Record<PlatformId, { min: number; max: number; target: number }> = {
  linkedin: { min: 15, max: 25, target: 20 },
  twitter: { min: 8, max: 15, target: 10 },
  threads: { min: 3, max: 5, target: 3 },
  email: { min: 4, max: 6, target: 5 },
  ads: { min: 4, max: 6, target: 5 },
}

// Helper functions
export function getPlatformById(id: PlatformId): PlatformConfig | undefined {
  return PLATFORMS.find((p) => p.id === id)
}

export function getPlatformName(id: PlatformId): string {
  return PLATFORM_NAMES[id] || id
}

export function getPlatformColor(id: PlatformId): string {
  return PLATFORM_COLORS[id] || "bg-gray-500"
}

export function getAllPlatformIds(): PlatformId[] {
  return PLATFORMS.map((p) => p.id)
}
