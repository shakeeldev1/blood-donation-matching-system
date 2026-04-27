import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AskChatbotDto } from './dto/ask-chatbot.dto';
import { Donor } from '../donor/schemas/donor.schema';
import { BloodRequest } from '../donor/schemas/blood-request.schema';

type ChatbotReply = {
  reply: string;
  intent: string | null;
  source:
    | 'ml-service'
    | 'fallback'
    | 'server-rules'
    | 'database-tools'
    | 'openai'
    | 'gemini';
  confidence: number;
};

type SessionTurn = {
  role: 'user' | 'assistant';
  text: string;
};

type ChatbotRequester = {
  sub: string;
  email: string;
  name: string;
  role: string;
} | null;

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private openAiDisabledUntil = 0;
  private readonly responseCacheTtlMs = 120_000;
  private readonly maxSessionTurns = 6;
  private readonly responseCache = new Map<
    string,
    { expiresAt: number; reply: ChatbotReply }
  >();
  private readonly sessionContext = new Map<string, SessionTurn[]>();

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Donor.name) private readonly donorModel: Model<Donor>,
    @InjectModel(BloodRequest.name)
    private readonly bloodRequestModel: Model<BloodRequest>,
  ) {}

  private getOpenAiApiKey() {
    return this.configService.get<string>('OPENAI_API_KEY') ?? '';
  }

  private getGeminiApiKey() {
    return this.configService.get<string>('GEMINI_API_KEY') ?? '';
  }

  private getOpenAiModel() {
    return this.configService.get<string>('OPENAI_MODEL') ?? 'gpt-4.1-mini';
  }

  private getGeminiModel() {
    return this.configService.get<string>('GEMINI_MODEL') ?? 'gemini-2.0-flash';
  }

  private getGeminiCandidateModels(): string[] {
    const configured = this.getGeminiModel().trim();
    const defaults = ['gemini-2.0-flash', 'gemini-2.5-flash'];
    return [configured, ...defaults].filter((value, index, arr) => {
      return Boolean(value) && arr.indexOf(value) === index;
    });
  }

  private getOpenAiRateLimitCooldownMs() {
    const configuredValue = Number(
      this.configService.get<string>('OPENAI_RATE_LIMIT_COOLDOWN_MS'),
    );

    return Number.isFinite(configuredValue) && configuredValue > 0
      ? configuredValue
      : 60_000;
  }

  private normalizeMessage(text: string) {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private buildCacheKey(
    normalizedMessage: string,
    requester: ChatbotRequester,
  ): string {
    const role = requester?.role?.toLowerCase() ?? 'guest';
    return `${role}::${normalizedMessage}`;
  }

  private getCachedReply(cacheKey: string): ChatbotReply | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) {
      return null;
    }

    if (cached.reply.source === 'fallback') {
      this.responseCache.delete(cacheKey);
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    return cached.reply;
  }

  private setCachedReply(cacheKey: string, reply: ChatbotReply) {
    if (reply.source === 'fallback') {
      return;
    }

    this.responseCache.set(cacheKey, {
      expiresAt: Date.now() + this.responseCacheTtlMs,
      reply,
    });
  }

  private rememberConversation(
    sessionId: string | undefined,
    userMessage: string,
    assistantReply: string,
  ) {
    if (!sessionId) {
      return;
    }

    const previous = this.sessionContext.get(sessionId) ?? [];
    const next = [
      ...previous,
      { role: 'user' as const, text: userMessage },
      { role: 'assistant' as const, text: assistantReply },
    ];

    const maxTurns = this.maxSessionTurns * 2;
    this.sessionContext.set(sessionId, next.slice(-maxTurns));
  }

  private buildSessionContextText(sessionId?: string): string {
    if (!sessionId) {
      return '';
    }

    const turns = this.sessionContext.get(sessionId);
    if (!turns || turns.length === 0) {
      return '';
    }

    return turns
      .map((turn) => `${turn.role === 'user' ? 'User' : 'Assistant'}: ${turn.text}`)
      .join('\n');
  }

  private isOpenAiConfigured() {
    return Boolean(this.getOpenAiApiKey().trim());
  }

  private isGeminiConfigured() {
    return Boolean(this.getGeminiApiKey().trim());
  }

  private extractBloodGroup(text: string): string | null {
    const match = text.match(
      /(?<![A-Za-z0-9])(a\+|a-|b\+|b-|ab\+|ab-|o\+|o-)(?![A-Za-z0-9])/i,
    );
    return match ? match[1].toUpperCase() : null;
  }

  private isBloodGroupUserQuery(text: string): boolean {
    const hasBloodGroup = Boolean(this.extractBloodGroup(text));
    const asksForDonors = /\b(user|users|donor|donors|available)\b/i.test(text);
    return hasBloodGroup && asksForDonors;
  }

  private getCompatibilityReply(bloodGroup: string): string | null {
    const normalized = bloodGroup.toUpperCase();
    const receiveFrom: Record<string, string[]> = {
      'O-': ['O-'],
      'O+': ['O+', 'O-'],
      'A-': ['A-', 'O-'],
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'AB-': ['AB-', 'A-', 'B-', 'O-'],
      'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-'],
    };
    const donateTo: Record<string, string[]> = {
      'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      'O+': ['O+', 'A+', 'B+', 'AB+'],
      'A-': ['A-', 'A+', 'AB-', 'AB+'],
      'A+': ['A+', 'AB+'],
      'B-': ['B-', 'B+', 'AB-', 'AB+'],
      'B+': ['B+', 'AB+'],
      'AB-': ['AB-', 'AB+'],
      'AB+': ['AB+'],
    };

    if (!receiveFrom[normalized] || !donateTo[normalized]) {
      return null;
    }

    return `For blood group ${normalized}, you can typically receive from: ${receiveFrom[
      normalized
    ].join(', ')}. You can donate to: ${donateTo[normalized].join(', ')}.`;
  }

  private async buildDatabaseReply(message: string): Promise<ChatbotReply | null> {
    const text = message.toLowerCase();

    if (/\b(how many|total|number of)\b.*\b(donor|donors)\b/.test(text)) {
      const totalDonors = await this.donorModel.countDocuments({}).exec();
      const availableDonors = await this.donorModel
        .countDocuments({ availability: true })
        .exec();

      return {
        reply: `Currently, there are ${totalDonors} registered donors, and ${availableDonors} are marked as available.`,
        intent: 'donor_count',
        source: 'database-tools',
        confidence: 0.99,
      };
    }

    if (/\b(available|availability)\b.*\b(donor|donors)\b/.test(text)) {
      const bloodGroup = this.extractBloodGroup(text);

      if (bloodGroup) {
        const availableByGroup = await this.donorModel
          .countDocuments({ availability: true, bloodGroup })
          .exec();

        return {
          reply: `There are currently ${availableByGroup} available donors with blood group ${bloodGroup}.`,
          intent: 'available_donors_by_blood_group',
          source: 'database-tools',
          confidence: 0.99,
        };
      }

      const availableDonors = await this.donorModel
        .countDocuments({ availability: true })
        .exec();

      return {
        reply: `There are currently ${availableDonors} available donors in total. Include a blood group like O- or A+ to get a filtered count.`,
        intent: 'available_donors',
        source: 'database-tools',
        confidence: 0.98,
      };
    }

    if (this.isBloodGroupUserQuery(text)) {
      const bloodGroup = this.extractBloodGroup(text);

      if (!bloodGroup) {
        return null;
      }

      const totalByGroup = await this.donorModel
        .countDocuments({ bloodGroup })
        .exec();
      const availableByGroup = await this.donorModel
        .countDocuments({ bloodGroup, availability: true })
        .exec();

      return {
        reply: `For blood group ${bloodGroup}, there are ${totalByGroup} registered donors and ${availableByGroup} currently available donors.`,
        intent: 'blood_group_user_count',
        source: 'database-tools',
        confidence: 0.99,
      };
    }

    if (
      Boolean(this.extractBloodGroup(text)) &&
      /\b(donor|donors|available)\b/.test(text)
    ) {
      const bloodGroup = this.extractBloodGroup(text);
      if (!bloodGroup) {
        return null;
      }

      const totalByGroup = await this.donorModel
        .countDocuments({ bloodGroup })
        .exec();
      const availableByGroup = await this.donorModel
        .countDocuments({ bloodGroup, availability: true })
        .exec();

      return {
        reply: `For ${bloodGroup}, there are ${totalByGroup} registered donors and ${availableByGroup} currently available donors.`,
        intent: 'blood_group_donor_count',
        source: 'database-tools',
        confidence: 0.99,
      };
    }

    if (/\b(urgent|critical|high)\b.*\b(request|requests)\b/.test(text)) {
      const activeUrgentRequests = await this.bloodRequestModel
        .countDocuments({
          status: { $in: ['Pending', 'Accepted'] },
          urgency: { $in: ['Critical', 'High'] },
        })
        .exec();

      return {
        reply: `There are currently ${activeUrgentRequests} active urgent blood requests (Critical or High urgency in Pending/Accepted state).`,
        intent: 'urgent_requests_count',
        source: 'database-tools',
        confidence: 0.99,
      };
    }

    return null;
  }

  private extractOpenAiText(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const maybePayload = payload as {
      output_text?: unknown;
      output?: Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>;
    };

    if (typeof maybePayload.output_text === 'string') {
      return maybePayload.output_text.trim();
    }

    if (Array.isArray(maybePayload.output)) {
      for (const item of maybePayload.output) {
        if (!item || !Array.isArray(item.content)) {
          continue;
        }

        for (const content of item.content) {
          if (
            content?.type === 'output_text' &&
            typeof content.text === 'string'
          ) {
            const text = content.text.trim();
            if (text) {
              return text;
            }
          }
        }
      }
    }

    return '';
  }

  private async askOpenAi(
    message: string,
    sessionId?: string,
  ): Promise<ChatbotReply | null> {
    if (!this.isOpenAiConfigured()) {
      return null;
    }

    if (Date.now() < this.openAiDisabledUntil) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const sessionContext = this.buildSessionContextText(sessionId);

    try {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.getOpenAiApiKey()}`,
        },
        body: JSON.stringify({
          model: this.getOpenAiModel(),
          temperature: 0.2,
          max_output_tokens: 500,
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: 'You are the Blood Donation System assistant. Answer clearly and professionally. Be concise first, then give practical steps. Do not invent live database numbers. If asked for live metrics, explain that live data is handled by system database tools.',
                },
              ],
            },
            ...(sessionContext
              ? [
                  {
                    role: 'system',
                    content: [
                      {
                        type: 'input_text',
                        text: `Conversation context:\n${sessionContext}`,
                      },
                    ],
                  },
                ]
              : []),
            {
              role: 'user',
              content: [
                {
                  type: 'input_text',
                  text: message,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 429) {
          this.openAiDisabledUntil = Date.now() + this.getOpenAiRateLimitCooldownMs();
          this.logger.log(
            `OpenAI rate limited (429). Falling back for ${this.getOpenAiRateLimitCooldownMs()}ms.`,
          );
          return null;
        }

        this.logger.warn(
          `OpenAI service returned ${response.status}. Body: ${errorBody.slice(0, 400)}`,
        );
        return null;
      }

      const payload = (await response.json()) as unknown;
      const reply = this.extractOpenAiText(payload);

      if (!reply) {
        return null;
      }

      return {
        reply,
        intent: null,
        source: 'openai',
        confidence: 0.9,
      };
    } catch (error) {
      this.openAiDisabledUntil = Date.now() + 30_000;
      this.logger.warn(
        `OpenAI unavailable, cooling down for 30000ms and continuing with fallback chain: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractGeminiText(payload: unknown): string {
    if (!payload || typeof payload !== 'object') {
      return '';
    }

    const maybePayload = payload as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    if (!Array.isArray(maybePayload.candidates)) {
      return '';
    }

    for (const candidate of maybePayload.candidates) {
      const parts = candidate?.content?.parts;
      if (!Array.isArray(parts)) {
        continue;
      }

      for (const part of parts) {
        if (typeof part?.text === 'string' && part.text.trim()) {
          return part.text.trim();
        }
      }
    }

    return '';
  }

  private async askGemini(
    message: string,
    sessionId?: string,
  ): Promise<ChatbotReply | null> {
    if (!this.isGeminiConfigured()) {
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const sessionContext = this.buildSessionContextText(sessionId);
    const candidateModels = this.getGeminiCandidateModels();

    try {
      for (const model of candidateModels) {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.getGeminiApiKey()}`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are the Blood Donation System assistant. Answer clearly and professionally. Be concise first, then give practical steps. Do not invent live database numbers. If asked for live metrics, explain that live data is handled by system database tools.\n${
                      sessionContext
                        ? `Conversation context:\n${sessionContext}\n`
                        : ''
                    }User question: ${message}`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 500,
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          this.logger.warn(
            `Gemini model ${model} returned ${response.status}. Body: ${errorBody.slice(0, 400)}`,
          );
          continue;
        }

        const payload = (await response.json()) as unknown;
        const reply = this.extractGeminiText(payload);

        if (!reply) {
          continue;
        }

        return {
          reply,
          intent: null,
          source: 'gemini',
          confidence: 0.9,
        };
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Gemini unavailable, continuing fallback chain: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildFallback(message: string): ChatbotReply {
    if (!message?.trim()) {
      return {
        reply: 'Please type your question so I can help.',
        intent: null,
        source: 'fallback',
        confidence: 0.0,
      };
    }

    return {
      reply:
        'I can help with blood donation guidance, donor eligibility, blood requests, recipient flow, campaigns, and platform usage. Please share a specific question.',
      intent: null,
      source: 'fallback',
      confidence: 0.2,
    };
  }

  private buildRuleBasedReply(message: string): ChatbotReply | null {
    const text = message.toLowerCase();

    if (
      /\b(hello|helo|hi|hey|good morning|good afternoon|good evening|how are you|how r you)\b/.test(
        text,
      )
    ) {
      return {
        reply:
          'Hello. I am doing well and ready to help. You can ask about donor eligibility, blood request flow, donation interval, blood group compatibility, or campaign support.',
        intent: 'greeting',
        source: 'server-rules',
        confidence: 0.96,
      };
    }

    if (
      /\b(important|rare|critical|universal|best)\b.*\b(blood|group|type)\b|\bwhich blood group is important\b/.test(
        text,
      )
    ) {
      return {
        reply:
          'No blood group is universally more important than others, but O- is often crucial in emergencies because it can be used for many recipients. AB plasma is also widely compatible for plasma transfusion. In practice, the most important group is the one currently needed by a patient.',
        intent: 'blood_group_importance',
        source: 'server-rules',
        confidence: 0.95,
      };
    }

    if (
      /\b(compatible|compatibility|match|use|receive|donate to|can i use)\b.*\b(blood|group|type)\b|\bblood group.*\b(can i use|compatible|match)\b/.test(
        text,
      )
    ) {
      const bloodGroup = this.extractBloodGroup(text);
      if (bloodGroup) {
        const reply = this.getCompatibilityReply(bloodGroup);
        if (reply) {
          return {
            reply,
            intent: 'blood_group_compatibility',
            source: 'server-rules',
            confidence: 0.95,
          };
        }
      }
    }

    if (
      /\b(how|can|could|may|ways?|steps?)\b.*\b(donate|donation)\b|\bhow i can donate\b|\bhow can i donate\b/.test(
        text,
      )
    ) {
      return {
        reply:
          'To donate blood: 1) complete donor profile and eligibility details, 2) choose appointment location/time, 3) pass basic health screening, 4) donate, and 5) rest and hydrate. If you want, I can guide you step-by-step based on your profile.',
        intent: 'donation_process',
        source: 'server-rules',
        confidence: 0.95,
      };
    }

    if (
      /\b(expensive|costly|price|cost)\b.*\b(blood|group|type)\b|\bwhich blood group is expensive\b/.test(
        text,
      )
    ) {
      return {
        reply:
          'Blood should not be sold commercially. In legitimate blood bank workflows, charges are generally for processing, testing, storage, and logistics, not for the blood group itself. Availability can vary by group (for example O- is often more constrained), but pricing policy depends on regulated medical providers.',
        intent: 'blood_pricing_policy',
        source: 'server-rules',
        confidence: 0.96,
      };
    }

    if (/\bwho can donate\b|\beligible\b.*\bdonate\b/.test(text)) {
      return {
        reply:
          'General eligibility includes age 18-65, healthy condition, safe hemoglobin range, and a proper interval since last donation. Final eligibility is confirmed by medical screening.',
        intent: 'donation_eligibility',
        source: 'server-rules',
        confidence: 0.95,
      };
    }

    if (/\bhow\b.*\brequest\b.*\bblood\b|\brequest blood\b/.test(text)) {
      return {
        reply:
          'To request blood, submit patient details, hospital, blood type, required units, urgency, and contact number in the request form. The system then routes and tracks the request status.',
        intent: 'request_blood',
        source: 'server-rules',
        confidence: 0.95,
      };
    }

    if (/\bhow often\b.*\bdonate\b|\binterval\b.*\bdonation\b/.test(text)) {
      return {
        reply:
          'For many donors, whole blood donation is allowed around every 3 months, but exact rules can vary by policy and medical advice.',
        intent: 'donation_frequency',
        source: 'server-rules',
        confidence: 0.95,
      };
    }

    return null;
  }

  private finalizeReply(
    dto: AskChatbotDto,
    message: string,
    cacheKey: string,
    reply: ChatbotReply,
  ): ChatbotReply {
    this.setCachedReply(cacheKey, reply);
    this.rememberConversation(dto.sessionId, message, reply.reply);
    return reply;
  }

  async ask(
    dto: AskChatbotDto,
    requester: ChatbotRequester = null,
  ): Promise<ChatbotReply> {
    const message = dto.message?.trim();
    if (!message) {
      return this.buildFallback('');
    }

    const normalizedMessage = this.normalizeMessage(message);
    const cacheKey = this.buildCacheKey(normalizedMessage, requester);

    // Always compute database answers live so metrics stay current.
    const databaseReply = await this.buildDatabaseReply(message);
    if (databaseReply) {
      return this.finalizeReply(dto, message, cacheKey, databaseReply);
    }

    const cachedReply = this.getCachedReply(cacheKey);
    if (cachedReply) {
      return cachedReply;
    }

    const openAiReply = await this.askOpenAi(message, dto.sessionId);
    if (openAiReply) {
      return this.finalizeReply(dto, message, cacheKey, openAiReply);
    }

    const geminiReply = await this.askGemini(message, dto.sessionId);
    if (geminiReply) {
      return this.finalizeReply(dto, message, cacheKey, geminiReply);
    }

    const serverRuleReply = this.buildRuleBasedReply(message);
    if (serverRuleReply) {
      return this.finalizeReply(dto, message, cacheKey, serverRuleReply);
    }

    return this.finalizeReply(dto, message, cacheKey, this.buildFallback(message));
  }
}
