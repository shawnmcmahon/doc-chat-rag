type UsageTotals = {
  inputTokens: number;
  outputTokens: number;
  requests: number;
};

const totals: UsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  requests: 0,
};

export function logTokenUsage(inputTokens: number, outputTokens: number): void {
  totals.inputTokens += inputTokens;
  totals.outputTokens += outputTokens;
  totals.requests += 1;

  console.info("[token-usage]", {
    inputTokens,
    outputTokens,
    instanceTotals: { ...totals },
  });
}

export function getTokenUsageTotals(): UsageTotals {
  return { ...totals };
}
