import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";

const serviceName = process.env.OTEL_SERVICE_NAME ?? "neo-api";

const traceExporter = new OTLPTraceExporter({
  // Compatible with most vendors; override via env if needed
  url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
});

export const otelSdk = new NodeSDK({
  serviceName,
  traceExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-http": {
        ignoreIncomingRequestHook: (req: { url?: string }) => {
          const url = req.url ?? "";
          return url.startsWith("/health") || url.startsWith("/ready");
        },
      },
      "@opentelemetry/instrumentation-pg": {
        requireParentSpan: true,
      },
    }),
  ],
});

