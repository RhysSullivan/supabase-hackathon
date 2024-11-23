import {
  type Message,
  StreamData,
  convertToCoreMessages,
  generateObject,
  streamText,
} from 'ai';
import { z } from 'zod';
import { customModel } from '@/lib/ai';
import { systemPrompt } from '@/lib/ai/prompts';
import { getMostRecentUserMessage } from '@/lib/utils';
import { Database } from 'duckdb-async';

export const maxDuration = 60;

type AllowedTools = 'getWeather' | 'getData';

const weatherTools: AllowedTools[] = ['getWeather', 'getData'];

const allTools: AllowedTools[] = [...weatherTools];

export async function POST(request: Request) {
  const {
    id,
    messages,
    modelId,
  }: { id: string; messages: Array<Message>; modelId: string } =
    await request.json();

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const streamingData = new StreamData();

  const result = await streamText({
    model: customModel(),
    system: systemPrompt,
    messages: coreMessages,
    maxSteps: 5,
    experimental_activeTools: allTools,
    tools: {
      getWeather: {
        description: 'Get the current weather at a location',
        parameters: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        execute: async ({ latitude, longitude }) => {
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
          );

          const weatherData = await response.json();
          return weatherData;
        },
      },
      getData: {
        description: 'Question about city data',
        parameters: z.object({
          query: z.string(),
        }),
        execute: async ({ query }) => {
          const db = await Database.create(':memory:');
          await db.run(
            `CREATE TEMPORARY TABLE temp_table AS SELECT * FROM read_csv_auto('https://spwogmmcqrgmnfmscszi.supabase.co/storage/v1/object/public/data/csv/traffic.csv', sample_size=-1)`,
          );
          const schema = await db.all('DESCRIBE temp_table');
          const smallSchema = JSON.stringify(schema, null, 0);
          const sql = await generateObject({
            model: customModel('claude-3-opus-20240229'),
            schema: z.object({
              sql: z.string(),
            }),
            prompt: `The schema of the table is ${smallSchema} the table is named temp_table. Generate a SQL query that answers the question: ${query}`,
          });
          const data = await db.all(sql.object.sql);
          console.log(data);
          return data;
        },
      },
    },
    onFinish: async ({ responseMessages }) => {
      streamingData.close();
    },
    experimental_telemetry: {
      isEnabled: true,
      functionId: 'stream-text',
    },
  });

  return result.toDataStreamResponse({
    data: streamingData,
  });
}
