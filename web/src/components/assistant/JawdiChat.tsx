"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Box, type BoxProps, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { Check, Mic, Send, Sparkles, X } from "lucide-react";
import {
  useChatMutation,
  useConfirmActionMutation,
  type ChatTurn,
  type Risk,
} from "@/store/api/assistantApi";
import { aurora, glass } from "./aurora";

/* ------------------------------------------------------------------ model */

type Kind = "ANSWER" | "DRAFT" | "CLARIFICATION";
type DraftStatus = "pending" | "confirmed" | "cancelled" | "expired";

interface Msg {
  id: string;
  role: "user" | "assistant";
  kind?: Kind;
  text?: string;
  action?: string | null;
  summary?: string | null;
  risk?: Risk | null;
  claimId?: string | null;
  status?: DraftStatus;
}

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

/**
 * Flexbox wrapper with a Stack-like API (default column, like MUI Stack) — MUI
 * v9's Stack drops alignItems/gap as props, so this keeps the call sites terse
 * and valid. Composes its own layout sx first, then the caller's sx.
 */
interface FlexProps extends Omit<BoxProps, "gap"> {
  direction?: "row" | "column";
  alignItems?: string;
  justifyContent?: string;
  flexWrap?: "wrap" | "nowrap";
  gap?: number;
}
function Flex({ direction = "column", alignItems, justifyContent, flexWrap, gap, sx, ...rest }: FlexProps) {
  return (
    <Box
      sx={[
        { display: "flex", flexDirection: direction, alignItems, justifyContent, flexWrap, gap },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
      {...rest}
    />
  );
}

/** Map the rendered thread to the API shape (role + text only). */
function toThread(messages: Msg[]): ChatTurn[] {
  return messages
    .map((m) => ({ role: m.role, text: (m.text ?? m.summary ?? "").trim() }))
    .filter((t) => t.text.length > 0)
    .slice(-40);
}

const RISK: Record<Risk, { label: string; color: string }> = {
  LOW: { label: "À confirmer", color: aurora.primary },
  MEDIUM: { label: "À vérifier", color: aurora.amber },
  HIGH: { label: "Attention", color: aurora.secondary },
};

const SUGGESTIONS = [
  "Comment va mon élevage ?",
  "Mon stock d'aliment",
  "Résultat du mois",
  "Qui me doit de l'argent ?",
  "Vaccins à faire cette semaine",
];

/* ------------------------------------------------------------- animations */

// Cast to string: at runtime these stay Keyframes objects (so emotion still
// injects the @keyframes rule when interpolated), but typed as string they
// satisfy sx's `animation` shorthand without a template-literal-type mismatch.
const rise = keyframes`from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; }` as unknown as string;
const blink = keyframes`0%, 80%, 100% { opacity: 0.25; } 40% { opacity: 1; }` as unknown as string;
const halo = keyframes`0%, 100% { opacity: 0.55; } 50% { opacity: 0.9; }` as unknown as string;

/* ---------------------------------------------------------------- speech */

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

/* ================================================================ chat */

export function JawdiChat({ farmId, unitId = null }: { farmId: number; unitId?: number | null }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [chat, { isLoading }] = useChatMutation();
  const [confirmAction] = useConfirmActionMutation();

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const supportsVoice =
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || isLoading) return;
      const withUser = [...messages, { id: uid(), role: "user" as const, text }];
      setMessages(withUser);
      setInput("");
      try {
        const res = await chat({ farmId, messages: toThread(withUser), unitId }).unwrap();
        const reply: Msg =
          res.kind === "DRAFT"
            ? {
                id: uid(),
                role: "assistant",
                kind: "DRAFT",
                action: res.action,
                summary: res.summary,
                risk: res.risk ?? "MEDIUM",
                claimId: res.claimId,
                status: "pending",
              }
            : { id: uid(), role: "assistant", kind: res.kind, text: res.message ?? "" };
        setMessages((m) => [...m, reply]);
      } catch {
        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", kind: "CLARIFICATION", text: "Connexion interrompue. Réessayez." },
        ]);
      }
    },
    [chat, farmId, unitId, isLoading, messages],
  );

  const confirm = useCallback(
    async (msg: Msg) => {
      if (!msg.claimId) return;
      try {
        const r = await confirmAction({ farmId, claimId: msg.claimId }).unwrap();
        setMessages((ms) =>
          ms
            .map((x) => (x.id === msg.id ? { ...x, status: "confirmed" as DraftStatus } : x))
            .concat({ id: uid(), role: "assistant", kind: "ANSWER", text: `Enregistré : ${r.summary}` }),
        );
      } catch {
        setMessages((ms) =>
          ms.map((x) => (x.id === msg.id ? { ...x, status: "expired" as DraftStatus } : x)),
        );
      }
    },
    [confirmAction, farmId],
  );

  const cancel = (msg: Msg) =>
    setMessages((ms) => ms.map((x) => (x.id === msg.id ? { ...x, status: "cancelled" } : x)));

  const toggleVoice = useCallback(() => {
    if (!supportsVoice) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    rec.onresult = (e) => {
      const results = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>);
      const transcript = results.map((r) => r[0].transcript).join("");
      setInput(transcript);
      if (results.length && results[results.length - 1].isFinal) {
        setListening(false);
        rec.stop();
        void send(transcript);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    setListening(true);
    rec.start();
  }, [listening, supportsVoice, send]);

  const empty = messages.length === 0;

  return (
    <Box
      sx={{
        position: "relative",
        m: { xs: -2, sm: -3, md: -4 },
        height: { xs: "calc(100dvh - 60px)", md: "calc(100dvh - 64px)" },
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: aurora.bg,
        color: aurora.onSurface,
        fontFamily: aurora.sans,
      }}
    >
      <Halos />

      {/* Header */}
      <Flex
        direction="row"
        alignItems="center"
        gap={1.5}
        sx={{
          position: "relative",
          px: { xs: 2, md: 3 },
          py: 1.5,
          borderBottom: `1px solid ${aurora.border}`,
          backdropFilter: "blur(12px)",
        }}
      >
        <Avatar glow />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.1 }}>Jawdi IA</Typography>
          <Flex direction="row" alignItems="center" gap={0.75}>
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: aurora.primary, boxShadow: `0 0 8px ${aurora.primary}` }} />
            <Typography sx={{ fontSize: "0.78rem", color: aurora.onVariant }}>
              Conseiller d&apos;élevage · en ligne
            </Typography>
          </Flex>
        </Box>
      </Flex>

      {/* Thread */}
      <Box sx={{ position: "relative", flex: 1, overflowY: "auto", px: { xs: 2, md: 3 }, py: 3 }}>
        <Box sx={{ maxWidth: 860, mx: "auto" }}>
          {empty ? (
            <Welcome onPick={send} />
          ) : (
            <Flex gap={2.5}>
              {messages.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} text={m.text ?? ""} />
                ) : m.kind === "DRAFT" ? (
                  <DraftCard key={m.id} msg={m} onConfirm={() => confirm(m)} onCancel={() => cancel(m)} />
                ) : (
                  <AssistantBubble key={m.id} text={m.text ?? ""} />
                ),
              )}
              {isLoading && <Thinking />}
              <div ref={endRef} />
            </Flex>
          )}
        </Box>
      </Box>

      {/* Input */}
      <Box sx={{ position: "relative", px: { xs: 2, md: 3 }, pt: 1, pb: { xs: 2, md: 2.5 } }}>
        <Box sx={{ maxWidth: 860, mx: "auto" }}>
          {!empty && (
            <Flex direction="row" gap={1} sx={{ overflowX: "auto", pb: 1.25, "&::-webkit-scrollbar": { display: "none" } }}>
              {SUGGESTIONS.map((s) => (
                <Chip key={s} label={s} onClick={() => send(s)} />
              ))}
            </Flex>
          )}
          <Flex
            direction="row"
            alignItems="flex-end"
            gap={1}
            sx={[glass(28), { p: 0.75, pl: 2 }]}
          >
            <Box
              component="textarea"
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={listening ? "Je vous écoute…" : "Posez une question ou dictez une action…"}
              rows={1}
              sx={{
                flex: 1,
                resize: "none",
                border: "none",
                outline: "none",
                background: "transparent",
                color: aurora.onSurface,
                fontFamily: aurora.sans,
                fontSize: "1rem",
                lineHeight: 1.5,
                py: 1.25,
                maxHeight: 120,
                "&::placeholder": { color: aurora.onVariant },
              }}
            />
            {supportsVoice && <MicButton listening={listening} onClick={toggleVoice} />}
            <SendButton disabled={!input.trim() || isLoading} onClick={() => void send(input)} />
          </Flex>
          <Typography sx={{ mt: 1, textAlign: "center", fontSize: "0.7rem", color: aurora.onVariant }}>
            Jawdi s&apos;appuie sur vos données réelles. Vérifiez toujours avant d&apos;enregistrer une action.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/* ============================================================ subcomponents */

function Halos() {
  return (
    <>
      <Box
        sx={{
          position: "absolute",
          top: -160,
          left: -120,
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${aurora.primaryDeep}55 0%, transparent 68%)`,
          filter: "blur(40px)",
          animation: `${halo} 9s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -200,
          right: -140,
          width: 560,
          height: 560,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${aurora.secondary}33 0%, transparent 66%)`,
          filter: "blur(48px)",
          animation: `${halo} 11s ease-in-out infinite`,
          pointerEvents: "none",
        }}
      />
    </>
  );
}

function Avatar({ glow = false }: { glow?: boolean }) {
  return (
    <Box
      sx={{
        flexShrink: 0,
        width: 40,
        height: 40,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background: `linear-gradient(135deg, ${aurora.primaryDeep}, ${aurora.primary})`,
        boxShadow: glow ? `0 0 18px ${aurora.primary}66` : "none",
      }}
    >
      <Sparkles size={20} color={aurora.onPrimary} strokeWidth={2.4} />
    </Box>
  );
}

function Welcome({ onPick }: { onPick: (s: string) => void }) {
  return (
    <Flex alignItems="center" gap={2.5} sx={{ py: { xs: 6, md: 10 }, textAlign: "center", animation: `${rise} 0.5s ease` }}>
      <Box sx={{ transform: "scale(1.6)", mb: 1 }}>
        <Avatar glow />
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: { xs: "1.6rem", md: "2rem" }, lineHeight: 1.15, maxWidth: 520 }}>
        Bonjour, je suis Jawdi.
      </Typography>
      <Typography sx={{ color: aurora.onVariant, fontSize: "1rem", maxWidth: 440 }}>
        Votre conseiller d&apos;élevage. Posez-moi une question sur votre ferme, ou dictez une action —
        je m&apos;appuie sur vos données réelles.
      </Typography>
      <Flex direction="row" flexWrap="wrap" justifyContent="center" gap={1} sx={{ mt: 1, maxWidth: 600 }}>
        {SUGGESTIONS.map((s) => (
          <Chip key={s} label={s} onClick={() => onPick(s)} />
        ))}
      </Flex>
    </Flex>
  );
}

function Chip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      sx={{
        flexShrink: 0,
        cursor: "pointer",
        whiteSpace: "nowrap",
        px: 1.75,
        py: 0.9,
        borderRadius: 999,
        background: aurora.glass,
        border: `1px solid ${aurora.border}`,
        color: aurora.onSurface,
        fontFamily: aurora.sans,
        fontSize: "0.85rem",
        transition: "all 0.15s",
        "&:hover": { background: aurora.glassStrong, borderColor: aurora.primary, boxShadow: `0 0 14px ${aurora.primaryDeep}44` },
      }}
    >
      {label}
    </Box>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", animation: `${rise} 0.35s ease` }}>
      <Box
        sx={{
          maxWidth: "80%",
          px: 2,
          py: 1.25,
          borderRadius: "20px 20px 6px 20px",
          background: `linear-gradient(135deg, ${aurora.primaryDeep}, ${aurora.primary})`,
          color: aurora.onPrimary,
          fontWeight: 500,
          whiteSpace: "pre-wrap",
          boxShadow: `0 6px 20px ${aurora.primaryDeep}44`,
        }}
      >
        {text}
      </Box>
    </Box>
  );
}

function AssistantBubble({ text }: { text: string }) {
  return (
    <Flex direction="row" gap={1.5} sx={{ animation: `${rise} 0.35s ease` }}>
      <Avatar />
      <Box
        sx={[
          glass(20),
          {
            maxWidth: "82%",
            px: 2,
            py: 1.4,
            borderTopLeftRadius: 6,
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
          },
        ]}
      >
        {text}
      </Box>
    </Flex>
  );
}

function DraftCard({ msg, onConfirm, onCancel }: { msg: Msg; onConfirm: () => void; onCancel: () => void }) {
  const risk = RISK[msg.risk ?? "MEDIUM"];
  const done = msg.status && msg.status !== "pending";
  return (
    <Flex direction="row" gap={1.5} sx={{ animation: `${rise} 0.35s ease` }}>
      <Avatar />
      <Box sx={[glass(20), { maxWidth: "82%", borderTopLeftRadius: 6, overflow: "hidden", flex: 1 }]}>
        <Box sx={{ px: 2, pt: 1.75, pb: 1.5 }}>
          <Flex direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
            <Box
              sx={{
                px: 1,
                py: 0.3,
                borderRadius: 999,
                border: `1px solid ${risk.color}`,
                color: risk.color,
                fontFamily: aurora.mono,
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {risk.label}
            </Box>
            <Typography sx={{ fontFamily: aurora.mono, fontSize: "0.7rem", color: aurora.onVariant }}>
              {msg.action}
            </Typography>
          </Flex>
          <Typography sx={{ fontSize: "1.05rem", fontWeight: 600, lineHeight: 1.35 }}>{msg.summary}</Typography>
        </Box>

        {done ? (
          <Box
            sx={{
              px: 2,
              py: 1.25,
              borderTop: `1px solid ${aurora.border}`,
              fontSize: "0.85rem",
              color:
                msg.status === "confirmed"
                  ? aurora.primary
                  : msg.status === "expired"
                    ? aurora.danger
                    : aurora.onVariant,
            }}
          >
            {msg.status === "confirmed"
              ? "✓ Enregistré"
              : msg.status === "expired"
                ? "Expiré — reformulez pour réessayer"
                : "Annulé"}
          </Box>
        ) : (
          <Flex direction="row" gap={1} sx={{ px: 2, pb: 1.75 }}>
            <Box
              component="button"
              onClick={onConfirm}
              sx={{
                cursor: "pointer",
                flex: 1,
                py: 1.1,
                borderRadius: 14,
                border: "none",
                background: aurora.primary,
                color: aurora.onPrimary,
                fontFamily: aurora.sans,
                fontWeight: 700,
                fontSize: "0.95rem",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0.75,
                boxShadow: `0 0 20px ${aurora.primary}55`,
                transition: "filter 0.15s",
                "&:hover": { filter: "brightness(1.08)" },
              }}
            >
              <Check size={18} strokeWidth={3} /> Confirmer
            </Box>
            <Box
              component="button"
              onClick={onCancel}
              sx={{
                cursor: "pointer",
                py: 1.1,
                px: 2,
                borderRadius: 14,
                background: aurora.glass,
                border: `1px solid ${aurora.border}`,
                color: aurora.onVariant,
                fontFamily: aurora.sans,
                fontWeight: 600,
                fontSize: "0.95rem",
                display: "inline-flex",
                alignItems: "center",
                gap: 0.5,
                "&:hover": { background: aurora.glassStrong },
              }}
            >
              <X size={16} /> Annuler
            </Box>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}

function Thinking() {
  return (
    <Flex direction="row" gap={1.5} sx={{ animation: `${rise} 0.3s ease` }}>
      <Avatar />
      <Flex direction="row" alignItems="center" gap={0.6} sx={[glass(16), { px: 2, py: 1.5, borderTopLeftRadius: 6 }]}>
        {[0, 1, 2].map((i) => (
          <Box
            key={i}
            sx={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              bgcolor: aurora.primary,
              animation: `${blink} 1.3s ${i * 0.18}s infinite ease-in-out`,
            }}
          />
        ))}
      </Flex>
    </Flex>
  );
}

function MicButton({ listening, onClick }: { listening: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      aria-label="Dicter"
      sx={{
        cursor: "pointer",
        flexShrink: 0,
        width: 46,
        height: 46,
        borderRadius: "50%",
        border: "none",
        display: "grid",
        placeItems: "center",
        color: listening ? aurora.onPrimary : aurora.onSurface,
        background: listening ? aurora.secondary : aurora.glass,
        boxShadow: listening ? `0 0 0 6px ${aurora.secondary}33, 0 0 22px ${aurora.secondary}88` : "none",
        transition: "all 0.2s",
        "&:hover": { background: listening ? aurora.secondary : aurora.glassStrong },
        ...(listening ? { animation: `${halo} 1.4s ease-in-out infinite` } : {}),
      }}
    >
      <Mic size={20} />
    </Box>
  );
}

function SendButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <Box
      component="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Envoyer"
      sx={{
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        width: 46,
        height: 46,
        borderRadius: "50%",
        border: "none",
        display: "grid",
        placeItems: "center",
        color: aurora.onPrimary,
        background: aurora.primary,
        opacity: disabled ? 0.4 : 1,
        boxShadow: disabled ? "none" : `0 0 18px ${aurora.primary}66`,
        transition: "all 0.2s",
        "&:hover": { filter: disabled ? "none" : "brightness(1.08)" },
      }}
    >
      <Send size={19} />
    </Box>
  );
}
