"use client";

import { useEffect, useRef } from "react";
import { OperationGate } from "./operation";

export function useOperationGate(): OperationGate {
  const ref = useRef<OperationGate>();
  if (!ref.current) ref.current = new OperationGate();
  const gate = ref.current;
  useEffect(() => () => gate.invalidate(), [gate]);
  return gate;
}
