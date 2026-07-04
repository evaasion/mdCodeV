import { isRemoteProject } from "../lib/project-fs";
import type { RemoteServerSettings, ServerSettings } from "../lib/settings";
import type { ProjectInfo } from "../lib/tauri-fs";
import { useFxServer } from "./useFxServer";
import { useRemoteServer } from "./useRemoteServer";

export function useServerConsole(
  project: ProjectInfo | null,
  serverSettings: ServerSettings,
  remoteServerSettings: RemoteServerSettings,
) {
  const local = useFxServer(project, serverSettings);
  const remote = useRemoteServer(project, remoteServerSettings);

  if (isRemoteProject(project)) {
    return {
      ...remote,
      mode: "remote" as const,
      liveReload: remoteServerSettings.liveReload,
    };
  }

  return {
    ...local,
    mode: "local" as const,
    liveReload: serverSettings.liveReload,
    polling: false,
    refreshLogs: async () => undefined,
  };
}