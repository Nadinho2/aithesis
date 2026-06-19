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

    // Store in DB and return record id
    let recordId: string | null = null;
    if (supabase) {
      try {
        const { data: record, error } = await supabase
          .from("side_hustles")
          .insert({
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
          })
          .select("id")
          .single();

        if (error) throw new Error(error.message);
        recordId = record.id;
      } catch (e: any) {
        console.error("Failed to save side-hustle to history:", e?.message ?? e);
      }
    }

    return { ...result, recordId, userAnswers: JSON.stringify(data) };
  });

// ─── Side Hustle Journey / Plan ───

const StartPlanInput = z.object({
  sideHustleId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(500),
  difficulty: z.string().optional(),
  estimatedEarnings: z.string().optional(),
  timeRequired: z.string().optional(),
  description: z.string().optional(),
  firstSteps: z.array(z.string()).optional(),
  userAnswers: z.string().optional(),
});

export const startSideHustlePlan = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => StartPlanInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // Build AI prompt for personalised milestones
    let milestones: {
      phase: number;
      title: string;
      description: string;
      tasks: string[];
      estimated_days: number;
    }[] = [];

    if (apiKey) {
      const systemPrompt = `You are a career coach and side-hustle strategist. Given a user's chosen side hustle and their personal context, generate a structured 7-phase roadmap to get them from zero to their first paying client.

For each phase provide:
- phase: phase number (1-7)
- title: a short motivational name
- description: 2-3 sentences explaining what this phase focuses on
- tasks: 3-5 concrete, actionable tasks the user should do
- estimated_days: realistic number of days to complete this phase

The 7 phases should cover:
1. Skill Up — identify and close skill gaps
2. Build Portfolio — create samples or case studies
3. Set Your Rates & Offer — define pricing and service packages
4. Create Presence — profiles on freelance platforms, social media
5. Find Leads — where and how to find potential clients
6. Pitch & Close — how to write proposals and land the first client
7. Deliver & Get Reviews — complete the project successfully and get testimonials

Return ONLY valid JSON (no markdown, no code fences):
{
  "milestones": [
    {
      "phase": 1,
      "title": "Skill Up",
      "description": "...",
      "tasks": ["Task 1", "Task 2", "Task 3"],
      "estimated_days": 7
    }
  ]
}`;

      const userPrompt = `Side hustle chosen: ${data.title}
Description: ${data.description || "N/A"}
Difficulty: ${data.difficulty || "N/A"}
Estimated earnings: ${data.estimatedEarnings || "N/A"}
Time required: ${data.timeRequired || "N/A"}
First steps suggested: ${(data.firstSteps || []).join(", ")}

User's context (their answers to the 5 questions):
${data.userAnswers || "N/A"}

Generate a personalised 7-phase roadmap to help this user get their first client.`;

      try {
        const result = await callAI(apiKey, {
          model: "deepseek-chat",
          system: systemPrompt,
          user: userPrompt,
        });
        if (result?.milestones) {
          milestones = result.milestones;
        }
      } catch (e) {
        console.error("AI milestones failed, using defaults:", e);
      }
    }

    // Fallback milestones if AI fails
    if (milestones.length === 0) {
      milestones = [
        { phase: 1, title: "Skill Up", description: "Identify any skill gaps and master the fundamentals needed for your side hustle.", tasks: ["Research required skills", "Take an online course or tutorial", "Practice with small projects", "Join relevant communities"], estimated_days: 7 },
        { phase: 2, title: "Build Your Portfolio", description: "Create samples or case studies that showcase what you can deliver.", tasks: ["Complete 2-3 sample projects", "Write case studies of your work", "Take screenshots / record demos", "Organise portfolio pieces"], estimated_days: 7 },
        { phase: 3, title: "Set Your Rates & Offer", description: "Define your pricing, packages, and what makes your offer unique.", tasks: ["Research market rates", "Define 3 service packages", "Write your value proposition", "Prepare a pricing sheet"], estimated_days: 3 },
        { phase: 4, title: "Create Your Presence", description: "Set up profiles where clients look for talent.", tasks: ["Create / optimise LinkedIn profile", "Join 2-3 freelance platforms", "Write your bio and service descriptions", "Set up a simple portfolio page"], estimated_days: 5 },
        { phase: 5, title: "Find Leads", description: "Identify where your ideal clients hang out and start connecting.", tasks: ["Search for job postings matching your service", "Join niche communities and forums", "Network with 10 potential connections", "Set up job alerts"], estimated_days: 7 },
        { phase: 6, title: "Pitch & Close", description: "Write compelling proposals and land your first client.", tasks: ["Write a proposal template", "Apply to 5-10 opportunities", "Follow up on applications", "Practice your discovery call", "Send your first invoice"], estimated_days: 14 },
        { phase: 7, title: "Deliver & Get Reviews", description: "Knock your first project out of the park and get testimonials.", tasks: ["Set clear expectations with a scope document", "Deliver ahead of schedule", "Ask for a testimonial / review", "Request referrals", "Log your learnings"], estimated_days: 14 },
      ];
    }

    // Insert plan into DB
    let plan: any = null;
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from("side_hustle_plans")
          .insert({
            user_id: userId,
            side_hustle_id: data.sideHustleId,
            title: data.title,
            difficulty: data.difficulty || "Beginner",
            estimated_earnings: data.estimatedEarnings || "",
            time_required: data.timeRequired || "",
            description: data.description || "",
            milestones,
            current_step: 0,
            status: "active",
          })
          .select()
          .single();

        if (!error) plan = inserted;
      } catch (e: any) {
        console.error("DB insert failed (table may not exist yet):", e?.message ?? e);
      }
    }

    // Always return a plan object — even if DB save failed, the journey page can still work
    return plan ?? {
      id: "local_" + crypto.randomUUID(),
      user_id: userId,
      side_hustle_id: data.sideHustleId,
      title: data.title,
      difficulty: data.difficulty || "Beginner",
      estimated_earnings: data.estimatedEarnings || "",
      time_required: data.timeRequired || "",
      description: data.description || "",
      milestones,
      current_step: 0,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _local: true, // flag so journey page knows it's not in DB
    };
  });

export const getActivePlan = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("side_hustle_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== "PGRST116") { // not found is ok
      console.error("getActivePlan error:", error.message);
      return null;
    }
    return data ?? null;
  });

export const updateMilestone = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ planId: z.string().uuid(), step: z.number().int().min(0) }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("side_hustle_plans")
      .update({ current_step: data.step, updated_at: new Date().toISOString() })
      .eq("id", data.planId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const completePlan = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ planId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("side_hustle_plans")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", data.planId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPlans = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("side_hustle_plans")
      .select("id, title, difficulty, status, current_step, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
