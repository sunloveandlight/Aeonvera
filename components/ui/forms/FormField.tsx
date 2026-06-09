"use client";

import React, { useEffect } from "react";
import Field from "./Field";
import { useFormContext } from "./Form";

type FormFieldProps = {
  name: string;
  label?: string;
  hint?: string;
  required?: boolean;
  children: (props: {
    value: unknown;
    onChange: (value: unknown) => void;
  }) => React.ReactNode;
  validate?: (value: unknown) => string | null;
};

export default function FormField({
  name,
  label,
  hint,
  required,
  children,
  validate,
}: FormFieldProps) {
  const { values, errors, setValue, setError, clearError } =
    useFormContext();

  const value = values[name];
  const error = errors[name];

  const handleChange = (val: unknown) => {
    setValue(name, val);

    if (validate) {
      const result = validate(val);
      if (result) setError(name, result);
      else clearError(name);
    }
  };

  useEffect(() => {
    if (validate && value !== undefined) {
      const result = validate(value);
      if (result) setError(name, result);
      else clearError(name);
    }
  }, [clearError, name, setError, validate, value]);

  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {children({
        value,
        onChange: handleChange,
      })}
    </Field>
  );
}
