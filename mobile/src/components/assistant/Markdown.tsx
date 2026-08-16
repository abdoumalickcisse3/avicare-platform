/**
 * Minimal Markdown renderer for the Jawdi chat — dependency-free (RN 0.85 +
 * React 19 is ahead of the third-party markdown libs). Supports the subset the
 * advisor produces: headings, **bold**, *italic*, `code`, bullet/numbered
 * lists, blockquotes, and GFM tables — so answers read like a real chat with
 * developed stats and tables. Styled to the light advisor theme.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@/theme';

const INLINE = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`)/g;

/** Render a line of inline markdown to nested <Text> segments. */
function inline(text: string, k: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(<Text key={`${k}-t${i}`}>{text.slice(last, m.index)}</Text>);
    if (m[2] !== undefined || m[3] !== undefined) {
      out.push(<Text key={`${k}-b${i}`} style={styles.bold}>{m[2] ?? m[3]}</Text>);
    } else if (m[4] !== undefined || m[5] !== undefined) {
      out.push(<Text key={`${k}-i${i}`} style={styles.italic}>{m[4] ?? m[5]}</Text>);
    } else if (m[6] !== undefined) {
      out.push(<Text key={`${k}-c${i}`} style={styles.code}>{m[6]}</Text>);
    }
    last = m.index + m[0].length;
    i += 1;
  }
  if (last < text.length) out.push(<Text key={`${k}-t${i}`}>{text.slice(last)}</Text>);
  return out;
}

const isTableSep = (l: string) => /^\s*\|?[\s:|-]+\|?\s*$/.test(l) && l.includes('-');
const cells = (row: string) =>
  row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

function Table({ rows, k }: { rows: string[]; k: string }) {
  const header = cells(rows[0] ?? "");
  const body = rows.slice(2).map(cells);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableWrap}>
      <View style={styles.table}>
        <View style={[styles.tr, styles.trHead]}>
          {header.map((c, ci) => (
            <Text key={ci} style={[styles.cell, styles.th]}>{inline(c, `${k}-h${ci}`)}</Text>
          ))}
        </View>
        {body.map((row, ri) => (
          <View key={ri} style={styles.tr}>
            {header.map((_h, ci) => (
              <Text key={ci} style={[styles.cell, styles.td]}>{inline(row[ci] ?? '', `${k}-r${ri}c${ci}`)}</Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, '').split('\n');
  const at = (n: number): string => lines[n] ?? '';
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = at(i);
    if (line.trim() === '') {
      i += 1;
      continue;
    }
    // Table (header row + separator).
    if (line.trim().startsWith('|') && i + 1 < lines.length && isTableSep(at(i + 1))) {
      const rows: string[] = [];
      while (i < lines.length && at(i).trim().startsWith('|')) {
        rows.push(at(i));
        i += 1;
      }
      blocks.push(<Table key={`b${b++}`} rows={rows} k={`t${b}`} />);
      continue;
    }
    // Heading.
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = (h[1] ?? "").length;
      blocks.push(
        <Text key={`b${b++}`} style={[styles.h, lvl === 1 ? styles.h1 : lvl === 2 ? styles.h2 : styles.h3]}>
          {inline(h[2] ?? "", `h${b}`)}
        </Text>,
      );
      i += 1;
      continue;
    }
    // Blockquote.
    if (/^>\s?/.test(line)) {
      const q: string[] = [];
      while (i < lines.length && /^>\s?/.test(at(i))) {
        q.push(at(i).replace(/^>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <View key={`b${b++}`} style={styles.quote}>
          <Text style={styles.p}>{inline(q.join(' '), `q${b}`)}</Text>
        </View>,
      );
      continue;
    }
    // List (bullet or numbered).
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const items: { marker: string; content: string }[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(at(i))) {
        const mm = at(i).match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (mm) items.push({ marker: /\d/.test(mm[1] ?? "") ? (mm[1] ?? "") : '•', content: mm[2] ?? "" });
        i += 1;
      }
      blocks.push(
        <View key={`b${b++}`} style={styles.list}>
          {items.map((it, idx) => (
            <View key={idx} style={styles.li}>
              <Text style={styles.liMarker}>{it.marker}</Text>
              <Text style={[styles.p, styles.liText]}>{inline(it.content, `li${b}-${idx}`)}</Text>
            </View>
          ))}
        </View>,
      );
      continue;
    }
    // Paragraph (join consecutive plain lines).
    const para: string[] = [];
    while (
      i < lines.length &&
      at(i).trim() !== '' &&
      !at(i).trim().startsWith('|') &&
      !/^(#{1,3})\s/.test(at(i)) &&
      !/^>\s?/.test(at(i)) &&
      !/^\s*([-*]|\d+\.)\s+/.test(at(i))
    ) {
      para.push(at(i));
      i += 1;
    }
    blocks.push(
      <Text key={`b${b++}`} style={styles.p}>{inline(para.join(' '), `p${b}`)}</Text>,
    );
  }
  return <View style={styles.root}>{blocks}</View>;
}

const styles = StyleSheet.create({
  root: { gap: tokens.spacing[2] },
  p: { ...tokens.typography.bodyLg, color: tokens.colors.field.text },
  bold: { fontFamily: tokens.typography.button.fontFamily, color: tokens.colors.primary[700] },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: tokens.typography.numericSm.fontFamily, fontSize: 15, color: tokens.colors.primary[800] },
  h: { color: tokens.colors.field.text, fontFamily: tokens.typography.headingMd.fontFamily },
  h1: { fontSize: 20, lineHeight: 26 },
  h2: { fontSize: 18, lineHeight: 24 },
  h3: { fontSize: 16, lineHeight: 22 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: tokens.colors.primary[400],
    paddingLeft: tokens.spacing[3],
  },
  list: { gap: 4 },
  li: { flexDirection: 'row', gap: tokens.spacing[2] },
  liMarker: { ...tokens.typography.bodyLg, color: tokens.colors.primary[600] },
  liText: { flex: 1 },
  tableWrap: {
    borderWidth: 1,
    borderColor: 'rgba(36,85,36,0.14)',
    borderRadius: tokens.radii.md,
  },
  table: {},
  tr: { flexDirection: 'row' },
  trHead: { backgroundColor: 'rgba(36,85,36,0.07)' },
  cell: {
    minWidth: 96,
    paddingHorizontal: tokens.spacing[3],
    paddingVertical: tokens.spacing[2],
    borderColor: 'rgba(36,85,36,0.12)',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    ...tokens.typography.bodyMd,
    color: tokens.colors.field.text,
  },
  th: { fontFamily: tokens.typography.button.fontFamily, color: tokens.colors.field.text },
  td: {},
});
