"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Check,
  Copy,
  ChevronRight,
  ChevronLeft,
  Calendar,
  FileText,
  Target,
  CheckSquare,
  Search,
  Sparkles,
  Building2,
  Users,
  Trophy,
  Megaphone,
  Download,
  RefreshCw,
  Filter,
  BarChart3,
  ChevronDown,
  Linkedin,
  Twitter,
  Mail,
  MessageCircle,
  Edit3,
  Settings,
  Upload,
  X,
  TrendingUp,
  User,
  FileDown,
  FileUp,
  Square,
  Home,
  Menu,
  LogOut,
  Hash,
  Shuffle,
  Eye,
} from "lucide-react"

import { parseAIResponse } from "@/lib/parse-ai-response"
import { generateContentWithLLM, generateContentWithStreaming, type GenerationProgress } from "@/lib/content/llm-generator"
import { parseCompetitors, formatInsightsForPrompt, loadCompetitorInsights, saveCompetitorInsights, type CompetitorInsights } from "@/lib/competitors/analyzer"
import { toast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { FormData } from "@/types/form"

// ============================================
// LOCAL STORAGE UTILITIES
// ============================================
const STORAGE_KEYS = {
  FORM_DATA: "gtm_form_data",
  GENERATED_CONTENT: "gtm_generated_content",
  DAILY_TASKS: "gtm_daily_tasks",
  READY_STATE: "gtm_ready_state",
}

// Platform character limits (optimal/max)
const PLATFORM_LIMITS: Record<string, { optimal: number; max: number; label: string }> = {
  linkedin: { optimal: 1300, max: 3000, label: "LinkedIn" },
  twitter: { optimal: 240, max: 280, label: "X/Twitter" },
  threads: { optimal: 400, max: 500, label: "Threads" },
  email: { optimal: 1500, max: 2500, label: "Email" },
  ads: { optimal: 90, max: 125, label: "Ad Copy" },
}

const saveToLocalStorage = (key: string, data: any) => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error("Error saving to localStorage:", error)
  }
}

const loadFromLocalStorage = (key: string) => {
  if (typeof window === "undefined") return null
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.error("Error loading from localStorage:", error)
    return null
  }
}

const exportAllData = () => {
  const data = {
    formData: loadFromLocalStorage(STORAGE_KEYS.FORM_DATA),
    generatedContent: loadFromLocalStorage(STORAGE_KEYS.GENERATED_CONTENT),
    dailyTasks: loadFromLocalStorage(STORAGE_KEYS.DAILY_TASKS),
    readyState: loadFromLocalStorage(STORAGE_KEYS.READY_STATE),
    exportDate: new Date().toISOString(),
    version: "1.0",
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `gtm-content-engine-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const importData = (file: File, onSuccess: () => void) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)

      if (data.formData) saveToLocalStorage(STORAGE_KEYS.FORM_DATA, data.formData)
      if (data.generatedContent) saveToLocalStorage(STORAGE_KEYS.GENERATED_CONTENT, data.generatedContent)
      if (data.dailyTasks) saveToLocalStorage(STORAGE_KEYS.DAILY_TASKS, data.dailyTasks)
      if (data.readyState !== undefined) saveToLocalStorage(STORAGE_KEYS.READY_STATE, data.readyState)

      toast({ title: "Success", description: "Data imported successfully! Reloading..." })
      onSuccess()
    } catch (error) {
      toast({ title: "Error", description: "Error importing data. Please check the file format.", variant: "destructive" })
      console.error(error)
    }
  }
  reader.readAsText(file)
}

const exportContentCSV = (content: any, companyName: string, showToast?: boolean) => {
  const rows = [["Platform", "ID", "Title", "Pillar", "Status", "Content"]]

  let totalPosts = 0
  Object.entries(content).forEach(([platform, posts]: [string, any]) => {
    posts.forEach((post: any) => {
      rows.push([platform, post.id.toString(), post.title, post.pillar, post.status || "ready", post.content.replace(/\n/g, " ")])
      totalPosts++
    })
  })

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${companyName}-content-library-${Date.now()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  return totalPosts
}

const exportContentJSON = (content: any, companyName: string) => {
  const exportData = {
    exportDate: new Date().toISOString(),
    company: companyName,
    content: content,
    summary: {
      linkedin: (content.linkedin || []).length,
      twitter: (content.twitter || []).length,
      threads: (content.threads || []).length,
      email: (content.email || []).length,
      ads: (content.ads || []).length,
    },
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${companyName}-content-library-${Date.now()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  const total = Object.values(exportData.summary).reduce((a, b) => a + b, 0)
  return total
}

// ============================================
// CONFIGURATION
// ============================================

const PLATFORMS = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, color: "bg-blue-600" },
  { id: "twitter", name: "Twitter/X", icon: Twitter, color: "bg-black" },
  { id: "threads", name: "Threads", icon: MessageCircle, color: "bg-purple-600" },
  { id: "email", name: "Email", icon: Mail, color: "bg-green-600" },
  { id: "ads", name: "Ad Copy", icon: Megaphone, color: "bg-orange-500" },
]

const PILLARS = [
  { id: "product", name: "Product Journey", pct: 20, color: "bg-blue-500", desc: "Features, launches, how it works" },
  { id: "founder", name: "Founder Story", pct: 15, color: "bg-purple-500", desc: "Origin, vision, lessons" },
  { id: "metrics", name: "Growth Metrics", pct: 15, color: "bg-green-500", desc: "Milestones, wins, traction" },
  { id: "insights", name: "Industry Insights", pct: 20, color: "bg-amber-500", desc: "Trends, education" },
  { id: "community", name: "Community Wins", pct: 15, color: "bg-pink-500", desc: "Customer stories" },
  { id: "culture", name: "Culture/BTS", pct: 10, color: "bg-cyan-500", desc: "Team, behind-the-scenes" },
  { id: "engagement", name: "Engagement", pct: 5, color: "bg-red-500", desc: "Polls, questions" },
]

const INDUSTRIES = [
  { value: "saas", label: "B2B SaaS" },
  { value: "agency", label: "Agency / Consulting" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "marketplace", label: "Marketplace" },
  { value: "coaching", label: "Coaching / Info Products" },
  { value: "other", label: "Other" },
]

// ============================================
// CONTENT GENERATION ENGINE
// ============================================

function generateContent(data: any) {
  const {
    companyName = "Our Company",
    productDescription = "",
    targetAudience = "",
    painPoints = "",
    uniqueValue = "",
    primaryGoal = "leads",
    industry = "saas",
    contentTone = "professional",
  } = data

  const pains = painPoints.split("\n").filter((p: string) => p.trim())
  const mainPain = pains[0] || "common challenges in your industry"
  const secondPain = pains[1] || "scaling efficiently"
  const thirdPain = pains[2] || "finding the right solutions"

  const toneMap: any = {
    professional: { opener: "Here's what I've learned:", cta: "Thoughts?" },
    casual: { opener: "Real talk:", cta: "What do you think?" },
    bold: { opener: "Unpopular opinion:", cta: "Fight me on this 👇" },
    educational: { opener: "Let me break this down:", cta: "Save this for later." },
    inspiring: { opener: "This changed everything for me:", cta: "Your turn." },
  }
  const tone = toneMap[contentTone] || toneMap.professional

  const goalCTA: any = {
    leads: "Want to see how? Link in comments.",
    awareness: "Follow for more insights like this.",
    authority: "Agree or disagree? Let's discuss.",
    sales: 'DM me "INFO" to learn more.',
    community: "Join our community - link in bio.",
    hiring: "We're hiring. Check out our careers page.",
  }

  const hashtags = `#${companyName.replace(/\s+/g, "")} #${industry === "saas" ? "SaaS" : industry} #BuildingInPublic`

  const linkedin = [
    {
      id: 1,
      title: "Origin Story",
      pillar: "Founder Story",
      status: "ready" as const,
      content: `Why I built ${companyName}:

${mainPain}

I watched this problem destroy productivity for years. Everyone had the same complaints. Nobody was fixing it the right way.

${tone.opener}

The existing solutions were:
• Too complex for most teams
• Too expensive for the value
• Built by people who never experienced the problem

So we built ${companyName}.

${uniqueValue || "We focused on what actually matters - solving the core problem without the bloat."}

3 lessons from the journey:

1. Talk to 100 customers before writing code
2. Ship ugly, iterate fast
3. Your first version will be embarrassing - launch anyway

What made you start your company?

${hashtags} #FounderJourney`,
    },
    {
      id: 2,
      title: "Biggest Lesson",
      pillar: "Founder Story",
      status: "review" as const,
      content: `The biggest lesson from building ${companyName}:

Your first version will be embarrassing. Ship it anyway.

Our MVP had:
• Bugs everywhere
• Missing features customers wanted
• UI that made designers cry

But we also had:
✅ Real users giving real feedback
✅ Data on what actually mattered
✅ Momentum that perfectionism kills

If we'd waited for "ready," we'd still be waiting.

The gap between "ready" and "perfect" is infinite.
The gap between "shipped" and "good enough" is one iteration.

What's something you shipped before it was ready?

${tone.cta}

${hashtags}`,
    },
    {
      id: 3,
      title: "Why Now",
      pillar: "Founder Story",
      status: "ready" as const,
      content: `People ask: "Why build ${companyName} now?"

The timing wasn't random.

3 things converged:

1. The problem got worse
${mainPain} - this pain point has been growing for years. COVID accelerated it.

2. Technology caught up
What used to require a team of 10 can now be done with modern tools.

3. The old solutions stopped working
Legacy players got comfortable. They stopped innovating.

${companyName} exists because the market was ready for something new.

Timing isn't everything. But it's a lot.

When did you realize it was "time" for your idea?

${hashtags}`,
    },
    {
      id: 4,
      title: "Problem Agitation",
      pillar: "Industry Insights",
      status: "review" as const,
      content: `${tone.opener}

Most ${industry} companies are solving the wrong problem.

They focus on:
❌ Adding more features nobody asked for
❌ Hiring more people instead of fixing processes
❌ Throwing money at ads without strategy

When they should focus on:
✅ Understanding the real pain point
✅ Building systems that scale
✅ Creating value before capturing it

${mainPain} isn't a feature problem.

It's a mindset problem.

Here's what actually works:

1. Start with the outcome your customer wants
2. Work backwards to the simplest path
3. Remove everything that doesn't serve that path

What would you add?

${hashtags} #ThoughtLeadership`,
    },
    {
      id: 5,
      title: "Framework Post",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `The 5-step framework we use at ${companyName}:

Step 1: Define the problem (specifically)
Most teams skip this. They think they know.
They don't. Write it down.

Step 2: Map your current state
Where are you now? What's working? What's broken?
Be brutally honest.

Step 3: Design the ideal state
Where do you want to be in 90 days?
What does success look like?

Step 4: Build the bridge
What's the minimum viable path?
Cut everything else.

Step 5: Execute and iterate
Ship fast. Learn faster.
Adjust weekly based on data.

This framework has helped ${targetAudience || "our customers"} consistently hit their goals.

The secret? It's not the framework.
It's the discipline to follow it.

Save this. You'll need it.

${hashtags} #Framework`,
    },
    {
      id: 6,
      title: "Contrarian Take",
      pillar: "Industry Insights",
      status: "review" as const,
      content: `Controversial opinion:

Stop "building in public."

At least the way most people do it.

Here's what I mean:

❌ Sharing every revenue milestone
❌ Posting screenshots of MRR charts
❌ Making everything about the numbers

That's not building in public.
That's humble bragging in public.

✅ Real building in public:
• Sharing the failures (not just wins)
• Teaching what you learned
• Being honest about what's hard
• Helping others avoid your mistakes

The best content makes people feel less alone.
Not more impressed by your success.

What do you think? Overrated or underrated?

${hashtags}`,
    },
    {
      id: 7,
      title: "Industry Trend",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `3 trends reshaping ${industry} in 2025:

1. AI is table stakes, not a differentiator
Everyone has AI now. The winners will be those who implement it thoughtfully, not those who slap "AI-powered" on everything.

2. Consolidation is coming
Too many tools. Buyers are exhausted. Platforms that do 3 things well will beat point solutions.

3. Community > Content
Content is saturated. The new moat is community. People want to belong, not just consume.

How ${companyName} is adapting:
${uniqueValue ? uniqueValue.substring(0, 100) + "..." : "We're building for the long game."}

Which trend do you think matters most?

${hashtags} #Trends`,
    },
    {
      id: 8,
      title: "How-To Guide",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `How to ${primaryGoal === "leads" ? "generate 50+ qualified leads" : primaryGoal === "awareness" ? "build brand awareness" : "get results"} in 30 days:

Without spending money on ads

Step 1: Pick ONE platform
LinkedIn if B2B. Twitter if building in public.
Don't spread yourself thin.

Step 2: Post daily for 30 days
Not promotional. Valuable.
Teach what you know.

Step 3: Comment on 20 posts per day
From ${targetAudience || "your target audience"}.
Add value. Don't pitch.

Step 4: DM 5 engaged followers weekly
Start conversations. Be human.
Ask questions. Listen.

Step 5: Create ONE lead magnet
Solve a specific problem.
Give it away for email addresses.

That's it. No fancy funnels.

We did this for 90 days before our first customer.
Now we have hundreds.

Your turn.

${hashtags}`,
    },
    {
      id: 9,
      title: "Milestone Post",
      pillar: "Growth Metrics",
      status: "ready" as const,
      content: `${companyName} update:

📈 Last 30 days:
• New customers: +47
• Revenue: +32% MoM
• NPS: 72 (up from 64)

But here's what the numbers don't tell you:

Every single customer came from:
• Word of mouth referrals
• Content that helped people
• Building in public

We spent $0 on paid ads last month.

Not because paid doesn't work.
Because organic works better when you:

1. Actually solve a real problem
2. Share your journey authentically
3. Help people before asking for anything

The best marketing strategy?

Build something people want to tell their friends about.

${goalCTA[primaryGoal]}

${hashtags} #Growth`,
    },
    {
      id: 10,
      title: "Year in Review",
      pillar: "Growth Metrics",
      status: "review" as const,
      content: `${companyName} - what a year:

January: Just an idea
March: First MVP shipped
May: First paying customer
July: Hit $10K MRR
October: Team of 5
December: Profitable

The unsexy truth?

90% of those months felt like failure.

• Missed targets
• Features that flopped
• Customers who churned
• Doubts about everything

The 10% that felt like success?
Those came from the 90% of "failures."

If you're in the hard part right now:

Keep going.
The compounding hasn't kicked in yet.

What was your biggest win this year?

${hashtags}`,
    },
    {
      id: 11,
      title: "Customer Story",
      pillar: "Community Wins",
      status: "ready" as const,
      content: `Customer spotlight 🎉

One of our ${targetAudience || "customers"} just shared their results:

Before ${companyName}:
• ${mainPain}
• Wasting 15+ hours weekly on manual work
• Missing opportunities constantly

After 60 days:
• Workflow completely streamlined
• 15+ hours saved per week
• Finally focusing on growth

Their exact words:

"I wish we found ${companyName} six months ago. We would have saved ourselves so much pain."

This is why we do what we do.

Not to build features.
Not to raise money.
Not to hit vanity metrics.

To help people get real results.

${goalCTA[primaryGoal]}

${hashtags} #CustomerSuccess`,
    },
    {
      id: 12,
      title: "Testimonial Thread",
      pillar: "Community Wins",
      status: "ready" as const,
      content: `What our customers say about ${companyName}:

"Finally, something that actually works." - Marketing Director

"ROI in the first week. Not kidding." - Startup Founder

"My team loves it. Adoption was instant." - VP of Operations

"Support is incredible. They actually care." - Small Business Owner

"Why didn't this exist 5 years ago?" - Agency Owner

But my favorite feedback?

"It just... makes sense."

That's what we optimize for.

Not complexity. Simplicity.
Not features. Outcomes.
Not impressive. Useful.

Thank you to everyone who's taken a chance on us.

We're just getting started.

${hashtags}`,
    },
    {
      id: 13,
      title: "Product Update",
      pillar: "Product Journey",
      status: "review" as const,
      content: `New in ${companyName} this week:

🚀 What we shipped:

1. [Feature name] - Save 2+ hours per week
Finally automated the thing everyone complained about.

2. Improved onboarding
New users now see value in under 5 minutes.

3. Performance boost
Everything is 40% faster. You'll notice.

🔧 What we fixed:
• That annoying bug (you know the one)
• Mobile experience improvements
• Better error messages

📋 What's next:
• Integration with [popular tool]
• Advanced analytics dashboard
• Team collaboration features

Feedback drives our roadmap.

What would make ${companyName} 10x better for you?

${hashtags} #ProductUpdate`,
    },
    {
      id: 14,
      title: "How It Works",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `How ${companyName} works in 60 seconds:

${productDescription || "We solve the problem you hate dealing with."}

Step 1: Connect your accounts (2 minutes)
No complex setup. No IT needed.

Step 2: Tell us your goals
We customize everything based on what you're trying to achieve.

Step 3: Let it run
${companyName} handles the heavy lifting.

Step 4: See results
Real metrics. Real impact. Real fast.

That's it.

No learning curve.
No implementation headaches.
No wondering if it's working.

${uniqueValue || "We built this because we hated all the alternatives."}

${goalCTA[primaryGoal]}

${hashtags}`,
    },
    {
      id: 15,
      title: "Why We Built X",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `Why we built [new feature]:

Customer feedback:
"I love ${companyName}, but I wish it could also do X."

We heard this 50+ times.

So we built it.

Here's the thinking:

The old way:
• Manual, time-consuming
• Error-prone
• Required 3 different tools

The ${companyName} way:
• Automated, instant
• Accurate
• All in one place

Building in public means building what people actually need.

Not what we think is cool.
Not what looks good in a demo.
What solves real problems.

What feature would you add?

${hashtags}`,
    },
    {
      id: 16,
      title: "Behind the Scenes",
      pillar: "Culture/BTS",
      status: "review" as const,
      content: `Behind the scenes at ${companyName} this week:

🔨 What we shipped:
• New feature customers requested
• Improved onboarding flow
• 12 bug fixes

📚 What we learned:
• Customer feedback > our assumptions
• Small improvements compound
• Documentation is underrated

🎯 What's next:
• Major update coming next month
• Expanding the team
• More customer wins to share

The unsexy truth about building:

90% of the work is invisible.

The bug fixes nobody notices.
The customer calls that don't make LinkedIn.
The iterations after the launch post.

But that's where real progress happens.

What's happening behind the scenes at your company?

${hashtags} #BTS`,
    },
    {
      id: 17,
      title: "Team Spotlight",
      pillar: "Culture/BTS",
      status: "ready" as const,
      content: `Team spotlight: [Team member name]

Role: [Their role]

What they do:
"I make sure our customers actually succeed, not just buy."

Favorite thing about ${companyName}:
"We actually listen. When a customer suggests something, it often ships within weeks."

Outside of work:
[Hobby/interest]

Why we hired them:
They cared more about our mission than their title.

That's the ${companyName} way.

We're a small team that punches above our weight.

Because we hire people who give a damn.

Speaking of which - we're hiring.

Link in comments if you want to join us.

${hashtags} #TeamSpotlight`,
    },
    {
      id: 18,
      title: "Poll",
      pillar: "Engagement",
      status: "ready" as const,
      content: `Quick question for ${targetAudience || "my network"}:

What's your biggest challenge right now?

🔴 ${mainPain}
🟡 ${secondPain}
🟢 ${thirdPain}
🔵 Something else (comment below)

I'm asking because we're planning our roadmap at ${companyName}.

And we want to build what YOU need.

Not what sounds good in a pitch deck.
What actually moves the needle.

Drop your vote + any context below 👇

${hashtags} #Poll`,
    },
    {
      id: 19,
      title: "Hot Take Request",
      pillar: "Engagement",
      status: "review" as const,
      content: `Give me your hottest take on ${industry}:

I'll go first:

"${tone.opener} Most companies in our space are solving a problem that doesn't exist."

Now you.

Rules:
• Has to be something you actually believe
• Bonus points if it's controversial
• No hedge words ("I think maybe possibly")

Best take gets featured in our newsletter.

Go 👇

${hashtags}`,
    },
    {
      id: 20,
      title: "This or That",
      pillar: "Engagement",
      status: "ready" as const,
      content: `${industry} edition: This or That?

Move fast vs. Move right
Remote vs. In-office
Bootstrapped vs. Funded
Product-led vs. Sales-led
Specialist vs. Generalist

My answers:
Move fast (you can fix mistakes)
Remote (talent > location)
Bootstrapped (until you need to go faster)
Product-led (let the work speak)
Generalist (especially early)

What about you?

${hashtags}`,
    },
  ]

  const twitter = [
    {
      id: 1,
      title: "Hook Thread",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `${mainPain}?

Here's how to fix it in 30 days (without spending money on ads):

🧵👇`,
    },
    {
      id: 2,
      title: "Hot Take",
      pillar: "Industry Insights",
      status: "review" as const,
      content: `hot take: most ${industry} companies are overcomplicating this

the answer is simpler than you think

${companyName} is proof`,
    },
    {
      id: 3,
      title: "Milestone",
      pillar: "Growth Metrics",
      status: "ready" as const,
      content: `${companyName} update:

✅ 100+ customers
✅ 40% growth MoM
✅ $0 spent on ads

building in public hits different 🚀`,
    },
    {
      id: 4,
      title: "Quick Tip",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `quick tip that saved us 10+ hours/week at ${companyName}:

stop doing it manually.

automate it.

your future self will thank you.`,
    },
    {
      id: 5,
      title: "Engagement",
      pillar: "Engagement",
      status: "review" as const,
      content: `if you're a ${targetAudience || "founder"}:

what's the ONE thing holding you back right now?

reply below. i read everything.`,
    },
    {
      id: 6,
      title: "Lesson",
      pillar: "Founder Story",
      status: "ready" as const,
      content: `biggest lesson from building ${companyName}:

ship embarrassing work

iterate fast

perfection is a trap`,
    },
    {
      id: 7,
      title: "Contrarian",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `unpopular opinion:

most "best practices" in ${industry} are outdated

what worked in 2020 doesn't work in 2025

adapt or get left behind`,
    },
    {
      id: 8,
      title: "Value Add",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `the ${industry} playbook for 2025:

1. solve one problem really well
2. let customers do your marketing
3. build community, not just product

that's it. that's the strategy.`,
    },
    {
      id: 9,
      title: "Story",
      pillar: "Founder Story",
      status: "review" as const,
      content: `6 months ago: idea on a napkin

today: ${companyName} is helping 100+ companies

the secret?

we started before we were ready.`,
    },
    {
      id: 10,
      title: "CTA",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `tired of ${mainPain.toLowerCase()}?

we built ${companyName} to fix exactly that.

DM me "INFO" and I'll show you how it works.`,
    },
  ]

  const threads = [
    {
      id: 1,
      title: "Full Journey Thread",
      pillar: "Founder Story",
      status: "ready" as const,
      content: `How we built ${companyName} from idea to 100+ customers:

A thread 🧵

---

1/ The problem was clear:

${mainPain}

Everyone was doing it the hard way. There had to be a better way.

---

2/ We asked: what if we could...

${uniqueValue?.split(".")[0] || "Build something that actually works"}?

That question changed everything.

---

3/ First, we validated:

• Talked to 50+ potential customers
• Found the common thread
• Identified must-have features

No code. Just conversations.

---

4/ Then we built MVP in 30 days:

• Ugly but functional
• Core features only
• Real users testing daily

Shipped embarrassing. Iterated fast.

---

5/ What we learned:

• Speed > perfection
• Feedback > assumptions
• Focus > features

The magic is in the iteration.

---

6/ Results so far:

• 100+ customers
• 40% monthly growth
• Profitable

And we're just getting started.

---

7/ If you're building something:

Ship fast.
Listen hard.
Iterate always.

That's the playbook.

Follow for more ${companyName} updates.

---

8/ Want to try ${companyName}?

Link in bio.

Or DM me your use case - happy to chat.`,
    },
    {
      id: 2,
      title: "Framework Thread",
      pillar: "Industry Insights",
      status: "review" as const,
      content: `The exact framework we use at ${companyName} to ${primaryGoal === "leads" ? "generate leads" : "drive results"}:

(Stolen from 5 years of trial and error)

🧵

---

1/ Step 1: Get crystal clear on the problem

Not "we help businesses grow"

More like "we help ${targetAudience} solve ${mainPain}"

Specific > generic. Always.

---

2/ Step 2: Validate before building

Talk to 20 potential customers.

Ask: "Would you pay for this?"

If <15 say yes enthusiastically, go back to step 1.

---

3/ Step 3: Build the smallest possible version

What's the ONE feature that solves the core problem?

Build that. Nothing else.

Ship in 30 days or less.

---

4/ Step 4: Get 10 design partners

People who will use it, give feedback, and forgive the bugs.

Treat them like gold. They are.

---

5/ Step 5: Iterate weekly

Every Friday: What did we learn? What do we ship next?

Speed of iteration = speed of success.

---

6/ Step 6: Document everything

What worked. What didn't. Why.

Your future self will thank you.

---

7/ This framework took us from idea to ${companyName} in 6 months.

It's not magic.

It's just disciplined execution.

---

8/ Want the full playbook?

Drop a "🔥" and I'll DM you our internal doc.`,
    },
    {
      id: 3,
      title: "Mistakes Thread",
      pillar: "Founder Story",
      status: "ready" as const,
      content: `7 mistakes we made building ${companyName} (so you don't have to):

🧵

---

1/ Mistake #1: Building before validating

We spent 2 months on a feature nobody wanted.

Lesson: Talk to customers first. Always.

---

2/ Mistake #2: Trying to please everyone

We added features for edge cases.

Result? Confusing product, unfocused team.

Lesson: Say no more than yes.

---

3/ Mistake #3: Hiring too fast

We hired for skills, not values.

It cost us 6 months of progress.

Lesson: Culture fit > resume.

---

4/ Mistake #4: Ignoring distribution

We built a great product and expected people to find it.

They didn't.

Lesson: Distribution IS the product.

---

5/ Mistake #5: Perfectionism

We delayed launches waiting for "ready."

"Ready" never came.

Lesson: Ship it ugly. Fix it later.

---

6/ Mistake #6: Comparing to others

We obsessed over competitor features.

Distracted us from our own vision.

Lesson: Run your own race.

---

7/ Mistake #7: Not asking for help

We thought we had to figure it out alone.

Wrong.

Lesson: Find mentors. Ask questions. Be humble.

---

8/ Every mistake taught us something.

${companyName} exists because of these failures, not despite them.

What's the biggest mistake you've made building your company?`,
    },
  ]

  const email = [
    {
      id: 1,
      title: "Welcome Email",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `Subject: Welcome to ${companyName} - Here's what's next

Hey [First Name],

You just made a great decision.

Welcome to ${companyName}.

Here's what happens next:

Over the next few days, I'll send you:
• A quick-start guide (get results in under 5 minutes)
• Our best resources
• Tips from power users

But first, one quick thing:

👉 [PRIMARY CTA BUTTON]

This takes 2 minutes and will 10x your results.

Questions? Just reply to this email.

I read every response personally.

Talk soon,
[Your name]
Founder, ${companyName}

P.S. ${mainPain}? You're in exactly the right place.`,
    },
    {
      id: 2,
      title: "Value Email",
      pillar: "Industry Insights",
      status: "review" as const,
      content: `Subject: The #1 mistake ${targetAudience || "most people"} make

Hey [First Name],

Quick question:

Are you making this mistake?

${mainPain}

Most people try to fix this by:
• Throwing more time at it
• Hiring more people
• Using more tools

But that just makes it worse.

Here's what actually works:

1. Focus on the root cause, not symptoms
2. Automate the repetitive stuff
3. Measure what matters

${companyName} was built to make this easy.

Want to see how?

👉 [CTA BUTTON: See How It Works]

Best,
[Your name]

P.S. Reply with your biggest challenge. I respond to every email.`,
    },
    {
      id: 3,
      title: "Case Study Email",
      pillar: "Community Wins",
      status: "ready" as const,
      content: `Subject: How [Customer] got [specific result]

Hey [First Name],

Quick story:

[Customer Name] came to us 60 days ago.

They were dealing with:
• ${mainPain}
• Wasting 10+ hours weekly
• Frustrated with every "solution" they tried

Sound familiar?

Here's what happened after they started using ${companyName}:

✅ [Specific result #1]
✅ [Specific result #2]
✅ [Specific result #3]

Their exact words:

"I wish we found ${companyName} sooner. It's exactly what we needed."

Want similar results?

👉 [CTA BUTTON: Start Your Free Trial]

Best,
[Your name]

P.S. We have 50+ more stories like this. Reply if you want to hear them.`,
    },
    {
      id: 4,
      title: "Objection Handler",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `Subject: "I don't have time for another tool"

Hey [First Name],

I hear this a lot:

"${companyName} looks great, but I don't have time to learn another tool."

I get it. Tool fatigue is real.

But here's what our customers say:

"I was skeptical too. Then I set it up in 10 minutes and saved 5 hours that week." - [Customer]

${companyName} isn't another tool to manage.

It's a tool that manages things FOR you.

• Setup: Under 10 minutes
• Learning curve: Almost none
• Time saved: 5-10+ hours/week

Still not sure?

Try it free for 14 days. No credit card required.

If it doesn't save you time in week 1, I'll personally help you find a better solution.

👉 [CTA BUTTON: Try It Free]

Best,
[Your name]`,
    },
    {
      id: 5,
      title: "Urgency Email",
      pillar: "Product Journey",
      status: "review" as const,
      content: `Subject: Quick question, [First Name]

Hey [First Name],

I noticed you signed up for ${companyName} but haven't started yet.

No pressure - just curious:

What's holding you back?

A) Not sure how to get started
B) Not sure if it's right for me
C) Just been busy
D) Something else

Reply with A, B, C, or D and I'll personally help.

If it's A - I'll send you our 5-minute quickstart guide.
If it's B - I'll hop on a quick call to see if we're a fit.
If it's C - Totally get it. This email will be here when you're ready.
If it's D - Tell me what's up. I want to help.

${companyName} has helped hundreds of ${targetAudience || "companies"} solve ${mainPain.toLowerCase()}.

I don't want you to miss out.

👉 [CTA BUTTON: Get Started Now]

Best,
[Your name]
Founder, ${companyName}

P.S. Just reply to this email. I read and respond to every one.`,
    },
  ]

  const ads = [
    {
      id: 1,
      title: "Problem-Agitate",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `[HEADLINE]
Still struggling with ${mainPain.toLowerCase()}?

[BODY]
${targetAudience || "Smart teams"} are switching to ${companyName}.

✅ ${uniqueValue?.split(".")[0] || "Finally, a solution that works"}
✅ Setup in under 10 minutes
✅ See results in week 1

Join 100+ companies who've made the switch.

[CTA]
Try Free for 14 Days →`,
    },
    {
      id: 2,
      title: "Social Proof",
      pillar: "Community Wins",
      status: "review" as const,
      content: `[HEADLINE]
"${companyName} changed everything for us."

[BODY]
Join 100+ ${targetAudience || "companies"} who've already made the switch.

Results they're seeing:
• 10+ hours saved weekly
• 40% improvement in [key metric]
• ROI in under 30 days

[CTA]
Start Your Free Trial →`,
    },
    {
      id: 3,
      title: "Curiosity",
      pillar: "Industry Insights",
      status: "ready" as const,
      content: `[HEADLINE]
Why ${targetAudience || "top performers"} are ditching [old solution]

[BODY]
The old way of handling ${mainPain.toLowerCase()} is broken.

${companyName} is the fix.

• Works in minutes, not months
• No technical skills required
• Results guaranteed

[CTA]
See How It Works →`,
    },
    {
      id: 4,
      title: "Direct Response",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `[HEADLINE]
${mainPain}? There's a better way.

[BODY]
${companyName} helps ${targetAudience || "teams like yours"}:

→ Save 10+ hours every week
→ Eliminate manual busywork
→ Focus on what actually matters

No long contracts. No complex setup.
Just results.

[CTA]
Get Started Free →`,
    },
    {
      id: 5,
      title: "Retargeting",
      pillar: "Product Journey",
      status: "ready" as const,
      content: `[HEADLINE]
Still thinking about ${companyName}?

[BODY]
Here's what you're missing:

✅ 100+ happy customers
✅ 4.9/5 average rating
✅ 14-day free trial (no card required)

The only risk is waiting.

${mainPain} won't solve itself.

[CTA]
Try ${companyName} Today →`,
    },
  ]

  return { linkedin, twitter, threads, email, ads }
}

// ============================================
// ONBOARDING WIZARD
// ============================================

function OnboardingWizard({ onComplete }: { onComplete: (data: any, content: any) => void }) {
  const [step, setStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState("Preparing...")
  const [generationMode, setGenerationMode] = useState<"template" | "llm">("llm") // Default to LLM
  const [aiModalStep, setAiModalStep] = useState<1 | 2>(1)
  const [aiPromptCopied, setAiPromptCopied] = useState(false)
  const [aiResponse, setAiResponse] = useState("")
  const [showAIModal, setShowAIModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [isAutoFilling, setIsAutoFilling] = useState(false)
  const [autofillResult, setAutofillResult] = useState<any>(null)

  const [formData, setFormData] = useState(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.FORM_DATA)
    return (
      saved || {
        companyName: "",
        website: "",
        industry: "",
        productDescription: "",
        logo: "",
        targetAudience: "",
        jobTitles: "",
        companySize: "",
        painPoints: "",
        uniqueValue: "",
        keyBenefits: "",
        competitors: "",
        pricingModel: "",
        currentChannels: [] as string[],
        contentFrequency: "",
        teamSize: "",
        primaryGoal: "",
        contentTone: "",
        targetPlatforms: [] as string[],
      }
    )
  })

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.FORM_DATA, formData)
  }, [formData])

  const update = (field: string, value: unknown) => setFormData((prev: FormData) => ({ ...prev, [field]: value }))

  const generateAIPromptText = () => {
    const companyName = formData.companyName || "[Your Company Name]"
    const website = formData.website || "[Your Website]"

    return `I need help filling out a GTM content engine for my company. Answer based on what you know about us:

Company: ${companyName}
Website: ${website}

Provide answers in this EXACT format:

1. PRODUCT DESCRIPTION:
[2-3 sentences about what the product/service does]

2. TARGET AUDIENCE:
[Describe the ideal customer profile]

3. JOB TITLES TO TARGET:
[3-5 job titles, comma-separated]

4. TOP 3 PAIN POINTS:
[Pain point 1]
[Pain point 2]
[Pain point 3]

5. UNIQUE VALUE PROPOSITION:
[What makes this different from competitors]

6. KEY BENEFITS:
[Benefit 1]
[Benefit 2]
[Benefit 3]

7. MAIN COMPETITORS:
[2-4 competitors, comma-separated]

8. INDUSTRY:
[One of: saas, agency, ecommerce, fintech, healthtech, edtech, marketplace, coaching, other]

9. COMPANY SIZE TARGET:
[One of: 1-10, 11-50, 51-200, 201-1000, 1000+]

10. PRIMARY GOAL:
[One of: leads, awareness, authority, sales, community, hiring]

11. CONTENT TONE:
[One of: professional, casual, bold, educational, inspiring]`
  }

  const generateAIPrompt = () => {
    const industry = formData.industry
      ? INDUSTRIES.find((i) => i.value === formData.industry)?.label || formData.industry
      : "[your industry]"
    return `I need help filling out a GTM content engine for my company. Please answer each question based on what you know about us:

Company: ${formData.companyName || "[Company Name]"}
Website: ${formData.website || "[Website URL]"}

Please provide answers in this exact format so I can copy them back:

1. PRODUCT DESCRIPTION (2-3 sentences):
[Describe what the product/service does and who it's for]

2. TARGET AUDIENCE:
[Describe the ideal customer profile - who buys this]

3. JOB TITLES TO TARGET:
[List 3-5 job titles, comma-separated]

4. TOP 3 PAIN POINTS (one per line):
[Pain point 1]
[Pain point 2]
[Pain point 3]

5. UNIQUE VALUE PROPOSITION:
[What makes this different from competitors]

6. KEY BENEFITS (top 3):
[Benefit 1]
[Benefit 2]
[Benefit 3]

7. MAIN COMPETITORS:
[List 2-4 competitors, comma-separated]

Based on your knowledge of ${formData.companyName || "[Company Name]"} and the ${industry} space, fill this out accurately.`
  }

  const copyAIPrompt = () => {
    navigator.clipboard.writeText(generateAIPromptText())
    setAiPromptCopied(true)
    setTimeout(() => setAiPromptCopied(false), 2000)
  }

  const handleAIAutofill = () => {
    const parsed = parseAIResponse(aiResponse)

    // Update formData with all parsed values
    setFormData((prev: FormData) => ({
      ...prev,
      productDescription: parsed.productDescription || prev.productDescription,
      targetAudience: parsed.targetAudience || prev.targetAudience,
      jobTitles: parsed.jobTitles || prev.jobTitles,
      painPoints: parsed.painPoints || prev.painPoints,
      uniqueValue: parsed.uniqueValue || prev.uniqueValue,
      keyBenefits: parsed.keyBenefits || prev.keyBenefits,
      competitors: parsed.competitors || prev.competitors,
      industry: parsed.industry || prev.industry,
      companySize: parsed.companySize || prev.companySize,
      primaryGoal: parsed.primaryGoal || prev.primaryGoal,
      contentTone: parsed.contentTone || prev.contentTone,
      targetPlatforms: ["linkedin", "twitter", "email"], // Set default platforms
    }))

    // Close modal and jump to Step 5
    setShowAIModal(false)
    setAiModalStep(1)
    setAiResponse("")
    setStep(5)

    // Show success feedback
    setTimeout(() => {
      toast({ title: "Success", description: "Autofilled from AI response" })
    }, 100)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: "Copied", description: "Prompt copied to clipboard" })
  }

  // Direct AI autofill using Claude API
  const handleDirectAutofill = async () => {
    if (!formData.companyName) {
      toast({ title: "Required", description: "Please enter a company name first", variant: "destructive" })
      return
    }

    setIsAutoFilling(true)
    setAutofillResult(null)

    try {
      const response = await fetch("/api/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: formData.companyName,
          website: formData.website || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.code === "NO_API_KEY") {
          toast({ title: "Not Available", description: "AI autofill is not available. The ANTHROPIC_API_KEY is not configured.", variant: "destructive" })
        } else {
          toast({ title: "Failed", description: `Autofill failed: ${result.error || "Unknown error"}`, variant: "destructive" })
        }
        setIsAutoFilling(false)
        return
      }

      if (result.success) {
        setAutofillResult(result)
      } else {
        toast({ title: "Not Found", description: "Could not find information for this company. Try adding a website URL.", variant: "destructive" })
      }
    } catch (error) {
      console.error("Autofill error:", error)
      toast({ title: "Error", description: "Failed to research company. Please check your internet connection.", variant: "destructive" })
    } finally {
      setIsAutoFilling(false)
    }
  }

  // Apply autofill result to form data
  const applyAutofillResult = () => {
    if (!autofillResult?.data) return

    const data = autofillResult.data

    setFormData((prev: typeof formData) => ({
      ...prev,
      productDescription: data.productDescription || prev.productDescription,
      targetAudience: data.targetAudience || prev.targetAudience,
      jobTitles: data.jobTitles || prev.jobTitles,
      painPoints: data.painPoints || prev.painPoints,
      uniqueValue: data.uniqueValue || prev.uniqueValue,
      keyBenefits: data.keyBenefits || prev.keyBenefits,
      competitors: data.competitors || prev.competitors,
      industry: data.industry || prev.industry,
      companySize: data.companySize || prev.companySize,
      primaryGoal: data.primaryGoal || prev.primaryGoal,
      contentTone: data.contentTone || prev.contentTone,
      targetPlatforms: prev.targetPlatforms.length > 0 ? prev.targetPlatforms : ["linkedin", "twitter", "email"],
    }))

    // Close modal and jump to Step 5
    setShowAIModal(false)
    setAutofillResult(null)
    setStep(5)

    // Show success feedback
    setTimeout(() => {
      toast({ title: "Success", description: `Autofilled ${autofillResult.completeness?.filledFields?.length || 0} fields from AI research` })
    }, 100)
  }

  const handleComplete = async () => {
    setIsGenerating(true)
    setProgress(0)
    setProgressMessage("Preparing your content engine...")
    setGenerationError(null)

    if (generationMode === "llm") {
      // LLM-powered generation
      try {
        // First, fetch competitor insights if competitors are provided
        let competitorInsights = ""
        if (formData.competitors) {
          setProgressMessage("Analyzing your competitors...")
          setProgress(10)

          try {
            const competitors = parseCompetitors(formData)
            const competitorResponse = await fetch("/api/competitors", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                companyName: formData.companyName,
                industry: formData.industry,
                competitors: competitors.map(c => c.name),
                website: formData.website,
              }),
            })

            if (competitorResponse.ok) {
              const { insights } = await competitorResponse.json()
              saveCompetitorInsights(insights)
              competitorInsights = formatInsightsForPrompt(insights)
            }
          } catch (e) {
            console.log("Competitor analysis skipped:", e)
          }
        }

        setProgress(25)
        setProgressMessage("AI is generating personalized content...")

        // Generate content with streaming LLM for better UX
        const result = await generateContentWithStreaming(
          formData,
          competitorInsights,
          (progressUpdate: GenerationProgress) => {
            setProgressMessage(progressUpdate.message)
            setProgress(25 + (progressUpdate.progress * 0.7))
          }
        )

        if (result.success && result.content) {
          setProgress(100)
          setProgressMessage("Content generated successfully!")
          setTimeout(() => onComplete(formData, result.content), 500)
        } else {
          // Fallback to template generation
          console.log("LLM generation failed, falling back to templates:", result.error)
          setProgressMessage("Falling back to template generation...")
          setProgress(80)

          await new Promise((r) => setTimeout(r, 1000))
          const content = generateContent(formData)

          setProgress(100)
          setProgressMessage("Content ready!")
          setTimeout(() => onComplete(formData, content), 500)
        }
      } catch (error) {
        console.error("Generation error:", error)
        // Fallback to template generation
        setProgressMessage("Using template generation...")
        const content = generateContent(formData)
        setProgress(100)
        setTimeout(() => onComplete(formData, content), 500)
      }
    } else {
      // Template-based generation (original)
      const interval = setInterval(() => {
        setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 15))
      }, 400)

      setProgressMessage("Generating content templates...")
      await new Promise((r) => setTimeout(r, 2000))

      const content = generateContent(formData)

      clearInterval(interval)
      setProgress(100)
      setProgressMessage("Content ready!")
      setTimeout(() => onComplete(formData, content), 500)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.companyName && formData.productDescription && formData.industry // Added industry as required
      case 2:
        return formData.targetAudience && formData.painPoints
      case 3:
        return formData.uniqueValue
      case 4:
        return true
      case 5:
        return formData.primaryGoal && formData.targetPlatforms.length > 0
      default:
        return true
    }
  }

  const steps = [
    { num: 1, title: "Company", icon: Building2 },
    { num: 2, title: "Audience", icon: Users },
    { num: 3, title: "Positioning", icon: Target },
    { num: 4, title: "Current State", icon: BarChart3 },
    { num: 5, title: "Goals", icon: Trophy },
  ]

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        update("logo", reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Sparkles size={28} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {generationMode === "llm" ? "AI is Creating Your Content" : "Generating Your Content Engine"}
          </h2>
          <p className="text-gray-500 mb-6">{progressMessage}</p>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
            <div
              className="bg-gray-900 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {generationMode === "llm" ? (
            <div className="space-y-2 text-sm text-gray-500">
              {progress > 5 && <p className="flex items-center justify-center gap-2"><Check size={14} className="text-green-600" /> Analyzing company profile</p>}
              {progress > 15 && formData.competitors && <p className="flex items-center justify-center gap-2"><Check size={14} className="text-green-600" /> Researching competitors</p>}
              {progress > 30 && <p className="flex items-center justify-center gap-2"><Check size={14} className="text-green-600" /> Crafting personalized messaging</p>}
              {progress > 50 && <p className="flex items-center justify-center gap-2"><Check size={14} className="text-green-600" /> Generating platform-specific content</p>}
              {progress > 75 && <p className="flex items-center justify-center gap-2"><Check size={14} className="text-green-600" /> Validating content quality</p>}
              {progress > 95 && <p className="flex items-center justify-center gap-2"><Check size={14} className="text-green-600" /> Finalizing your content library</p>}
            </div>
          ) : (
            <div className="space-y-2 text-sm text-gray-500">
              {progress > 10 && <p>✓ Analyzing your ICP and pain points...</p>}
              {progress > 30 && <p>✓ Crafting positioning and messaging...</p>}
              {progress > 50 && <p>✓ Generating LinkedIn content...</p>}
              {progress > 70 && <p>✓ Creating Twitter threads...</p>}
              {progress > 90 && <p>✓ Finalizing your content library...</p>}
            </div>
          )}
          {generationError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {generationError}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header with logo and step indicator */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Top row: Logo/title */}
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center gap-3">
              {formData.logo ? (
                <img
                  src={formData.logo || "/placeholder.svg"}
                  alt={formData.companyName}
                  className="w-10 h-10 rounded-lg object-contain"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {formData.companyName || "GTM Content Engine"}
                </h1>
                <p className="text-xs text-gray-500">Complete setup to generate your content</p>
              </div>
            </div>
          </div>

          {/* Step indicator - horizontal */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-1 md:gap-2">
              {steps.map((s, idx) => (
                <div key={s.num} className="flex items-center">
                  <button
                    onClick={() => {
                      // Only allow going back to completed steps
                      if (s.num < step) setStep(s.num)
                    }}
                    disabled={s.num > step}
                    className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium transition ${
                      step === s.num
                        ? "bg-gray-900 text-white"
                        : s.num < step
                          ? "bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer"
                          : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <s.icon size={14} className="hidden sm:block" />
                    <span className="hidden sm:inline">{s.title}</span>
                    <span className="sm:hidden">{s.num}</span>
                  </button>
                  {idx < steps.length - 1 && (
                    <ChevronRight size={14} className="text-gray-300 mx-0.5 md:mx-1" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - centered */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-4 md:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                {/* Adjust heading size for mobile */}
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Tell us about your company</h2>
                {/* Adjust text size for mobile */}
                <p className="text-sm md:text-base text-gray-600">We'll use this to craft your messaging.</p>
              </div>

              {/* AI fill button moved up and styled */}
              <div className="flex items-center gap-3 p-3 md:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Sparkles size={20} className="text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm text-blue-900">Want to save time? Use AI to auto-fill this form</p>
                </div>
                <button
                  onClick={() => setShowAIModal(true)}
                  className="flex-shrink-0 px-3 md:px-4 py-1.5 md:py-2 bg-blue-600 text-white text-xs md:text-sm font-medium rounded-lg hover:bg-blue-700"
                >
                  AI Fill
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
                {/* Improved logo upload area styling */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 md:p-8 text-center cursor-pointer hover:border-gray-400 transition ${formData.logo ? "border-green-300 bg-green-50" : "border-gray-300"}`}
                  onClick={() => document.getElementById("logo-upload")?.click()}
                >
                  {formData.logo ? (
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={formData.logo || "/placeholder.svg"}
                        alt="Company Logo"
                        className="w-20 h-20 md:w-24 md:h-24 object-contain"
                      />
                      <p className="text-xs md:text-sm text-green-700 font-medium">Logo uploaded</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                        <Upload size={20} className="text-gray-400" />
                      </div>
                      <p className="text-sm md:text-base font-medium text-gray-700 mb-1">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs md:text-sm text-gray-500">Square format recommended (PNG, JPG)</p>
                    </>
                  )}
                  <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Company Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => update("companyName", e.target.value)}
                  placeholder="Acme Inc."
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => update("website", e.target.value)}
                  placeholder="https://acme.com"
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Industry <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.industry}
                  onChange={(e) => update("industry", e.target.value)}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                >
                  <option value="">Select</option>
                  {INDUSTRIES.map((ind) => (
                    <option key={ind.value} value={ind.value}>
                      {ind.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What does your product/service do? <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.productDescription}
                  onChange={(e) => update("productDescription", e.target.value)}
                  placeholder="We help companies automate their customer support with AI-powered chatbots..."
                  rows={4}
                  className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-base"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Who's your ideal customer?</h2>
                <p className="text-sm md:text-base text-gray-600">This shapes all your content messaging.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience Description *</label>
                  <textarea
                    value={formData.targetAudience}
                    onChange={(e) => update("targetAudience", e.target.value)}
                    placeholder="E.g., B2B SaaS founders at seed-stage startups..."
                    rows={3}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Job Titles You Target</label>
                  <input
                    type="text"
                    value={formData.jobTitles}
                    onChange={(e) => update("jobTitles", e.target.value)}
                    placeholder="CEO, VP Marketing, Head of Growth..."
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Company Size</label>
                  <select
                    value={formData.companySize}
                    onChange={(e) => update("companySize", e.target.value)}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  >
                    <option value="">Select</option>
                    <option value="1-10">1-10 (Startup)</option>
                    <option value="11-50">11-50 (Small)</option>
                    <option value="51-200">51-200 (Mid-market)</option>
                    <option value="201-1000">201-1000 (Enterprise)</option>
                    <option value="1000+">1000+ (Large)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Top 3 Pain Points <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.painPoints}
                    onChange={(e) => update("painPoints", e.target.value)}
                    placeholder="1. High customer support costs..."
                    rows={4}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-base"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What makes you different?</h2>
                <p className="text-sm md:text-base text-gray-600">
                  Your unique positioning drives content differentiation.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Unique Value Proposition <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.uniqueValue}
                    onChange={(e) => update("uniqueValue", e.target.value)}
                    placeholder="We automate customer support with AI, reducing response times by 80% and saving 50% on costs."
                    rows={4}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Key Benefits (Top 3)</label>
                  <textarea
                    value={formData.keyBenefits}
                    onChange={(e) => update("keyBenefits", e.target.value)}
                    placeholder="1. Reduce costs by 50%&#10;2. Improve customer satisfaction by 30%&#10;3. Automate 80% of inquiries"
                    rows={4}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Main Competitors</label>
                  <input
                    type="text"
                    value={formData.competitors}
                    onChange={(e) => update("competitors", e.target.value)}
                    placeholder="Intercom, Zendesk, Drift..."
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pricing Model</label>
                  <select
                    value={formData.pricingModel}
                    onChange={(e) => update("pricingModel", e.target.value)}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  >
                    <option value="">Select</option>
                    <option value="freemium">Freemium</option>
                    <option value="subscription">Subscription</option>
                    <option value="usage">Usage-based</option>
                    <option value="one-time">One-time</option>
                    <option value="custom">Custom/Enterprise</option>
                    <option value="service">Service/Retainer</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Where are you now?</h2>
                <p className="text-sm md:text-base text-gray-600">Your current state helps us prioritize.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Marketing Channels</label>
                  {/* Responsive grid for checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {["LinkedIn", "Twitter/X", "Email", "SEO/Blog", "Paid Ads", "Podcast", "YouTube", "Events"].map(
                      (ch) => (
                        <label
                          key={ch}
                          className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition"
                        >
                          <input
                            type="checkbox"
                            checked={formData.currentChannels.includes(ch)}
                            onChange={(e) =>
                              update(
                                "currentChannels",
                                e.target.checked
                                  ? [...formData.currentChannels, ch]
                                  : formData.currentChannels.filter((c: string) => c !== ch),
                              )
                            }
                            className="h-4 w-4 text-gray-900 rounded focus:ring-gray-900"
                          />
                          <span className="text-sm text-gray-700">{ch}</span>
                        </label>
                      ),
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content Frequency</label>
                  <select
                    value={formData.contentFrequency}
                    onChange={(e) => update("contentFrequency", e.target.value)}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  >
                    <option value="">Select frequency</option>
                    <option value="never">Not posting yet</option>
                    <option value="sporadic">Sporadically</option>
                    <option value="weekly">1-2x per week</option>
                    <option value="several">3-5x per week</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Team Size</label>
                  <select
                    value={formData.teamSize}
                    onChange={(e) => update("teamSize", e.target.value)}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  >
                    <option value="">Select team size</option>
                    <option value="solo">Just me</option>
                    <option value="1-2">1-2 people</option>
                    <option value="3-5">3-5 people</option>
                    <option value="6+">6+ people</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">What are your goals?</h2>
                <p className="text-sm md:text-base text-gray-600">We'll tailor content to hit these targets.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Primary Goal <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.primaryGoal}
                    onChange={(e) => update("primaryGoal", e.target.value)}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  >
                    <option value="">Select primary goal</option>
                    <option value="leads">Generate leads</option>
                    <option value="awareness">Build awareness</option>
                    <option value="authority">Establish authority</option>
                    <option value="sales">Drive sales</option>
                    <option value="community">Build community</option>
                    <option value="hiring">Attract talent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Content Tone</label>
                  <select
                    value={formData.contentTone}
                    onChange={(e) => update("contentTone", e.target.value)}
                    className="w-full px-4 py-2.5 md:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-base"
                  >
                    <option value="">Select tone</option>
                    <option value="professional">Professional</option>
                    <option value="casual">Casual</option>
                    <option value="bold">Bold & contrarian</option>
                    <option value="educational">Educational</option>
                    <option value="inspiring">Inspiring</option>
                  </select>
                </div>
                {/* Generation Mode Toggle */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Content Generation Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGenerationMode("llm")}
                      className={`p-4 rounded-lg border-2 text-left transition ${
                        generationMode === "llm"
                          ? "border-blue-600 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles size={18} className={generationMode === "llm" ? "text-blue-600" : "text-gray-400"} />
                        <span className={`font-semibold ${generationMode === "llm" ? "text-blue-900" : "text-gray-700"}`}>
                          AI-Powered
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Recommended</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Claude generates unique, personalized content based on your company profile
                        {formData.competitors && " and competitor analysis"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationMode("template")}
                      className={`p-4 rounded-lg border-2 text-left transition ${
                        generationMode === "template"
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={18} className={generationMode === "template" ? "text-gray-900" : "text-gray-400"} />
                        <span className={`font-semibold ${generationMode === "template" ? "text-gray-900" : "text-gray-700"}`}>
                          Templates
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Fast</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        Pre-built templates with your company info filled in. Instant results.
                      </p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Target Platforms <span className="text-red-500">*</span>
                  </label>
                  {/* Responsive grid for platform checkboxes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {PLATFORMS.map((p) => (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                          formData.targetPlatforms.includes(p.id)
                            ? "border-gray-900 bg-gray-50"
                            : "border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.targetPlatforms.includes(p.id)}
                          onChange={(e) =>
                            update(
                              "targetPlatforms",
                              e.target.checked
                                ? [...formData.targetPlatforms, p.id]
                                : formData.targetPlatforms.filter((x: string) => x !== p.id),
                            )
                          }
                          className="h-4 w-4 text-gray-900 rounded focus:ring-gray-900"
                        />
                        <div className={`w-6 h-6 ${p.color} rounded flex items-center justify-center`}>
                          <p.icon size={14} className="text-white" />
                        </div>
                        <span className="text-sm text-gray-700 font-medium">{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft size={16} /> Back
              </button>
            )}
            <div className="flex-1" /> {/* Push button to the right */}
            {step < 5 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                Continue <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!canProceed()}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              >
                <Sparkles size={16} /> Generate
              </button>
            )}
          </div>
        </div>
      </div>

      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {aiModalStep === 1 ? "AI Company Research" : aiModalStep === 2 ? "Manual Paste (Backup)" : "Review & Apply"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {aiModalStep === 1
                    ? "Let AI research your company and fill the form"
                    : aiModalStep === 2
                      ? "Paste response from Claude/ChatGPT"
                      : "Review the parsed information"}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowAIModal(false)
                  setAiModalStep(1)
                  setAiResponse("")
                  setIsAutoFilling(false)
                  setAutofillResult(null)
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              {aiModalStep === 1 ? (
                <div className="space-y-6">
                  {/* One-click AI Research */}
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Sparkles size={24} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">One-Click AI Research</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          AI will research {formData.companyName || "your company"} and automatically fill in the form fields.
                          {formData.website && ` Using website: ${formData.website}`}
                        </p>
                        <button
                          onClick={handleDirectAutofill}
                          disabled={isAutoFilling || !formData.companyName}
                          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAutoFilling ? (
                            <>
                              <RefreshCw size={18} className="animate-spin" />
                              Researching {formData.companyName}...
                            </>
                          ) : (
                            <>
                              <Sparkles size={18} />
                              Research & Autofill
                            </>
                          )}
                        </button>
                        {!formData.companyName && (
                          <p className="text-xs text-red-600 mt-2">Enter a company name first</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Manual paste option */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white text-gray-500">or use manual paste</span>
                    </div>
                  </div>

                  <button
                    onClick={() => setAiModalStep(2)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    <Copy size={18} />
                    Copy prompt & paste response manually
                  </button>
                </div>
              ) : aiModalStep === 2 ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">Copy this prompt to Claude/ChatGPT:</p>
                    <div className="relative">
                      <textarea
                        readOnly
                        value={generateAIPromptText()}
                        className="w-full h-40 px-4 py-3 border border-gray-200 rounded-lg text-xs font-mono bg-gray-50 resize-none focus:outline-none"
                      />
                      <button
                        onClick={copyAIPrompt}
                        className="absolute top-2 right-2 px-3 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800"
                      >
                        {aiPromptCopied ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Then paste the response here:</p>
                    <textarea
                      value={aiResponse}
                      onChange={(e) => setAiResponse(e.target.value)}
                      placeholder="Paste the full AI response here..."
                      className="w-full h-48 px-4 py-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => setAiModalStep(1)}
                      className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={handleAIAutofill}
                      disabled={!aiResponse.trim()}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles size={16} /> Parse & Apply
                    </button>
                  </div>
                </>
              ) : (
                /* Step 3: Review parsed results */
                <div className="space-y-4">
                  {autofillResult && (
                    <>
                      <div className={`p-4 rounded-lg ${
                        autofillResult.dataQuality === "excellent" ? "bg-green-50 border border-green-200" :
                        autofillResult.dataQuality === "good" ? "bg-blue-50 border border-blue-200" :
                        autofillResult.dataQuality === "partial" ? "bg-yellow-50 border border-yellow-200" :
                        "bg-orange-50 border border-orange-200"
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">Data Quality: {autofillResult.dataQuality}</span>
                          <span className="text-sm text-gray-600">{autofillResult.completeness?.percentage || 0}% complete</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              autofillResult.dataQuality === "excellent" ? "bg-green-600" :
                              autofillResult.dataQuality === "good" ? "bg-blue-600" :
                              autofillResult.dataQuality === "partial" ? "bg-yellow-600" :
                              "bg-orange-600"
                            }`}
                            style={{ width: `${autofillResult.completeness?.percentage || 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {Object.entries(autofillResult.data || {}).map(([key, value]: [string, unknown]) => (
                          value ? (
                            <div key={key} className="flex items-start gap-2 p-2 bg-gray-50 rounded-lg">
                              <Check size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <span className="text-xs font-medium text-gray-500 uppercase">{key.replace(/([A-Z])/g, " $1")}</span>
                                <p className="text-sm text-gray-900 truncate">{String(value).slice(0, 100)}{String(value).length > 100 ? "..." : ""}</p>
                              </div>
                            </div>
                          ) : null
                        ))}
                      </div>

                      {autofillResult.completeness?.missingFields?.length > 0 && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            <strong>Missing fields:</strong> {autofillResult.completeness.missingFields.join(", ")}
                          </p>
                          <p className="text-xs text-yellow-700 mt-1">You can fill these in manually after applying.</p>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => {
                        setAiModalStep(1)
                        setAutofillResult(null)
                      }}
                      className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1"
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      onClick={applyAutofillResult}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <Check size={16} /> Apply to Form
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// DASHBOARD
// ============================================

function Dashboard({ companyData, onReset }: { companyData: any; onReset: () => void }) {
  const [section, setSection] = useState("library")
  const [platform, setPlatform] = useState("linkedin")
  const [pillar, setPillar] = useState("all")
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [postStatuses, setPostStatuses] = useState<Record<string, "ready" | "review">>({})
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set())
  const [critiquingPost, setCritiquingPost] = useState<string | null>(null)
  const [critiqueResult, setCritiqueResult] = useState<any | null>(null)
  const [variantsPost, setVariantsPost] = useState<string | null>(null)
  const [variantsResult, setVariantsResult] = useState<any | null>(null)
  const [hashtagsPost, setHashtagsPost] = useState<string | null>(null)
  const [hashtagsResult, setHashtagsResult] = useState<any | null>(null)
  const [scoringPost, setScoringPost] = useState<string | null>(null)
  const [scoringResult, setScoringResult] = useState<any | null>(null)
  const [previewPost, setPreviewPost] = useState<{ platform: string; content: string; title: string } | null>(null)
  const [regeneratePost, setRegeneratePost] = useState<{ platform: string; postId: number; content: string; title: string } | null>(null)
  const [regenerateFeedback, setRegenerateFeedback] = useState("")
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [copyDropdown, setCopyDropdown] = useState<string | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState("dashboard") // Added view state
  const [showBanner, setShowBanner] = useState(true) // Added showBanner state to Dashboard component where it's actually used
  const [showSettings, setShowSettings] = useState(false) // Declared showSettings
  const [showUserMenu, setShowUserMenu] = useState(false) // Declared showUserMenu

  // Initialize state for mobile sidebar
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [activeView, setActiveView] = useState("content")
  const [selectedPlatform, setSelectedPlatform] = useState("all")
  const [selectedPillar, setSelectedPillar] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set())
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [editedContent, setEditedContent] = useState("")

  const [generatedContent, setGeneratedContent] = useState<any>(() => {
    const saved = loadFromLocalStorage(STORAGE_KEYS.GENERATED_CONTENT)
    return saved || {}
  })

  useEffect(() => {
    saveToLocalStorage(STORAGE_KEYS.GENERATED_CONTENT, generatedContent)
  }, [generatedContent])

  useEffect(() => {
    if (generatedContent) {
      const statuses: Record<string, "ready" | "review"> = {}
      Object.entries(generatedContent).forEach(([platform, posts]: [string, any]) => {
        posts.forEach((post: any) => {
          statuses[`${platform}-${post.id}`] = post.status || "ready"
        })
      })
      setPostStatuses(statuses)
    }
  }, [generatedContent])

  const handleRegeneratePost = (platform: string, postId: number) => {
    // Find the post to get its content
    const posts = generatedContent[platform] || []
    const post = posts.find((p: any) => p.id === postId)
    if (post) {
      setRegeneratePost({ platform, postId, content: post.content, title: post.title })
      setRegenerateFeedback("")
    }
  }

  const executeRegenerate = async () => {
    if (!regeneratePost) return

    setIsRegenerating(true)
    const { platform, postId, content, title } = regeneratePost

    try {
      const response = await fetch("/api/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platform,
          feedback: regenerateFeedback || undefined,
          formData: companyData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to regenerate", variant: "destructive" })
        return
      }

      if (result.success && result.newContent) {
        // Update the post content
        const updatedContent = { ...generatedContent }
        const postIndex = updatedContent[platform].findIndex((p: any) => p.id === postId)
        if (postIndex !== -1) {
          updatedContent[platform][postIndex].content = result.newContent
          setGeneratedContent(updatedContent)
          toast({ title: "Regenerated", description: "Post content updated successfully" })
        }
      }
    } catch (error) {
      console.error("Regeneration error:", error)
      toast({ title: "Error", description: "Failed to regenerate post", variant: "destructive" })
    } finally {
      setIsRegenerating(false)
      setRegeneratePost(null)
      setRegenerateFeedback("")
    }
  }

  const handleEditPost = (platform: string, postId: number, content: string) => {
    setEditingPost(`${platform}-${postId}`)
    setEditContent(content)
  }

  const handleSaveEdit = (platform: string, postId: number) => {
    // Update the content in generatedContent
    if (generatedContent) {
      const updatedContent = { ...generatedContent }
      const postIndex = updatedContent[platform].findIndex((p: any) => p.id === postId)
      if (postIndex !== -1) {
        updatedContent[platform][postIndex].content = editContent
        setGeneratedContent(updatedContent) // Update state
        toast({ title: "Saved", description: "Post content updated successfully" })
      }
    }
    setEditingPost(null)
    setEditContent("")
  }

  const handleCancelEdit = () => {
    setEditingPost(null)
    setEditContent("")
  }

  // Bulk selection handlers
  const togglePostSelection = (postKey: string) => {
    setSelectedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postKey)) {
        newSet.delete(postKey)
      } else {
        newSet.add(postKey)
      }
      return newSet
    })
  }

  const selectAllPosts = () => {
    if (!generatedContent) return
    const allKeys = new Set<string>()
    const platforms = ["linkedin", "twitter", "threads", "email", "ads"]
    platforms.forEach(platform => {
      const posts = generatedContent[platform] || []
      posts.forEach((post: any) => {
        allKeys.add(`${platform}-${post.id}`)
      })
    })
    setSelectedPosts(allKeys)
    toast({ title: "Selected", description: `Selected ${allKeys.size} posts` })
  }

  const clearSelection = () => {
    setSelectedPosts(new Set())
  }

  const deleteSelectedPosts = () => {
    if (!generatedContent || selectedPosts.size === 0) return

    const updatedContent = { ...generatedContent }
    const platforms = ["linkedin", "twitter", "threads", "email", "ads"]

    platforms.forEach(platform => {
      if (updatedContent[platform]) {
        updatedContent[platform] = updatedContent[platform].filter((post: any) =>
          !selectedPosts.has(`${platform}-${post.id}`)
        )
      }
    })

    setGeneratedContent(updatedContent)
    toast({ title: "Deleted", description: `Deleted ${selectedPosts.size} posts` })
    setSelectedPosts(new Set())
  }

  const exportSelectedPosts = () => {
    if (!generatedContent || selectedPosts.size === 0) return

    const exportData: any[] = []
    const platforms = ["linkedin", "twitter", "threads", "email", "ads"]

    platforms.forEach(platform => {
      const posts = generatedContent[platform] || []
      posts.forEach((post: any) => {
        if (selectedPosts.has(`${platform}-${post.id}`)) {
          exportData.push({
            platform,
            id: post.id,
            title: post.title,
            pillar: post.pillar,
            content: post.content,
          })
        }
      })
    })

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `selected-posts-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)

    toast({ title: "Exported", description: `Exported ${exportData.length} posts` })
  }

  // Critique a post using AI
  const handleCritiquePost = async (platform: string, postId: number, content: string) => {
    const key = `${platform}-${postId}`
    setCritiquingPost(key)
    setCritiqueResult(null)

    try {
      const response = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platform,
          formData: companyData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to critique post", variant: "destructive" })
        setCritiquingPost(null)
        return
      }

      if (result.success) {
        setCritiqueResult(result.critique)
        toast({ title: "Critique Ready", description: `Overall score: ${result.critique.overallScore}/10` })
      }
    } catch (error) {
      console.error("Critique error:", error)
      toast({ title: "Error", description: "Failed to critique post. Please try again.", variant: "destructive" })
    }
  }

  const closeCritique = () => {
    setCritiquingPost(null)
    setCritiqueResult(null)
  }

  // Generate A/B variants for a post
  const handleGetVariants = async (platform: string, postId: number, content: string) => {
    const key = `${platform}-${postId}`
    setVariantsPost(key)
    setVariantsResult(null)

    try {
      const response = await fetch("/api/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platform,
          formData: companyData,
          numVariants: 3,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to generate variants", variant: "destructive" })
        setVariantsPost(null)
        return
      }

      if (result.success) {
        setVariantsResult(result.variants)
        toast({ title: "Variants Ready", description: `Generated ${result.variants.length} headline variants` })
      }
    } catch (error) {
      console.error("Variants error:", error)
      toast({ title: "Error", description: "Failed to generate variants", variant: "destructive" })
      setVariantsPost(null)
    }
  }

  const closeVariants = () => {
    setVariantsPost(null)
    setVariantsResult(null)
  }

  // Get hashtag suggestions for a post
  const handleGetHashtags = async (platform: string, postId: number, content: string) => {
    const key = `${platform}-${postId}`
    setHashtagsPost(key)
    setHashtagsResult(null)

    try {
      const response = await fetch("/api/hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platform,
          formData: companyData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to get hashtags", variant: "destructive" })
        setHashtagsPost(null)
        return
      }

      if (result.success) {
        setHashtagsResult(result)
        toast({ title: "Hashtags Ready", description: `Found ${result.hashtags.length} hashtag suggestions` })
      }
    } catch (error) {
      console.error("Hashtags error:", error)
      toast({ title: "Error", description: "Failed to get hashtags", variant: "destructive" })
      setHashtagsPost(null)
    }
  }

  const closeHashtags = () => {
    setHashtagsPost(null)
    setHashtagsResult(null)
  }

  // Get content score for a post
  const handleGetScore = async (platform: string, postId: number, content: string) => {
    const key = `${platform}-${postId}`
    setScoringPost(key)
    setScoringResult(null)

    try {
      const response = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          platform,
          formData: companyData,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        toast({ title: "Error", description: result.error || "Failed to score content", variant: "destructive" })
        setScoringPost(null)
        return
      }

      if (result.success) {
        setScoringResult(result.score)
        toast({ title: "Score Ready", description: `Overall score: ${result.score.overallScore}/10` })
      }
    } catch (error) {
      console.error("Scoring error:", error)
      toast({ title: "Error", description: "Failed to score content", variant: "destructive" })
      setScoringPost(null)
    }
  }

  const closeScore = () => {
    setScoringPost(null)
    setScoringResult(null)
  }

  const togglePostStatus = (platform: string, postId: number) => {
    const key = `${platform}-${postId}`
    setPostStatuses((prev) => ({
      ...prev,
      [key]: prev[key] === "ready" ? "review" : "ready",
    }))
  }

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Copy with format options
  const copyWithFormat = (text: string, format: "plain" | "markdown" | "html", id: string) => {
    let formattedText = text

    if (format === "markdown") {
      // Convert to markdown - preserve line breaks and add formatting
      formattedText = text
        .split("\n")
        .map(line => {
          // Convert lines starting with hashtags to headers
          if (line.match(/^#+\s/)) return line
          // Bold lines that are short (likely titles or emphasis)
          if (line.length < 50 && line.length > 0 && !line.startsWith("-")) {
            return `**${line}**`
          }
          return line
        })
        .join("\n\n")
    } else if (format === "html") {
      // Convert to HTML
      formattedText = text
        .split("\n\n")
        .map(para => `<p>${para.replace(/\n/g, "<br>")}</p>`)
        .join("\n")
    }

    navigator.clipboard.writeText(formattedText)
    setCopied(id)
    setCopyDropdown(null)
    toast({
      title: "Copied",
      description: `Content copied as ${format === "plain" ? "plain text" : format === "markdown" ? "Markdown" : "HTML"}`
    })
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleDailyTask = (id: number) => {
    const savedTasks = loadFromLocalStorage(STORAGE_KEYS.DAILY_TASKS) || {}
    const updatedTasks = { ...savedTasks, [id]: !savedTasks[id] }
    saveToLocalStorage(STORAGE_KEYS.DAILY_TASKS, updatedTasks)
    // Use a state variable to manage checked tasks. Declare 'checked' state.
    setChecked(updatedTasks)
  }

  // Declare 'checked' state variable
  const [checked, setChecked] = useState<Record<number, boolean>>(() => {
    return loadFromLocalStorage(STORAGE_KEYS.DAILY_TASKS) || {}
  })

  // Competitor insights state
  const [competitorInsights, setCompetitorInsights] = useState<CompetitorInsights | null>(() => {
    return loadCompetitorInsights()
  })
  const [isLoadingInsights, setIsLoadingInsights] = useState(false)

  const refreshCompetitorInsights = async () => {
    if (!companyData?.competitors) return

    setIsLoadingInsights(true)
    try {
      const competitors = parseCompetitors(companyData)
      const response = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyData.companyName,
          industry: companyData.industry,
          competitors: competitors.map((c: any) => c.name),
          website: companyData.website,
        }),
      })

      if (response.ok) {
        const { insights } = await response.json()
        saveCompetitorInsights(insights)
        setCompetitorInsights(insights)
      }
    } catch (error) {
      console.error("Failed to refresh competitor insights:", error)
    } finally {
      setIsLoadingInsights(false)
    }
  }

  const filtered = () => {
    let posts = generatedContent[platform] || []
    if (pillar !== "all") posts = posts.filter((p: any) => p.pillar.toLowerCase().includes(pillar.toLowerCase()))
    if (search)
      posts = posts.filter(
        (p: any) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.content.toLowerCase().includes(search.toLowerCase()),
      )
    return posts
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      importData(file, () => {
        window.location.reload()
      })
    }
  }

  const clearAllData = () => {
    if (window.confirm("Are you sure? This will delete all your data and cannot be undone.")) {
      localStorage.clear()
      window.location.reload()
    }
  }

  const tasks = [
    {
      id: 1,
      cat: "Content",
      text: `Post 1 piece on ${companyData.targetPlatforms?.[0] || "LinkedIn"}`,
      time: "9:00 AM",
      pri: "high",
    },
    { id: 2, cat: "Engagement", text: "Comment on 10 posts from ICP", time: "9:30 AM", pri: "high" },
    { id: 3, cat: "Engagement", text: "Reply to yesterday's comments", time: "10:00 AM", pri: "medium" },
    { id: 4, cat: "Outreach", text: "Send 5 connection requests", time: "11:00 AM", pri: "medium" },
    { id: 5, cat: "Content", text: "Schedule tomorrow's content", time: "2:00 PM", pri: "high" },
    { id: 6, cat: "Analytics", text: "Review yesterday's performance", time: "4:00 PM", pri: "low" },
  ]

  const calendar = Array.from({ length: 12 }, (_, i) => ({
    week: i + 1,
    month: Math.floor(i / 4) + 1,
    phase: i < 4 ? "Foundation" : i < 8 ? "Growth" : "Scale",
    posts: [
      { day: "Mon", type: "Educational", pillar: PILLARS[i % 7].name },
      { day: "Wed", type: "Story", pillar: PILLARS[(i + 2) % 7].name },
      { day: "Fri", type: "Engagement", pillar: PILLARS[(i + 4) % 7].name },
    ],
  }))

  const done = Object.values(checked).filter(Boolean).length
  const total = Object.values(generatedContent).reduce((a: number, p: any) => a + p.length, 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <div className="hidden md:flex w-64 bg-white border-r border-gray-200 flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-gray-200">
          <div className="relative">
            {companyData.logo ? (
              <img
                src={companyData.logo || "/placeholder.svg"}
                alt={companyData.companyName}
                className="w-10 h-10 rounded-lg object-contain"
              />
            ) : (
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Building2 size={20} className="text-gray-400" />
              </div>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{companyData.companyName || "My Company"}</div>
            <div className="text-xs text-gray-500">{total} posts ready</div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-1">
          {[
            { id: "library", icon: FileText, label: "Content Library", badge: total },
            { id: "calendar", icon: Calendar, label: "90-Day Calendar" },
            { id: "tasks", icon: CheckSquare, label: "Daily Tasks", badge: `${done}/${tasks.length}` },
            { id: "pillars", icon: Target, label: "Content Pillars" },
            { id: "competitors", icon: Users, label: "Competitor Insights" },
            { id: "metrics", icon: BarChart3, label: "Metrics & KPIs" },
          ].map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition ${
                section === n.id
                  ? "bg-transparent text-gray-900 font-medium border-l-2 border-gray-900 rounded-l-none"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.badge && <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">{n.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 space-1">
          <button
            onClick={() => setShowSettings(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button
            onClick={onReset}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <LogOut size={18} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      <div className="md:hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowMobileSidebar(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            {companyData.logo ? (
              <img
                src={companyData.logo || "/placeholder.svg"}
                alt={companyData.companyName}
                className="w-8 h-8 rounded object-contain"
              />
            ) : (
              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                <Building2 size={16} className="text-gray-400" />
              </div>
            )}
            <span className="text-sm font-bold">{companyData.companyName || "My Company"}</span>
          </div>
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="p-2 hover:bg-gray-100 rounded-lg relative">
            <User size={20} />
          </button>
        </div>
      </div>

      {showMobileSidebar && (
        <div className="md:hidden fixed inset-0 bg-black/50 z-50" onClick={() => setShowMobileSidebar(false)}>
          <div className="bg-white w-64 h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {companyData.logo ? (
                  <img
                    src={companyData.logo || "/placeholder.svg"}
                    alt={companyData.companyName}
                    className="w-10 h-10 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Building2 size={20} className="text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-sm font-bold text-gray-900">{companyData.companyName || "My Company"}</h1>
                  <p className="text-xs text-gray-500">Content Engine</p>
                </div>
              </div>
              <button onClick={() => setShowMobileSidebar(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 p-4 space-1">
              {[
                { id: "library", label: "Content Library", icon: FileText, badge: total },
                { id: "calendar", label: "Calendar", icon: Calendar },
                { id: "tasks", label: "Daily Tasks", icon: CheckSquare, badge: `${done}/${tasks.length}` },
                { id: "pillars", label: "Content Pillars", icon: Target },
                { id: "metrics", label: "Metrics", icon: TrendingUp },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSection(item.id)
                    setShowMobileSidebar(false)
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left ${
                    section === item.id
                      ? "bg-gray-50 text-gray-900 border-l-4 border-gray-900 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon size={18} />
                  <span className="text-sm">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-xs bg-gray-200 px-2 py-0.5 rounded-full">{item.badge}</span>
                  )}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-200 space-1">
              <button
                onClick={() => {
                  setShowSettings(true)
                  setShowMobileSidebar(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-left"
              >
                <Settings size={18} />
                <span className="text-sm">Settings</span>
              </button>
              <button
                onClick={() => {
                  onReset()
                  setShowMobileSidebar(false)
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-left"
              >
                <LogOut size={18} />
                <span className="text-sm">Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Home size={16} />
              <ChevronRight size={14} />
              <span className="text-gray-900 font-medium">
                {section === "library"
                  ? "Content Library"
                  : section === "calendar"
                    ? "90-Day Calendar"
                    : section === "tasks"
                      ? "Daily Tasks"
                      : section === "pillars"
                        ? "Content Pillars"
                        : "Metrics & KPIs"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Building2 size={16} />
              <span className="font-medium">{companyData.companyName}</span>
              <span className="text-gray-300">•</span>
              <span className="text-gray-500">{companyData.industry}</span>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 hover:bg-gray-50 rounded-lg p-1.5"
              >
                {companyData.logo ? (
                  <img
                    src={companyData.logo || "/placeholder.svg"}
                    alt="User"
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <User size={16} className="text-gray-600" />
                  </div>
                )}
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-2 w-48 z-10">
                  <button
                    onClick={onReset}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Reset Onboarding
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8">
          {section === "library" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900">Content Library</h2>
                  <p className="text-sm text-gray-600 mt-1">Browse and manage your generated content</p>
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium"
                >
                  <Filter size={16} />
                  Filters
                </button>
              </div>

              <div className={`space-y-4 ${showFilters ? "block" : "hidden md:block"}`}>
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="text"
                        placeholder="Search content..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPlatform(p.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                        platform === p.id ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-700"
                      }`}
                    >
                      <p.icon size={16} />
                      {p.name} ({(generatedContent[p.id] || []).length})
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0">
                  <button
                    onClick={() => setPillar("all")}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                      pillar === "all" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-700"
                    }`}
                  >
                    All Pillars
                  </button>
                  {PILLARS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => setPillar(p.name)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                        pillar === p.name ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-700"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bulk Actions Bar */}
              <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => selectedPosts.size > 0 ? clearSelection() : selectAllPosts()}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    {selectedPosts.size > 0 ? (
                      <>
                        <Square size={16} className="text-gray-500" />
                        Clear ({selectedPosts.size})
                      </>
                    ) : (
                      <>
                        <CheckSquare size={16} className="text-gray-500" />
                        Select All
                      </>
                    )}
                  </button>
                </div>

                {selectedPosts.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportSelectedPosts}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
                    >
                      <Download size={14} />
                      Export
                    </button>
                    <button
                      onClick={deleteSelectedPosts}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                    >
                      <X size={14} />
                      Delete
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filtered().map((post: any) => {
                  const key = `${platform}-${post.id}`
                  const status = postStatuses[key] || post.status || "ready"
                  const isEditing = editingPost === key
                  const isSelected = selectedPosts.has(key)

                  return (
                    <div
                      key={key}
                      className={`bg-white border rounded-xl overflow-hidden hover:shadow-md transition ${isSelected ? "border-gray-900 ring-1 ring-gray-900" : "border-gray-200"}`}
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer"
                        onClick={() => !isEditing && setExpanded(expanded === key ? null : key)}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              togglePostSelection(key)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 text-gray-900 rounded focus:ring-gray-900 flex-shrink-0"
                          />
                          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center text-sm font-medium text-gray-500">
                            {post.id}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900">{post.title}</h3>
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  status === "ready" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {status === "ready" ? "Ready" : "Review"}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                {post.pillar}
                              </span>
                              {expanded !== key && (
                                <span className="text-xs text-gray-400 truncate">
                                  {post.content.substring(0, 140)}...
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {status === "review" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePostStatus(platform, post.id)
                              }}
                              className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg"
                            >
                              <Square size={18} />
                            </button>
                          )}
                          {status === "ready" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                togglePostStatus(platform, post.id)
                              }}
                              className="p-2 text-green-500 hover:bg-green-50 rounded-lg"
                            >
                              <CheckSquare size={18} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copy(post.content, key)
                            }}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            {copied === key ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                          </button>
                          <ChevronDown
                            size={18}
                            className={`text-gray-400 transition-transform ${expanded === key ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>
                      {expanded === key && (
                        <div className="border-t border-gray-100 p-4 bg-gray-50">
                          {isEditing ? (
                            <>
                              <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Escape") {
                                    handleCancelEdit()
                                  } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                    handleSaveEdit(platform, post.id)
                                  }
                                }}
                                className="w-full min-h-[200px] p-3 text-sm text-gray-700 font-sans leading-relaxed border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 mb-2"
                                autoFocus
                              />
                              {/* Character count for editing */}
                              {(() => {
                                const limits = PLATFORM_LIMITS[platform] || { optimal: 1000, max: 2000, label: platform }
                                const charCount = editContent.length
                                const isOverOptimal = charCount > limits.optimal
                                const isOverMax = charCount > limits.max
                                const percentage = Math.min((charCount / limits.max) * 100, 100)
                                return (
                                  <div className="mb-2">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <span className={isOverMax ? "text-red-600 font-medium" : isOverOptimal ? "text-amber-600" : "text-gray-500"}>
                                        {charCount.toLocaleString()} / {limits.max.toLocaleString()} characters
                                      </span>
                                      <span className="text-gray-400">Optimal: {limits.optimal.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full transition-all ${
                                          isOverMax ? "bg-red-500" : isOverOptimal ? "bg-amber-500" : "bg-green-500"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )
                              })()}
                              <p className="text-xs text-gray-500 mb-4">Press Esc to cancel • ⌘+Enter to save</p>
                            </>
                          ) : (
                            <>
                              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed mb-2">
                                {post.content}
                              </pre>
                              {/* Character count display */}
                              {(() => {
                                const limits = PLATFORM_LIMITS[platform] || { optimal: 1000, max: 2000, label: platform }
                                const charCount = post.content.length
                                const isOverOptimal = charCount > limits.optimal
                                const isOverMax = charCount > limits.max
                                const percentage = Math.min((charCount / limits.max) * 100, 100)
                                return (
                                  <div className="mb-4 px-3 py-2 bg-white rounded-lg border border-gray-100">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                      <div className="flex items-center gap-2">
                                        <span className={isOverMax ? "text-red-600 font-medium" : isOverOptimal ? "text-amber-600" : "text-green-600"}>
                                          {charCount.toLocaleString()} chars
                                        </span>
                                        {isOverMax && <span className="text-red-600 text-xs font-medium">⚠ Over limit!</span>}
                                        {!isOverMax && isOverOptimal && <span className="text-amber-600 text-xs">Above optimal</span>}
                                        {!isOverOptimal && <span className="text-green-600 text-xs">✓ Good length</span>}
                                      </div>
                                      <span className="text-gray-400">
                                        {limits.label}: {limits.optimal.toLocaleString()}-{limits.max.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full transition-all ${
                                          isOverMax ? "bg-red-500" : isOverOptimal ? "bg-amber-500" : "bg-green-500"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                  </div>
                                )
                              })()}
                            </>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            {/* Copy button with format dropdown */}
                            <div className="relative">
                              <div className="flex">
                                <button
                                  onClick={() => copy(post.content, `${key}-full`)}
                                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-l-lg hover:bg-gray-800"
                                >
                                  {copied === `${key}-full` ? (
                                    <><Check size={14} /> Copied!</>
                                  ) : (
                                    <><Copy size={14} /> Copy</>
                                  )}
                                </button>
                                <button
                                  onClick={() => setCopyDropdown(copyDropdown === key ? null : key)}
                                  className="px-2 py-2 bg-gray-900 text-white text-sm rounded-r-lg hover:bg-gray-800 border-l border-gray-700"
                                >
                                  <ChevronDown size={14} className={`transition ${copyDropdown === key ? "rotate-180" : ""}`} />
                                </button>
                              </div>
                              {copyDropdown === key && (
                                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[160px]">
                                  <button
                                    onClick={() => copyWithFormat(post.content, "plain", `${key}-plain`)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-lg"
                                  >
                                    <FileText size={14} /> Plain Text
                                  </button>
                                  <button
                                    onClick={() => copyWithFormat(post.content, "markdown", `${key}-md`)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                  >
                                    <FileText size={14} /> Markdown
                                  </button>
                                  <button
                                    onClick={() => copyWithFormat(post.content, "html", `${key}-html`)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-b-lg"
                                  >
                                    <FileText size={14} /> HTML
                                  </button>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleRegeneratePost(platform, post.id)}
                              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-white"
                            >
                              <RefreshCw size={14} /> Regenerate
                            </button>
                            <button
                              onClick={() => handleCritiquePost(platform, post.id, post.content)}
                              disabled={critiquingPost === key}
                              className="flex items-center gap-2 px-4 py-2 border border-purple-200 text-purple-600 text-sm rounded-lg hover:bg-purple-50 disabled:opacity-50"
                            >
                              {critiquingPost === key ? (
                                <><RefreshCw size={14} className="animate-spin" /> Analyzing...</>
                              ) : (
                                <><Sparkles size={14} /> Feedback</>
                              )}
                            </button>
                            <button
                              onClick={() => handleGetVariants(platform, post.id, post.content)}
                              disabled={variantsPost === key && !variantsResult}
                              className="flex items-center gap-2 px-4 py-2 border border-blue-200 text-blue-600 text-sm rounded-lg hover:bg-blue-50 disabled:opacity-50"
                            >
                              {variantsPost === key && !variantsResult ? (
                                <><RefreshCw size={14} className="animate-spin" /> Loading...</>
                              ) : (
                                <><Shuffle size={14} /> A/B</>
                              )}
                            </button>
                            {(platform === "linkedin" || platform === "twitter" || platform === "threads") && (
                              <button
                                onClick={() => handleGetHashtags(platform, post.id, post.content)}
                                disabled={hashtagsPost === key && !hashtagsResult}
                                className="flex items-center gap-2 px-4 py-2 border border-cyan-200 text-cyan-600 text-sm rounded-lg hover:bg-cyan-50 disabled:opacity-50"
                              >
                                {hashtagsPost === key && !hashtagsResult ? (
                                  <><RefreshCw size={14} className="animate-spin" /> Loading...</>
                                ) : (
                                  <><Hash size={14} /> Tags</>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleGetScore(platform, post.id, post.content)}
                              disabled={scoringPost === key && !scoringResult}
                              className="flex items-center gap-2 px-4 py-2 border border-amber-200 text-amber-600 text-sm rounded-lg hover:bg-amber-50 disabled:opacity-50"
                            >
                              {scoringPost === key && !scoringResult ? (
                                <><RefreshCw size={14} className="animate-spin" /> Scoring...</>
                              ) : (
                                <><BarChart3 size={14} /> Score</>
                              )}
                            </button>
                            <button
                              onClick={() => setPreviewPost({ platform, content: post.content, title: post.title })}
                              className="flex items-center gap-2 px-4 py-2 border border-indigo-200 text-indigo-600 text-sm rounded-lg hover:bg-indigo-50"
                            >
                              <Eye size={14} /> Preview
                            </button>
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveEdit(platform, post.id)}
                                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                                >
                                  <Check size={14} /> Save
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-white"
                                >
                                  <X size={14} /> Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleEditPost(platform, post.id, post.content)}
                                className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-white"
                              >
                                <Edit3 size={14} /> Edit
                              </button>
                            )}
                          </div>

                          {/* Critique Results */}
                          {critiquingPost === key && critiqueResult && (
                            <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-purple-900">AI Feedback</h4>
                                <button
                                  onClick={closeCritique}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  <X size={16} />
                                </button>
                              </div>

                              {/* Scores */}
                              <div className="grid grid-cols-4 gap-2 mb-4">
                                <div className="text-center p-2 bg-white rounded-lg">
                                  <div className="text-xl font-bold text-purple-600">{critiqueResult.overallScore}/10</div>
                                  <div className="text-xs text-gray-600">Overall</div>
                                </div>
                                <div className="text-center p-2 bg-white rounded-lg">
                                  <div className="text-lg font-bold text-blue-600">{critiqueResult.hookScore}/10</div>
                                  <div className="text-xs text-gray-600">Hook</div>
                                </div>
                                <div className="text-center p-2 bg-white rounded-lg">
                                  <div className="text-lg font-bold text-green-600">{critiqueResult.clarityScore}/10</div>
                                  <div className="text-xs text-gray-600">Clarity</div>
                                </div>
                                <div className="text-center p-2 bg-white rounded-lg">
                                  <div className="text-lg font-bold text-orange-600">{critiqueResult.ctaScore}/10</div>
                                  <div className="text-xs text-gray-600">CTA</div>
                                </div>
                              </div>

                              {/* Strengths */}
                              {critiqueResult.strengths?.length > 0 && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-green-800 mb-1">Strengths</h5>
                                  <ul className="text-sm text-gray-700 space-y-1">
                                    {critiqueResult.strengths.map((s: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <Check size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                                        {s}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Weaknesses */}
                              {critiqueResult.weaknesses?.length > 0 && (
                                <div className="mb-3">
                                  <h5 className="text-sm font-medium text-red-800 mb-1">Areas to Improve</h5>
                                  <ul className="text-sm text-gray-700 space-y-1">
                                    {critiqueResult.weaknesses.map((w: string, i: number) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <X size={14} className="text-red-600 mt-0.5 flex-shrink-0" />
                                        {w}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Rewritten Version */}
                              {critiqueResult.rewrittenVersion && (
                                <div>
                                  <h5 className="text-sm font-medium text-purple-800 mb-1">Improved Version</h5>
                                  <div className="bg-white p-3 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                                    {critiqueResult.rewrittenVersion}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setEditContent(critiqueResult.rewrittenVersion)
                                      setEditingPost(key)
                                      closeCritique()
                                    }}
                                    className="mt-2 text-sm text-purple-600 hover:text-purple-800 font-medium"
                                  >
                                    Use this version →
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* A/B Variants Results */}
                          {variantsPost === key && variantsResult && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-blue-900">A/B Headline Variants</h4>
                                <button onClick={closeVariants} className="text-blue-600 hover:text-blue-800">
                                  <X size={16} />
                                </button>
                              </div>
                              <div className="space-y-3">
                                {variantsResult.map((variant: any, i: number) => (
                                  <div key={i} className="bg-white p-3 rounded-lg border border-blue-100">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-900 font-medium">{variant.headline}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">{variant.hook}</span>
                                          <span className={`text-xs px-2 py-0.5 rounded ${
                                            variant.predictedEngagement === "high" ? "bg-green-100 text-green-700" :
                                            variant.predictedEngagement === "medium" ? "bg-yellow-100 text-yellow-700" :
                                            "bg-gray-100 text-gray-700"
                                          }`}>
                                            {variant.predictedEngagement} engagement
                                          </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">{variant.angle}</p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(variant.headline)
                                          toast({ title: "Copied", description: "Headline variant copied" })
                                        }}
                                        className="text-blue-600 hover:text-blue-800 p-1"
                                      >
                                        <Copy size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Hashtag Suggestions Results */}
                          {hashtagsPost === key && hashtagsResult && (
                            <div className="mt-4 p-4 bg-cyan-50 border border-cyan-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-cyan-900">Hashtag Suggestions</h4>
                                <button onClick={closeHashtags} className="text-cyan-600 hover:text-cyan-800">
                                  <X size={16} />
                                </button>
                              </div>
                              <p className="text-sm text-cyan-800 mb-3">{hashtagsResult.strategy}</p>
                              <p className="text-xs text-cyan-700 mb-2">Recommended: Use {hashtagsResult.recommendedCount} hashtags</p>
                              <div className="flex flex-wrap gap-2">
                                {hashtagsResult.hashtags?.map((tag: any, i: number) => (
                                  <button
                                    key={i}
                                    onClick={() => {
                                      navigator.clipboard.writeText(tag.hashtag)
                                      toast({ title: "Copied", description: `${tag.hashtag} copied` })
                                    }}
                                    className={`text-sm px-3 py-1 rounded-full border cursor-pointer transition hover:opacity-80 ${
                                      tag.reach === "high" ? "bg-green-100 border-green-200 text-green-700" :
                                      tag.reach === "medium" ? "bg-yellow-100 border-yellow-200 text-yellow-700" :
                                      "bg-gray-100 border-gray-200 text-gray-700"
                                    }`}
                                    title={tag.reason}
                                  >
                                    {tag.hashtag}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => {
                                  const allHashtags = hashtagsResult.hashtags?.slice(0, hashtagsResult.recommendedCount).map((t: any) => t.hashtag).join(" ")
                                  navigator.clipboard.writeText(allHashtags || "")
                                  toast({ title: "Copied", description: "All recommended hashtags copied" })
                                }}
                                className="mt-3 text-sm text-cyan-600 hover:text-cyan-800 font-medium"
                              >
                                Copy all recommended →
                              </button>
                            </div>
                          )}

                          {/* Scoring Results */}
                          {scoringPost === key && scoringResult && (
                            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-medium text-amber-900">Content Score Analysis</h4>
                                <button onClick={closeScore} className="text-amber-600 hover:text-amber-800">
                                  <X size={16} />
                                </button>
                              </div>

                              {/* Overall Score */}
                              <div className="flex items-center gap-4 mb-4 p-3 bg-white rounded-lg">
                                <div className="text-3xl font-bold text-amber-600">
                                  {scoringResult.overallScore}/10
                                </div>
                                <div className="flex-1">
                                  <div className={`text-sm font-medium ${
                                    scoringResult.predictedPerformance === "viral" ? "text-green-600" :
                                    scoringResult.predictedPerformance === "high" ? "text-blue-600" :
                                    scoringResult.predictedPerformance === "average" ? "text-amber-600" :
                                    "text-red-600"
                                  }`}>
                                    {scoringResult.predictedPerformance?.toUpperCase()} predicted performance
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    Platform optimization: {scoringResult.platformOptimization}%
                                  </div>
                                </div>
                              </div>

                              {/* Breakdown Grid */}
                              <div className="grid grid-cols-3 gap-2 mb-4">
                                {Object.entries(scoringResult.breakdown || {}).map(([dimension, data]: [string, any]) => (
                                  <div key={dimension} className="p-2 bg-white rounded-lg">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-xs text-gray-600 capitalize">{dimension}</span>
                                      <span className={`text-sm font-bold ${
                                        data.score >= 8 ? "text-green-600" :
                                        data.score >= 6 ? "text-amber-600" :
                                        "text-red-600"
                                      }`}>{data.score}/10</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                                      <div
                                        className={`h-1.5 rounded-full ${
                                          data.score >= 8 ? "bg-green-500" :
                                          data.score >= 6 ? "bg-amber-500" :
                                          "bg-red-500"
                                        }`}
                                        style={{ width: `${data.score * 10}%` }}
                                      />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{data.feedback}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Quick Wins */}
                              {scoringResult.quickWins?.length > 0 && (
                                <div className="p-3 bg-white rounded-lg">
                                  <h5 className="text-sm font-medium text-amber-900 mb-2">Quick Wins</h5>
                                  <ul className="space-y-1">
                                    {scoringResult.quickWins.map((win: string, i: number) => (
                                      <li key={i} className="text-xs text-gray-700 flex items-start gap-2">
                                        <span className="text-amber-500 mt-0.5">→</span>
                                        {win}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {section === "calendar" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">90-Day Calendar</h2>
                  <p className="text-gray-500">Your strategic posting schedule</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                  <Download size={14} /> Export
                </button>
              </div>
              {[1, 2, 3].map((m) => (
                <div key={m} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                  <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">
                      Month {m}: {m === 1 ? "Foundation" : m === 2 ? "Growth" : "Scale"}
                    </h3>
                  </div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                        <th className="px-6 py-3 w-20">Week</th>
                        <th className="px-6 py-3">Monday</th>
                        <th className="px-6 py-3">Wednesday</th>
                        <th className="px-6 py-3">Friday</th>
                        <th className="px-6 py-3 w-32">Focus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {calendar
                        .filter((w) => w.month === m)
                        .map((w) => (
                          <tr key={w.week} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{w.week}</td>
                            {w.posts.map((p, i) => (
                              <td key={i} className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{p.type}</div>
                                <div className="text-xs text-gray-500">{p.pillar}</div>
                              </td>
                            ))}
                            <td className="px-6 py-4">
                              <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{w.phase}</span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {section === "tasks" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Daily Tasks</h2>
                  <p className="text-gray-500">Your GTM execution checklist</p>
                </div>
                <span className="text-sm text-gray-500">
                  {done}/{tasks.length} complete
                </span>
              </div>
              {["Content", "Engagement", "Outreach", "Analytics"].map((cat) => {
                const catTasks = tasks.filter((t) => t.cat === cat)
                if (!catTasks.length) return null
                return (
                  <div key={cat} className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-medium text-gray-900">{cat}</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {catTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => toggleDailyTask(t.id)}
                          className={`flex items-center gap-4 p-4 cursor-pointer ${checked[t.id] ? "bg-green-50" : "hover:bg-gray-50"}`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checked[t.id] ? "bg-green-500 border-green-500" : "border-gray-300"}`}
                          >
                            {checked[t.id] && <Check size={14} className="text-white" />}
                          </div>
                          <p
                            className={`flex-1 text-sm ${checked[t.id] ? "text-gray-500 line-through" : "text-gray-900"}`}
                          >
                            {t.text}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${t.pri === "high" ? "bg-red-100 text-red-700" : t.pri === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}
                          >
                            {t.pri}
                          </span>
                          <span className="text-xs text-gray-400">{t.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {section === "pillars" && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Content Pillars</h2>
              <p className="text-gray-500 mb-6">Your strategic content mix</p>
              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="font-medium text-gray-900 mb-4">Pillar Distribution</h3>
                <div className="space-y-4">
                  {PILLARS.map((p) => (
                    <div key={p.id} className="flex items-center gap-4">
                      <div className="w-32 text-sm font-medium text-gray-700">{p.name}</div>
                      <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                        <div className={`h-full ${p.color} flex items-center px-3`} style={{ width: `${p.pct * 4}%` }}>
                          <span className="text-xs font-medium text-white">{p.pct}%</span>
                        </div>
                      </div>
                      <div className="w-40 text-xs text-gray-500">{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-medium text-gray-900 mb-4">Recommended Hashtags</h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    `#${companyData.companyName?.replace(/\s+/g, "")}`,
                    "#BuildingInPublic",
                    `#${companyData.industry || "SaaS"}`,
                    "#StartupLife",
                    "#GrowthMarketing",
                  ].map((tag) => (
                    <span
                      key={tag}
                      onClick={() => copy(tag, tag)}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm rounded-lg cursor-pointer hover:bg-blue-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {section === "competitors" && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Competitor Insights</h2>
                  <p className="text-gray-500">Intelligence on your competition's content strategy</p>
                </div>
                <button
                  onClick={refreshCompetitorInsights}
                  disabled={isLoadingInsights || !companyData?.competitors}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw size={16} className={isLoadingInsights ? "animate-spin" : ""} />
                  {isLoadingInsights ? "Analyzing..." : "Refresh Analysis"}
                </button>
              </div>

              {!companyData?.competitors ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                  <Users size={48} className="mx-auto text-yellow-500 mb-4" />
                  <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Competitors Configured</h3>
                  <p className="text-yellow-700 text-sm">
                    Add competitors during onboarding to get AI-powered competitive insights.
                  </p>
                </div>
              ) : !competitorInsights ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                  <Sparkles size={48} className="mx-auto text-blue-500 mb-4" />
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">Generate Competitor Analysis</h3>
                  <p className="text-blue-700 text-sm mb-4">
                    Click "Refresh Analysis" to get AI-powered insights on your competitors' content strategies.
                  </p>
                  <button
                    onClick={refreshCompetitorInsights}
                    disabled={isLoadingInsights}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoadingInsights ? "Analyzing..." : "Analyze Competitors"}
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Executive Summary</h3>
                    <p className="text-gray-700">{competitorInsights.summary}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      Last updated: {new Date(competitorInsights.generatedAt).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Competitor Analysis */}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">Competitor Breakdown</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {competitorInsights.competitors?.map((comp, idx) => (
                        <div key={idx} className="p-6">
                          <h4 className="font-semibold text-gray-900 mb-4">{comp.competitor}</h4>
                          <div className="grid md:grid-cols-2 gap-4">
                            <div>
                              <h5 className="text-sm font-medium text-green-700 mb-2">Strengths</h5>
                              <ul className="space-y-2">
                                {comp.strengths?.slice(0, 3).map((s, i) => (
                                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                                    <Check size={14} className="text-green-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>{s.strength}</strong> - {s.example}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <h5 className="text-sm font-medium text-orange-700 mb-2">Opportunities for You</h5>
                              <ul className="space-y-2">
                                {comp.weaknesses?.slice(0, 3).map((w, i) => (
                                  <li key={i} className="text-sm text-gray-600 flex gap-2">
                                    <Target size={14} className="text-orange-600 flex-shrink-0 mt-0.5" />
                                    <span><strong>{w.weakness}</strong> - {w.opportunity}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Angles */}
                  {competitorInsights.recommendedAngles && competitorInsights.recommendedAngles.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">Recommended Content Angles</h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {competitorInsights.recommendedAngles.map((angle, idx) => (
                          <div key={idx} className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <h4 className="font-medium text-green-900 mb-1">{angle.angle}</h4>
                            <p className="text-sm text-green-700 mb-2">{angle.rationale}</p>
                            <p className="text-xs text-green-600 font-medium">Differentiator: {angle.differentiator}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What to Avoid */}
                  {competitorInsights.avoidList && competitorInsights.avoidList.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-6">
                      <h3 className="font-semibold text-gray-900 mb-4">What to Avoid</h3>
                      <div className="space-y-3">
                        {competitorInsights.avoidList.map((item, idx) => (
                          <div key={idx} className="flex gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <X size={18} className="text-red-600 flex-shrink-0" />
                            <div>
                              <span className="font-medium text-red-900">{item.tactic}</span>
                              <p className="text-sm text-red-700">{item.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {section === "metrics" && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Metrics & KPIs</h2>
              <p className="text-gray-500 mb-6">Track your GTM progress</p>
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Posts", value: total, trend: "+12%", bg: "from-blue-50 to-white" },
                  { label: "Engagement Rate", value: "4.8%", trend: "+0.3%", bg: "from-green-50 to-white" },
                  { label: "Reach (90d)", value: "125K", trend: "+18%", bg: "from-purple-50 to-white" },
                  { label: "Conversions", value: "43", trend: "+9", bg: "from-orange-50 to-white" },
                ].map((m, i) => (
                  <div key={i} className={`bg-gradient-to-br ${m.bg} border border-gray-200 rounded-xl p-4`}>
                    <div className="text-xs text-gray-500 mb-1">{m.label}</div>
                    <div className="flex items-end justify-between">
                      <div className="text-2xl font-bold text-gray-900">{m.value}</div>
                      <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                        <TrendingUp size={12} /> {m.trend}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="font-medium text-gray-900">90-Day Targets</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase bg-gray-50">
                      <th className="px-6 py-3">Metric</th>
                      <th className="px-6 py-3 text-center">Month 1</th>
                      <th className="px-6 py-3 text-center">Month 2</th>
                      <th className="px-6 py-3 text-center">Month 3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { m: "Posts Published", v: ["12", "20", "30"] },
                      { m: "Followers", v: ["+200", "+500", "+1,000"] },
                      { m: "Engagement Rate", v: ["2%", "3%", "4%+"] },
                      { m: "Leads", v: ["20", "50", "100"] },
                      { m: "Demos", v: ["5", "15", "30"] },
                    ].map((r) => (
                      <tr key={r.m} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{r.m}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-center">{r.v[0]}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 text-center">{r.v[1]}</td>
                        <td className="px-6 py-4 text-sm text-center font-medium text-green-600">{r.v[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-medium text-amber-900 mb-2">Optimal Posting Times</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-amber-800">LinkedIn:</span>{" "}
                    <span className="text-amber-700">Tue-Thu, 7-9 AM or 12-1 PM</span>
                  </div>
                  <div>
                    <span className="font-medium text-amber-800">Twitter:</span>{" "}
                    <span className="text-amber-700">6 AM, 12 PM, 3 PM, 8 PM</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-500 mt-1">Manage your data and preferences</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Company Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Company:</span>
                    <span className="text-gray-900 font-medium">{companyData.companyName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Industry:</span>
                    <span className="text-gray-900">{companyData.industry || "Not set"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Target Platforms:</span>
                    <span className="text-gray-900">{companyData.targetPlatforms?.length || 0} selected</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Data Management</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FileDown size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">Export All Data</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Download your complete GTM engine data as JSON (includes company info, content, and tasks)
                        </p>
                        <button
                          onClick={() => {
                            exportAllData()
                            toast({ title: "Exported", description: "All data exported to JSON file" })
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
                        >
                          <Download size={14} /> Export JSON
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FileUp size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">Import Data</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Restore from a previous export or transfer data between devices
                        </p>
                        <input type="file" id="import-data" accept=".json" onChange={handleImport} className="hidden" />
                        <label
                          htmlFor="import-data"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition cursor-pointer"
                        >
                          <Upload size={14} /> Import JSON
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FileText size={20} className="text-purple-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">Export Content Library (CSV)</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Download all your content posts in spreadsheet format for easy sharing
                        </p>
                        <button
                          onClick={() => {
                            const count = exportContentCSV(generatedContent, companyData.companyName)
                            toast({ title: "Exported", description: `Exported ${count} posts to CSV` })
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition"
                        >
                          <Download size={14} /> Export CSV
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-red-900 mb-3">Danger Zone</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 mb-1">Clear All Data</h4>
                      <p className="text-sm text-gray-600 mb-3">
                        Permanently delete all data from this device. This cannot be undone.
                      </p>
                      <button
                        onClick={clearAllData}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
                      >
                        <X size={14} /> Clear All Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Storage Stats</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{total}</div>
                    <div className="text-xs text-gray-500">Total Posts</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{done}</div>
                    <div className="text-xs text-gray-500">Tasks Done</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-gray-900">{companyData.targetPlatforms?.length || 0}</div>
                    <div className="text-xs text-gray-500">Platforms</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBanner && view === "dashboard" && (
        <div className="fixed bottom-0 left-0 right-0 bg-yellow-50 border-t border-amber-200 px-6 py-3 flex items-center justify-between z-50">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <p className="text-sm text-amber-900">
              <strong>Preview Mode</strong> - Your content is ready to copy. Connect a database to save across sessions.
            </p>
          </div>
          <button onClick={() => setShowBanner(false)} className="p-1 hover:bg-amber-100 rounded transition">
            <X size={16} className="text-amber-700" />
          </button>
        </div>
      )}

      {/* Regenerate with Feedback Dialog */}
      <Dialog open={!!regeneratePost} onOpenChange={(open) => !open && setRegeneratePost(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw size={18} />
              Regenerate Post
            </DialogTitle>
          </DialogHeader>
          {regeneratePost && (
            <div className="mt-4 space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Current Content</h4>
                <p className="text-sm text-gray-700 line-clamp-4">{regeneratePost.content}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  What would you like to change? (optional)
                </label>
                <textarea
                  value={regenerateFeedback}
                  onChange={(e) => setRegenerateFeedback(e.target.value)}
                  placeholder="e.g., Make it more casual, add a question at the end, focus on the pain point..."
                  className="w-full p-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-[100px]"
                />
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                <h5 className="text-sm font-medium text-blue-900 mb-1">Quick Suggestions</h5>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Make it shorter",
                    "Add a question",
                    "More casual tone",
                    "Stronger hook",
                    "Add urgency",
                    "Focus on benefits",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setRegenerateFeedback((prev) => prev ? `${prev}, ${suggestion.toLowerCase()}` : suggestion)}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setRegeneratePost(null)}
                  disabled={isRegenerating}
                  className="px-4 py-2 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={executeRegenerate}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {isRegenerating ? (
                    <><RefreshCw size={14} className="animate-spin" /> Regenerating...</>
                  ) : (
                    <><RefreshCw size={14} /> Regenerate</>
                  )}
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Post Preview Modal */}
      <Dialog open={!!previewPost} onOpenChange={(open) => !open && setPreviewPost(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye size={18} />
              {previewPost?.platform && PLATFORM_LIMITS[previewPost.platform]?.label} Preview
            </DialogTitle>
          </DialogHeader>
          {previewPost && (
            <div className="mt-4">
              {/* Platform-specific preview */}
              {previewPost.platform === "linkedin" && (
                <div className="border border-gray-200 rounded-lg bg-white">
                  {/* LinkedIn header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                        {companyData.companyName?.charAt(0) || "C"}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{companyData.companyName}</div>
                        <div className="text-xs text-gray-500">{companyData.industry || "Industry"}</div>
                        <div className="text-xs text-gray-400">Just now · 🌐</div>
                      </div>
                    </div>
                  </div>
                  {/* LinkedIn content */}
                  <div className="p-4">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed">
                      {previewPost.content}
                    </pre>
                  </div>
                  {/* LinkedIn engagement bar */}
                  <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-4 text-gray-500 text-sm">
                    <span>👍 Like</span>
                    <span>💬 Comment</span>
                    <span>🔄 Repost</span>
                    <span>📤 Send</span>
                  </div>
                </div>
              )}

              {previewPost.platform === "twitter" && (
                <div className="border border-gray-200 rounded-xl bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-700 to-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {companyData.companyName?.charAt(0) || "C"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-gray-900">{companyData.companyName}</span>
                        <span className="text-gray-500 text-sm">@{(companyData.companyName || "company").toLowerCase().replace(/\s/g, "")}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500 text-sm">now</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 mt-1 leading-relaxed">
                        {previewPost.content}
                      </pre>
                      <div className="flex items-center gap-8 mt-3 text-gray-500">
                        <span className="text-sm">💬 0</span>
                        <span className="text-sm">🔄 0</span>
                        <span className="text-sm">❤️ 0</span>
                        <span className="text-sm">📊 0</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewPost.platform === "threads" && (
                <div className="border border-gray-200 rounded-xl bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {companyData.companyName?.charAt(0) || "C"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-gray-900">{(companyData.companyName || "company").toLowerCase().replace(/\s/g, "")}</span>
                        <span className="text-gray-400 text-sm">· now</span>
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 mt-2 leading-relaxed">
                        {previewPost.content}
                      </pre>
                      <div className="flex items-center gap-6 mt-3 text-gray-400">
                        <span>❤️</span>
                        <span>💬</span>
                        <span>🔄</span>
                        <span>📤</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewPost.platform === "email" && (
                <div className="border border-gray-200 rounded-lg bg-white">
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="text-sm space-y-1">
                      <div><span className="text-gray-500">From:</span> <span className="text-gray-900">{companyData.companyName} &lt;hello@{(companyData.website || "company.com").replace("https://", "").replace("http://", "")}&gt;</span></div>
                      <div><span className="text-gray-500">To:</span> <span className="text-gray-900">[Recipient]</span></div>
                      <div><span className="text-gray-500">Subject:</span> <span className="font-medium text-gray-900">{previewPost.title}</span></div>
                    </div>
                  </div>
                  <div className="p-6">
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed">
                      {previewPost.content}
                    </pre>
                  </div>
                </div>
              )}

              {previewPost.platform === "ads" && (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg bg-white p-4">
                    <div className="text-xs text-gray-500 mb-2">Ad Preview - Facebook/Instagram</div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {companyData.companyName?.charAt(0) || "C"}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{companyData.companyName}</div>
                        <div className="text-xs text-gray-400">Sponsored</div>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-gray-900 leading-relaxed">
                      {previewPost.content}
                    </pre>
                    <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-200">
                      <div className="text-xs text-gray-500 uppercase">Learn More</div>
                      <div className="font-medium text-gray-900">{companyData.companyName}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Character count for preview */}
              {(() => {
                const limits = PLATFORM_LIMITS[previewPost.platform] || { optimal: 1000, max: 2000, label: previewPost.platform }
                const charCount = previewPost.content.length
                const isOverOptimal = charCount > limits.optimal
                const isOverMax = charCount > limits.max
                return (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm">
                      <span className={isOverMax ? "text-red-600 font-medium" : isOverOptimal ? "text-amber-600" : "text-green-600"}>
                        {charCount.toLocaleString()} / {limits.max.toLocaleString()} characters
                        {isOverMax && " (over limit!)"}
                        {!isOverMax && isOverOptimal && " (above optimal)"}
                        {!isOverOptimal && " (good length)"}
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* Copy button */}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewPost.content)
                    toast({ title: "Copied", description: "Content copied to clipboard" })
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
                >
                  <Copy size={14} /> Copy Content
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================
// MAIN APP
// ============================================

export default function GTMContentEngine() {
  const [isLoaded, setIsLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<any>(null)
  const [content, setContent] = useState<any>(null)

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    const savedReady = loadFromLocalStorage(STORAGE_KEYS.READY_STATE)
    const savedData = loadFromLocalStorage(STORAGE_KEYS.FORM_DATA)
    const savedContent = loadFromLocalStorage(STORAGE_KEYS.GENERATED_CONTENT)

    if (savedReady) setReady(savedReady)
    if (savedData) setData(savedData)
    if (savedContent) setContent(savedContent)

    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      saveToLocalStorage(STORAGE_KEYS.READY_STATE, ready)
    }
  }, [ready, isLoaded])

  const handleComplete = (formData: any, generatedContent: any) => {
    setData(formData)
    setContent(generatedContent)
    setReady(true)
    saveToLocalStorage(STORAGE_KEYS.FORM_DATA, formData)
    saveToLocalStorage(STORAGE_KEYS.GENERATED_CONTENT, generatedContent)
    saveToLocalStorage(STORAGE_KEYS.READY_STATE, true)
  }

  const handleReset = () => {
    if (typeof window !== "undefined") {
      localStorage.clear()
    }
    setReady(false)
    setData(null)
    setContent(null)
  }

  // Show loading state while checking localStorage
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center animate-pulse">
          <Sparkles size={20} className="text-white" />
        </div>
      </div>
    )
  }

  if (!ready) return <OnboardingWizard onComplete={handleComplete} />
  return <Dashboard companyData={data} onReset={handleReset} />
}
