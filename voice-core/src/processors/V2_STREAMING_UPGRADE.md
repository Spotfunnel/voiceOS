# V2 Upgrade: Streaming Multi-ASR (Option 1)

## Current V1 Implementation (Hybrid Batch)

- Buffers audio chunks until silence or max duration.
- Sends full buffer to three batch ASR APIs in parallel.
- LLM ranks candidates and emits best transcript.
- Accepts +500ms latency for email/phone only.

Trade-offs:
- Simple and reliable for V1.
- Not true streaming.
- Only critical primitives pay latency/cost.

## V2 Target Architecture (Streaming Multi-ASR)

Goal: retain 75-85% accuracy while meeting latency targets (<300ms P95 for STT).

### Pipeline Refactor

1. Fan-out AudioRawFrame to 3 streaming STT services:
   - DeepgramSTTService (nova-3)
   - AssemblyAISTTService (WebSocket)
   - OpenAISTTService (gpt-4o-transcribe, streaming)
2. Collect 3 final TranscriptionFrames.
3. LLM ranks candidates (gpt-4o-mini).
4. Emit best transcript downstream.

### Components to Add

- MultiASRMerger: collects streaming transcripts per utterance.
- TranscriptCoordinator: waits for final results from all three providers.
- Timeout logic: if a provider fails or times out, rank with remaining candidates.

### Implementation Notes

- Use pipecat-native STT services for each provider.
- Maintain streaming sessions to avoid cold-start latency.
- Keep conditional activation (email/phone only).
- Ensure partial transcript handling does not trigger LLM prematurely.

### Estimated Effort

- 4-6 hours engineering.
- Moderate complexity (pipeline branching + transcript merge).

### Decision Criteria for V2 Upgrade

Upgrade if:
- +500ms latency on critical capture causes user complaints.
- Call volume is high and re-elicitation cost is significant.
- Engineering time is available for streaming refactor.
