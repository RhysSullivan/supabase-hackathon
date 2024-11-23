"use client";

import type { Message } from "ai";
import cx from "classnames";
import { motion } from "framer-motion";
import { SparklesIcon } from "./icons";
import { Markdown } from "./markdown";
import { MessageActions } from "./message-actions";
import { Weather } from "./weather";

import SuperJSON from "superjson";
import { GenericTable } from "./table";

function Tool(props: { toolName: string; result: any }) {
  const { toolName, result } = props;
  if (toolName === "getData") {
    const json = SuperJSON.parse(result) as Record<
      string,
      string | number | bigint
    >[];
    return <GenericTable data={json} />;
  }
  if (toolName === "getWeather") {
    return <Weather weatherAtLocation={result} />;
  }
  return <pre>{JSON.stringify(result, null, 2)}</pre>;
}

export const PreviewMessage = ({
  message,
  isLoading,
}: {
  message: Message;
  isLoading: boolean;
}) => {
  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message"
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      data-role={message.role}
    >
      <div
        className={cx(
          "group-data-[role=user]/message:bg-primary group-data-[role=user]/message:text-primary-foreground flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl"
        )}
      >
        {message.role === "assistant" && (
          <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
            <SparklesIcon size={14} />
          </div>
        )}

        <div className="flex flex-col gap-2 w-full">
          {message.content && (
            <div className="flex flex-col gap-4">
              <Markdown>{message.content as string}</Markdown>
            </div>
          )}

          {message.toolInvocations && message.toolInvocations.length > 0 && (
            <div className="flex flex-col gap-4">
              {message.toolInvocations.map((toolInvocation) => {
                const { toolName, toolCallId, state, args } = toolInvocation;

                if (state === "result") {
                  const { result } = toolInvocation;

                  return (
                    <div key={toolCallId}>
                      <Tool toolName={toolName} result={result} />
                    </div>
                  );
                }
                return (
                  <div
                    key={toolCallId}
                    className={cx({
                      skeleton: ["getWeather"].includes(toolName),
                    })}
                  >
                    {toolName === "getWeather" ? <Weather /> : null}
                  </div>
                );
              })}
            </div>
          )}

          <MessageActions
            key={`action-${message.id}`}
            message={message}
            isLoading={isLoading}
          />
        </div>
      </div>
    </motion.div>
  );
};

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cx(
          "flex gap-4 group-data-[role=user]/message:px-3 w-full group-data-[role=user]/message:w-fit group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:py-2 rounded-xl",
          {
            "group-data-[role=user]/message:bg-muted": true,
          }
        )}
      >
        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border">
          <SparklesIcon size={14} />
        </div>

        <div className="flex flex-col gap-2 w-full">
          <div className="flex flex-col gap-4 text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>
    </motion.div>
  );
};
