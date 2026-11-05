import { z } from "zod";

// Strip control chars & collapse whitespace; reject angle brackets-heavy markup via React escaping on client too.
const clean = (s: string) =>
  s.replace(/[\u0000-\u001f\u007f​-‏‪-‮]/g, " ").replace(/\s+/g, " ").trim();

const field = (max: number) =>
  z.string().transform(clean).pipe(z.string().min(1, "Required").max(max, `Max ${max} characters`));

export const joinSchema = z.object({
  name: field(40),
  title: field(60),
  description: field(160),
});

export type JoinInput = z.infer<typeof joinSchema>;
