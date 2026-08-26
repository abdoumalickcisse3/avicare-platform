/**
 * Rules-based client-creation parser — "nouveau client Modou Diop",
 * "ajoute un grossiste Sénégal Volaille". Pure, offline, deterministic.
 *
 * The timid one of the commerce set, and the only one that can be: creating a client commits
 * nothing — the worst case is a duplicate name the farmer sees on the confirmation card. It still
 * refuses anything it cannot read cleanly rather than filing a mangled name.
 */
import type { CreateClientIntent, ParseContext } from '../types';
import { normalize } from './util';

const CREATE_RE = /\b(nouveau client|nouvelle cliente|ajoute un client|ajouter un client|creer un client|nouveau grossiste|nouveau revendeur|ajoute un grossiste)\b/;

/** Domain enum names of the client type, matched on the word the farmer used. */
const TYPES: { re: RegExp; value: string }[] = [
  { re: /\b(grossiste|grossistes)\b/, value: 'WHOLESALER' },
  { re: /\b(societe|entreprise|restaurant|boutique|magasin|hotel)\b/, value: 'BUSINESS' },
];

/** Words that are part of the command, never part of the name. */
const COMMAND_WORDS =
  /^(nouveau|nouvelle|ajoute|ajouter|creer|cree|un|une|le|la|client|cliente|grossiste|revendeur|nomme|appele|qui s appelle|:)\s*/;

function nameOf(text: string, norm: string): string | null {
  const m = norm.match(CREATE_RE);
  if (m?.index == null) return null;

  let name = text.slice(m.index + m[0].length).trim();
  // Strip whatever leftover command words the phrasing put before the name.
  let previous = '';
  while (name !== previous) {
    previous = name;
    name = name.replace(COMMAND_WORDS, '').trim();
  }
  name = name.replace(/^[:,.\-–—]+/, '').trim();

  // A name is at least two characters and must contain a letter; digits alone are a misread.
  if (name.length < 2 || !/\p{L}/u.test(name)) return null;
  return name.slice(0, 120);
}

export const createClientParser = {
  parse(text: string, _ctx: ParseContext): CreateClientIntent | null {
    const norm = normalize(text);
    if (!CREATE_RE.test(norm)) return null;

    const displayName = nameOf(text, norm);
    if (displayName == null) return null;

    return {
      kind: 'CREATE_CLIENT',
      displayName,
      clientType: TYPES.find((t) => t.re.test(norm))?.value ?? 'INDIVIDUAL',
    };
  },
};
