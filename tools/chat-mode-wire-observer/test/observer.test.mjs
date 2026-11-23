import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import vm from "node:vm";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const code = readFileSync(join(root, "observer-main.js"), "utf8");

function harness() {
  const records = [];
  const location = { origin: "https://chatgpt.com", href: "https://chatgpt.com/" };
  let calls = 0;
  const win = {
    fetch: async () => { calls++; return { status: 200 }; },
    postMessage: event => records.push(event),
  };
  const context = vm.createContext({
    window: win, location, URL, Headers, Request, Reflect,
    performance: { now: () => 10 }, Date, Promise,
    XMLHttpRequest: undefined,
  });
  vm.runInContext(code, context);
  return { win, records, getCalls: () => calls };
}
const settle = async () => { for (let i = 0; i < 7; i++) await Promise.resolve(); };

test("captures Chat POST without storing prompts or credentials", async () => {
  const h = harness();
  await h.win.fetch("/backend-api/f/conversation", {
    method: "POST",
    headers: { Authorization: "Bearer NEVER_EXPORT_ME", "openai-sentinel-token": "SECRET" },
    body: JSON.stringify({
      model: "gpt-6-thinking",
      thinking_effort: "extended",
      conversation_mode: { kind: "primary_assistant" },
      messages: [{ content: { parts: ["PRIVATE_PROMPT_NEVER_SAVE"] } }],
    }),
  });
  await settle();
  assert.equal(h.getCalls(), 1);
  assert.equal(h.records.length, 1);
  const record = h.records[0].record;
  assert.equal(record.endpoint, "/backend-api/f/conversation");
  assert.equal(record.model, "gpt-6-thinking");
  assert.equal(record.thinkingEffort, "extended");
  assert.equal(record.status, 200);
  assert.equal(record.conversationMode, "primary_assistant");
  const dumped = JSON.stringify(record);
  assert.ok(!dumped.includes("PRIVATE_PROMPT_NEVER_SAVE"));
  assert.ok(!dumped.includes("NEVER_EXPORT_ME"));
  assert.ok(!dumped.includes("SECRET"));
});

test("ignores Work paths, other origins and GET calls", async () => {
  const h = harness();
  await h.win.fetch("/backend-api/codex/responses", { method: "POST", body: "{}" });
  await h.win.fetch("https://example.com/backend-api/f/conversation", { method: "POST" });
  await h.win.fetch("/backend-api/f/conversation", { method: "GET" });
  await settle();
  assert.equal(h.getCalls(), 3);
  assert.equal(h.records.length, 0);
});

test("recognizes older normal Chat path", async () => {
  const h = harness();
  await h.win.fetch("https://chatgpt.com/backend-api/conversation", {
    method: "POST",
    body: JSON.stringify({model:"gpt-6"}),
  });
  await settle();
  assert.equal(h.records.length,1);
  assert.equal(h.records[0].record.endpoint,"/backend-api/conversation");
});

test("does not break original fetch return value", async () => {
  const h = harness();
  const response = await h.win.fetch("/backend-api/f/conversation", { method:"POST" });
  assert.equal(response.status,200);
});