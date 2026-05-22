"use client";

import { useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { buttonStyles, type ButtonStyle } from "./_lib/theme";

export function ThreadComposer({
  onSend,
  onSendImage,
  onTyping,
  isSending,
  isUploading,
  primaryColor,
  buttonStyle,
}: {
  onSend: (body: string) => Promise<void>;
  onSendImage: (file: File) => Promise<void>;
  onTyping: () => void;
  isSending: boolean;
  isUploading: boolean;
  primaryColor: string;
  buttonStyle: ButtonStyle;
}) {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const body = text.trim();
    if (!body || isSending) return;
    await onSend(body);
    setText("");
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void onSendImage(f);
    e.target.value = "";
  };

  const sendBtnStyle = buttonStyles(buttonStyle, primaryColor, "var(--hl-radius)");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="border-t border-zinc-200 bg-white px-3 py-2 flex items-end gap-2"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onPickFile}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isSending || isUploading}
        aria-label="Attach image"
        title="Attach image"
        className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 disabled:opacity-40"
      >
        <Paperclip className="h-4 w-4" />
      </button>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.length > 0) onTyping();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder="Type a reply…"
        rows={1}
        className="flex-1 resize-none rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-400 max-h-20"
      />
      <button
        type="submit"
        disabled={!text.trim() || isSending}
        className="px-3 py-1.5 text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1"
        style={sendBtnStyle}
      >
        <Send className="h-3 w-3" />
        {isSending ? "…" : "Send"}
      </button>
    </form>
  );
}
