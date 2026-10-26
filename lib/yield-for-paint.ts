/** Let React commit a loader and the browser paint before starting PDF work. */
export function yieldForPaint(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return new Promise((resolve) => {
    let frame: number | undefined;
    let afterFrame: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(fallback);
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (afterFrame !== undefined) clearTimeout(afterFrame);
      resolve();
    };
    // Hidden tabs may suspend animation frames. This is a fallback, not a delay.
    const fallback = setTimeout(finish, 100);
    frame = requestAnimationFrame(() => {
      frame = undefined;
      afterFrame = setTimeout(finish, 0);
    });
  });
}
