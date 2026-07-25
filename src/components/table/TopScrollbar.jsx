import React, { useRef, useState, useEffect, useCallback } from "react";

/**
 * يضيف شريط تمرير أفقي أعلى المحتوى متزامنًا مع شريط التمرير السفلي.
 * يظهر فقط عند الحاجة (عندما يتجاوز المحتوى العرض).
 */
export function TopScrollbar({ children, className = "" }) {
  const topRef = useRef(null);
  const contentRef = useRef(null);
  const [spacerWidth, setSpacerWidth] = useState(0);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const update = () => {
      setSpacerWidth(el.scrollWidth);
      setNeedsScroll(el.scrollWidth > el.clientWidth + 1);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const table = el.querySelector("table");
    if (table) ro.observe(table);
    return () => ro.disconnect();
  }, []);

  const syncFromTop = useCallback(() => {
    if (contentRef.current && topRef.current) {
      contentRef.current.scrollLeft = topRef.current.scrollLeft;
    }
  }, []);

  const syncFromContent = useCallback(() => {
    if (topRef.current && contentRef.current) {
      topRef.current.scrollLeft = contentRef.current.scrollLeft;
    }
  }, []);

  return (
    <div className={className}>
      <div
        ref={topRef}
        onScroll={syncFromTop}
        className={`overflow-x-auto overflow-y-hidden ${needsScroll ? "" : "hidden"}`}
      >
        <div style={{ width: spacerWidth, height: 12 }} />
      </div>
      <div ref={contentRef} onScroll={syncFromContent} className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}