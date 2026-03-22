import {
  ActionButton,
  ButtonGroup,
  Divider,
  Flex,
  Heading,
  Text,
  TextField,
  View,
} from "@adobe/react-spectrum";
import { CommandLog } from "../types";

interface LogsPanelProps {
  logs: CommandLog[];
  limit: string;
  onLimitChange: (value: string) => void;
  onRefresh: () => void;
}

export function LogsPanel({ logs, limit, onLimitChange, onRefresh }: LogsPanelProps) {
  return (
    <View backgroundColor="chartreuse-400" padding="size-200" borderRadius="medium">
      <Flex justifyContent="space-between" alignItems="center" gap="size-150" wrap>
        <Heading level={3}>Logs</Heading>
        <ButtonGroup>
          <ActionButton onPress={onRefresh}>
            <Text>Refresh</Text>
          </ActionButton>
          <TextField
            aria-label="Log limit"
            value={limit}
            onChange={onLimitChange}
            width="size-1200"
          />
        </ButtonGroup>
      </Flex>
      <Divider size="S" marginY="size-100" />
      <View maxHeight="size-4600" overflow="auto">
        {logs.map((log) => (
          <View
            key={log.id}
            borderBottomColor="gray-300"
            borderBottomWidth="thin"
            paddingY="size-100"
          >
            <Text>
              [{log.created_at}] {log.actor_username} ({log.actor_role}) {log.command} -{" "}
              {log.status}
              {log.duration_ms ? ` (${log.duration_ms}ms)` : ""}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
