import type { Instrumentation } from "next";

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  console.error(
    JSON.stringify({
      type: "request_error",
      method: request.method,
      route: context.routePath,
      routeType: context.routeType,
      errorType: error instanceof Error ? error.name : "UnknownError",
      digest:
        error && typeof error === "object" && "digest" in error
          ? error.digest
          : undefined,
      at: new Date().toISOString(),
    }),
  );
};
