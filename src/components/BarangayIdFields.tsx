"use client";

import { documentValidity, type DocumentEvidence } from "@/lib/documents";
import { Input } from "./ui/input";

export function BarangayIdFields({
  value,
  onChange,
  prefix,
}: {
  value: DocumentEvidence;
  onChange: (value: DocumentEvidence) => void;
  prefix: string;
}) {
  const validity = documentValidity(value);
  return (
    <fieldset className="space-y-3 rounded-2xl border-2 border-civic bg-card p-4">
      <legend className="px-1 text-sm font-bold">
        Your Barangay ID details
      </legend>
      <p role="status" className="text-sm font-semibold">
        {validity.status === "valid"
          ? "Validity recorded"
          : validity.status === "expired"
            ? "Expired"
            : "Needs confirmation"}{" "}
        — {validity.reason}
      </p>
      <div className="space-y-1">
        <label htmlFor={`${prefix}-issue`} className="text-sm font-bold">
          Issue date
          {value.noPrintedExpiry
            ? " (required when no expiry is printed)"
            : " (if known)"}
        </label>
        <Input
          id={`${prefix}-issue`}
          type="date"
          value={value.issuedOn ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              issuedOn: e.target.value || undefined,
              validityConfirmed: false,
            })
          }
        />
      </div>
      <label className="flex min-h-11 items-start gap-3 py-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 accent-civic"
          checked={!!value.noPrintedExpiry}
          onChange={(e) =>
            onChange({
              ...value,
              noPrintedExpiry: e.target.checked,
              expiresOn: undefined,
              validityConfirmed: false,
            })
          }
        />
        No expiry date is printed on this card
      </label>
      {!value.noPrintedExpiry ? (
        <div className="space-y-1">
          <label htmlFor={`${prefix}-expiry`} className="text-sm font-bold">
            Printed expiry date
          </label>
          <Input
            id={`${prefix}-expiry`}
            type="date"
            value={value.expiresOn ?? ""}
            onChange={(e) =>
              onChange({
                ...value,
                expiresOn: e.target.value || undefined,
                validityConfirmed: false,
              })
            }
          />
        </div>
      ) : (
        <label className="flex min-h-11 items-start gap-3 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-civic"
            checked={!!value.validityConfirmed}
            onChange={(e) =>
              onChange({ ...value, validityConfirmed: e.target.checked })
            }
          />
          I confirmed with the issuing barangay that this card is still valid
        </label>
      )}
      <p className="text-xs text-muted-foreground">
        Confirm the details below for the application where you will use this
        card. No validity period is assumed for a card without a printed expiry.
      </p>
      {(
        [
          [
            "photoSignature",
            "The card bears both my photo and my signature (PSAHelpline)",
          ],
          [
            "philsysFields",
            "The card shows my full name, photo, signature/thumbmark, permanent address and date of birth (PhilSys)",
          ],
          [
            "addressCurrent",
            "The residential address on the card matches my current application address (Postal ID)",
          ],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="flex min-h-11 items-start gap-3 py-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-5 shrink-0 accent-civic"
            checked={value[key] === true}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
    </fieldset>
  );
}
