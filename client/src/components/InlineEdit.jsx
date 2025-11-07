import React, { useState, useEffect, useRef } from "react";

export function InlineEdit({
  value,
  onChange,
  className = "",
  type = "text",
  onBlur,
  editValue, // Optional: different value to show when editing starts
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(tempValue);
    setIsEditing(false);
    if (onBlur) onBlur();
  };

  if (!isEditing) {
    return (
      <div
        className={`cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-2 py-1 transition-colors ${className}`}
        onClick={() => {
          // Use editValue if provided, otherwise use value
          setTempValue(editValue !== undefined ? editValue : value);
          setIsEditing(true);
        }}
      >
        {value || "—"}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      className={`border-2 border-blue-400 dark:border-blue-500 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100 ${className}`}
      value={tempValue}
      onChange={(e) => {
        // For text inputs, keep the value as string to preserve +/- prefixes
        const newValue = type === "number" ? Number(e.target.value) : e.target.value;
        setTempValue(newValue);
      }}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
          setTempValue(editValue !== undefined ? editValue : value);
          setIsEditing(false);
        }
      }}
    />
  );
}
