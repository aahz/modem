import {
  ActionButton,
  ButtonGroup,
  Divider,
  Heading,
  Text,
  TextField,
} from "@react-spectrum/s2";
import { CommandLog } from "../types";

interface LogsPanelProps {
  logs: CommandLog[];
  limit: string;
  onLimitChange: (value: string) => void;
  onRefresh: () => void;
  onCleanup: () => void;
  canCleanup: boolean;
}

export function LogsPanel({
  logs,
  limit,
  onLimitChange,
  onRefresh,
  onCleanup,
  canCleanup,
}: LogsPanelProps) {
  return (
    <div style={{ background: "#ecffd2", padding: "16px", borderRadius: "8px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <Heading level={3}>Logs</Heading>
        <ButtonGroup>
          <ActionButton onPress={onRefresh}>
            <Text>Refresh</Text>
          </ActionButton>
          {canCleanup ? (
            <ActionButton onPress={onCleanup}>
              <Text>Cleanup</Text>
            </ActionButton>
          ) : null}
          <TextField
            aria-label="Log limit"
            value={limit}
            onChange={onLimitChange}
            width="size-1200"
          />
        </ButtonGroup>
      </div>
      <Divider size="S" marginY="size-100" />
      <div style={{ maxHeight: "480px", overflow: "auto" }}>
        {logs.map((log) => (
          <div
            key={log.id}
            style={{
              borderBottom: "1px solid #d1d5db",
              paddingTop: "8px",
              paddingBottom: "8px",
            }}
          >
            <Text>
              [{log.created_at}] {log.actor_username} ({log.actor_role}) {log.command} -{" "}
              {log.status}
              {log.duration_ms ? ` (${log.duration_ms}ms)` : ""}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}
