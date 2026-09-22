export interface LlmGenerateInput {
  system: string;
  user: string;
}

export interface LlmProvider {
  generate: (input: LlmGenerateInput) => Promise<string>;
}
