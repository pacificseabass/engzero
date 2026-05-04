export type MemoryUpdateRef = {
  id: string;
  type:
    | "failure_note"
    | "lesson"
    | "proposed_rule"
    | "decision"
    | "deployment_log"
    | "change_set_summary";
  obsidianPath: string;
  summary: string;
};
