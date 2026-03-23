import { Button, Heading, TextArea, TextField } from "@react-spectrum/s2";

interface AtCommandsPanelProps {
  command: string;
  timeoutMs: string;
  response: string;
  onCommandChange: (value: string) => void;
  onTimeoutChange: (value: string) => void;
  onResponseChange: (value: string) => void;
  onSend: () => void;
}

export function AtCommandsPanel(props: AtCommandsPanelProps) {
  return (
    <div style={{ background: "#e7f2ff", padding: "16px", borderRadius: "8px" }}>
      <Heading level={3}>AT Commands</Heading>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <TextField
          label="Command"
          value={props.command}
          onChange={props.onCommandChange}
          width="100%"
          UNSAFE_className="modem-field-wide"
        />
        <TextField
          label="Timeout (ms)"
          value={props.timeoutMs}
          onChange={props.onTimeoutChange}
          width="size-1600"
          UNSAFE_className="modem-field-compact"
        />
        <Button variant="accent" onPress={props.onSend}>
          Send
        </Button>
      </div>
      <TextArea
        label="Response"
        value={props.response}
        onChange={props.onResponseChange}
        minHeight="size-1200"
        width="100%"
      />
    </div>
  );
}
