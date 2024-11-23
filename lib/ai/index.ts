import { anthropic } from '@ai-sdk/anthropic';
import { experimental_wrapLanguageModel as wrapLanguageModel } from 'ai';

import { customMiddleware } from './custom-middleware';

export const customModel = () => {
  return wrapLanguageModel({
    model: anthropic('claude-3-5-sonnet-20241022'),
    middleware: customMiddleware,
  });
};
