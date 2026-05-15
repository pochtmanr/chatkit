import { CodeTabs, type CodeTab } from "./CodeTabs";

// Re-export under the historical name so the landing-page Install
// section keeps importing `InstallTabs`. The implementation is now the
// generic `CodeTabs` in this folder.
export type InstallTab = CodeTab;
export const InstallTabs = CodeTabs;
