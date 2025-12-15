import Anthropic from '@anthropic-ai/sdk';
import { Session, Idea, AgentMessage } from '@glacier-photo-vault/shared';
import { v4 as uuidv4 } from 'uuid';

export class AIAgentService {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Analyze a new idea and provide suggestions
   */
  async analyzeAndSuggest(session: Session, newIdea: Idea): Promise<AgentMessage | null> {
    try {
      const context = this.buildContext(session);

      const prompt = `あなたはブレインストーミングのファシリテーターです。
参加者が新しいアイディアを提出しました。

現在のアイディア一覧:
${context}

新しいアイディア: "${newIdea.content}"

このアイディアに対して以下のいずれかを行ってください:
1. 類似するアイディアがあれば指摘し、グループ化を提案する
2. アイディアを深掘りする質問をする
3. 新しい視点や発展的な提案をする

回答は簡潔に1-2文で、創造性を刺激するような内容にしてください。`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return {
          id: uuidv4(),
          userId: 'ai-agent',
          type: 'suggestion',
          content: content.text,
          timestamp: Date.now(),
          relatedIdeaIds: [newIdea.id]
        };
      }

      return null;
    } catch (error) {
      console.error('Error in AI analysis:', error);
      return null;
    }
  }

  /**
   * Provide general facilitation for the session
   */
  async provideFacilitation(session: Session): Promise<AgentMessage | null> {
    try {
      const context = this.buildContext(session);

      const prompt = `あなたはブレインストーミングのファシリテーターです。

現在のアイディア一覧:
${context}

セッション全体を見て、以下のいずれかを行ってください:
1. 新しい切り口や視点を提案する
2. まだ議論されていない領域を指摘する
3. アイディア同士の新しい組み合わせを提案する
4. 議論を活性化させる質問をする

回答は簡潔に1-2文で、参加者の創造性を刺激するような内容にしてください。`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return {
          id: uuidv4(),
          userId: 'ai-agent',
          type: 'question',
          content: content.text,
          timestamp: Date.now()
        };
      }

      return null;
    } catch (error) {
      console.error('Error in AI facilitation:', error);
      return null;
    }
  }

  /**
   * Analyze ideas and suggest groupings
   */
  async suggestGroupings(session: Session): Promise<{ name: string; ideaIds: string[] }[]> {
    try {
      const context = session.ideas.map((idea: Idea, idx: number) =>
        `${idx + 1}. [ID: ${idea.id}] ${idea.content}`
      ).join('\n');

      const prompt = `以下のアイディアを類似性に基づいてグループ化してください。

アイディア一覧:
${context}

JSON形式で回答してください:
[
  {
    "name": "グループ名",
    "ideaIds": ["idea-id-1", "idea-id-2"]
  }
]`;

      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = message.content[0];
      if (content.type === 'text') {
        // Parse JSON response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      }

      return [];
    } catch (error) {
      console.error('Error in AI grouping:', error);
      return [];
    }
  }

  private buildContext(session: Session): string {
    if (session.ideas.length === 0) {
      return '(まだアイディアがありません)';
    }

    return session.ideas
      .map((idea: Idea, idx: number) => `${idx + 1}. ${idea.content}`)
      .join('\n');
  }
}
