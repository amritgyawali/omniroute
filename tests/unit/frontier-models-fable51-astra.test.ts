import test from "node:test";
import assert from "node:assert/strict";

import { anthropicProvider } from "../../open-sse/config/providers/registry/anthropic/index.ts";
import { claudeProvider } from "../../open-sse/config/providers/registry/claude/index.ts";
import { codexProvider } from "../../open-sse/config/providers/registry/codex/index.ts";
import { openaiProvider } from "../../open-sse/config/providers/registry/openai/index.ts";
import { getModelSpec } from "../../src/shared/constants/modelSpecs.ts";
import { DEFAULT_PRICING } from "../../src/shared/constants/pricing.ts";
import { extendCodexGpt56EffortValues } from "../../src/shared/reasoning/effortStandardization.ts";

test("Fable 5.1 and Fable 5 are both exposed by first-party Anthropic providers", () => {
  for (const provider of [claudeProvider, anthropicProvider]) {
    const models = provider.models;
    const fable51 = models.find((model) => model.id === "claude-fable-5.1");

    assert.ok(fable51, `${provider.id} must expose claude-fable-5.1`);
    assert.equal(fable51.contextLength, 1000000);
    assert.equal(fable51.maxOutputTokens, 128000);
    assert.ok(models.some((model) => model.id === "claude-fable-5"));
    assert.equal(
      models.some((model) => model.id === "claude-fable-5-1"),
      false,
      `${provider.id} must preserve the upstream dot in claude-fable-5.1`
    );
  }

  const spec = getModelSpec("claude-fable-5.1");
  assert.equal(spec?.adaptiveThinkingOnly, true);
  assert.equal(spec?.rejectsThinkingDisabled, true);
  assert.equal(spec?.rejectsForcedToolChoice, true);
  assert.equal(spec?.supportsVision, true);
});

test("GPT-6 Astra is exposed through OpenAI API and Codex OAuth with correct limits", () => {
  const apiModel = openaiProvider.models.find((model) => model.id === "gpt-6-astra");
  assert.ok(apiModel);
  assert.equal(apiModel.targetFormat, "openai-responses");
  assert.equal(apiModel.contextLength, 1050000);
  assert.equal(apiModel.maxOutputTokens, 128000);

  const codexModels = codexProvider.models;
  for (const suffix of ["", "-ultra", "-max", "-xhigh", "-high", "-medium", "-low"]) {
    const model = codexModels.find((entry) => entry.id === `gpt-6-astra${suffix}`);
    assert.ok(model, `codex must expose gpt-6-astra${suffix}`);
    assert.equal(model.contextLength, 272000);
    assert.equal(model.targetFormat, "openai-responses");
  }

  assert.deepEqual(extendCodexGpt56EffortValues("codex", "gpt-6-astra", ["low"]), [
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
    "ultra",
  ]);
});

test("Fable 5.1 and GPT-6 Astra pricing is registered for direct and OAuth routes", () => {
  const pricing = DEFAULT_PRICING as Record<
    string,
    Record<string, { input: number; output: number; cached?: number }>
  >;

  for (const [provider, model] of [
    ["anthropic", "claude-fable-5.1"],
    ["cc", "claude-fable-5.1"],
    ["openai", "gpt-6-astra"],
    ["cx", "gpt-6-astra"],
  ] as const) {
    assert.equal(pricing[provider][model].input, 10);
    assert.equal(pricing[provider][model].output, 50);
  }

  assert.equal(pricing.anthropic["claude-fable-5.1"].cached, 0.25);
  assert.equal(pricing.openai["gpt-6-astra"].cached, 1);
});
