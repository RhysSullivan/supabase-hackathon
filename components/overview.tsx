import { motion } from "framer-motion";
import Link from "next/link";

export const Overview = () => {
  return (
    <motion.div
      key="overview"
      className="max-w-3xl mx-auto md:mt-20"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: 0.5 }}
    >
      <div className="rounded-xl p-6 flex flex-col gap-8 leading-relaxed text-center max-w-xl">
        <p>
          This is a chatbot for data about San Francisco. It leverages data from
          the{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://data.sfgov.org/"
            target="_blank"
          >
            SF Open Data Portal
          </Link>{" "}
          to answer questions about the city.
        </p>
        <p>
          Check out the{" "}
          <Link
            className="font-medium underline underline-offset-4"
            href="https://github.com/RhysSullivan/supabase-hackathon"
            target="_blank"
          >
            source code
          </Link>
          . Thank you to Supabase, Anthropic, and Browserbase for providing
          credits to build this project.
        </p>
      </div>
    </motion.div>
  );
};
