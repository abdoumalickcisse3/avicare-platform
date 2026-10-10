"use client";

/**
 * A phone field that knows which country it is in.
 *
 * Port of the mobile `PhoneInput`, same contract: the value in and out is always E.164
 * (`+221771842787`). Before this, every phone field was a free-text `TextField` and the backend
 * guessed the country from the digits — it guessed wrong on 2026-10-02, read three Beninese
 * numbers as Senegalese ones, and eighteen WhatsApp alerts went nowhere. The country is chosen
 * now, not inferred.
 */
import { useMemo, useState } from "react";
import { MenuItem, Select, Stack, TextField } from "@mui/material";
import { COUNTRIES, type Country, splitE164, toE164 } from "@/lib/phone/countries";

export function PhoneField({
  value,
  onChange,
  label = "Téléphone",
  helperText,
  error,
  fullWidth = true,
}: {
  value: string | null | undefined;
  onChange: (e164: string) => void;
  label?: string;
  helperText?: string;
  error?: boolean;
  fullWidth?: boolean;
}) {
  const parsed = useMemo(() => splitE164(value), [value]);
  // Held locally so clearing the number does not reset the flag the user just picked: an empty
  // value carries no country of its own.
  const [country, setCountry] = useState<Country>(parsed.country);
  const current = value ? parsed.country : country;

  const pick = (iso: string) => {
    const next = COUNTRIES.find((c) => c.iso === iso) ?? current;
    setCountry(next);
    onChange(toE164(next, parsed.local));
  };

  /**
   * People paste their whole number, '+221 77 123 45 67' and all. Treating that as the subscriber
   * part doubles the country code and rebuilds the very sixteen-digit shape that broke WhatsApp.
   * A leading '+' is unambiguous, so it is read as a full number and the picker follows it.
   */
  const typed = (text: string) => {
    if (text.trim().startsWith("+")) {
      const full = splitE164(text);
      setCountry(full.country);
      onChange(toE164(full.country, full.local));
      return;
    }
    onChange(toE164(current, text));
  };

  return (
    // `flex-start`, not the flex default: a row stretches its children to the tallest one, so the
    // helper text appearing under the number would silently make the indicative 22px taller than
    // the field it sits next to. Top-aligned, the message hangs below without moving anything.
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: "flex-start", width: fullWidth ? "100%" : undefined }}
    >
      <Select
        value={current.iso}
        onChange={(e) => pick(e.target.value)}
        // Same height as the field beside it. The theme puts every TextField on `size: "small"`
        // (40px); a Select states its own size and would otherwise sit at MUI's 56px default,
        // which is how the indicative ended up overhanging the number by 16px.
        size="small"
        inputProps={{ "aria-label": `Indicatif pays : ${current.name}` }}
        renderValue={(iso) => {
          const c = COUNTRIES.find((x) => x.iso === iso) ?? current;
          return `${c.flag} +${c.dial}`;
        }}
        sx={{ minWidth: 120, flexShrink: 0 }}
      >
        {COUNTRIES.map((c) => (
          <MenuItem key={c.iso} value={c.iso}>
            {c.flag}&nbsp;&nbsp;{c.name}&nbsp;&nbsp;
            <span style={{ opacity: 0.6 }}>+{c.dial}</span>
          </MenuItem>
        ))}
      </Select>
      <TextField
        label={label}
        value={parsed.local}
        onChange={(e) => typed(e.target.value)}
        placeholder={current.example}
        helperText={helperText}
        error={error}
        fullWidth
        slotProps={{ htmlInput: { inputMode: "tel" } }}
      />
    </Stack>
  );
}
