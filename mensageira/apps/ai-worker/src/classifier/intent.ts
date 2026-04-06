import Anthropic from '@anthropic-ai/sdk';
import { AI_CONFIDENCE_THRESHOLD } from '@mensageira/shared';
import pino from 'pino';

const logger = pino({ level: 'info' });

interface ClassificationResult {
  action: 'respond' | 'transfer_human' | 'stop' | 'notify_human';
  scoreDelta: number;
  scoreReason: string;
  confidence: number;
}

export class IntentClassifier {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async classify(message: string, classificationPrompt: string): Promise<ClassificationResult> {
    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        system: classificationPrompt,
        messages: [{ role: 'user', content: message }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const parsed = JSON.parse(text);

      return {
        action: parsed.action || 'notify_human',
        scoreDelta: parsed.scoreDelta || 0,
        scoreReason: parsed.scoreReason || 'classification',
        confidence: parsed.action ? 0.8 : 0.5,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Classification failed');
      return {
        action: 'notify_human',
        scoreDelta: 0,
        scoreReason: 'classification_error',
        confidence: 0,
      };
    }
  }
}

export class ResponseGenerator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(
    systemPrompt: string,
    conversationHistory: Array<{ sender: string; content: string }>,
    latestMessage: string,
  ): Promise<{ content: string; confidence: number }> {
    const messages: Anthropic.MessageParam[] = [];

    for (const msg of conversationHistory.slice(-10)) {
      messages.push({
        role: msg.sender === 'lead' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
    messages.push({ role: 'user', content: latestMessage });

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: systemPrompt,
        messages,
      });

      const content = response.content[0].type === 'text' ? response.content[0].text : '';
      return { content, confidence: content.length > 0 ? 0.85 : 0.3 };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Response generation failed');
      return { content: '', confidence: 0 };
    }
  }
}
