export const LIMITS = { name: 40, title: 60, description: 160 } as const;
export type JoinForm = { name: string; title: string; description: string };

export function validateJoin(f: JoinForm): Partial<Record<keyof JoinForm, string>> {
  const errs: Partial<Record<keyof JoinForm, string>> = {};
  (Object.keys(LIMITS) as (keyof JoinForm)[]).forEach((k) => {
    const v = f[k].trim();
    if (!v) errs[k] = "Required";
    else if (v.length > LIMITS[k]) errs[k] = `Max ${LIMITS[k]} characters`;
  });
  return errs;
}
