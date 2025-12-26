export const parseAIResponse = (text: string) => {
  const extract = (label: string): string => {
    const regex = new RegExp(`${label}[:\\s]*([\\s\\S]*?)(?=\\d+\\.|$)`, "i")
    const match = text.match(regex)
    return match ? match[1].trim() : ""
  }

  return {
    productDescription: extract("PRODUCT DESCRIPTION"),
    targetAudience: extract("TARGET AUDIENCE"),
    jobTitles: extract("JOB TITLES TO TARGET"),
    painPoints: extract("TOP 3 PAIN POINTS"),
    uniqueValue: extract("UNIQUE VALUE PROPOSITION"),
    keyBenefits: extract("KEY BENEFITS"),
    competitors: extract("MAIN COMPETITORS"),
    industry: extract("INDUSTRY").toLowerCase(),
    companySize: extract("COMPANY SIZE TARGET"),
    primaryGoal: extract("PRIMARY GOAL").toLowerCase(),
    contentTone: extract("CONTENT TONE").toLowerCase(),
  }
}
