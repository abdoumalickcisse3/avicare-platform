"use client";

import { Box } from "@mui/material";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { aurora } from "./aurora";

/**
 * Renders a Jawdi answer as Markdown (GFM: tables, lists, emphasis) styled to
 * the light-glass advisor theme — so the assistant can develop an analysis with
 * bold figures, bullet points and tables, like a real chat. Element components
 * map to Box so every node is theme-styled and tables scroll on their own.
 */
const components: Components = {
  p: ({ children }) => <Box component="p" sx={{ m: 0, mb: 1, "&:last-child": { mb: 0 }, lineHeight: 1.6 }}>{children}</Box>,
  strong: ({ children }) => <Box component="strong" sx={{ fontWeight: 700, color: aurora.primaryDeep }}>{children}</Box>,
  em: ({ children }) => <Box component="em" sx={{ fontStyle: "italic" }}>{children}</Box>,
  h1: ({ children }) => <Box component="h3" sx={{ m: 0, mt: 1, mb: 0.5, fontSize: "1.15rem", fontWeight: 700 }}>{children}</Box>,
  h2: ({ children }) => <Box component="h4" sx={{ m: 0, mt: 1, mb: 0.5, fontSize: "1.05rem", fontWeight: 700 }}>{children}</Box>,
  h3: ({ children }) => <Box component="h5" sx={{ m: 0, mt: 1, mb: 0.5, fontSize: "0.98rem", fontWeight: 700 }}>{children}</Box>,
  ul: ({ children }) => <Box component="ul" sx={{ m: 0, mb: 1, pl: 2.5 }}>{children}</Box>,
  ol: ({ children }) => <Box component="ol" sx={{ m: 0, mb: 1, pl: 2.5 }}>{children}</Box>,
  li: ({ children }) => <Box component="li" sx={{ mb: 0.25, lineHeight: 1.55 }}>{children}</Box>,
  a: ({ children, href }) => (
    <Box component="a" href={href} target="_blank" rel="noreferrer" sx={{ color: aurora.primaryDeep, textDecoration: "underline" }}>
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box component="blockquote" sx={{ m: 0, my: 1, pl: 1.5, borderLeft: `3px solid ${aurora.primary}`, color: aurora.onVariant }}>
      {children}
    </Box>
  ),
  code: ({ children }) => (
    <Box component="code" sx={{ fontFamily: aurora.mono, fontSize: "0.85em", bgcolor: "rgba(36,85,36,0.08)", px: 0.5, py: 0.1, borderRadius: 0.75 }}>
      {children}
    </Box>
  ),
  table: ({ children }) => (
    <Box sx={{ overflowX: "auto", my: 1, borderRadius: 1.5, border: `1px solid ${aurora.borderSoft}` }}>
      <Box component="table" sx={{ borderCollapse: "collapse", width: "100%", fontSize: "0.88rem" }}>{children}</Box>
    </Box>
  ),
  thead: ({ children }) => <Box component="thead" sx={{ bgcolor: "rgba(36,85,36,0.07)" }}>{children}</Box>,
  th: ({ children }) => (
    <Box component="th" sx={{ textAlign: "left", fontWeight: 700, px: 1.25, py: 0.75, borderBottom: `1px solid ${aurora.borderSoft}`, whiteSpace: "nowrap" }}>
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box component="td" sx={{ px: 1.25, py: 0.6, borderTop: `1px solid ${aurora.borderSoft}`, fontVariantNumeric: "tabular-nums" }}>
      {children}
    </Box>
  ),
};

export function MarkdownView({ text }: { text: string }) {
  return (
    <Box sx={{ "& > *:first-of-type": { mt: 0 } }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </Box>
  );
}
