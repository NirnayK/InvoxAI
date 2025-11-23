import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileQueries } from "../files/queries";
import { FileCommands } from "../files/commands";
import { importFiles } from "../files/file-import";
import { createXmlForFiles, appendXmlFile, generateXmlFile } from "../xml";
import type { FileListQuery, FileStatus } from "../files/types";

export function useFiles(query: FileListQuery) {
  return useQuery({
    queryKey: ["files", query],
    queryFn: () => FileQueries.listFiles(query),
  });
}

export function useFileMutations() {
  const queryClient = useQueryClient();

  const invalidateFiles = () => {
    queryClient.invalidateQueries({ queryKey: ["files"] });
  };

  const importFilesMutation = useMutation({
    mutationFn: importFiles,
    onSuccess: invalidateFiles,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ fileId, status }: { fileId: string; status: FileStatus }) =>
      FileCommands.updateStatus(fileId, status),
    onSuccess: invalidateFiles,
  });

  const updateMultipleStatusMutation = useMutation({
    mutationFn: ({
      fileIds,
      status,
    }: {
      fileIds: string[];
      status: FileStatus;
    }) => FileCommands.updateMultipleStatus(fileIds, status),
    onSuccess: invalidateFiles,
  });

  const updateParsedDetailsMutation = useMutation({
    mutationFn: ({
      fileId,
      parsedDetails,
    }: {
      fileId: string;
      parsedDetails: string;
    }) => FileCommands.updateParsedDetails(fileId, parsedDetails),
    onSuccess: invalidateFiles,
  });

  const deleteFilesMutation = useMutation({
    mutationFn: FileCommands.deleteFiles,
    onSuccess: invalidateFiles,
  });

  const createXmlMutation = useMutation({
    mutationFn: ({
      fileIds,
      xmlName,
    }: {
      fileIds: string[];
      xmlName: string;
    }) => createXmlForFiles(fileIds, xmlName),
    onSuccess: () => {
      invalidateFiles();
      queryClient.invalidateQueries({ queryKey: ["xml-files"] });
    },
  });

  const appendXmlMutation = useMutation({
    mutationFn: ({ xmlId, fileIds }: { xmlId: number; fileIds: string[] }) =>
      appendXmlFile(xmlId, fileIds),
    onSuccess: () => {
      invalidateFiles();
      queryClient.invalidateQueries({ queryKey: ["xml-files"] });
    },
  });

  const generateXmlMutation = useMutation({
    mutationFn: generateXmlFile,
  });

  const processFilesMutation = useMutation({
    mutationFn: async ({
      files,
      options,
    }: {
      files: any[];
      options?: any;
    }) => {
      const { processFiles } = await import("../files/file-processing");
      return processFiles(files, options);
    },
    onSuccess: invalidateFiles,
  });

  return {
    importFiles: importFilesMutation,
    updateStatus: updateStatusMutation,
    updateMultipleStatus: updateMultipleStatusMutation,
    updateParsedDetails: updateParsedDetailsMutation,
    deleteFiles: deleteFilesMutation,
    createXml: createXmlMutation,
    appendXml: appendXmlMutation,
    generateXml: generateXmlMutation,
    processFiles: processFilesMutation,
  };
}
