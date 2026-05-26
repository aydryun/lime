"use client";

import {
  DoorOpen,
  Hash,
  LogOut,
  MessageSquare,
  MoreVertical,
  Plus,
  Send,
  Settings,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChannelMembersDialog } from "@/components/channel-members-dialog";
import { OwnerLeaveDialog } from "@/components/owner-leave-dialog";
import { ModeToggle } from "@/components/theme-selector";
import { apiUrl } from "@/lib/api";
import { type AuthUser, clearStoredUser, getStoredUser } from "@/lib/auth";
import {
  type Channel,
  type ChannelMessage,
  createChannel,
  fetchChannels,
  fetchMessages,
  removeMember,
  renameChannel,
  sendMessage,
} from "@/lib/channels";

type ViewMode = "personal" | "channels";

export default function ChatPage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("channels");
  const [user, setUser] = useState<AuthUser | null>(null);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [ownerLeaveOpen, setOwnerLeaveOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  const loadChannels = useCallback(async (): Promise<Channel[]> => {
    try {
      const list = await fetchChannels();
      setChannels(list);
      return list;
    } catch (e) {
      setError((e as Error).message);
      return [];
    }
  }, []);

  useEffect(() => {
    loadChannels().then((list) => {
      if (list.length > 0) {
        setActiveChannelId((current) => current ?? list[0].id);
      }
    });
  }, [loadChannels]);

  const loadMessages = useCallback(async (channelId: number) => {
    try {
      const list = await fetchMessages(channelId);
      setMessages(list);
    } catch (e) {
      setError((e as Error).message);
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    if (activeChannelId != null) {
      loadMessages(activeChannelId);
    } else {
      setMessages([]);
    }
  }, [activeChannelId, loadMessages]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on every new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort
    }
    clearStoredUser();
    router.replace("/login");
    router.refresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const channel = await createChannel(name);
      setChannels((prev) => [...prev, channel]);
      setActiveChannelId(channel.id);
      setNewName("");
      setCreating(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (renamingId == null) return;
    const name = renameValue.trim();
    if (!name) return;
    try {
      const updated = await renameChannel(renamingId, name);
      setChannels((prev) =>
        prev.map((c) =>
          c.id === updated.id ? { ...c, name: updated.name } : c,
        ),
      );
      setRenamingId(null);
      setRenameValue("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const removeActiveChannelLocally = () => {
    if (activeChannelId == null) return;
    setChannels((prev) => {
      const remaining = prev.filter((c) => c.id !== activeChannelId);
      setActiveChannelId(remaining[0]?.id ?? null);
      return remaining;
    });
  };

  const handleLeave = async () => {
    if (activeChannelId == null || user == null) return;
    setMenuOpen(false);
    if (activeChannel?.my_role === "canal_owner") {
      setOwnerLeaveOpen(true);
      return;
    }
    if (!confirm("Quitter ce canal ?")) return;
    try {
      await removeMember(activeChannelId, user.id);
      removeActiveChannelLocally();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChannelId == null) return;
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const message = await sendMessage(activeChannelId, content);
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;
  const listTitle = viewMode === "channels" ? "Canaux" : "Messages privées";
  const displayName = user?.username ?? "...";
  const initials = user
    ? `${user.firstname.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase()
    : "...";

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* 1. Primary Sidebar (Server/Mode Selector) */}
      <div className="w-16 flex flex-col items-center py-4 bg-sidebar border-r border-border gap-4 z-20 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-2">
          <div className="w-6 h-6 rounded-full bg-primary" />
        </div>

        <div className="w-8 h-[2px] bg-border rounded-full my-2" />

        <button
          type="button"
          aria-label="Afficher les salons"
          onClick={() => setViewMode("channels")}
          className={`w-12 h-12 flex items-center justify-center transition-all ${
            viewMode === "channels"
              ? "bg-primary text-primary-foreground rounded-xl"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:rounded-xl rounded-2xl"
          }`}
          title="Channels"
        >
          <Hash className="w-6 h-6" />
        </button>

        <button
          type="button"
          aria-label="Afficher les messages privées"
          onClick={() => setViewMode("personal")}
          className={`w-12 h-12 flex items-center justify-center transition-all ${
            viewMode === "personal"
              ? "bg-primary text-primary-foreground rounded-xl"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:rounded-xl rounded-2xl"
          }`}
          title="Direct Messages"
        >
          <MessageSquare className="w-6 h-6" />
        </button>

        <div className="flex-1" />

        <div className="pb-4 flex flex-col gap-4 items-center">
          <ModeToggle />

          <button
            type="button"
            onClick={() => router.push("/settings")}
            title="Paramètres"
            aria-label="Paramètres"
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
          >
            <Settings className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title="Se déconnecter"
            aria-label="Se déconnecter"
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 2. Secondary Sidebar (List) */}
      <div className="w-64 bg-sidebar/50 border-r border-border flex flex-col z-10 shrink-0">
        <div className="h-14 border-b border-border flex items-center justify-between px-4 font-semibold shadow-sm">
          <span>{listTitle}</span>
          {viewMode === "channels" && (
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              aria-label="Créer un canal"
              title="Créer un canal"
              className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {viewMode === "channels" && creating && (
          <form
            onSubmit={handleCreate}
            className="px-3 py-2 border-b border-border bg-background/50"
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nom du canal"
              className="w-full px-2 py-1.5 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="px-3 py-1 text-xs rounded-md bg-primary text-primary-foreground hover:opacity-90"
              >
                Créer
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="px-3 py-1 text-xs rounded-md text-muted-foreground hover:bg-muted"
              >
                Annuler
              </button>
            </div>
          </form>
        )}

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {viewMode === "channels" ? (
            channels.length === 0 ? (
              <div className="text-xs text-muted-foreground px-2 py-1">
                Aucun canal. Cliquez sur + pour en créer un.
              </div>
            ) : (
              channels.map((channel) =>
                renamingId === channel.id ? (
                  <form
                    key={channel.id}
                    onSubmit={handleRename}
                    className="px-2"
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => setRenamingId(null)}
                      className="w-full px-2 py-1 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    key={channel.id}
                    onClick={() => setActiveChannelId(channel.id)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-sm text-left ${
                      activeChannelId === channel.id
                        ? "bg-muted text-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Hash className="w-4 h-4 opacity-70" />
                    <span className="truncate">{channel.name}</span>
                  </button>
                ),
              )
            )
          ) : (
            <div className="text-xs text-muted-foreground px-2 py-1">
              Messages privés non disponibles pour le moment.
            </div>
          )}
        </div>

        <div className="h-16 border-t border-border bg-sidebar flex items-center px-4 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-xs text-muted-foreground truncate">Online</div>
          </div>
        </div>
      </div>

      {/* 3. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Chat Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-2 font-semibold">
            <Hash className="w-5 h-5 text-muted-foreground" />
            {activeChannel?.name ?? "Sélectionnez un canal"}
          </div>
          {activeChannel && (
            <div className="relative">
              <button
                type="button"
                aria-label="Options du canal"
                onClick={() => setMenuOpen((v) => !v)}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Fermer le menu"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-0 cursor-default bg-transparent"
                  />
                  <div
                    role="menu"
                    className="absolute right-0 mt-1 w-56 rounded-md border border-border bg-background shadow-lg z-10"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMembersOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      {activeChannel.my_role === "canal_member"
                        ? "Voir les membres"
                        : "Gérer les membres"}
                    </button>
                    {activeChannel.my_role === "canal_owner" && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(activeChannel.id);
                          setRenameValue(activeChannel.name);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4" />
                        Renommer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleLeave}
                      className="w-full text-left px-3 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
                    >
                      {activeChannel.my_role === "canal_owner" ? (
                        <Trash2 className="w-4 h-4" />
                      ) : (
                        <DoorOpen className="w-4 h-4" />
                      )}
                      Quitter le canal
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="px-6 py-2 text-sm text-destructive bg-destructive/10 border-b border-border flex justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeChannel == null ? (
            <div className="text-muted-foreground text-sm">
              Sélectionnez ou créez un canal pour commencer.
            </div>
          ) : messages.length === 0 ? (
            <div className="text-muted-foreground text-sm">
              Aucun message dans ce canal.
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 shrink-0 flex items-center justify-center text-primary font-medium text-sm mt-0.5">
                  {msg.sender.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm">{msg.sender}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="text-foreground/90 text-sm whitespace-pre-wrap wrap-break-word">
                    {msg.content}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="p-4 pt-0 shrink-0">
          <form
            onSubmit={handleSend}
            className="bg-muted/50 rounded-lg flex items-center p-2 focus-within:ring-1 focus-within:ring-primary border border-border/50 focus-within:border-primary transition-all"
          >
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!activeChannel || sending === true}
              placeholder={
                activeChannel
                  ? `Message #${activeChannel.name}`
                  : "Sélectionnez un canal"
              }
              className="flex-1 bg-transparent border-none outline-none px-3 text-foreground placeholder:text-muted-foreground h-10 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={
                !activeChannel || sending === true || draft.trim() === ""
              }
              aria-label="Envoyer le message"
              className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {membersOpen && activeChannel && (
        <ChannelMembersDialog
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          currentUserId={user?.id ?? null}
          callerRole={activeChannel.my_role}
          onClose={() => setMembersOpen(false)}
        />
      )}

      {ownerLeaveOpen && activeChannel && user && (
        <OwnerLeaveDialog
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          currentUserId={user.id}
          onClose={() => setOwnerLeaveOpen(false)}
          onDone={() => {
            setOwnerLeaveOpen(false);
            removeActiveChannelLocally();
          }}
        />
      )}
    </div>
  );
}
