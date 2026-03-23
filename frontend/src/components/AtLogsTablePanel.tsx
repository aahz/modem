import {
  ActionButton,
  ButtonGroup,
  Cell,
  Column,
  DialogTrigger,
  Heading,
  Popover,
  Row,
  StatusLight,
  Text,
  TableBody,
  TableHeader,
  TableView,
  TextArea,
} from "@react-spectrum/s2";
import { CommandLog } from "../types";

interface LogsTablePanelProps {
  logs: CommandLog[];
  canCleanup: boolean;
  onRefresh: () => void;
  onCleanup: () => void;
}

export function AtLogsTablePanel({
  logs,
  canCleanup,
  onRefresh,
  onCleanup,
}: LogsTablePanelProps) {
  return (
    <section className="panel panel-logs">
      <div className="panel-head">
        <Heading level={3}>Command log</Heading>
        <ButtonGroup>
          <ActionButton onPress={onRefresh}>Refresh</ActionButton>
          {canCleanup ? <ActionButton onPress={onCleanup}>Cleanup</ActionButton> : null}
        </ButtonGroup>
      </div>

      <div className="logs-table-wrap">
        <TableView density="compact" aria-label="Command logs">
          <TableHeader>
            <Column id="timing">Timing</Column>
            <Column id="command">Command</Column>
            <Column id="actor">Actor</Column>
            <Column id="details">Details</Column>
          </TableHeader>
          <TableBody items={logs}>
            {(item) => (
              <Row id={item.id}>
                <Cell>{item.created_at} / {item.duration_ms ? `${item.duration_ms} ms` : "-"}</Cell>
                <Cell>
                  <StatusLight variant={item.status === 'ok' ? 'positive' : 'negative'}>
                    {item.command}
                  </StatusLight>
                </Cell>
                <Cell>{item.actor_username}</Cell>
                <Cell>
                  <DialogTrigger>
                    <ActionButton size="XS">Details</ActionButton>
                    <Popover>
                      <div className="log-popover">
                        <Text>Actor: {item.actor_username} ({item.actor_role})</Text>
                        <Text>Command: <StatusLight variant={item.status === 'ok' ? 'positive' : 'negative'}>{item.command}</StatusLight></Text>
                        <Text>Status: {item.status}</Text>
                        <Text>Timing: {item.created_at} / {item.duration_ms ? `${item.duration_ms} ms` : "-"}</Text>
                        {item.response ? (
                            <TextArea label="Response" value={item.response} isReadOnly />
                        ) : null}
                        {item.error ? <Text>Error: {item.error}</Text> : null}
                      </div>
                    </Popover>
                  </DialogTrigger>
                </Cell>
              </Row>
            )}
          </TableBody>
        </TableView>
      </div>
    </section>
  );
}
