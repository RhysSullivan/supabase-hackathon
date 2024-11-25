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
import { env } from '@/env';
import { VoyageAIClient } from 'voyageai';
import { createServerClient } from '@supabase/ssr';

export type DatasetMetadata = {
  // Basic identifiers
  id: string;
  created_at: string; // ISO 8601 datetime string

  // Vector data (high-dimensional arrays)
  description_vector: string; // String representation of numeric array
  title_vector: string; // String representation of numeric array

  // Content fields
  title: string;
  description: string;

  // URLs and file paths
  url: string;
  csv_filepath: string | null;
  csv_url: string;

  // Enhanced fields
  llm_enhanced_title: string;
};

export const maxDuration = 60;
const client = new VoyageAIClient({ apiKey: env.VOYAGE_API_KEY });
const supabase = createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  {
    cookies: {
      async getAll() {
        return [];
      },
      async setAll(cookiesToSet) {},
    },
  },
);
// Extract tool implementations to get their return types
async function executeWeatherTool({
  latitude,
  longitude,
}: { latitude: number; longitude: number }) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`,
  );
  return response.json();
}

async function executeDataTool({ query }: { query: string }) {
  console.log('Get data - Searching for:', query);
  const db = await Database.create(':memory:');
  console.log('Get data - Created DB');
  const datasets = await executeSearchDatasetsTool({
    query,
    matchCount: 1,
  });
  const dataset = datasets.at(0);
  console.log('Get data - Dataset:', dataset?.title);

  if (!dataset) {
    console.log('Did not find', dataset);
    throw new Error('No dataset found');
  }
  const csvUrl = `https://spwogmmcqrgmnfmscszi.supabase.co/storage/v1/object/public/data/csv/${dataset.id}.csv`;
  console.log('Get data - Creating table for', dataset.title);
  await db
    .run(
      `CREATE TEMPORARY TABLE temp_table AS SELECT * FROM read_csv_auto('${csvUrl}', sample_size=-1, ignore_errors=true)`,
    )
    .catch((error) => {
      console.error('Get data - Error creating table:', error);
    });
  console.log('Get data - Created table');
  const schema = await db.all('DESCRIBE temp_table');
  const smallSchema = JSON.stringify(schema, null, 0);

  const relevantColumns = await generateObject({
    model: customModel(),
    schema: z.object({
      canAnswer: z.boolean(),
      columns: z.array(z.string()),
      reasoning: z.string(),
    }),
    prompt: `
      Given this table schema:
      ${smallSchema}
      
      And this user question:
      "${query}"

      Can this table answer the question? Return:
      - canAnswer: boolean indicating if the table can answer this question
      - columns: array of column names that would be needed to answer this question
      - reasoning: brief explanation of why the question can or cannot be answered

      Only return true for canAnswer if the table definitely has the required data.
    `,
  });

  const MAX_EXAMPLES = 5; // Configurable maximum number of examples when many unique values exist
  const DISTINCT_THRESHOLD = 50; // Configurable threshold for when to limit examples

  // Modify example collection to only use relevant columns
  const columnExamples = await Promise.all(
    schema
      .filter((column) =>
        relevantColumns.object.columns.includes(column.column_name),
      )
      .map(async (column) => {
        // First, count distinct values
        const countResult = await db.all(
          `SELECT COUNT(DISTINCT "${column.column_name}") as count 
           FROM temp_table 
           WHERE "${column.column_name}" IS NOT NULL`,
        );
        const distinctCount = countResult[0].count;

        // Adjust LIMIT based on distinct count
        const limit =
          distinctCount > DISTINCT_THRESHOLD ? MAX_EXAMPLES : distinctCount;

        const samples = await db.all(
          `SELECT DISTINCT "${column.column_name}" 
           FROM temp_table 
           WHERE "${column.column_name}" IS NOT NULL 
           LIMIT ${limit}`,
        );
        return {
          column: column.column_name,
          examples: samples.map((s) => s[column.column_name]),
        };
      }),
  );

  const examplesText = columnExamples
    .map(
      (col) =>
        `Column "${col.column}" example values:\n${col.examples.join(', ')}`,
    )
    .join('\n\n');

  console.log('Get data - Creating SQL');
  const prompt = `The schema of the table is:

${smallSchema}

The table is named temp_table. 

Relevant columns for this query: ${relevantColumns.object.columns.join(', ')}
Reasoning: ${relevantColumns.object.reasoning}

Example values: ${examplesText}

Generate a SQL query that answers the question: ${query}

SQL Requirements:
1. Use DuckDB dialect only - no SQLite-specific functions
2. Available date/time functions:
   - strftime('%Y', date) for year
   - strftime('%m', date) for month
   - strftime('%Y-%m-%d', date) for full date
   - Do NOT use DATE() function
3. Date comparisons:
   - Use direct string comparisons: date >= '2024-01-01'
   - Or use TRY_CAST(date AS DATE) when needed
4. STRING_AGG limitations:
   - Do not use LIMIT within STRING_AGG()
   - Instead, limit rows in a subquery before aggregating
   - Example: STRING_AGG(col, ', ') FROM (SELECT DISTINCT col FROM table LIMIT 5) t

Column Naming Requirements:
1. Use readable column aliases with proper spacing:
   - accident_count AS "Accident Count"
   - yearly_total AS "Yearly Total"
2. Capitalize important words in aliases
3. Use quotes around aliases with spaces

Data Requirements:
1. Unless specified, focus on aggregate data
2. Add appropriate type casts using TRY_CAST()
3. Round decimal calculations to 2 places using ROUND()
4. Include appropriate filters to handle NULL values
5. When limiting aggregated string results:
   - Apply LIMIT in a subquery before STRING_AGG
   - Never use LIMIT inside STRING_AGG function

The current date is ${new Date().toISOString().split('T')[0]}.

After generating the query, verify:
1. All date functions are DuckDB-compatible
2. Column aliases are properly quoted and readable
3. Appropriate type casting is used
4. No SQLite-specific functions are included
5. All source column names exactly match the provided list
6. Double quotes are used for ALL column names containing spaces
7. STRING_AGG usage follows DuckDB syntax:
   - No LIMIT clause within STRING_AGG
   - Limits applied in subqueries before aggregation

Remember: 
- Column names must match EXACTLY as provided - no underscores, different spacing, or case changes are allowed
- Never use LIMIT inside STRING_AGG - always limit rows in a subquery first`;
  console.log('Get data - Prompt:', prompt);
  const sql = await generateObject({
    model: customModel(),
    schema: z.object({
      sql: z.string(),
    }),
    prompt,
  });
  console.log('Get data - SQL:', sql.object.sql);
  const data = await db.all(sql.object.sql);
  console.log('Get data - Data:', data);
  return {
    data,
    sql: sql.object.sql,
    query,
    dataset: dataset,
  };
}

async function executeSearchDatasetsTool({
  query,
  matchThreshold = -1,
  matchCount = 15,
}: {
  query: string;
  matchThreshold?: number;
  matchCount?: number;
}) {
  console.log('Search datasets - Searching for:', query);
  const embedding = await client.embed({
    model: 'voyage-3',
    input: query,
    inputType: 'query',
  });
  // biome-ignore lint/style/noNonNullAssertion: <explanation>
  const e = embedding.data!.at(0)!.embedding!;
  const { data: matches } = (await supabase.rpc('match_csv_data', {
    query_embedding: e,
    match_threshold: matchThreshold,
    match_count: matchCount,
  })) as { data: DatasetMetadata[] };

  // Add relevance ranking using LLM
  const rankedMatches = await generateObject({
    model: customModel(),
    schema: z.object({
      rankedIndices: z.array(z.number()),
      reasoning: z.string(),
    }),
    prompt: `
      Given this user query: "${query}"
      
      And these datasets:
      ${matches.map((m, i) => `${i}. ${m.title}\nDescription: ${m.description}`).join('\n\n')}

      Return the indices of the datasets reordered by relevance to the query, with the most relevant first.
      Consider both the title and description when determining relevance.
      
      Also provide brief reasoning for the top matches.
    `,
  });

  console.log(
    'Search datasets - Ranking reasoning:',
    rankedMatches.object.reasoning,
  );

  // Reorder matches based on LLM ranking
  const reorderedMatches = rankedMatches.object.rankedIndices.map(
    (i) => matches[i],
  );

  console.log(
    'Search datasets - Ranked matches:',
    reorderedMatches.map((m) => m.title),
  );

  return reorderedMatches.map((m) => {
    const { description_vector, title_vector, ...rest } = m;
    return rest;
  });
}

async function executeListDatasetsTool() {
  const { data } = await supabase.from('sf_csv_data_duplicate').select('*');
  return data?.map((d) => d.title);
}

// Infer tool return types from execute functions
export type ToolReturns = {
  getData: Awaited<ReturnType<typeof executeDataTool>>;
  searchDatasets: Awaited<ReturnType<typeof executeSearchDatasetsTool>>;
  listDatasets: Awaited<ReturnType<typeof executeListDatasetsTool>>;
};

type AllowedTools = keyof ToolReturns;

const weatherTools: AllowedTools[] = [
  'getData',
  'searchDatasets',
  'listDatasets',
];

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
    maxSteps: 1,
    experimental_activeTools: allTools,
    tools: {
      searchDatasets: {
        description:
          'Search for a dataset. Used if the user is just looking for what data sets are available but does not have a specific query',
        parameters: z.object({
          query: z.string(),
          matchThreshold: z.number().optional(),
          matchCount: z.number().optional(),
        }),
        execute: async ({ query, matchThreshold, matchCount }) => {
          try {
            const result = await executeSearchDatasetsTool({
              query,
              matchThreshold,
              matchCount,
            });
            return superjson.stringify(result);
          } catch (error) {
            console.error('Error executing search datasets tool:', error);
            throw error;
          }
        },
      },
      listDatasets: {
        description: 'List all datasets',
        parameters: z.object({}),
        execute: executeListDatasetsTool,
      },
      getData: {
        description:
          'Ask questions about a data set. Used if the user has a query about a specific data set',
        parameters: z.object({
          query: z.string(),
        }),
        execute: async ({ query, dataset }) => {
          try {
            console.log('Get data - Dataset:', dataset);
            const result = await executeDataTool({ query });
            return superjson.stringify(result);
          } catch (error) {
            console.error('Error executing data tool:', error);
            throw error;
          }
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
