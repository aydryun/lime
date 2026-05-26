"use client";

import { Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type ChannelMember,
  deleteChannel,
  fetchMembers,
  transferOwnership,
} from "@/lib/channels";

type Props = {
  channelId: number;
  channelName: string;
  currentUserId: number;
  onClose: () => void;
  onDone: () => void;
};

export function OwnerLeaveDialog({
  channelId,
  channelName,
  currentUserId,
  onClose,
  onDone,
}: Props) {
  const [members, setMembers] = useState<ChannelMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMembers(channelId)
      .then((m) => {
        if (!cancelled) setMembers(m);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  const handleTransfer = async (newOwnerId: number) => {
    setBusy(true);
    setError(null);
    try {
      await transferOwnership(channelId, newOwnerId);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement #${channelName} pour tous ?`))
      return;
    setBusy(true);
    setError(null);
    try {
      await deleteChannel(channelId);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Quitter le canal ${channelName}`}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="font-semibold">Quitter #{channelName}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="px-4 py-2 text-sm text-destructive border-b border-border">
            {error}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : otherMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Vous êtes seul dans ce canal. Quitter supprimera le canal.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Vous êtes propriétaire. Choisissez un nouveau propriétaire pour
                le canal, ou supprimez-le pour tous.
              </p>
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-2">
                  Transférer à
                </div>
                <ul className="space-y-1">
                  {otherMembers.map((m) => (
                    <li
                      key={m.user_id}
                      className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">
                          {m.firstname} {m.lastname}{" "}
                          <span className="text-muted-foreground font-normal">
                            @{m.username}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleTransfer(m.user_id)}
                        className="text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        Transférer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="text-sm px-3 py-2 rounded-md text-destructive hover:bg-destructive/10 flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer le canal
          </button>
        </div>
      </div>
    </div>
  );
}
