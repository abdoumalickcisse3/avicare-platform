"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from "@mui/material";
import { ChevronRight } from "lucide-react";
import type { NextStep, NextStepKind } from "@/lib/commercial";
import { colors } from "@/theme/tokens";

export interface DocumentFlowLink {
  label: string;
  href?: string;
  current?: boolean;
}

const mono = {
  fontFamily: "var(--font-mono)",
  fontVariantNumeric: "tabular-nums",
} as const;

/**
 * Presentational banner (Card) showing the document chain (order → delivery →
 * invoice) and the primary next-step action button. Contains no business logic —
 * the parent component computes `links` and `nextStep`.
 */
export function DocumentFlow({
  links,
  nextStep,
  onAction,
  busy,
}: {
  links: DocumentFlowLink[];
  nextStep: NextStep;
  onAction: (kind: NextStepKind) => void;
  busy?: boolean;
}) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
        >
          {/* Linked-document chain */}
          <Box
            sx={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 0.5,
              overflowX: "auto",
            }}
          >
            {links.map((link, idx) => (
              <Box
                key={idx}
                sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
              >
                {idx > 0 && (
                  <ChevronRight
                    size={14}
                    color={colors.neutral[400]}
                    aria-hidden
                  />
                )}
                {link.href ? (
                  <Link
                    href={link.href}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{
                        ...mono,
                        color: link.current
                          ? colors.neutral[800]
                          : colors.primary[600],
                        fontWeight: link.current ? 700 : 500,
                        textDecoration: link.href ? "underline" : "none",
                        textUnderlineOffset: 2,
                        textDecorationColor: colors.primary[300],
                        "&:hover": {
                          color: colors.primary[700],
                        },
                      }}
                    >
                      {link.label}
                    </Typography>
                  </Link>
                ) : (
                  <Typography
                    component="span"
                    variant="body2"
                    sx={{
                      ...mono,
                      color: link.current
                        ? colors.neutral[800]
                        : colors.neutral[500],
                      fontWeight: link.current ? 700 : 400,
                    }}
                  >
                    {link.label}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>

          {/* Next-step action */}
          {nextStep.kind !== "none" && (
            <Button
              variant="contained"
              size="small"
              disabled={busy}
              onClick={() => onAction(nextStep.kind)}
              sx={{ whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {nextStep.label}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}
