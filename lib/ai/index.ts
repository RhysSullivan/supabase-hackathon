import { anthropic } from '@ai-sdk/anthropic';
import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';

import { customMiddleware } from './custom-middleware';
type AnthropicMessagesModelId =
  | 'claude-3-5-sonnet-latest'
  | 'claude-3-5-sonnet-20241022'
  | 'claude-3-5-sonnet-20240620'
  | 'claude-3-5-haiku-latest'
  | 'claude-3-5-haiku-20241022'
  | 'claude-3-opus-latest'
  | 'claude-3-opus-20240229'
  | 'claude-3-sonnet-20240229'
  | 'claude-3-haiku-20240307';
export const customModel = (
  id: AnthropicMessagesModelId = 'claude-3-5-sonnet-latest',
) => {
  return wrapLanguageModel({
    model: anthropic(id),
    middleware: customMiddleware,
  });
};
