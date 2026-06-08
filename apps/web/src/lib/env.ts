import { z } from "zod";

export const env = z
  .object({
    VITE_SERVER_URL: z.url().default("http://localhost:3000"),
  })
  .parse(import.meta.env);
