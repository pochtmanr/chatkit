# @holylabs/chatkit-mcp

Local stdio MCP server for [HolyLabs ChatKit](https://chat-admin.holylabs.dev).
Connects MCP-aware AI tools (Claude Code, Claude Desktop, Cursor) to
your ChatKit conversations so the AI can read, reply, and update
statuses.

## Install

```bash
# global, once:
npm install -g @holylabs/chatkit-mcp

# or use ad-hoc with npx:
npx @holylabs/chatkit-mcp
```

## Get an MCP access key

1. Sign in to <https://chat-admin.holylabs.dev>.
2. Open **Settings → MCP**.
3. Click **New key**, name it (e.g. `My laptop`), and copy the
   `mcp_live_…` value shown. You won't see it again.

## Set the env var

```bash
export CHATKIT_MCP_KEY=mcp_live_abcd1234abcd1234abcd1234abcd1234
```

If you're self-hosting ChatKit, also set:

```bash
export CHATKIT_BASE_URL=https://your-chat-admin.example.com
```

## Configure your MCP client

### Claude Code

Add to `~/.claude/mcp.json` (or your project-level `./.mcp.json`):

```json
{
  "mcpServers": {
    "chatkit": {
      "command": "npx",
      "args": ["-y", "@holylabs/chatkit-mcp"],
      "env": {
        "CHATKIT_MCP_KEY": "mcp_live_…"
      }
    }
  }
}
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "chatkit": {
      "command": "npx",
      "args": ["-y", "@holylabs/chatkit-mcp"],
      "env": { "CHATKIT_MCP_KEY": "mcp_live_…" }
    }
  }
}
```

Restart Claude Desktop. The 🔧 icon should show ChatKit tools.

### Cursor

Cursor settings → MCP → "Add new MCP server" → command:
`npx -y @holylabs/chatkit-mcp`, with `CHATKIT_MCP_KEY` set in the
env section.

## Tools

| Tool                  | Purpose                                                       |
|-----------------------|---------------------------------------------------------------|
| `list_businesses`     | Businesses this key has access to (always one).               |
| `list_inboxes`        | Active inboxes in the business.                               |
| `list_conversations`  | Conversations filtered by inbox / status.                     |
| `get_conversation`    | Conversation + 50 most recent messages.                       |
| `list_messages`       | Paginated message history.                                    |
| `send_reply`          | Post a reply as the agent.                                    |
| `change_status`       | Update conversation status (new/active/waiting_*/done/transferred). |
| `list_chat_users`     | End-users (customers). PII.                                   |
| `get_stats`           | Aggregate stats for a date range.                             |
| `search_messages`     | Substring search across message bodies.                       |

## Example prompts

> Open Claude Code and ask:
>
> - "List my chatkit conversations that are waiting on us, sorted by oldest first."
> - "Show me conversation `<id>` and draft a polite reply."
> - "Search my conversations for 'refund' and summarise the top 5."

## Troubleshooting

- **"missing or malformed Authorization header"** — set `CHATKIT_MCP_KEY`.
- **"invalid key"** — the key was revoked or deleted. Create a new
  one in Settings → MCP.
- **Tool calls hang** — the server connects to the chat-admin host
  on each call. Check `CHATKIT_BASE_URL` is reachable.

## Security

- Treat your MCP key like a password. Anyone with it can read and
  reply to every conversation in your business.
- Revoke compromised keys immediately in Settings → MCP.
- Keys are never stored on Anthropic servers — they live on your
  machine in the env config above.

## License

MIT. See `LICENSE` in the repo.
