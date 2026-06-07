"use client";

import React, { createContext, useContext, useState } from "react";

type FormContextType = {
  values: Record<string, any>;
  errors: Record<string, string>;
  setValue: (name: string, value: any) => void;
  setError: (name: string, error: string) => void;
  clearError: (name: string) => void;
};

const FormContext = createContext<FormContextType | null>(null);

export function useFormContext() {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error("Form components must be used inside <Form>");
  return ctx;
}

type FormProps = {
  defaultValues?: Record<string, any>;
  onSubmit: (values: Record<string, any>) => void | Promise<void>;
  children: React.ReactNode;
  className?: string;
};

export default function Form({
  defaultValues = {},
  onSubmit,
  children,
  className = "",
}: FormProps) {
  const [values, setValues] = useState<Record<string, any>>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (name: string, value: any) => {
    setValues((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const setError = (name: string, error: string) => {
    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));
  };

  const clearError = (name: string) => {
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
  };

  return (
    <FormContext.Provider
      value={{ values, errors, setValue, setError, clearError }}
    >
      <form onSubmit={handleSubmit} className={`w-full ${className}`}>
        {children}
      </form>
    </FormContext.Provider>
  );
}