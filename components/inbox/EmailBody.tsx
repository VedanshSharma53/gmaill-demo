"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  hasMeaningfulHtml,
  plainTextToHtml,
  wrapEmailHtmlDocument,
} from "@/lib/email/render";

interface EmailBodyProps {
  bodyHtml: string | null;
  bodyText: string | null;
  snippet?: string | null;
  className?: string;
}

export function EmailBody({
  bodyHtml,
  bodyText,
  snippet,
  className,
}: EmailBodyProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);

  const srcDoc = hasMeaningfulHtml(bodyHtml)
    ? wrapEmailHtmlDocument(bodyHtml!)
    : plainTextToHtml(bodyText ?? snippet ?? "");

  const resizeIframe = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    const nextHeight = iframe.contentDocument.documentElement.scrollHeight;
    setHeight(Math.max(80, nextHeight + 8));
  }, []);

  useEffect(() => {
    resizeIframe();
  }, [srcDoc, resizeIframe]);

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        title="Email content"
        sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        onLoad={resizeIframe}
        className="w-full border-0 rounded-md bg-white"
        style={{ height, minHeight: 80 }}
      />
    </div>
  );
}
