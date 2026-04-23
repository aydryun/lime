"use client";

import {
  Bell,
  Hash,
  MessageSquare,
  Search,
  Send,
  Settings,
  Users,
} from "lucide-react";
import { useState } from "react";
import { ModeToggle } from "@/components/theme-selector";

type ViewMode = "personal" | "channels";

export default function ChatLayout() {
  const [viewMode, setViewMode] = useState<ViewMode>("channels");

  // Dummy data
  const channels = ["general", "hors-sujets", "annonces", "developpement"];
  const directMessages = [
    "Alice Smith",
    "Bob Jones",
    "Charlie Brown",
    "Diana Prince",
  ];
  const messages = [
    {
      id: 1,
      user: "Alice",
      time: "10:30 AM",
      text: "Salut tout le monde! Comment le projet se porte il ?",
    },
    {
      id: 2,
      user: "Bob",
      time: "10:32 AM",
      text: "Bien ! Je travail sur la layout des canaux.",
    },
    {
      id: 3,
      user: "Charlie",
      time: "10:35 AM",
      text: "J'aime bien, surtout la selection de thème.",
    },
  ];

  const currentList = viewMode === "channels" ? channels : directMessages;
  const listTitle = viewMode === "channels" ? "Canaux" : "Messages privées";

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
          className={`w-12 h-12 flex items-center justify-center transition-all ${viewMode === "channels"
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
          className={`w-12 h-12 flex items-center justify-center transition-all ${viewMode === "personal"
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
            aria-label="Changer de thème"
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted transition-all"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 2. Secondary Sidebar (List) */}
      <div className="w-64 bg-sidebar/50 border-r border-border flex flex-col z-10 shrink-0">
        <div className="h-14 border-b border-border flex items-center px-4 font-semibold shadow-sm">
          {listTitle}
        </div>
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {currentList.map((item) => (
            <button
              type="button"
              key={item}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm text-left"
            >
              {viewMode === "channels" ? (
                <Hash className="w-4 h-4 opacity-70" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                  {item.charAt(0)}
                </div>
              )}
              <span className="truncate">{item}</span>
            </button>
          ))}
        </div>
        <div className="h-16 border-t border-border bg-sidebar flex items-center px-4 gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm shrink-0">
            ME
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">My Username</div>
            <div className="text-xs text-muted-foreground truncate">Online</div>
          </div>
        </div>
      </div>

      {/* 3. Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Chat Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-2 font-semibold">
            {viewMode === "channels" ? (
              <Hash className="w-5 h-5 text-muted-foreground" />
            ) : (
              <Users className="w-5 h-5 text-muted-foreground" />
            )}
            {viewMode === "channels" ? "general" : "Alice Smith"}
          </div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <Bell className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
            <Search className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className="flex gap-4 group">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center text-primary font-medium mt-1">
                {msg.user.charAt(0)}
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold">{msg.user}</span>
                  <span className="text-xs text-muted-foreground">
                    {msg.time}
                  </span>
                </div>
                <div className="text-foreground/90 mt-1 leading-relaxed">
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 pt-0 shrink-0">
          <div className="bg-muted/50 rounded-lg flex items-center p-2 focus-within:ring-1 focus-within:ring-primary border border-border/50 focus-within:border-primary transition-all">
            <input
              type="text"
              placeholder={`Message ${viewMode === "channels" ? "#general" : "@Alice Smith"}`}
              className="flex-1 bg-transparent border-none outline-none px-3 text-foreground placeholder:text-muted-foreground h-10"
            />
            <button
              type="button"
              aria-label="Envouyer le message"
              className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
