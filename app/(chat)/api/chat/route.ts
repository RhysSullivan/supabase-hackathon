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
import superjson from 'superjson';

export const maxDuration = 60;

type AllowedTools = 'getWeather' | 'getData';

const weatherTools: AllowedTools[] = ['getWeather', 'getData'];

const allTools: AllowedTools[] = [...weatherTools];

export async function POST(request: Request) {
  const {
    messages,
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
          console.log('Get data - Searching for:', query);
          const db = await Database.create(':memory:');
          console.log('Get data - Created DB');
          const csvUrl =
            'https://spwogmmcqrgmnfmscszi.supabase.co/storage/v1/object/public/data/csv/traffic-1.csv';
          console.log('Get data - Creating table');

          await db
            .run(
              `CREATE TEMPORARY TABLE temp_table AS SELECT * FROM read_csv_auto('${csvUrl}', sample_size=-1)`,
            )
            .catch((error) => {
              console.error('Get data - Error creating table:', error);
            });
          console.log('Get data - Created table');
          const schema = await db.all('DESCRIBE temp_table');
          const smallSchema = JSON.stringify(schema, null, 0);
          console.log('Get data - Creating SQL');
          const sql = await generateObject({
            model: customModel('claude-3-opus-20240229'),
            schema: z.object({
              sql: z.string(),
            }),
            prompt: `
            The schema of the table is:
            
            ${smallSchema} 
            
            the table is named temp_table. 
            
            Generate a SQL query that answers the question: ${query}
            
            Apply aliases to the columns in the query to make it more readable.
            i.e accident_count -> Accident Count
            `,
          });
          console.log('Get data - SQL:', sql.object.sql);
          const data = await db.all(sql.object.sql);
          console.log('Get data - Data:', data);
          return superjson.stringify(data);
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
