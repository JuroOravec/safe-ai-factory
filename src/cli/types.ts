import type { CommandDef, ParsedArgs } from 'citty';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ParsedArgsFromCommand<T extends CommandDef<any>> = ParsedArgs<
  T extends CommandDef<infer U> ? U : never
>;
