import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { messages } = await request.json();


  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    system: 'You are a friendly assistant!',
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    messages,
    maxSteps: 5,
  });
  return result.toDataStreamResponse();
}