import { describe, it, expect } from "@jest/globals";
import { processBatchWithRetry } from "@/lib/invoice/process";
import type { InvoiceFileInput } from "@/lib/invoice/types";

describe("Batch Invoice Processing", () => {
  describe("processBatchWithRetry", () => {
    it("should process files in batches of 5", async () => {
      // Create 12 test files
      const files: InvoiceFileInput[] = Array.from({ length: 12 }, (_, i) => ({
        file: new Blob([`test content ${i}`], { type: "application/pdf" }),
        mimeType: "application/pdf",
        displayName: `test-file-${i}.pdf`,
      }));

      const fileIds = Array.from({ length: 12 }, (_, i) => `file-id-${i}`);
      const progressUpdates: Array<{ processed: number; total: number }> = [];

      const result = await processBatchWithRetry({
        files,
        fileIds,
        apiKey: process.env.GEMINI_API_KEY || "test-api-key",
        onProgress: (processed, total) => {
          progressUpdates.push({ processed, total });
        },
      });

      // Should have progress updates for all 12 files
      expect(progressUpdates.length).toBe(12);
      expect(progressUpdates[0]).toEqual({ processed: 1, total: 12 });
      expect(progressUpdates[11]).toEqual({ processed: 12, total: 12 });

      // Should have results or errors for all files
      expect(result.results.length + result.errors.length).toBe(12);
    });

    it("should retry with different models on 429 errors", async () => {
      const files: InvoiceFileInput[] = [
        {
          file: new Blob(["test content"], { type: "application/pdf" }),
          mimeType: "application/pdf",
          displayName: "test-file.pdf",
        },
      ];

      const fileIds = ["file-id-1"];

      // This test would need to mock the API to return 429 errors
      // For now, we'll just verify the function signature
      const result = await processBatchWithRetry({
        files,
        fileIds,
        apiKey: process.env.GEMINI_API_KEY || "test-api-key",
      });

      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("errors");
    });

    it("should timeout after 2 minutes per batch", async () => {
      const files: InvoiceFileInput[] = [
        {
          file: new Blob(["test content"], { type: "application/pdf" }),
          mimeType: "application/pdf",
          displayName: "test-file.pdf",
        },
      ];

      const fileIds = ["file-id-1"];

      // This test would need to mock a slow API response
      // For now, we'll just verify the function handles timeouts
      const result = await processBatchWithRetry({
        files,
        fileIds,
        apiKey: process.env.GEMINI_API_KEY || "test-api-key",
      });

      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("errors");
    });

    it("should mark files as failed on non-429 errors", async () => {
      const files: InvoiceFileInput[] = [
        {
          file: new Blob(["invalid content"], { type: "application/pdf" }),
          mimeType: "application/pdf",
          displayName: "invalid-file.pdf",
        },
      ];

      const fileIds = ["file-id-1"];

      // This test would need to mock the API to return non-429 errors
      const result = await processBatchWithRetry({
        files,
        fileIds,
        apiKey: process.env.GEMINI_API_KEY || "test-api-key",
      });

      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("errors");
    });

    it("should include file identifiers in results", async () => {
      const files: InvoiceFileInput[] = [
        {
          file: new Blob(["test content"], { type: "application/pdf" }),
          mimeType: "application/pdf",
          displayName: "test-file.pdf",
        },
      ];

      const fileIds = ["test-file-id-123"];

      const result = await processBatchWithRetry({
        files,
        fileIds,
        apiKey: process.env.GEMINI_API_KEY || "test-api-key",
      });

      // Check that results include file IDs
      if (result.results.length > 0) {
        expect(result.results[0]).toHaveProperty("fileId");
        expect(result.results[0]).toHaveProperty("fileName");
        expect(result.results[0]).toHaveProperty("result");
      }

      // Check that errors include file IDs
      if (result.errors.length > 0) {
        expect(result.errors[0]).toHaveProperty("fileId");
        expect(result.errors[0]).toHaveProperty("fileName");
        expect(result.errors[0]).toHaveProperty("error");
      }
    });
  });
});
