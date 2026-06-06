"use client";

import { useState } from "react";
import {
  IconButton,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from "@mui/material";
import { Eye, EyeOff, Lock } from "lucide-react";

/**
 * Outlined password field with a show/hide toggle (lucide eye) and a lock
 * start-adornment, matching the Stitch auth designs. Spreads through to MUI
 * TextField, so it plugs straight into a react-hook-form Controller field.
 */
export function PasswordField(props: TextFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <TextField
      {...props}
      type={show ? "text" : "password"}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <Lock size={18} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShow((s) => !s)}
                edge="end"
                tabIndex={-1}
                aria-label={
                  show ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
