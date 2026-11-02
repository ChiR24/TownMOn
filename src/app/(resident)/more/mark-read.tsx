"use client";

import { useEffect } from "react";
import { markMessagesRead } from "@/app/actions";

/** Rendered only while there are unread messages: seeing the list clears the dot on the bell. */
export function MarkRead() {
  useEffect(() => {
    void markMessagesRead();
  }, []);
  return null;
}
