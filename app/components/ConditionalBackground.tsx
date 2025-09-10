// components/ConditionalBackground.tsx
"use client";

import { useEffect, useState } from "react";
import BackgroundWrapper from "./BackgroundWrapper";

export default function ConditionalBackground() {
  const [isFirefox, setIsFirefox] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsFirefox(/firefox/i.test(navigator.userAgent));
    }
  }, []);

  return isFirefox ? <BackgroundWrapper /> : null;
}
