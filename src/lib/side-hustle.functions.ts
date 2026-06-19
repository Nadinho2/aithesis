import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";

const SideHustleInput = z.object({
  skills: z.string().min(2).max(2000),
  interests: z.string().min(2).max(2000),
  time: z.string().min(2).max(1000),
  goal: z.string().min(2).max(2000),
  experience: z.string().min(2).max(2000),
});

export const generateSideHustle = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SideHustleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    const systemPrompt = `You are a career and side-hustle advisor. Based on the user's answers to 5 questions, suggest 3-5 realistic side-hustle ideas.

For each side-hustle provide:
- title: the side-hustle name
- description: 2-3 sentences explaining what it involves
- why_fit: 1-2 sentences explaining why it suits this user's profile
- estimated_earnings: realistic earning range (monthly, in USD)
- time_required: estimated hours per week
- difficulty: "Beginner" | "Intermediate" | "Advanced"
- first_steps: 3-5 concrete actionable steps to get started

Return ONLY valid JSON (no markdown, no code fences):
{
  "summary": "A one-paragraph overview tying their answers together and recommending their best path",
  "suggestions": [
    {
      "title": "Side Hustle Name",
      "description": "...",
      "why_fit": "...",
      "estimated_earnings": "$X - $Y/month",
      "time_required": "X hrs/week",
      "difficulty": "Beginner",
      "first_steps": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}`;

    const userPrompt = `Here are my answers:

1. What are my current skills or areas of expertise?
${data.skills}

2. What am I passionate about or interested in?
${data.interests}

3. How much time can I realistically dedicate per week?
${data.time}

4. What is my primary goal (extra income, skill building, portfolio, etc.)?
${data.goal}

5. What level of experience do I have in my field?
${data.experience}`;

    const result = await callAI(apiKey, {
      model: "deepseek-chat",
      system: systemPrompt,
      user: userPrompt,
    });

    // Store in DB
    if (supabase) {
      try {
        await supabase.from("side_hustles").insert({
          user_id: userId,
          answers: {
            skills: data.skills,
            interests: data.interests,
            time: data.time,
            goal: data.goal,
            experience: data.experience,
          },
          suggestions: result,
          status: "completed",
        });
      } catch (e: any) {
        console.error("Failed to save side-hustle to history:", e?.message ?? e);
      }
    }

    return result;
  });
