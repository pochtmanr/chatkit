// Round 5 reserves this surface so customer/agent boundaries are
// visible in code review. Full agent embed implementation lands in
// Round 6 with session-backed auth. See
// prompts/round-5-authenticated-widget-brief.md §"Phase 4: Agent
// Embed Security" for the planned scope.
export const dynamic = "force-static";

export default function AgentInboxNotImplemented() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        background: "#fafafa",
        color: "#18181b",
      }}
    >
      <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
        /embed/inbox is reserved for Round 6
      </h1>
      <p style={{ fontSize: 13, color: "#71717a", maxWidth: 480 }}>
        The agent embed inbox surface is intentionally not implemented in
        this build. See{" "}
        <code>prompts/round-5-authenticated-widget-brief.md</code> §&ldquo;Phase
        4: Agent Embed Security&rdquo; for the planned scope. Customers should
        use <code>/embed/customer</code> instead.
      </p>
    </div>
  );
}
